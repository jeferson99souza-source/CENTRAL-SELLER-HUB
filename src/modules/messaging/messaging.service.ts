import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
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

  async markAsReplied(tenantId: string, messageId: string): Promise<void> {
    await this.messageRepo.update(
      { id: messageId, tenantId },
      { status: 'replied', repliedAt: new Date() },
    );
  }

  async save(message: Partial<Message>): Promise<Message> {
    return this.messageRepo.save(message);
  }
}
