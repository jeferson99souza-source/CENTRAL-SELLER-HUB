import { Injectable, Logger } from '@nestjs/common';

interface MercadoLivreConfig {
  accessToken: string;
  sellerId: string;
}

/**
 * Serviço de integração com Mercado Livre.
 * Todas as chamadas devem vir via fila RabbitMQ, não diretamente via request.
 */
@Injectable()
export class MercadoLivreService {
  private readonly logger = new Logger(MercadoLivreService.name);
  private readonly baseUrl = 'https://api.mercadolibre.com';

  async getMessages(config: MercadoLivreConfig, packId: string) {
    this.logger.log(`Buscando mensagens do pack ${packId} no ML`);
    // TODO: implementar chamada real com token criptografado
    return [];
  }

  async getUnansweredQuestions(config: MercadoLivreConfig) {
    this.logger.log(`Buscando perguntas sem resposta no ML`);
    // TODO: GET /questions/search?seller_id={id}&status=UNANSWERED
    return [];
  }

  async getClaims(config: MercadoLivreConfig) {
    this.logger.log(`Buscando reclamações no ML`);
    // TODO: GET /post-purchase/v1/claims/search?seller_id={id}
    return [];
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log('Renovando token do ML');
    // TODO: POST https://api.mercadolibre.com/oauth/token
    throw new Error('Not implemented');
  }
}
