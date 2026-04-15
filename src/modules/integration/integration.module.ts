import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';

import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { Message } from '../messaging/entities/message.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { IntegrationController } from './integration.controller';
import { MercadoLivreService } from './services/mercadolivre.service';
import { MlSyncService } from './services/ml-sync.service';
import { ShopeeService } from './services/shopee.service';
import { AmazonService } from './services/amazon.service';
import { OAuthStateService } from './services/oauth-state.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Module({
  imports: [
    ConfigModule,
    AccountsModule,
    AuthModule,
    TypeOrmModule.forFeature([MarketplaceAccount, Message, Complaint]),
  ],
  controllers: [IntegrationController],
  providers: [
    // Cliente Redis — usa REDIS_URL (Railway) ou variáveis individuais (local)
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');

        if (redisUrl) {
          return new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: false,
            lazyConnect: false,
          });
        }

        return new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: 3,
        });
      },
      inject: [ConfigService],
    },
    OAuthStateService,
    TokenEncryptionService,
    MercadoLivreService,
    MlSyncService,
    ShopeeService,
    AmazonService,
  ],
  exports: [MercadoLivreService, ShopeeService, AmazonService],
})
export class IntegrationModule {}
