import { Injectable, Logger } from '@nestjs/common';

interface ShopeeConfig {
  shopId: string;
  accessToken: string;
  partnerId: string;
  partnerKey: string;
}

/**
 * Serviço de integração com Shopee.
 * Requer HMAC-SHA256 em todos os requests.
 */
@Injectable()
export class ShopeeService {
  private readonly logger = new Logger(ShopeeService.name);
  private readonly baseUrl = 'https://partner.shopeemobile.com';

  async getConversations(config: ShopeeConfig) {
    this.logger.log(`Buscando conversas na Shopee — shop: ${config.shopId}`);
    // TODO: POST /api/v2/message/get_conversation_list
    return [];
  }

  async getMessages(config: ShopeeConfig, conversationId: string) {
    this.logger.log(`Buscando mensagens da conversa ${conversationId}`);
    // TODO: POST /api/v2/message/get_message
    return [];
  }

  async sendMessage(config: ShopeeConfig, conversationId: string, message: string) {
    this.logger.log(`Enviando mensagem para conversa ${conversationId}`);
    // TODO: POST /api/v2/message/send_message
    return null;
  }

  async refreshToken(shopId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log(`Renovando token Shopee — shop: ${shopId}`);
    // TODO: POST /api/v2/auth/access_token/get
    throw new Error('Not implemented');
  }
}
