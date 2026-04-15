import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { MlSyncService } from './ml-sync.service';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    private readonly mlSync: MlSyncService,
  ) {}

  // Roda a cada 30 minutos como fallback dos webhooks
  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllTenants() {
    this.logger.log('Iniciando sync automático (cron 30min)...');

    const tenants = await this.accountRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.tenantId', 'tenantId')
      .where('a.marketplace = :mp', { mp: 'mercadolivre' })
      .andWhere('a.isActive = true')
      .getRawMany<{ tenantId: string }>();

    if (!tenants.length) {
      this.logger.log('Nenhum tenant com conta ML ativa.');
      return;
    }

    for (const { tenantId } of tenants) {
      try {
        const result = await this.mlSync.syncForTenant(tenantId);
        this.logger.log(
          `Cron sync tenant=${tenantId} — mensagens=${result.messages} reclamações=${result.complaints}`,
        );
      } catch (err) {
        this.logger.error(`Erro no cron sync tenant=${tenantId}: ${(err as Error).message}`);
      }
    }
  }
}
