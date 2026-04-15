import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { MercadoLivreService } from './services/mercadolivre.service';
import { MlSyncService } from './services/ml-sync.service';
import { ConnectAccountDto } from './dto/connect-account.dto';

@ApiTags('integration')
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly mlService: MercadoLivreService,
    private readonly mlSyncService: MlSyncService,
  ) {}

  // ─── Mercado Livre ──────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Iniciar conexão OAuth com Mercado Livre (PKCE + S256)',
    description:
      'Gera code_verifier/code_challenge PKCE, salva state no Redis e retorna a URL de autorização do ML.',
  })
  @ApiQuery({ name: 'companyId', description: 'UUID da empresa a conectar' })
  @Get('mercadolivre/connect')
  async connectMercadoLivre(
    @TenantId() tenantId: string,
    @Query() dto: ConnectAccountDto,
  ) {
    const url = await this.mlService.buildAuthUrl(tenantId, dto.companyId);
    return { data: { authUrl: url } };
  }

  @ApiOperation({
    summary: 'Callback OAuth do Mercado Livre',
    description:
      'Recebe code + state do ML, valida PKCE via Redis, troca por tokens e salva criptografado.',
  })
  @Get('mercadolivre/callback')
  async callbackMercadoLivre(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error) {
      throw new BadRequestException(
        errorDescription ?? `Erro OAuth do Mercado Livre: ${error}`,
      );
    }
    if (!code || !state) {
      throw new BadRequestException(
        'Parâmetros code e state são obrigatórios',
      );
    }
    const account = await this.mlService.handleCallback(code, state);
    return {
      data: {
        message: 'Conta Mercado Livre conectada com sucesso',
        accountId: account.id,
        sellerId: account.sellerId,
        sellerName: account.sellerName,
      },
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Sincronizar mensagens e reclamações do Mercado Livre',
    description: 'Busca mensagens e reclamações da API do ML e salva no banco.',
  })
  @Post('mercadolivre/sync')
  async syncMercadoLivre(@TenantId() tenantId: string) {
    const result = await this.mlSyncService.syncForTenant(tenantId);
    return { data: result };
  }
}
