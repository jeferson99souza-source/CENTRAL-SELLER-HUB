import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { Company } from './entities/company.entity';
import { MarketplaceAccount } from './entities/marketplace-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, MarketplaceAccount])],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
