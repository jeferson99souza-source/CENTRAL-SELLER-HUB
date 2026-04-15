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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { MercadoLivreService } from './services/mercadolivre.service';
import { MlSyncService } from './services/ml-sync.service';
import { ConnectAccountDto } from './dto/connect-account.dto';
import { MarketplaceAccount } from '../accounts/entities/marketplace-account.entity';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';

@ApiTags('integration')
@Controller('integration')
export class IntegrationController {
  constructor(
    private readonly mlService: MercadoLivreService,
    private readonly mlSyncService: MlSyncService,
    private readonly encryption: TokenEncryptionService,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Diagnosticar conexão com o Mercado Livre',
    description:
      'Verifica contas cadastradas, validade dos tokens e faz um teste real na API do ML.',
  })
  @Get('mercadolivre/diagnose')
  async diagnoseMercadoLivre(@TenantId() tenantId: string) {
    const accounts = await this.accountRepo.find({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
    });

    if (!accounts.length) {
      return {
        data: {
          ok: false,
          message:
            'Nenhuma conta Mercado Livre ativa encontrada para este tenant. Conecte uma conta em /integration/mercadolivre/connect',
          accounts: [],
        },
      };
    }

    const results = await Promise.all(
      accounts.map(async (account) => {
        const now = new Date();
        const isExpired =
          !account.tokenExpiresAt || account.tokenExpiresAt < now;
        const minutesUntilExpiry = account.tokenExpiresAt
          ? Math.round(
              (account.tokenExpiresAt.getTime() - now.getTime()) / 60000,
            )
          : null;

        let tokenTest: { ok: boolean; sellerId?: string; nickname?: string; error?: string };
        try {
          let accessToken: string;
          if (isExpired) {
            accessToken = await this.mlService.refreshAccountToken(account);
          } else {
            accessToken = this.encryption.decrypt(account.accessTokenEnc);
          }
          const profile = await this.mlService.testConnection(accessToken);
          tokenTest = {
            ok: true,
            sellerId: String(profile.id),
            nickname: profile.nickname,
          };
        } catch (err) {
          tokenTest = { ok: false, error: (err as Error).message };
        }

        return {
          accountId: account.id,
          sellerId: account.sellerId,
          sellerName: account.sellerName,
          companyId: account.companyId,
          lastSyncAt: account.lastSyncAt,
          tokenExpiresAt: account.tokenExpiresAt,
          tokenExpired: isExpired,
          minutesUntilExpiry,
          tokenTest,
        };
      }),
    );

    const allOk = results.every((r) => r.tokenTest.ok);

    return {
      data: {
        ok: allOk,
        totalAccounts: accounts.length,
        accounts: results,
        tip: allOk
          ? 'Tokens válidos. Chame POST /integration/mercadolivre/sync para sincronizar os dados.'
          : 'Um ou mais tokens estão inválidos. Reconecte a conta via /integration/mercadolivre/connect.',
      },
    };
  }
}
