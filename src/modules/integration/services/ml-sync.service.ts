import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { Message } from '../../messaging/entities/message.entity';
import { Complaint } from '../../complaints/entities/complaint.entity';
import { MercadoLivreService } from './mercadolivre.service';
import { TokenEncryptionService } from '../../../common/crypto/token-encryption.service';

interface MlOrder {
  id: number;
  pack_id?: number;
  buyer: { id: number; nickname: string; first_name?: string; last_name?: string };
  date_created: string;
  order_items?: { item: { id: string; title: string } }[];
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
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  /**
   * Sincroniza mensagens e reclamações do ML para um tenant.
   * Retorna um resumo do que foi sincronizado.
   */
  async syncForTenant(tenantId: string): Promise<{
    accounts: number;
    messages: number;
    complaints: number;
  }> {
    const accounts = await this.accountRepo.find({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
    });

    if (!accounts.length) {
      this.logger.warn(`Nenhuma conta ML ativa para tenant=${tenantId}`);
      return { accounts: 0, messages: 0, complaints: 0 };
    }

    let totalMessages = 0;
    let totalComplaints = 0;

    for (const account of accounts) {
      try {
        const accessToken = await this.getValidToken(account);
        const [messages, complaints] = await Promise.all([
          this.syncMessages(account, accessToken),
          this.syncComplaints(account, accessToken),
        ]);
        totalMessages += messages;
        totalComplaints += complaints;

        await this.accountRepo.update(account.id, { lastSyncAt: new Date() });
      } catch (err) {
        this.logger.error(
          `Erro ao sincronizar conta ${account.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Sync ML concluído — tenant=${tenantId} messages=${totalMessages} complaints=${totalComplaints}`,
    );

    return { accounts: accounts.length, messages: totalMessages, complaints: totalComplaints };
  }

  // ─── Mensagens ──────────────────────────────────────────────────────────────

  private async syncMessages(
    account: MarketplaceAccount,
    accessToken: string,
  ): Promise<number> {
    let synced = 0;

    try {
      const ordersData = (await this.mlService.getOrders(
        accessToken,
        account.sellerId,
      )) as { results: MlOrder[] };

      const orders = ordersData?.results ?? [];
      this.logger.log(`Pedidos encontrados para seller=${account.sellerId}: ${orders.length} (total API: ${(ordersData as any)?.paging?.total ?? '?'})`);

      for (const order of orders) {
        try {
          const packId = order.pack_id ?? order.id;
          const messagesData = (await this.mlService.getMessages(
            accessToken,
            String(packId),
            account.sellerId,
          )) as { messages: MlMessage[] };

          const mlMessages = messagesData?.messages ?? [];

          // Ordenar cronologicamente para garantir que a resposta do vendedor atualize as mensagens do cliente
          mlMessages.sort((a, b) => new Date(a.message_date.received).getTime() - new Date(b.message_date.received).getTime());

          for (const msg of mlMessages) {
            const externalId = String(msg.id);
            const exists = await this.messageRepo.findOne({
              where: { externalId, tenantId: account.tenantId },
            });

            const sellerId = Number(account.sellerId);
            const sender =
              msg.from?.user_id === sellerId ? 'vendedor' : 'cliente';

            // Se for mensagem do vendedor, marca todas as anteriores pendentes desse pack como respondidas
            if (sender === 'vendedor') {
               await this.messageRepo.update(
                 { packId: String(packId), tenantId: account.tenantId, sender: 'cliente', status: 'pending' },
                 { status: 'answered' }
               );
            }

            const buyerId = String(
              msg.from?.user_id === sellerId ? msg.to?.user_id : msg.from?.user_id,
            );
            const buyerFullName = `${order.buyer?.first_name ?? ''} ${order.buyer?.last_name ?? ''}`.trim();
            const buyerName = order.buyer?.nickname || buyerFullName || 'Cliente';
            const itemTitle = order.order_items?.[0]?.item?.title ?? undefined;

            if (exists) {
              // Atualiza campos que podem ter ficado nulos em syncs anteriores
              if (!exists.buyerName || !exists.itemTitle) {
                await this.messageRepo.update(exists.id, { buyerId, buyerName, itemTitle });
              }
              continue;
            }

            const slaDeadline = new Date(msg.message_date?.received ?? Date.now());
            slaDeadline.setHours(slaDeadline.getHours() + 48);

            await this.messageRepo.save({
              tenantId: account.tenantId,
              marketplaceAccountId: account.id,
              orderId: String(order.id),
              packId: String(packId),
              externalId,
              buyerId,
              buyerName,
              itemTitle,
              sender,
              content: msg.text?.plain ?? '',
              status: sender === 'vendedor' ? 'answered' : 'pending',
              slaDeadline,
            });
            synced++;
          }
        } catch {
          // ignora erros por pedido individual
        }
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar mensagens: ${(err as Error).message}`);
    }

    return synced;
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
      )) as { data: MlClaim[] };

      const claims = data?.data ?? [];

      for (const claim of claims) {
        const externalId = String(claim.id);
        const exists = await this.complaintRepo.findOne({
          where: { externalId, tenantId: account.tenantId },
        });
        if (exists) continue;

        const slaDeadline = new Date(claim.date_created);
        slaDeadline.setHours(slaDeadline.getHours() + 24);

        await this.complaintRepo.save({
          tenantId: account.tenantId,
          externalId,
          marketplace: 'mercadolivre',
          reason: claim.reason_id ?? 'Reclamação do Mercado Livre',
          status: claim.status === 'closed' ? 'closed' : 'open',
          priority: 'urgent',
          slaDeadline,
        });
        synced++;
      }
    } catch (err) {
      this.logger.error(`Erro ao buscar reclamações: ${(err as Error).message}`);
    }

    return synced;
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
