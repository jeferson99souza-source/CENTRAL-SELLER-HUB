import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { AccountsService } from './accounts.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @ApiOperation({ summary: 'Listar todas as empresas do tenant' })
  @Get('companies')
  findAllCompanies(@TenantId() tenantId: string) {
    return this.accountsService.findAllCompanies(tenantId);
  }

  @ApiOperation({ summary: 'Buscar empresa por ID' })
  @Get('companies/:id')
  findOneCompany(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.accountsService.findOneCompany(tenantId, id);
  }

  @ApiOperation({ summary: 'Criar nova empresa (CNPJ)' })
  @Post('companies')
  createCompany(@TenantId() tenantId: string, @Body() dto: CreateCompanyDto) {
    return this.accountsService.createCompany(tenantId, dto);
  }

  @ApiOperation({ summary: 'Listar contas de marketplace' })
  @Get('marketplace-accounts')
  findAllAccounts(@TenantId() tenantId: string) {
    return this.accountsService.findAllAccounts(tenantId);
  }
}
