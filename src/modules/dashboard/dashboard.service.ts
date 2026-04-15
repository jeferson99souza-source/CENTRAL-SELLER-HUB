import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import Redis from 'ioredis';
import { Message } from '../messaging/entities/message.entity';
import { Complaint } from '../complaints/entities/complaint.entity';

export interface DashboardKPIs {
  totalMessages: number;
  totalComplaints: number;
  complaintsSlaBreached: number;
  totalQuestions: number;
  averageResponseTime: number;
  byMarketplace: {
    marketplace: string;
    messages: number;
    complaints: number;
    questions: number;
  }[];
}

const PERIOD_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async getKPIs(tenantId: string, period: '24h' | '7d' | '30d' = '24h'): Promise<DashboardKPIs> {
    const cacheKey = `dashboard:kpis:${tenantId}:${period}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as DashboardKPIs;

    const since = new Date();
    since.setHours(since.getHours() - (PERIOD_HOURS[period] ?? 24));

    const [
      totalMessages,
      totalComplaints,
      complaintsSlaBreached,
      complaintsByMarketplace,
    ] = await Promise.all([
      this.messageRepo.count({ where: { tenantId, createdAt: MoreThan(since) } as any }),
      this.complaintRepo.count({ where: { tenantId, createdAt: MoreThan(since) } as any }),
      this.complaintRepo.count({
        where: { tenantId, status: 'open', slaDeadline: MoreThan(new Date(0)) } as any,
      }).then(async () => {
        return this.complaintRepo
          .createQueryBuilder('c')
          .where('c.tenantId = :tenantId', { tenantId })
          .andWhere('c.status = :status', { status: 'open' })
          .andWhere('c.slaDeadline < :now', { now: new Date() })
          .getCount();
      }),
      this.complaintRepo
        .createQueryBuilder('c')
        .select('c.marketplace', 'marketplace')
        .addSelect('COUNT(*)', 'count')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('c.createdAt > :since', { since })
        .groupBy('c.marketplace')
        .getRawMany<{ marketplace: string; count: string }>(),
    ]);

    const complaintCountByMarketplace: Record<string, number> = {};
    for (const row of complaintsByMarketplace) {
      complaintCountByMarketplace[row.marketplace] = Number(row.count);
    }

    const kpis: DashboardKPIs = {
      totalMessages,
      totalComplaints,
      complaintsSlaBreached,
      totalQuestions: 0,
      averageResponseTime: 0,
      byMarketplace: [
        {
          marketplace: 'mercadolivre',
          messages: totalMessages,
          complaints: complaintCountByMarketplace['mercadolivre'] ?? 0,
          questions: 0,
        },
        {
          marketplace: 'shopee',
          messages: 0,
          complaints: complaintCountByMarketplace['shopee'] ?? 0,
          questions: 0,
        },
        {
          marketplace: 'amazon',
          messages: 0,
          complaints: complaintCountByMarketplace['amazon'] ?? 0,
          questions: 0,
        },
      ],
    };

    await this.redis.set(cacheKey, JSON.stringify(kpis), 'EX', 60);
    return kpis;
  }
}
