import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  });

  // Validation pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Central Seller HUB')
    .setDescription(
      'API para centralização de operações em múltiplos marketplaces',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('accounts', 'Empresas e contas de marketplace')
    .addTag('messaging', 'Chat pós-venda centralizado')
    .addTag('complaints', 'Reclamações com controle de SLA')
    .addTag('integration', 'Sincronização com marketplaces')
    .addTag('dashboard', 'KPIs e métricas em tempo real')
    .addTag('automation', 'Classificação e sugestão automática via IA')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`\n Central Seller HUB rodando em: http://localhost:${port}`);
  console.log(` Swagger disponível em: http://localhost:${port}/api\n`);
}
bootstrap();
