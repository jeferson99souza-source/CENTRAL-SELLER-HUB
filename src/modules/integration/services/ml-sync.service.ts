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
  buyer: { id: number; nickname: string; first_name?: string; last_name?: string; email?: string };
  order_items?: { item: { id: string; title: string }; quantity: number; unit_price: number }[];
  shipping?: { id: number; status: string; tracking_number?: string };
}

interface MlMessage {
  id: string;
  from: { user_id: number };
  to: { user_id: number };
  text: { plain: string };
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
      return { accounts: 0, messages: 0, complaints: 0, questions: 0, orders: 0, errors: ['Nenhuma conta Mercado Livre ativa encontrada'] };
    }

    let totalMessages = 0;
    let totalComplaints = 0;
    let totalQuestions = 0;
    let totalOrders = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const accessToken = await this.getValidToken(account);
        this.logger.log(`Token OK para seller=${account.sellerId}. Iniciando sync...`);

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
        this.logger.log(`Conta ${account.sellerId} OK — msg=${messages} rec=${complaints} perguntas=${questions} pedidos=${orders}`);
      } catch (err) {
        const msg = `Conta seller=${account.sellerId}: ${(err as Error).message}`;
        this.logger.error(`Erro ao sincronizar ${msg}`);
        errors.push(msg);
      }
    }

    this.logger.log(
      `Sync ML concluído — tenant=${tenantId} messages=${totalMessages} complaints=${totalComplaints} questions=${totalQuestions} orders=${totalOrders} errors=${errors.length}`,
    );

    return { accounts: accounts.length, messages: totalMessages, complaints: totalComplaints, questions: totalQuestions, orders: totalOrders, errors };
  }

  // ─── Mensagens ──────────────────────────────────────────────────────────────

  private async syncMessages(account: MarketplaceAccount, accessToken: string): Promise<number> {
    let synced = 0;
    try {
      let offset = 0;
      let hasMore = true;
      const allOrders: MlOrder[] = [];

      while (hasMore && offset < 200) {
        const ordersData = (await this.mlService.getOrders(accessToken, account.sellerId, 90, offset)) as { results: MlOrder[]; paging: any };
        const pageOrders = ordersData?.results ?? [];
        allOrders.push(...pageOrders);
        if (pageOrders.length < 50 || offset + pageOrders.length >= (ordersData?.paging?.total ?? 0)) {
          hasMore = false;
        } else {
          offset += 50;
        }
      }

      this.logger.log(`Mensagens: ${allOrders.length} pedidos para seller=${account.sellerId}`);

      for (const order of allOrders) {
        try {
          const packId = order.pack_id ?? order.id;
          const messagesData = (await this.mlService.getMessages(accessToken, String(packId), account.sellerId)) as { messages: MlMessage[] };
          const mlMessages = messagesData?.messages ?? [];
          mlMessages.sort((a, b) => new Date(a.message_date.received).getTime() - new Date(b.message_date.received).getTime());

          const sellerId = Number(account.sellerId);
          const buyerFullName = `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
          const buyerName = order.buyer?.nickname || buyerFullName || 'Cliente';
          const itemTitle = order.order_items?.[0]?.item?.title ?? undefined;

          for (const msg of mlMessages) {
            const externalId = String(msg.id);
            const sender = msg.from?.user_id === sellerId ? 'vendedor' : 'cliente';
            const buyerId = String(msg.from?.user_id === sellerId ? msg.to?.user_id : msg.from?.user_id);

            if (sender === 'vendedor') {
              await this.messageRepo.update(
                { packId: String(packId), tenantId: account.tenantId, sender: 'cliente', status: 'pending' },
                { status: 'replied' },
              );
            }

            const exists = await this.messageRepo.findOne({ where: { externalId, tenantId: account.tenantId } });
            if (exists) {
              if (!exists.buyerName || !exists.itemTitle) {
                await this.messageRepo.update(exists.id, { buyerId, buyerName, itemTitle });
              }
              continue;
            }

            const content = msg.text?.plain?.trim() ?? '';
            const isAutoNotification = sender === 'cliente' && content === '';
            const slaDeadline = new Date(msg.message_date?.received ?? Date.now());
            slaDeadline.setHours(slaDeadline.getHours() + 48);

            await this.messageRepo.save({
              tenantId: account.tenantId,
              marketplaceAccountId: account.id,
              orderId: String(order.id),
              packId: String(packId),
              externalId, buyerId, buyerName, itemTitle, sender, content,
              status: sender === 'vendedor' || isAutoNotification ? 'replied' : 'pending',
              slaDeadline,
            });
            synced++;
          }
        } catch (orderErr) {
          this.logger.warn(`Mensagens pedido=${order.id} ignoradas: ${(orderErr as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar mensagens: ${(err as Error).message}`);
    }
    return synced;
  }

  // ─── Reclamações ────────────────────────────────────────────────────────────

  private async syncComplaints(account: MarketplaceAccount, accessToken: string): Promise<number> {
    let synced = 0;
    try {
      const data = (await this.mlService.getClaims(accessToken, account.sellerId)) as { data: MlClaim[] };
      const claims = data?.data ?? [];

      for (const claim of claims) {
        const externalId = String(claim.id);
        const exists = await this.complaintRepo.findOne({ where: { externalId, tenantId: account.tenantId } });
        if (exists) continue;

        const slaDeadline = new Date(claim.date_created);
        slaDeadline.setHours(slaDeadline.getHours() + 24);

        let buyerName: string | undefined;
        let itemTitle: string | undefined;
        let orderId: string | undefined;
        const claimOrderId = claim.order_id ?? claim.resource_id;
        if (claimOrderId) {
          try {
            const order = (await this.mlService.getOrderById(accessToken, String(claimOrderId))) as any;
            if (order) {
              orderId = String(claimOrderId);
              const fullName = `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
              buyerName = order.buyer?.nickname || fullName || undefined;
              itemTitle = order.order_items?.[0]?.item?.title ?? undefined;
            }
          } catch { /* segue sem dados do pedido */ }
        }

        await this.complaintRepo.save({
          tenantId: account.tenantId, externalId, marketplace: 'mercadolivre',
          reason: claim.reason_id ?? 'Reclamação do Mercado Livre',
          status: claim.status === 'closed' ? 'closed' : 'open',
          priority: 'urgent', slaDeadline, orderId, buyerName, itemTitle,
        });
        synced++;
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar reclamações: ${(err as Error).message}`);
    }
    return synced;
  }

  // ─── Perguntas ───────────────────────────────────────────────────────────────

  private async syncQuestions(account: MarketplaceAccount, accessToken: string): Promise<number> {
    let synced = 0;
    try {
      const data = (await this.mlService.getUnansweredQuestions(accessToken, account.sellerId)) as { questions: MlQuestion[]; total: number };
      const questions = data?.questions ?? [];
      this.logger.log(`Perguntas: ${questions.length} para seller=${account.sellerId}`);

      for (const q of questions) {
        const externalId = String(q.id);
        const exists = await this.questionRepo.findOne({ where: { externalId, tenantId: account.tenantId } });
        if (exists) continue;

        // Busca título do produto
        let itemTitle: string | undefined;
        let buyerName: string | undefined;
        if (q.item_id) {
          try {
            const item = (await this.mlService.getItem(accessToken, q.item_id)) as any;
            itemTitle = item?.title ?? undefined;
          } catch { /* segue */ }
        }
        if (q.from?.id) {
          try {
            const user = (await this.mlService.getUser(accessToken, String(q.from.id))) as any;
            buyerName = user?.nickname ?? undefined;
          } catch { /* segue */ }
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

  private async syncOrders(account: MarketplaceAccount, accessToken: string): Promise<number> {
    let synced = 0;
    try {
      const ordersData = (await this.mlService.getOrders(accessToken, account.sellerId, 30, 0)) as { results: MlOrder[]; paging: any };
      const orders = ordersData?.results ?? [];
      this.logger.log(`Pedidos: ${orders.length} para seller=${account.sellerId}`);

      for (const order of orders) {
        const externalId = String(order.id);
        const exists = await this.orderRepo.findOne({ where: { externalId, tenantId: account.tenantId } });
        if (exists) continue;

        const buyerFullName = `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
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
          shippingStatus: order.shipping?.status ?? undefined,
          trackingNumber: order.shipping?.tracking_number ?? undefined,
          orderDate: new Date(order.date_created),
        });
        synced++;
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar pedidos: ${(err as Error).message}`);
    }
    return synced;
  }

  // ─── Token ──────────────────────────────────────────────────────────────────

  private async getValidToken(account: MarketplaceAccount): Promise<string> {
    const isExpired = !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    if (isExpired) {
      this.logger.log(`Renovando token para conta ${account.id}`);
      return this.mlService.refreshAccountToken(account);
    }
    return this.encryption.decrypt(account.accessTokenEnc);
  }
}
