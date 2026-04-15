import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { Message } from '../../messaging/entities/message.entity';
import { MercadoLivreService } from './mercadolivre.service';
import { TokenEncryptionService } from '../../../common/crypto/token-encryption.service';
import { MlSyncService } from './ml-sync.service';

@Injectable()
export class MlWebhookService {
  private readonly logger = new Logger(MlWebhookService.name);

  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
    private readonly mlSync: MlSyncService, // We can trigger isolated syncs if needed
  ) {}

  async handleEvent(body: any, query: any) {
    const topic = body.topic || query.topic;
    const resource = body.resource || query.resource;
    const sellerId = body.user_id || query.user_id;

    if (!topic || !resource || !sellerId) {
      this.logger.debug(`Webhook recebido sem dados essenciais: ${JSON.stringify(body)}`);
      return;
    }

    const account = await this.accountRepo.findOne({
      where: { sellerId: String(sellerId), marketplace: 'mercadolivre', isActive: true },
    });

    if (!account) {
      this.logger.warn(`Conta ignorada no Webhook: seller_id=${sellerId}`);
      return;
    }

    try {
      const accessToken = await this.getValidToken(account);

      if (topic === 'messages') {
        await this.handleMessage(resource, account, accessToken);
      } else if (topic === 'orders_v2') {
        await this.handleOrderV2(resource, account, accessToken);
      } else {
        this.logger.debug(`Tópico ignorado: ${topic}`);
      }
    } catch (err) {
      this.logger.error(`Falha ao processar webhook resource=${resource}: ${(err as Error).message}`);
    }
  }

  private async handleMessage(resource: string, account: MarketplaceAccount, accessToken: string) {
    this.logger.log(`Processando Webhook de Mensagem: ${resource}`);
    
    // As in ml-sync, MercadoLivre requires direct GET to the resource
    // Access it using the private mlGet exposed or a custom fetch
    const response = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      this.logger.error(`Erro ao buscar resource ${resource}: ${response.status}`);
      return;
    }

    const msg: any = await response.json();
    const externalId = String(msg.id);
    const sellerIdNum = Number(account.sellerId);
    
    const sender = msg.from?.user_id === sellerIdNum ? 'vendedor' : 'cliente';
    const content = msg.text?.plain?.trim() ?? '';
    const isAutoNotification = sender === 'cliente' && content === '';
    
    const packId = String(msg.message_pack_id || msg.pack_id || msg.order_id);
    
    const exists = await this.messageRepo.findOne({
      where: { externalId, tenantId: account.tenantId }
    });

    if (exists) {
      this.logger.debug(`Mensagem ${externalId} já processada.`);
      return;
    }

    if (sender === 'vendedor') {
      await this.messageRepo.update(
        { packId, tenantId: account.tenantId, sender: 'cliente', status: 'pending' },
        { status: 'replied' }
      );
    }

    const buyerId = String(
      msg.from?.user_id === sellerIdNum ? msg.to?.user_id : msg.from?.user_id,
    );

    const slaDeadline = new Date(msg.message_date?.received ?? Date.now());
    slaDeadline.setHours(slaDeadline.getHours() + 48);

    await this.messageRepo.save({
      tenantId: account.tenantId,
      marketplaceAccountId: account.id,
      orderId: String(msg.order_id || ''),
      packId,
      externalId,
      buyerId,
      buyerName: 'Cliente via Webhook', // In a full version, we'd fetch the order to get the buyer real name
      itemTitle: 'Produto via Webhook',
      sender,
      content,
      status: (sender === 'vendedor' || isAutoNotification) ? 'replied' : 'pending',
      slaDeadline,
    });
    
    this.logger.log(`Mensagem salva via Webhook: ${externalId}`);
  }

  private async handleOrderV2(resource: string, account: MarketplaceAccount, accessToken: string) {
    this.logger.log(`Processando Webhook de Order: ${resource}`);
    
    // Future: Auto-Responder goes here
    // Example: fetch order, check if status is 'paid', wait 2 mins, send "Obrigado!" message.
  }

  private async getValidToken(account: MarketplaceAccount): Promise<string> {
    const isExpired = !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    if (isExpired) {
      return this.mlService.refreshAccountToken(account);
    }
    return this.encryption.decrypt(account.accessTokenEnc);
  }
}
