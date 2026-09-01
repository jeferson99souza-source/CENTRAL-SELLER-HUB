import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { MercadoLivreService } from '../integration/services/mercadolivre.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    private readonly mlService: MercadoLivreService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async findByOrder(
    tenantId: string,
    orderId: string,
    lastId?: string,
    limit = 50,
  ): Promise<Message[]> {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.orderId = :orderId', { orderId })
      .orderBy('m.createdAt', 'ASC')
      .take(limit);

    if (lastId) {
      qb.andWhere('m.id > :lastId', { lastId });
    }

    return qb.getMany();
  }

  async findPending(tenantId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  // Uma conversa por pack (a mensagem mais recente), pendentes primeiro.
  // Só mostra mensagens recebidas nos últimos 7 dias (recebido = SLA - 48h,
  // então SLA >= agora - 5 dias).
  async findAll(tenantId: string): Promise<Message[]> {
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.slaDeadline >= :cutoff', { cutoff })
      .orderBy('m.packId', 'ASC')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();

    // Mantém só a mensagem mais recente de cada conversa (pack)
    const latestByPack = new Map<string, Message>();
    for (const m of rows) {
      const key = m.packId || m.id;
      if (!latestByPack.has(key)) latestByPack.set(key, m);
    }

    const list = [...latestByPack.values()];
    list.sort((a, b) => {
      const pa = a.status === 'pending' ? 0 : 1;
      const pb = b.status === 'pending' ? 0 : 1;
      if (pa !== pb) return pa - pb; // pendentes primeiro
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    return list.slice(0, 200);
  }

  async findByPack(tenantId: string, packId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { tenantId, packId },
      order: { createdAt: 'ASC' },
    });
  }

  async markAsReplied(tenantId: string, messageId: string): Promise<void> {
    await this.messageRepo.update(
      { id: messageId, tenantId },
      { status: 'replied', repliedAt: new Date() },
    );
  }

  async replyToMessage(
    tenantId: string,
    messageId: string,
    text: string,
  ): Promise<void> {
    if (!text?.trim()) {
      throw new BadRequestException('Texto da resposta não pode ser vazio.');
    }

    const message = await this.messageRepo.findOne({
      where: { id: messageId, tenantId },
    });
    if (!message) throw new NotFoundException('Mensagem não encontrada.');

    // Tenta pelo ID direto; se não achar (mensagem antiga sem marketplaceAccountId), busca qualquer conta ML ativa
    const account = message.marketplaceAccountId
      ? await this.accountRepo.findOne({
          where: { id: message.marketplaceAccountId, tenantId },
        })
      : null;
    const resolvedAccount =
      account ??
      (await this.accountRepo.findOne({
        where: { tenantId, marketplace: 'mercadolivre', isActive: true },
      }));
    if (!resolvedAccount)
      throw new NotFoundException('Conta Mercado Livre não encontrada.');

    const isExpired =
      !resolvedAccount.tokenExpiresAt ||
      resolvedAccount.tokenExpiresAt < new Date();
    const accessToken = isExpired
      ? await this.mlService.refreshAccountToken(resolvedAccount)
      : this.encryption.decrypt(resolvedAccount.accessTokenEnc);

    // Validação básica antes de chamar ML
    if (!message.packId)
      throw new BadRequestException(
        'Mensagem sem packId — não é possível responder.',
      );
    if (!message.buyerId || message.buyerId === 'undefined')
      throw new BadRequestException(
        'Comprador não identificado nesta mensagem.',
      );

    try {
      await this.mlService.sendMessage(
        accessToken,
        message.packId,
        resolvedAccount.sellerId,
        message.buyerId,
        text.trim(),
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha ao enviar mensagem: ${detail}`);
      throw new InternalServerErrorException(
        detail || 'Falha ao enviar mensagem via Mercado Livre',
      );
    }

    await this.messageRepo.update(
      { id: messageId, tenantId },
      { status: 'replied', repliedAt: new Date() },
    );

    // Salva a resposta do vendedor localmente para aparecer no chat na hora.
    // externalId 'local-...' é adotado pelo sync quando a mensagem real chega do ML.
    await this.messageRepo.save({
      tenantId,
      marketplaceAccountId: resolvedAccount.id,
      orderId: message.orderId,
      packId: message.packId,
      externalId: `local-${message.packId}-${Date.now()}`,
      buyerId: message.buyerId,
      buyerName: message.buyerName,
      itemTitle: message.itemTitle,
      sender: 'vendedor',
      content: text.trim(),
      status: 'replied',
      slaDeadline: message.slaDeadline,
    });
  }

  async save(message: Partial<Message>): Promise<Message> {
    return this.messageRepo.save(message);
  }
}
