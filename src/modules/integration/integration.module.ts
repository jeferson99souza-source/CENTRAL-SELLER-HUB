import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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
