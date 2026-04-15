import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { IntegrationController } from './integration.controller';
import { MercadoLivreService } from './services/mercadolivre.service';
import { ShopeeService } from './services/shopee.service';
import { AmazonService } from './services/amazon.service';
import { OAuthStateService } from './services/oauth-state.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Module({
  imports: [ConfigModule, AccountsModule, AuthModule],
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
    ShopeeService,
    AmazonService,
  ],
  exports: [MercadoLivreService, ShopeeService, AmazonService],
})
export class IntegrationModule {}
