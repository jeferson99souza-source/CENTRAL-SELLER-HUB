import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { Message } from '../../messaging/entities/message.entity';
import { Question } from '../../questions/entities/question.entity';
import { Order } from '../../orders/entities/order.entity';
import { MercadoLivreService } from './mercadolivre.service';
import { TokenEncryptionService } from '../../../common/crypto/token-encryption.service';

@Injectable()
export class MlWebhookService {
  private readonly logger = new Logger(MlWebhookService.name);
  private readonly baseUrl = 'https://api.mercadolibre.com';

  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async handleEvent(body: any, query: any) {
    const topic = body.topic || query.topic;
    const resource = body.resource || query.resource;
    const sellerId = String(body.user_id || query.user_id || '');

    if (!topic || !resource || !sellerId) {
      this.logger.debug(`Webhook sem dados essenciais: ${JSON.stringify(body)}`);
      return;
    }

    const account = await this.accountRepo.findOne({
      where: { sellerId, marketplace: 'mercadolivre', isActive: true },
    });

    if (!account) {
      this.logger.warn(`Conta não encontrada para seller_id=${sellerId}`);
      return;
    }

    const accessToken = await this.getValidToken(account);

    if (topic === 'messages') {
      await this.handleMessage(resource, account, accessToken);
    } else if (topic === 'questions') {
      await this.handleQuestion(resource, account, accessToken);
    } else if (topic === 'orders_v2') {
      await this.handleOrderV2(resource, account, accessToken);
    } else {
      this.logger.debug(`Tópico ignorado: ${topic}`);
    }
  }

  private async handleMessage(
    resource: string,
    account: MarketplaceAccount,
    accessToken: string,
  ) {
    this.logger.log(`Processando webhook de mensagem: ${resource}`);

    // Busca a mensagem individual pelo resource (ex: /messages/{messageId})
    const msg = await this.mlFetch(resource, accessToken);
    if (!msg) return;

    const externalId = String(msg.id);

    const exists = await this.messageRepo.findOne({
      where: { externalId, tenantId: account.tenantId },
    });
    if (exists) {
      this.logger.debug(`Mensagem ${externalId} já existe, ignorando.`);
      return;
    }

    const sellerIdNum = Number(account.sellerId);
    const sender = msg.from?.user_id === sellerIdNum ? 'vendedor' : 'cliente';
    const content = msg.text?.plain?.trim() ?? '';
    const packId = String(msg.pack_id || msg.order_id || '');
    const orderId = String(msg.order_id || '');

    // Busca o pedido para obter nome do comprador e produto
    let buyerName = 'Cliente';
    let itemTitle: string | undefined;

    if (orderId) {
      const order = await this.mlFetch(`/orders/${orderId}`, accessToken);
      if (order) {
        const fullName = `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
        buyerName = order.buyer?.nickname || fullName || 'Cliente';
        itemTitle = order.order_items?.[0]?.item?.title;
      }
    }

    const buyerId = String(
      msg.from?.user_id === sellerIdNum ? msg.to?.user_id : msg.from?.user_id,
    );

    const slaDeadline = new Date(msg.message_date?.received ?? Date.now());
    slaDeadline.setHours(slaDeadline.getHours() + 48);

    const isAutoNotification = sender === 'cliente' && content === '';

    if (sender === 'vendedor') {
      await this.messageRepo.update(
        { packId, tenantId: account.tenantId, sender: 'cliente', status: 'pending' },
        { status: 'replied' },
      );
    }

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
      status: sender === 'vendedor' || isAutoNotification ? 'replied' : 'pending',
      slaDeadline,
    });

    this.logger.log(`Mensagem salva via webhook: externalId=${externalId} sender=${sender} buyer=${buyerName}`);
  }

  private async handleQuestion(resource: string, account: MarketplaceAccount, accessToken: string) {
    this.logger.log(`Processando webhook de pergunta: ${resource}`);
    
    const q = await this.mlFetch(resource, accessToken);
    if (!q) return;

    const externalId = String(q.id);
    const exists = await this.questionRepo.findOne({ where: { externalId, tenantId: account.tenantId } });
    if (exists) {
      if (q.status === 'ANSWERED' && exists.status === 'unanswered') {
         await this.questionRepo.update(exists.id, {
           status: 'answered',
           answer: q.answer?.text ?? exists.answer
         });
         this.logger.log(`Pergunta (Webhook) atualizada para respondida: ${externalId}`);
      }
      return;
    }

    let itemTitle: string | undefined;
    let buyerName: string | undefined;
    
    if (q.item_id) {
       const item = await this.mlFetch(`/items/${q.item_id}`, accessToken);
       itemTitle = item?.title ?? undefined;
    }
    
    if (q.from?.id) {
       const user = await this.mlFetch(`/users/${q.from.id}`, accessToken);
       buyerName = user?.nickname ?? undefined;
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
    
    this.logger.log(`Pergunta salva via webhook: ${externalId}`);
  }

  private async handleOrderV2(resource: string, account: MarketplaceAccount, accessToken: string) {
    this.logger.log(`Processando webhook de pedido: ${resource}`);
    
    const order = await this.mlFetch(resource, accessToken);
    if (!order) return;

    const externalId = String(order.id);
    const exists = await this.orderRepo.findOne({ where: { externalId, tenantId: account.tenantId } });
    
    const buyerFullName = `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
    const buyerName = order.buyer?.nickname || buyerFullName || 'Cliente';
    const item = order.order_items?.[0];

    const orderData = {
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
      orderDate: new Date(order.date_created || Date.now()),
    };

    if (exists) {
      // Atualiza os dados de status, etc se recwbeu um pedido existente
      await this.orderRepo.update(exists.id, orderData);
      this.logger.log(`Pedido (Webhook) atualizado: ${externalId} com status ${order.status}`);
      return;
    }

    await this.orderRepo.save(orderData);
    this.logger.log(`Pedido salvo via webhook: ${externalId}`);
    
    // Future: Auto-Responder goes here for `order.status === 'paid'`
  }

  private async mlFetch(resource: string, accessToken: string): Promise<any> {
    try {
      const url = resource.startsWith('http') ? resource : `${this.baseUrl}${resource}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        this.logger.error(`Erro ao buscar ${resource}: ${res.status}`);
        return null;
      }
      return res.json();
    } catch (err) {
      this.logger.error(`Falha ao buscar ${resource}: ${(err as Error).message}`);
      return null;
    }
  }

  private async getValidToken(account: MarketplaceAccount): Promise<string> {
    const isExpired = !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    if (isExpired) return this.mlService.refreshAccountToken(account);
    return this.encryption.decrypt(account.accessTokenEnc);
  }
}
