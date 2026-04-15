import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './common/redis/redis.module';

// Módulos da aplicação
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AutomationModule } from './modules/automation/automation.module';
import { QueuesModule } from './modules/queues/queues.module';

// Entidades TypeORM
import { User } from './modules/auth/entities/user.entity';
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
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get('DATABASE_URL');
        const isProduction = config.get('NODE_ENV') === 'production';
        const dbSync = config.get('DB_SYNC') === 'true';
        const shouldSync = dbSync || !isProduction;

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [User, Company, MarketplaceAccount, Message, Complaint],
            synchronize: shouldSync,
            logging: !isProduction,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
          };
        }

        return {
          type: 'postgres',
          host: config.get('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get('DB_USER', 'postgres'),
          password: config.get('DB_PASSWORD', 'postgres'),
          database: config.get('DB_NAME', 'central_seller'),
          entities: [User, Company, MarketplaceAccount, Message, Complaint],
          synchronize: shouldSync,
          logging: !isProduction,
          ssl: isProduction ? { rejectUnauthorized: false } : false,
        };
      },
      inject: [ConfigService],
    }),

    // Rate limiting global: 60 requests/min por tenant
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Redis global
    RedisModule,

    // Módulos de negócio
    AuthModule,
    AccountsModule,
    MessagingModule,
    ComplaintsModule,
    IntegrationModule,
    DashboardModule,
    AutomationModule,
    QueuesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
