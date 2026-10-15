import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { Message } from '../../messaging/entities/message.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';
import { Order } from '../../orders/entities/order.entity';
import {
  ShopeeService,
  type ShopeeConversation,
  type ShopeeOrderDetail,
  type ShopeeReturn,
} from './shopee.service';

/** Quantos dias de pedidos/devoluções buscar. */
const DIAS_PEDIDOS = 30;
/** Quantos dias de conversa buscar (mesma regra adotada no Mercado Livre). */
const DIAS_MENSAGENS = 7;
/** Limite duro da Shopee: cada get_order_list cobre no máximo 15 dias. */
const JANELA_MAX_DIAS = 15;

const SEGUNDOS_POR_DIA = 86400;

/**
 * Status de pedido da Shopee → vocabulário usado pelo kanban de Envios.
 * Mantém o mesmo conjunto de valores já usado pelo Mercado Livre para que as
 * colunas e os selos funcionem sem alteração na tela.
 */
const STATUS_ENVIO: Record<string, string> = {
  UNPAID: 'handling',
  INVOICE_PENDING: 'handling',
  PENDING: 'handling',
  READY_TO_SHIP: 'ready_to_ship',
  PROCESSED: 'ready_to_ship',
  RETRY_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  TO_CONFIRM_RECEIVE: 'shipped',
  COMPLETED: 'delivered',
  IN_CANCEL: 'cancelled',
  CANCELLED: 'cancelled',
};

/** Status de devolução da Shopee → status/estágio da reclamação. */
const STATUS_DEVOLUCAO: Record<
  string,
  { status: 'open' | 'pending' | 'closed'; stage: Complaint['stage'] }
> = {
  REQUESTED: { status: 'open', stage: 'return_requested' },
  PROCESSING: { status: 'open', stage: 'mediation' },
  ACCEPTED: { status: 'pending', stage: 'return_in_transit' },
  COMPLETED: { status: 'closed', stage: 'refunded' },
  CANCELLED: { status: 'closed', stage: 'resolved' },
};

/**
 * Sincroniza pedidos, devoluções e conversas da Shopee para o banco local.
 *
 * Decisões que valem registro:
 *
 *  - Pedidos são buscados em janelas de 15 dias porque a Shopee recusa
 *    intervalos maiores que isso numa única chamada.
 *  - O detalhe do pedido vem em lotes de até 50 order_sn (limite da API).
 *  - Devoluções paginam por número de página (começa em 1), não por cursor
 *    como os pedidos.
 *  - Nenhuma falha de uma conta/etapa interrompe as outras: cada bloco é
 *    isolado e o erro é registrado. Nunca devolve sucesso inventado.
 */
@Injectable()
export class ShopeeSyncService {
  private readonly logger = new Logger(ShopeeSyncService.name);

  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly shopee: ShopeeService,
  ) {}

  async syncForTenant(tenantId: string): Promise<{
    accounts: number;
    orders: number;
    returns: number;
    messages: number;
    errors: string[];
  }> {
    const resumo = {
      accounts: 0,
      orders: 0,
      returns: 0,
      messages: 0,
      errors: [] as string[],
    };

    if (!this.shopee.isConfigured) {
      resumo.errors.push(
        'Credenciais do app Shopee não configuradas (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY).',
      );
      return resumo;
    }

    const accounts = await this.accountRepo.find({
      where: { tenantId, marketplace: 'shopee', isActive: true },
      order: { updatedAt: 'DESC' },
    });
    resumo.accounts = accounts.length;

    if (!accounts.length) {
      resumo.errors.push('Nenhuma loja Shopee conectada.');
      return resumo;
    }

    for (const account of accounts) {
      let accessToken: string;
      try {
        accessToken = await this.shopee.getValidAccessToken(account);
      } catch (err) {
        const msg = `Loja ${account.sellerName}: ${(err as Error).message}`;
        this.logger.error(msg);
        resumo.errors.push(msg);
        // Autorização da Shopee cai depois de 30 dias sem uso — desativa para
        // a tela poder orientar a reconexão.
        if (/expirou|token/i.test((err as Error).message)) {
          await this.accountRepo.update(account.id, { isActive: false });
        }
        continue;
      }

      // Mensagens primeiro: é o que o vendedor mais precisa ver rápido.
      for (const etapa of [
        { nome: 'mensagens', fn: () => this.syncMessages(account, accessToken) },
        { nome: 'pedidos', fn: () => this.syncOrders(account, accessToken) },
        { nome: 'devoluções', fn: () => this.syncReturns(account, accessToken) },
      ]) {
        try {
          const n = await etapa.fn();
          if (etapa.nome === 'mensagens') resumo.messages += n;
          else if (etapa.nome === 'pedidos') resumo.orders += n;
          else resumo.returns += n;
        } catch (err) {
          const msg = `Loja ${account.sellerName} — ${etapa.nome}: ${(err as Error).message}`;
          this.logger.error(msg);
          resumo.errors.push(msg);
        }
      }

      await this.accountRepo.update(account.id, { lastSyncAt: new Date() });
    }

    this.logger.log(
      `Sync Shopee: ${resumo.orders} pedidos, ${resumo.returns} devoluções, ${resumo.messages} mensagens, ${resumo.errors.length} erro(s)`,
    );
    return resumo;
  }

  // ─── Pedidos ────────────────────────────────────────────────────────────────

  /**
   * Busca os pedidos dos últimos 30 dias, fatiando em janelas de 15 dias
   * (limite da Shopee) e paginando por cursor dentro de cada janela.
   */
  private async syncOrders(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    const agora = Math.floor(Date.now() / 1000);
    const inicio = agora - DIAS_PEDIDOS * SEGUNDOS_POR_DIA;

    const orderSns: string[] = [];

    for (
      let janelaInicio = inicio;
      janelaInicio < agora;
      janelaInicio += JANELA_MAX_DIAS * SEGUNDOS_POR_DIA
    ) {
      const janelaFim = Math.min(
        janelaInicio + JANELA_MAX_DIAS * SEGUNDOS_POR_DIA,
        agora,
      );

      let cursor: string | undefined;
      let paginas = 0;
      do {
        const res = await this.shopee.getOrderList(accessToken, account.sellerId, {
          timeFrom: janelaInicio,
          timeTo: janelaFim,
          cursor,
        });
        const lista = res.response?.order_list ?? [];
        orderSns.push(...lista.map((o) => o.order_sn).filter(Boolean));

        cursor = res.response?.more ? res.response?.next_cursor : undefined;
        paginas++;
        // Trava de segurança: nunca girar para sempre se a API não avançar
      } while (cursor && paginas < 50);
    }

    if (!orderSns.length) {
      this.logger.log(`Loja ${account.sellerName}: nenhum pedido no período.`);
      return 0;
    }

    // Detalhe em lotes de 50 (limite da API)
    let salvos = 0;
    const unicos = [...new Set(orderSns)];
    for (let i = 0; i < unicos.length; i += 50) {
      const lote = unicos.slice(i, i + 50);
      const res = await this.shopee.getOrderDetail(
        accessToken,
        account.sellerId,
        lote,
      );
      for (const detalhe of res.response?.order_list ?? []) {
        await this.upsertOrder(account, detalhe);
        salvos++;
      }
      // Pausa curta entre lotes para não estourar o limite da Shopee
      await this.pausa(250);
    }

    this.logger.log(`Loja ${account.sellerName}: ${salvos} pedidos salvos.`);
    return salvos;
  }

  private async upsertOrder(
    account: MarketplaceAccount,
    detalhe: ShopeeOrderDetail,
  ): Promise<void> {
    const itens = detalhe.item_list ?? [];
    const primeiro = itens[0];
    const titulo = primeiro?.item_name
      ? itens.length > 1
        ? `${primeiro.item_name} (+${itens.length - 1})`
        : primeiro.item_name
      : undefined;

    const statusEnvio = detalhe.order_status
      ? STATUS_ENVIO[detalhe.order_status]
      : undefined;

    // O pacote traz o status logístico mais detalhado quando existe
    const pacote = detalhe.package_list?.[0];

    const dados = {
      tenantId: account.tenantId,
      marketplace: 'shopee',
      externalId: detalhe.order_sn,
      buyerId: detalhe.buyer_user_id ? String(detalhe.buyer_user_id) : undefined,
      buyerName: detalhe.buyer_username ?? undefined,
      itemId: primeiro?.item_id ? String(primeiro.item_id) : undefined,
      itemTitle: titulo,
      itemQuantity: primeiro?.model_quantity_purchased ?? undefined,
      totalAmount: detalhe.total_amount ?? undefined,
      currency: detalhe.currency ?? 'BRL',
      status: detalhe.order_status?.toLowerCase() ?? 'confirmed',
      shippingStatus: statusEnvio,
      shippingSubstatus: pacote?.logistics_status ?? undefined,
      // Guarda o valor cru da Shopee; a tela traduz para o selo.
      logisticType: detalhe.fulfillment_flag ?? undefined,
      trackingNumber: pacote?.package_number ?? undefined,
      orderDate: detalhe.create_time
        ? new Date(detalhe.create_time * 1000)
        : undefined,
    };

    const existe = await this.orderRepo.findOne({
      where: {
        tenantId: account.tenantId,
        marketplace: 'shopee',
        externalId: detalhe.order_sn,
      },
    });

    if (existe) {
      // Não sobrescreve com vazio o que já estava preenchido
      await this.orderRepo.update(existe.id, {
        status: dados.status,
        shippingStatus: dados.shippingStatus ?? existe.shippingStatus,
        shippingSubstatus: dados.shippingSubstatus ?? existe.shippingSubstatus,
        logisticType: dados.logisticType ?? existe.logisticType,
        trackingNumber: dados.trackingNumber ?? existe.trackingNumber,
        buyerName: dados.buyerName ?? existe.buyerName,
        itemTitle: dados.itemTitle ?? existe.itemTitle,
      });
      return;
    }

    await this.orderRepo.save(this.orderRepo.create(dados));
  }

  // ─── Devoluções ─────────────────────────────────────────────────────────────

  /**
   * Busca as devoluções dos últimos 30 dias. Paginação por número de página
   * (a Shopee não usa cursor aqui).
   */
  private async syncReturns(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    const agora = Math.floor(Date.now() / 1000);
    const inicio = agora - DIAS_PEDIDOS * SEGUNDOS_POR_DIA;

    let salvos = 0;
    let pagina = 1;
    let temMais = true;

    while (temMais && pagina <= 20) {
      const res = await this.shopee.getReturnList(accessToken, account.sellerId, {
        createTimeFrom: inicio,
        createTimeTo: agora,
        pageNo: pagina,
      });

      const lista = res.response?.return ?? [];
      for (const devolucao of lista) {
        await this.upsertReturn(account, devolucao);
        salvos++;
      }

      temMais = Boolean(res.response?.more) && lista.length > 0;
      pagina++;
      await this.pausa(250);
    }

    this.logger.log(`Loja ${account.sellerName}: ${salvos} devoluções salvas.`);
    return salvos;
  }

  private async upsertReturn(
    account: MarketplaceAccount,
    devolucao: ShopeeReturn,
  ): Promise<void> {
    const mapeado = devolucao.status
      ? STATUS_DEVOLUCAO[devolucao.status]
      : undefined;
    const criadoEm = devolucao.create_time
      ? new Date(devolucao.create_time * 1000)
      : new Date();

    const itemTitle =
      devolucao.item?.[0]?.item_name ?? devolucao.item?.[0]?.name ?? undefined;

    const existe = await this.complaintRepo.findOne({
      where: {
        tenantId: account.tenantId,
        marketplace: 'shopee',
        externalId: devolucao.return_sn,
      },
    });

    const dados = {
      tenantId: account.tenantId,
      marketplace: 'shopee',
      externalId: devolucao.return_sn,
      orderId: devolucao.order_sn ?? undefined,
      buyerName: devolucao.user?.username ?? undefined,
      itemTitle,
      reason:
        devolucao.text_reason ||
        devolucao.reason ||
        'Devolução aberta pelo comprador',
      status: mapeado?.status ?? 'open',
      priority: 'urgent' as const,
      isReturn: true,
      stage: mapeado?.stage,
      // Devolução tem SLA de 24h, igual às reclamações do ML
      slaDeadline: new Date(criadoEm.getTime() + 24 * 60 * 60 * 1000),
      resolvedAt: mapeado?.status === 'closed' ? new Date() : undefined,
    };

    if (existe) {
      await this.complaintRepo.update(existe.id, {
        status: dados.status,
        stage: dados.stage ?? existe.stage,
        itemTitle: dados.itemTitle ?? existe.itemTitle,
        buyerName: dados.buyerName ?? existe.buyerName,
        resolvedAt: dados.resolvedAt ?? existe.resolvedAt,
      });
    } else {
      await this.complaintRepo.save(this.complaintRepo.create(dados));
    }

    // Marca o pedido como em devolução, para ele aparecer na coluna certa
    // do kanban de Envios.
    if (devolucao.order_sn) {
      const pedido = await this.orderRepo.findOne({
        where: {
          tenantId: account.tenantId,
          marketplace: 'shopee',
          externalId: devolucao.order_sn,
        },
      });
      if (pedido) {
        const concluida =
          devolucao.status === 'COMPLETED' || devolucao.status === 'ACCEPTED';
        await this.orderRepo.update(pedido.id, {
          returnStatus: devolucao.status?.toLowerCase() ?? 'requested',
          returnStartedAt: pedido.returnStartedAt ?? criadoEm,
          returnedAt: concluida ? (pedido.returnedAt ?? new Date()) : undefined,
        });
      }
    }
  }

  // ─── Conversas do chat ──────────────────────────────────────────────────────

  /**
   * Busca as conversas do chat e salva as mensagens dos últimos 7 dias.
   *
   * Exige a permissão de chat no app registrado em open.shopee.com — é um
   * escopo separado do de pedidos. Sem ela, a Shopee recusa a chamada e o
   * erro sobe para o resumo do sync (não é silenciado).
   */
  private async syncMessages(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    const corte = Date.now() - DIAS_MENSAGENS * SEGUNDOS_POR_DIA * 1000;

    const lista = await this.shopee.getConversationList(
      accessToken,
      account.sellerId,
      { pageSize: 50 },
    );
    const conversas = lista.response?.conversations ?? [];

    if (!conversas.length) {
      this.logger.log(`Loja ${account.sellerName}: nenhuma conversa.`);
      return 0;
    }

    let salvas = 0;
    for (const conversa of conversas) {
      // A conversa traz o timestamp da última mensagem em segundos.
      const ultima = (conversa.last_message_timestamp ?? 0) * 1000;
      if (ultima && ultima < corte) continue;

      try {
        salvas += await this.saveConversationMessages(
          account,
          accessToken,
          conversa,
          corte,
        );
      } catch (err) {
        this.logger.warn(
          `Conversa ${conversa.conversation_id}: ${(err as Error).message}`,
        );
      }
      await this.pausa(200);
    }

    this.logger.log(`Loja ${account.sellerName}: ${salvas} mensagens salvas.`);
    return salvas;
  }

  private async saveConversationMessages(
    account: MarketplaceAccount,
    accessToken: string,
    conversa: ShopeeConversation,
    corte: number,
  ): Promise<number> {
    const res = await this.shopee.getConversationMessages(
      accessToken,
      account.sellerId,
      conversa.conversation_id,
    );
    const mensagens = res.response?.messages ?? [];

    // Título do produto, quando a conversa referencia um pedido
    const pedidoSn = mensagens.find((m) => m.content?.order_sn)?.content
      ?.order_sn;
    let itemTitle: string | undefined;
    let orderId: string | undefined;
    if (pedidoSn) {
      orderId = pedidoSn;
      const pedido = await this.orderRepo.findOne({
        where: {
          tenantId: account.tenantId,
          marketplace: 'shopee',
          externalId: pedidoSn,
        },
      });
      itemTitle = pedido?.itemTitle ?? undefined;
    }

    let salvas = 0;
    for (const msg of mensagens) {
      const criadoEm = (msg.created_timestamp ?? 0) * 1000;
      if (criadoEm && criadoEm < corte) continue;

      // Só texto por enquanto — imagem/sticker/oferta não têm conteúdo legível
      const texto = msg.content?.text?.trim();
      if (!texto) continue;

      const jaExiste = await this.messageRepo.findOne({
        where: {
          tenantId: account.tenantId,
          externalId: msg.message_id,
        },
      });
      if (jaExiste) continue;

      // Quem mandou: se veio da própria loja, é o vendedor.
      const daLoja =
        String(msg.from_shop_id ?? '') === String(account.sellerId) ||
        String(msg.from_id ?? '') === String(account.sellerId);

      await this.messageRepo.save(
        this.messageRepo.create({
          tenantId: account.tenantId,
          marketplaceAccountId: account.id,
          marketplace: 'shopee',
          orderId,
          // O id da conversa ocupa o lugar do packId do ML: é a chave que
          // agrupa o histórico na tela de Mensagens.
          packId: conversa.conversation_id,
          externalId: msg.message_id,
          buyerId: conversa.to_id ? String(conversa.to_id) : undefined,
          buyerName: conversa.to_name ?? undefined,
          itemTitle,
          sender: daLoja ? 'vendedor' : 'cliente',
          content: texto,
          status: daLoja ? 'replied' : 'pending',
          // SLA de pós-venda: 48h, igual ao Mercado Livre
          slaDeadline: new Date(
            (criadoEm || Date.now()) + 48 * 60 * 60 * 1000,
          ),
        }),
      );
      salvas++;
    }

    return salvas;
  }

  private pausa(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
