import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  Logger,
} from '@nestjs/common';
import { MlWebhookService } from '../services/ml-webhook.service';

@Controller('integration/mercadolivre')
export class MlWebhookController {
  private readonly logger = new Logger(MlWebhookController.name);

  constructor(private readonly webhookService: MlWebhookService) {}

  // ML faz GET para validar a URL antes de ativar as notificações
  @Get('webhooks')
  @HttpCode(HttpStatus.OK)
  validateWebhook(): string {
    this.logger.log('ML Webhook URL validada com sucesso');
    return 'ok';
  }

  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any, @Query() query: any): Promise<string> {
    this.logger.log(
      `ML Webhook recebido: topic=${body.topic || query.topic} resource=${body.resource || query.resource}`,
    );
    this.webhookService.handleEvent(body, query).catch((err) => {
      this.logger.error(`Erro ao processar webhook ML: ${err.message}`);
    });
    return 'ok';
  }
}
