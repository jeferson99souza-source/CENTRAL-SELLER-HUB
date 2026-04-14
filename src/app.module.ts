import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

// Módulos da aplicação
import { AccountsModule } from './modules/accounts/accounts.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AutomationModule } from './modules/automation/automation.module';
import { QueuesModule } from './modules/queues/queues.module';

// Entidades TypeORM
import { Company } from './modules/accounts/entities/company.entity';
import { MarketplaceAccount } from './modules/accounts/entities/marketplace-account.entity';
import { Message } from './modules/messaging/entities/message.entity';
import { Complaint } from './modules/complaints/entities/complaint.entity';

@Module({
  imports: [
    // Config global com .env
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM com PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'central_seller'),
        entities: [Company, MarketplaceAccount, Message, Complaint],
        synchronize: config.get('NODE_ENV') !== 'production', // Só em dev!
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Rate limiting global: 60 requests/min por tenant
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Módulos de negócio
    AccountsModule,
    MessagingModule,
    ComplaintsModule,
    IntegrationModule,
    DashboardModule,
    AutomationModule,
    QueuesModule,
  ],
})
export class AppModule {}
