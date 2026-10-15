import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MarketplaceAccount,
  type Marketplace,
} from '../../accounts/entities/marketplace-account.entity';
import { MlSyncService } from './ml-sync.service';
import { ShopeeSyncService } from './shopee-sync.service';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
    private readonly mlSync: MlSyncService,
    private readonly shopeeSync: ShopeeSyncService,
  ) {}

  /**
   * Roda a cada 30 minutos como fallback dos webhooks.
   *
   * Na Shopee o sync automático não é só conveniência: a autorização da loja
   * expira se ficar 30 dias sem uso. Sem este cron, a loja desconectaria
   * sozinha sempre que o vendedor passasse um mês sem clicar em "Puxar Dados".
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllTenants() {
    this.logger.log('Iniciando sync automático (cron 30min)...');

    // Um marketplace não espera nem derruba o outro.
    await Promise.allSettled([this.syncMercadoLivre(), this.syncShopee()]);
  }

  private async tenantsCom(marketplace: Marketplace): Promise<string[]> {
    const rows = await this.accountRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.tenantId', 'tenantId')
      .where('a.marketplace = :mp', { mp: marketplace })
      .andWhere('a.isActive = true')
      .getRawMany<{ tenantId: string }>();
    return rows.map((r) => r.tenantId);
  }

  private async syncMercadoLivre() {
    const tenants = await this.tenantsCom('mercadolivre');
    if (!tenants.length) {
      this.logger.log('Nenhum tenant com conta ML ativa.');
      return;
    }

    for (const tenantId of tenants) {
      try {
        const result = await this.mlSync.syncForTenant(tenantId);
        this.logger.log(
          `Cron ML tenant=${tenantId} — mensagens=${result.messages} reclamações=${result.complaints}`,
        );
      } catch (err) {
        this.logger.error(
          `Erro no cron ML tenant=${tenantId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async syncShopee() {
    const tenants = await this.tenantsCom('shopee');
    if (!tenants.length) return;

    for (const tenantId of tenants) {
      try {
        const r = await this.shopeeSync.syncForTenant(tenantId);
        this.logger.log(
          `Cron Shopee tenant=${tenantId} — pedidos=${r.orders} devoluções=${r.returns} mensagens=${r.messages} erros=${r.errors.length}`,
        );
        for (const erro of r.errors) {
          this.logger.warn(`Cron Shopee tenant=${tenantId}: ${erro}`);
        }
      } catch (err) {
        this.logger.error(
          `Erro no cron Shopee tenant=${tenantId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
