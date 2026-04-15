import { Controller, Post, Body, HttpCode, HttpStatus, Query, Logger } from '@nestjs/common';
import { MlWebhookService } from '../services/ml-webhook.service';

@Controller('integration/mercadolivre')
export class MlWebhookController {
  private readonly logger = new Logger(MlWebhookController.name);

  constructor(private readonly webhookService: MlWebhookService) {}

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any, @Query() query: any): Promise<string> {
    this.logger.log(`ML Webhook Recebido: topic=${body.topic||query.topic} resource=${body.resource||query.resource}`);
    
    // Processado de forma assíncrona para liberar a resposta HTTP 200 OK exigida pelo Mercado Livre rapidamente
    this.webhookService.handleEvent(body, query).catch((err) => {
      this.logger.error(`Erro ao processar Webhook do ML: ${err.message}`);
    });
    
    return 'ok';
  }
}
