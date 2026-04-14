import { Injectable, Logger } from '@nestjs/common';

interface AmazonConfig {
  sellerId: string;
  accessToken: string;
  refreshToken: string;
  marketplace: string;
}

/**
 * Serviço de integração com Amazon SP-API.
 * Requer Login with Amazon (LWA) + AWS Signature v4.
 */
@Injectable()
export class AmazonService {
  private readonly logger = new Logger(AmazonService.name);

  async getMessages(config: AmazonConfig, orderId: string) {
    this.logger.log(`Buscando mensagens do pedido ${orderId} na Amazon`);
    // TODO: GET /messaging/v1/orders/{orderId}/messages
    return [];
  }

  async getOrders(config: AmazonConfig) {
    this.logger.log(`Buscando pedidos Amazon — seller: ${config.sellerId}`);
    // TODO: GET /orders/v0/orders
    return [];
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log('Renovando token Amazon LWA');
    // TODO: POST https://api.amazon.com/auth/o2/token
    throw new Error('Not implemented');
  }
}
