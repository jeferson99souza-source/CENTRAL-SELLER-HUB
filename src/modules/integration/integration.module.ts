import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { AccountsModule } from '../accounts/accounts.module';
import { IntegrationController } from './integration.controller';
import { MercadoLivreService } from './services/mercadolivre.service';
import { ShopeeService } from './services/shopee.service';
import { AmazonService } from './services/amazon.service';
import { OAuthStateService } from './services/oauth-state.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Module({
  imports: [ConfigModule, AccountsModule],
  controllers: [IntegrationController],
  providers: [
    // Cliente Redis para armazenar state PKCE (TTL 10 min)
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
        }),
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
