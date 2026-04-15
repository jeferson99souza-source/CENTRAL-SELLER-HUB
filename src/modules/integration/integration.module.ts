import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { Message } from '../messaging/entities/message.entity';
import { Complaint } from '../complaints/entities/complaint.entity';
import { Question } from '../questions/entities/question.entity';
import { Order } from '../orders/entities/order.entity';
import { IntegrationController } from './integration.controller';
import { MercadoLivreService } from './services/mercadolivre.service';
import { MlSyncService } from './services/ml-sync.service';
import { MlWebhookService } from './services/ml-webhook.service';
import { MlWebhookController } from './controllers/ml-webhook.controller';
import { SyncSchedulerService } from './services/sync-scheduler.service';
import { ShopeeService } from './services/shopee.service';
import { AmazonService } from './services/amazon.service';
import { OAuthStateService } from './services/oauth-state.service';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@Module({
  imports: [
    ConfigModule,
    AccountsModule,
    AuthModule,
    TypeOrmModule.forFeature([MarketplaceAccount, Message, Complaint, Question, Order]),
  ],
  controllers: [IntegrationController, MlWebhookController],
  providers: [
    OAuthStateService,
    TokenEncryptionService,
    MercadoLivreService,
    MlSyncService,
    MlWebhookService,
    SyncSchedulerService,
    ShopeeService,
    AmazonService,
  ],
  exports: [MercadoLivreService, ShopeeService, AmazonService, TokenEncryptionService],
})
export class IntegrationModule {}
