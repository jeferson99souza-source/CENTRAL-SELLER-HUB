import { Module } from '@nestjs/common';
import { MercadoLivreService } from './services/mercadolivre.service';
import { ShopeeService } from './services/shopee.service';
import { AmazonService } from './services/amazon.service';

@Module({
  providers: [MercadoLivreService, ShopeeService, AmazonService],
  exports: [MercadoLivreService, ShopeeService, AmazonService],
})
export class IntegrationModule {}
