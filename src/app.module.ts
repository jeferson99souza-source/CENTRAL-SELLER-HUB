import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
import { QuestionsModule } from './modules/questions/questions.module';
import { OrdersModule } from './modules/orders/orders.module';

// Entidades TypeORM
import { User } from './modules/auth/entities/user.entity';
import { Company } from './modules/accounts/entities/company.entity';
import { MarketplaceAccount } from './modules/accounts/entities/marketplace-account.entity';
import { Message } from './modules/messaging/entities/message.entity';
import { Complaint } from './modules/complaints/entities/complaint.entity';
import { Question } from './modules/questions/entities/question.entity';
import { Order } from './modules/orders/entities/order.entity';

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

        // Configuração comum para o SSL do Neon
        const sslConfig = { rejectUnauthorized: false };

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [User, Company, MarketplaceAccount, Message, Complaint, Question, Order],
            synchronize: true, // Forçamos true para ele criar as tabelas no seu Neon agora
            logging: true,
            ssl: sslConfig, // Força SSL
          };
        }

        return {
          type: 'postgres',
          host: config.get('DB_HOST'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get('DB_USER'),
          password: config.get('DB_PASSWORD'),
          database: config.get('DB_NAME'),
          entities: [User, Company, MarketplaceAccount, Message, Complaint, Question, Order],
          synchronize: true, // Forçamos true para criar as tabelas
          logging: true,
          ssl: sslConfig, // Força SSL
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

    // Cron jobs
    ScheduleModule.forRoot(),

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
    QuestionsModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
