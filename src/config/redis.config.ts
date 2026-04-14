import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  ttlDefault: parseInt(process.env.REDIS_TTL_DEFAULT || '60', 10),
  ttlDashboard: parseInt(process.env.REDIS_TTL_DASHBOARD || '60', 10),
}));
