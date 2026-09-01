import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { Message } from '../../messaging/entities/message.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';
import { Question } from '../../questions/entities/question.entity';
import { Order } from '../../orders/entities/order.entity';
import { MercadoLivreService } from './mercadolivre.service';
import { TokenEncryptionService } from '../../../common/crypto/token-encryption.service';

interface MlOrder {
  id: number;
  pack_id?: number;
  status: string;
  date_created: string;
  total_amount?: number;
  currency_id?: string;
  buyer: {
    id: number;
    nickname: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  order_items?: {
    item: { id: string; title: string };
    quantity: number;
    unit_price: number;
  }[];
  shipping?: {
    id: number;
    status: string;
    tracking_number?: string;
    logistic_type?: string;
  };
}

interface MlMessage {
  id: string;
  from: { user_id: number };
  to: { user_id: number };
  // API retorna text como string direta (não objeto)
  text: string | { plain: string };
  message_date: { received: string };
}

interface MlClaim {
  id: number;
  reason_id: string;
  status: string;
  date_created: string;
  resource_id?: number;
  order_id?: number;
}

interface MlQuestion {
  id: number;
  item_id: string;
  seller_id: number;
  from: { id: number; answered_questions: number };
  text: string;
  status: string;
  date_created: string;
  answer?: { text: string; date_created: string };
}

@Injectable()
export class MlSyncService {
  private readonly logger = new Logger(MlSyncService.name);

  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async syncForTenant(tenantId: string): Promise<{
    accounts: number;
    messages: number;
    complaints: number;
    questions: number;
    orders: number;
    errors: string[];
  }> {
    const accounts = await this.accountRepo.find({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
    });

    if (!accounts.length) {
      this.logger.warn(`Nenhuma conta ML ativa para tenant=${tenantId}`);
      return {
        accounts: 0,
        messages: 0,
        complaints: 0,
        questions: 0,
        orders: 0,
        errors: ['Nenhuma conta Mercado Livre ativa encontrada'],
      };
    }

    let totalMessages = 0;
    let totalComplaints = 0;
    let totalQuestions = 0;
    let totalOrders = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const accessToken = await this.getValidToken(account);
        this.logger.log(
          `Token OK para seller=${account.sellerId}. Iniciando sync...`,
        );

        const [messages, complaints, questions, orders] = await Promise.all([
          this.syncMessages(account, accessToken),
          this.syncComplaints(account, accessToken),
          this.syncQuestions(account, accessToken),
          this.syncOrders(account, accessToken),
        ]);
        totalMessages += messages;
        totalComplaints += complaints;
        totalQuestions += questions;
        totalOrders += orders;

        await this.accountRepo.update(account.id, { lastSyncAt: new Date() });
        this.logger.log(
          `Conta ${account.sellerId} OK — msg=${messages} rec=${complaints} perguntas=${questions} pedidos=${orders}`,
        );
      } catch (err) {
        const msg = `Conta seller=${account.sellerId}: ${(err as Error).message}`;
        this.logger.error(`Erro ao sincronizar ${msg}`);
        errors.push(msg);
      }
    }

    this.logger.log(
      `Sync ML concluído — tenant=${tenantId} messages=${totalMessages} complaints=${totalComplaints} questions=${totalQuestions} orders=${totalOrders} errors=${errors.length}`,
    );

    return {
      accounts: accounts.length,
      messages: totalMessages,
      complaints: totalComplaints,
      questions: totalQuestions,
      orders: totalOrders,
      errors,
    };
  }

  // ─── Mensagens ──────────────────────────────────────────────────────────────

  private async syncMessages(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    let synced = 0;
    try {
      // 1) Lista as conversas que REALMENTE têm mensagem (endpoint de não
      //    lidas). Esses packs não sofrem o bloqueio de Full.
      const unreadPackIds = new Set<string>();
      try {
        const unread = (await this.mlService.getUnreadMessages(
          accessToken,
        )) as { results?: { resource?: string; count?: number }[] };
        for (const r of unread?.results ?? []) {
          const match = /\/packs\/(\d+)\//.exec(r?.resource ?? '');
          if (match) unreadPackIds.add(match[1]);
        }
      } catch (unreadErr) {
        this.logger.warn(
          `Falha ao buscar não lidas: ${(unreadErr as Error).message}`,
        );
      }
      this.logger.log(
        `Mensagens: ${unreadPackIds.size} conversas com mensagem (não lidas) para seller=${account.sellerId}`,
      );

      // 2) Busca pedidos recentes só para enriquecer nome do comprador/produto.
      let offset = 0;
      let hasMore = true;
      const allOrders: MlOrder[] = [];
      while (hasMore && offset < 200) {
        const ordersData = (await this.mlService.getOrders(
          accessToken,
          account.sellerId,
          90,
          offset,
        )) as { results: MlOrder[]; paging: any };
        const pageOrders = ordersData?.results ?? [];
        allOrders.push(...pageOrders);
        if (
          pageOrders.length < 50 ||
          offset + pageOrders.length >= (ordersData?.paging?.total ?? 0)
        ) {
          hasMore = false;
        } else {
          offset += 50;
        }
      }

      // Mapa pack_id -> pedido (usa pack_id e o próprio order_id como chave)
      const orderByPack = new Map<string, MlOrder>();
      for (const order of allOrders) {
        if (order.pack_id) orderByPack.set(String(order.pack_id), order);
        orderByPack.set(String(order.id), order);
      }

      // 3) Packs a processar: os não lidos primeiro (têm mensagem garantida),
      //    depois os dos pedidos recentes (cobre conversas já lidas).
      const packsToProcess = new Set<string>(unreadPackIds);
      for (const order of allOrders) {
        packsToProcess.add(String(order.pack_id ?? order.id));
      }

      this.logger.log(
        `Mensagens: processando ${packsToProcess.size} packs (${allOrders.length} pedidos) para seller=${account.sellerId}`,
      );

      for (const packId of packsToProcess) {
        try {
          const messagesData = (await this.mlService.getMessages(
            accessToken,
            packId,
            account.sellerId,
          )) as { messages: MlMessage[] };
          const mlMessages = messagesData?.messages ?? [];
          if (!mlMessages.length) continue;
          // Descobre o pedido da conversa (comprador/produto) — usa o pedido
          // recente se já temos; senão busca pelo pack no ML.
          let order = orderByPack.get(packId);
          if (!order) {
            order = await this.resolveOrderFromPack(accessToken, packId);
          }
          synced += await this.savePackMessages(
            account,
            accessToken,
            packId,
            mlMessages,
            order,
          );
        } catch (packErr) {
          this.logger.warn(
            `Mensagens pack=${packId} ignoradas: ${(packErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar mensagens: ${(err as Error).message}`);
    }
    return synced;
  }

  /**
   * Salva as mensagens de um pack. O pedido (order) é opcional — quando
   * disponível, enriquece com nome do comprador e título do produto.
   */
  private async savePackMessages(
    account: MarketplaceAccount,
    accessToken: string,
    packId: string,
    mlMessages: MlMessage[],
    order?: MlOrder,
  ): Promise<number> {
    let saved = 0;
    mlMessages.sort(
      (a, b) =>
        new Date(a.message_date.received).getTime() -
        new Date(b.message_date.received).getTime(),
    );

    const sellerId = Number(account.sellerId);
    const buyerFullName = order
      ? `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim()
      : '';
    const buyerName = order?.buyer?.nickname || buyerFullName || 'Cliente';
    const itemTitle = order?.order_items?.[0]?.item?.title ?? undefined;
    const orderId = order ? String(order.id) : undefined;
    const orderStatus = order?.status ?? undefined;
    const shippingStatus = order?.shipping?.status ?? undefined;
    let logisticType = order?.shipping?.logistic_type ?? undefined;
    if (!logisticType && order?.shipping?.id) {
      try {
        const shipment = (await this.mlService.getShipment(
          accessToken,
          String(order.shipping.id),
        )) as { logistic_type?: string; logistic?: { type?: string } };
        logisticType =
          shipment?.logistic_type ?? shipment?.logistic?.type ?? undefined;
        this.logger.warn(
          `[logistic] pack=${packId} shipment=${order.shipping.id} type=${logisticType} raw=${JSON.stringify(shipment).slice(0, 250)}`,
        );
      } catch (shipErr) {
        this.logger.warn(
          `[logistic] pack=${packId} shipment=${order.shipping.id} ERRO: ${(shipErr as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `[logistic] pack=${packId} sem shipping.id (order=${order ? 'ok' : 'nulo'}) logisticFromOrder=${logisticType}`,
      );
    }

    for (const msg of mlMessages) {
      const externalId = String(msg.id);
      const sender = msg.from?.user_id === sellerId ? 'vendedor' : 'cliente';
      const buyerId = String(
        msg.from?.user_id === sellerId ? msg.to?.user_id : msg.from?.user_id,
      );
      const content = (
        typeof msg.text === 'string'
          ? msg.text
          : ((msg.text as any)?.plain ?? '')
      ).trim();

      if (sender === 'vendedor') {
        await this.messageRepo.update(
          {
            packId,
            tenantId: account.tenantId,
            sender: 'cliente',
            status: 'pending',
          },
          { status: 'replied' },
        );
      }

      const exists = await this.messageRepo.findOne({
        where: { externalId, tenantId: account.tenantId },
      });
      if (exists) {
        const updates: Record<string, unknown> = {};
        if (
          (!exists.buyerName || exists.buyerName === 'Cliente') &&
          buyerName !== 'Cliente'
        )
          updates.buyerName = buyerName;
        if (!exists.itemTitle && itemTitle) updates.itemTitle = itemTitle;
        if (orderStatus) updates.orderStatus = orderStatus;
        if (shippingStatus) updates.shippingStatus = shippingStatus;
        if (logisticType) updates.logisticType = logisticType;
        if (!exists.content && content && sender === 'cliente') {
          updates.content = content;
          updates.status = 'pending';
        }
        if (Object.keys(updates).length)
          await this.messageRepo.update(exists.id, updates);
        continue;
      }

      const isAutoNotification = sender === 'cliente' && content === '';
      const slaDeadline = new Date(msg.message_date?.received ?? Date.now());
      slaDeadline.setHours(slaDeadline.getHours() + 48);

      await this.messageRepo.save({
        tenantId: account.tenantId,
        marketplaceAccountId: account.id,
        orderId,
        packId,
        externalId,
        buyerId,
        buyerName,
        itemTitle,
        sender,
        content,
        orderStatus,
        shippingStatus,
        logisticType,
        status:
          sender === 'vendedor' || isAutoNotification ? 'replied' : 'pending',
        slaDeadline,
      });
      saved++;
    }
    return saved;
  }

  /**
   * Descobre o pedido de uma conversa a partir do pack_id.
   * Tenta o pack como order_id (pedidos de item único) e, se falhar,
   * busca o pack para pegar o primeiro pedido que o compõe.
   */
  private async resolveOrderFromPack(
    accessToken: string,
    packId: string,
  ): Promise<MlOrder | undefined> {
    try {
      const direct = (await this.mlService.getOrderById(
        accessToken,
        packId,
      )) as MlOrder;
      if (direct?.id) return direct;
    } catch {
      /* não era um order_id — tenta como pack abaixo */
    }
    try {
      const pack = (await this.mlService.getPack(accessToken, packId)) as {
        orders?: { id: number }[];
      };
      const orderId = pack?.orders?.[0]?.id;
      if (orderId) {
        return (await this.mlService.getOrderById(
          accessToken,
          String(orderId),
        )) as MlOrder;
      }
    } catch {
      /* segue sem enriquecer */
    }
    return undefined;
  }

  // ─── Reclamações ────────────────────────────────────────────────────────────

  private async syncComplaints(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    let synced = 0;
    try {
      const data = (await this.mlService.getClaims(
        accessToken,
        account.sellerId,
      )) as { results: MlClaim[] };
      const claims = data?.results ?? [];
      this.logger.log(
        `Reclamações: ${claims.length} para seller=${account.sellerId}`,
      );

      // Helpers de reason compartilhados
      const RETURN_REASONS = [
        'PDD',
        'ITEM_NOT_AS_DESCRIBED',
        'WANTS_RETURN',
        'PRODUCT_DAMAGED',
      ];
      const REASON_MAP: Record<string, string> = {
        PNR: 'Produto não recebido',
        PDD: 'Produto diferente ou danificado',
        WANTS_RETURN: 'Cliente solicita devolução',
        ITEM_NOT_AS_DESCRIBED: 'Item diferente do anúncio',
        PRODUCT_DAMAGED: 'Produto danificado',
      };
      const resolveReason = (reasonId: string) => {
        const prefix = reasonId.split(/\d/)[0];
        return (
          REASON_MAP[prefix] ??
          REASON_MAP[reasonId] ??
          reasonId ??
          'Reclamação do Mercado Livre'
        );
      };

      for (const claim of claims) {
        const externalId = String(claim.id);
        const exists = await this.complaintRepo.findOne({
          where: { externalId, tenantId: account.tenantId },
        });

        // Detecta se é uma devolução pelos reason_id do ML
        const isReturn = RETURN_REASONS.some((r) =>
          (claim.reason_id ?? '').startsWith(r),
        );
        const reason = resolveReason(claim.reason_id ?? '');

        // Atualiza campos novos em registros já existentes (isReturn, reason legível, vistoria, tracking)
        if (exists) {
          const needsUpdate = !exists.isReturn && isReturn;
          const reasonIsRawCode =
            exists.reason === claim.reason_id && reason !== claim.reason_id;
          const updates: Record<string, unknown> = {};
          if (needsUpdate) {
            updates.isReturn = true;
            updates.stage = 'opened';
          }
          if (reasonIsRawCode) updates.reason = reason;
          if (!exists.buyerName) {
            const claimOrderId = claim.order_id ?? claim.resource_id;
            if (claimOrderId) {
              try {
                const order = (await this.mlService.getOrderById(
                  accessToken,
                  String(claimOrderId),
                )) as any;
                if (order) {
                  const fullName =
                    `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
                  updates.buyerName =
                    order.buyer?.nickname || fullName || undefined;
                  updates.itemTitle =
                    order.order_items?.[0]?.item?.title ?? undefined;
                  updates.orderId = String(claimOrderId);
                }
              } catch {
                /* segue */
              }
            }
          }
          // Sempre tenta atualizar vistoria + tracking para devoluções
          if (isReturn) {
            const returnData = await this.fetchReturnDetails(
              accessToken,
              externalId,
            );
            if (returnData.vistoraRequired !== undefined)
              updates.vistoraRequired = returnData.vistoraRequired;
            if (returnData.returnShipmentStatus)
              updates.returnShipmentStatus = returnData.returnShipmentStatus;
            if (returnData.returnTrackingCode)
              updates.returnTrackingCode = returnData.returnTrackingCode;
          }
          if (Object.keys(updates).length) {
            await this.complaintRepo.update(exists.id, updates);
            this.logger.log(
              `Reclamação ${externalId} atualizada: ${JSON.stringify(Object.keys(updates))}`,
            );
          }
          continue;
        }

        const slaDeadline = new Date(claim.date_created);
        slaDeadline.setHours(slaDeadline.getHours() + 24);

        let buyerName: string | undefined;
        let itemTitle: string | undefined;
        let orderId: string | undefined;
        const claimOrderId = claim.order_id ?? claim.resource_id;
        if (claimOrderId) {
          try {
            const order = (await this.mlService.getOrderById(
              accessToken,
              String(claimOrderId),
            )) as any;
            if (order) {
              orderId = String(claimOrderId);
              const fullName =
                `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
              buyerName = order.buyer?.nickname || fullName || undefined;
              itemTitle = order.order_items?.[0]?.item?.title ?? undefined;
            }
          } catch {
            /* segue sem dados do pedido */
          }
        }

        let vistoraRequired = false;
        let returnShipmentStatus: string | undefined;
        let returnTrackingCode: string | undefined;
        if (isReturn) {
          const returnData = await this.fetchReturnDetails(
            accessToken,
            externalId,
          );
          vistoraRequired = returnData.vistoraRequired ?? false;
          returnShipmentStatus = returnData.returnShipmentStatus;
          returnTrackingCode = returnData.returnTrackingCode;
        }

        await this.complaintRepo.save({
          tenantId: account.tenantId,
          externalId,
          marketplace: 'mercadolivre',
          reason,
          status: claim.status === 'closed' ? 'closed' : 'open',
          priority: 'urgent',
          isReturn,
          stage: isReturn ? 'opened' : undefined,
          slaDeadline,
          orderId,
          buyerName,
          itemTitle,
          vistoraRequired,
          returnShipmentStatus,
          returnTrackingCode,
        });
        synced++;
      }
    } catch (err) {
      this.logger.error(
        `Erro ao buscar reclamações: ${(err as Error).message}`,
      );
    }
    return synced;
  }

  private async fetchReturnDetails(
    accessToken: string,
    claimId: string,
  ): Promise<{
    vistoraRequired?: boolean;
    returnShipmentStatus?: string;
    returnTrackingCode?: string;
  }> {
    const result: {
      vistoraRequired?: boolean;
      returnShipmentStatus?: string;
      returnTrackingCode?: string;
    } = {};
    try {
      const detail = (await this.mlService.getClaimDetail(
        accessToken,
        claimId,
      )) as any;
      const sellerPlayer =
        detail?.players?.find?.((p: any) => p.role === 'respondent') ??
        detail?.players?.seller;
      const actions: string[] = sellerPlayer?.available_actions ?? [];
      result.vistoraRequired = actions.includes('return_review_ok');
    } catch {
      /* segue */
    }
    try {
      const returns = (await this.mlService.getClaimReturns(
        accessToken,
        claimId,
      )) as any;
      const shipment = returns?.shipments?.[0];
      if (shipment) {
        result.returnShipmentStatus = shipment.status ?? undefined;
        result.returnTrackingCode = shipment.tracking_number ?? undefined;
      }
    } catch {
      /* segue */
    }
    return result;
  }

  // ─── Perguntas ───────────────────────────────────────────────────────────────

  private async syncQuestions(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    let synced = 0;
    try {
      const data = (await this.mlService.getUnansweredQuestions(
        accessToken,
        account.sellerId,
      )) as { questions: MlQuestion[]; total: number };
      const questions = data?.questions ?? [];
      this.logger.log(
        `Perguntas: ${questions.length} para seller=${account.sellerId}`,
      );

      // Marca como 'answered' qualquer pergunta no banco que não está mais na lista do ML
      const mlIds = new Set(questions.map((q) => String(q.id)));
      const dbPending = await this.questionRepo.find({
        where: { tenantId: account.tenantId, status: 'unanswered' },
      });
      const toClose = dbPending.filter((q) => !mlIds.has(q.externalId));
      if (toClose.length) {
        await Promise.all(
          toClose.map((q) =>
            this.questionRepo.update(q.id, { status: 'answered' }),
          ),
        );
        this.logger.log(
          `Perguntas marcadas como respondidas (já não pendentes no ML): ${toClose.length}`,
        );
      }

      for (const q of questions) {
        const externalId = String(q.id);
        const exists = await this.questionRepo.findOne({
          where: { externalId, tenantId: account.tenantId },
        });
        if (exists) continue;

        // Busca título do produto
        let itemTitle: string | undefined;
        let buyerName: string | undefined;
        if (q.item_id) {
          try {
            const item = (await this.mlService.getItem(
              accessToken,
              q.item_id,
            )) as any;
            itemTitle = item?.title ?? undefined;
          } catch {
            /* segue */
          }
        }
        if (q.from?.id) {
          try {
            const user = (await this.mlService.getUser(
              accessToken,
              String(q.from.id),
            )) as any;
            buyerName = user?.nickname ?? undefined;
          } catch {
            /* segue */
          }
        }

        const slaDeadline = new Date(q.date_created);
        slaDeadline.setHours(slaDeadline.getHours() + 12);

        await this.questionRepo.save({
          tenantId: account.tenantId,
          externalId,
          marketplace: 'mercadolivre',
          itemId: q.item_id,
          itemTitle,
          buyerId: String(q.from?.id ?? ''),
          buyerName,
          text: q.text,
          answer: q.answer?.text ?? undefined,
          status: q.status === 'ANSWERED' ? 'answered' : 'unanswered',
          slaDeadline,
        });
        synced++;
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar perguntas: ${(err as Error).message}`);
    }
    return synced;
  }

  // ─── Pedidos ─────────────────────────────────────────────────────────────────

  private async syncOrders(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    let synced = 0;
    try {
      let offset = 0;
      const orders: MlOrder[] = [];
      // Últimos 30 dias para acompanhar a transição de envios/devoluções.
      while (offset < 1000) {
        let page: MlOrder[] = [];
        try {
          const ordersData = (await this.mlService.getOrders(
            accessToken,
            account.sellerId,
            30,
            offset,
          )) as { results: MlOrder[]; paging: any };
          page = ordersData?.results ?? [];
        } catch (pageErr) {
          this.logger.warn(
            `Pedidos: paginação parou no offset ${offset}: ${(pageErr as Error).message}`,
          );
          break;
        }
        if (!page.length) break;
        orders.push(...page);
        if (page.length < 50) break;
        offset += 50;
      }
      this.logger.log(
        `Pedidos: ${orders.length} para seller=${account.sellerId}`,
      );

      for (const order of orders) {
        const externalId = String(order.id);
        const exists = await this.orderRepo.findOne({
          where: { externalId, tenantId: account.tenantId },
        });

        // Busca o shipment quando é novo, sem tipo de logística, ou ainda
        // está em movimento (pra rastrear entrega/devolução). Pedidos já
        // finalizados (entregue/devolvido/cancelado) são pulados = re-sync rápido.
        const done = ['delivered', 'returned', 'cancelled'].includes(
          (exists?.shippingStatus || '').toLowerCase(),
        );
        const needsShipment = !exists || !exists.logisticType || !done;
        const ship = needsShipment
          ? await this.fetchShipmentInfo(accessToken, order)
          : {
              shippingStatus: order.shipping?.status ?? undefined,
              shippingSubstatus: exists.shippingSubstatus,
              logisticType: exists.logisticType,
              trackingNumber: order.shipping?.tracking_number ?? undefined,
              notDeliveredAt: exists.notDeliveredAt,
              returnedAt: exists.returnedAt,
            };

        if (exists) {
          // Atualiza status e envio se mudaram
          await this.orderRepo.update(exists.id, {
            status: order.status ?? exists.status,
            shippingStatus: ship.shippingStatus ?? exists.shippingStatus,
            shippingSubstatus:
              ship.shippingSubstatus ?? exists.shippingSubstatus,
            logisticType: ship.logisticType ?? exists.logisticType,
            trackingNumber: ship.trackingNumber ?? exists.trackingNumber,
            notDeliveredAt: ship.notDeliveredAt ?? exists.notDeliveredAt,
            returnedAt: ship.returnedAt ?? exists.returnedAt,
          });
          continue;
        }

        const buyerFullName =
          `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
        const buyerName = order.buyer?.nickname || buyerFullName || 'Cliente';
        const item = order.order_items?.[0];

        await this.orderRepo.save({
          tenantId: account.tenantId,
          externalId,
          marketplace: 'mercadolivre',
          packId: order.pack_id ? String(order.pack_id) : undefined,
          buyerId: String(order.buyer?.id ?? ''),
          buyerName,
          buyerEmail: order.buyer?.email ?? undefined,
          itemId: item?.item?.id ?? undefined,
          itemTitle: item?.item?.title ?? undefined,
          itemQuantity: item?.quantity ?? undefined,
          totalAmount: order.total_amount ?? undefined,
          currency: order.currency_id ?? 'BRL',
          status: order.status ?? 'confirmed',
          shippingStatus: ship.shippingStatus,
          shippingSubstatus: ship.shippingSubstatus,
          logisticType: ship.logisticType,
          trackingNumber: ship.trackingNumber,
          notDeliveredAt: ship.notDeliveredAt,
          returnedAt: ship.returnedAt,
          orderDate: new Date(order.date_created),
        });
        synced++;
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar pedidos: ${(err as Error).message}`);
    }
    return synced;
  }

  /**
   * Busca os dados de envio de um pedido. O status básico vem no pedido, mas
   * o logistic_type (FULL/FLEX/COLETA) e o substatus só vêm no shipment.
   */
  private async fetchShipmentInfo(
    accessToken: string,
    order: MlOrder,
  ): Promise<{
    shippingStatus?: string;
    shippingSubstatus?: string;
    logisticType?: string;
    trackingNumber?: string;
    notDeliveredAt?: Date;
    returnedAt?: Date;
  }> {
    const info: {
      shippingStatus?: string;
      shippingSubstatus?: string;
      logisticType?: string;
      trackingNumber?: string;
      notDeliveredAt?: Date;
      returnedAt?: Date;
    } = {
      shippingStatus: order.shipping?.status ?? undefined,
      logisticType: order.shipping?.logistic_type ?? undefined,
      trackingNumber: order.shipping?.tracking_number ?? undefined,
    };

    const shipmentId = order.shipping?.id;
    if (shipmentId) {
      try {
        const s = (await this.mlService.getShipment(
          accessToken,
          String(shipmentId),
        )) as {
          status?: string;
          substatus?: string;
          logistic_type?: string;
          logistic?: { type?: string };
          tracking_number?: string;
          status_history?: Record<string, string | null>;
        };
        info.shippingStatus = s?.status ?? info.shippingStatus;
        info.shippingSubstatus = s?.substatus ?? undefined;
        info.logisticType =
          s?.logistic_type ?? s?.logistic?.type ?? info.logisticType;
        info.trackingNumber = s?.tracking_number ?? info.trackingNumber;

        const h = s?.status_history ?? {};
        if (h.date_not_delivered)
          info.notDeliveredAt = new Date(h.date_not_delivered);
        if (h.date_returned) info.returnedAt = new Date(h.date_returned);

        // Diagnóstico dos casos de não-entrega/devolução (pra mapear os substatus reais)
        if (
          s?.status === 'not_delivered' ||
          (s?.substatus ?? '').includes('return')
        ) {
          this.logger.warn(
            `[devolucao] shipment=${shipmentId} status=${s?.status} substatus=${s?.substatus} hist=${JSON.stringify(h).slice(0, 250)}`,
          );
        }
      } catch {
        /* sem shipment — usa o que veio no pedido */
      }
    }
    return info;
  }

  // ─── Token ──────────────────────────────────────────────────────────────────

  private async getValidToken(account: MarketplaceAccount): Promise<string> {
    const isExpired =
      !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    if (isExpired) {
      this.logger.log(`Renovando token para conta ${account.id}`);
      return this.mlService.refreshAccountToken(account);
    }
    return this.encryption.decrypt(account.accessTokenEnc);
  }
}
