import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');

        let client: Redis;
        if (redisUrl) {
          client = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: false,
            retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
          });
        } else {
          client = new Redis({
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            db: config.get<number>('REDIS_DB', 0),
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
          });
        }

        client.on('error', (err) => {
          console.warn('[Redis Warning]', err.message);
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
