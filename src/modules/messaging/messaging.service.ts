import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { MercadoLivreService } from '../integration/services/mercadolivre.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Injectable()
export class MessagingService {
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

    const account = await this.accountRepo.findOne({
      where: { id: message.marketplaceAccountId, tenantId },
    });
    if (!account) throw new NotFoundException('Conta do marketplace não encontrada.');

    const isExpired = !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    const accessToken = isExpired
      ? await this.mlService.refreshAccountToken(account)
      : this.encryption.decrypt(account.accessTokenEnc);

    await this.mlService.sendMessage(
      accessToken,
      message.packId,
      account.sellerId,
      message.buyerId,
      text.trim(),
    );

    await this.messageRepo.update(
      { id: messageId, tenantId },
      { status: 'replied', repliedAt: new Date() },
    );
  }

  async save(message: Partial<Message>): Promise<Message> {
    return this.messageRepo.save(message);
  }
}
