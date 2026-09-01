import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Redirect,
  Logger,
  Body,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
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
  private readonly logger = new Logger(IntegrationController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly mlService: MercadoLivreService,
    private readonly mlSyncService: MlSyncService,
    private readonly encryption: TokenEncryptionService,
    private readonly config: ConfigService,
    @InjectRepository(MarketplaceAccount)
    private readonly accountRepo: Repository<MarketplaceAccount>,
  ) {
    this.frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

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
      'Recebe code + state do ML, valida PKCE via Redis, troca por tokens, salva criptografado e redireciona ao frontend.',
  })
  @Redirect('', 302)
  @Get('mercadolivre/callback')
  async callbackMercadoLivre(
    @Query('code') code: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ) {
    if (error || !code) {
      const msg =
        errorDescription ?? error ?? 'Parâmetros inválidos no callback';
      this.logger.error(`Callback ML com erro: ${msg}`);
      return {
        url: `${this.frontendUrl}/contas?mlError=${encodeURIComponent(msg)}`,
      };
    }
    try {
      const account = await this.mlService.handleCallback(code, state ?? '');
      this.logger.log(
        `Conta ML conectada: seller=${account.sellerId} name=${account.sellerName}`,
      );
      return {
        url: `${this.frontendUrl}/contas?mlConnected=${encodeURIComponent(account.sellerName)}`,
      };
    } catch (err) {
      const msg = (err as Error).message ?? 'Falha ao conectar conta ML';
      this.logger.error(`Erro no callback ML: ${msg}`);
      return {
        url: `${this.frontendUrl}/contas?mlError=${encodeURIComponent(msg)}`,
      };
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Sincronizar mensagens e reclamações do Mercado Livre',
    description: 'Busca mensagens e reclamações da API do ML e salva no banco.',
  })
  @Post('mercadolivre/sync')
  syncMercadoLivre(@TenantId() tenantId: string) {
    // Contas com muito volume: roda em segundo plano para não estourar o
    // timeout do request. Os dados vão sendo salvos e aparecem ao atualizar.
    void this.mlSyncService
      .syncForTenant(tenantId)
      .catch((err) =>
        this.logger.error(
          `Sync em background falhou: ${(err as Error).message}`,
        ),
      );
    return { data: { started: true } };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Testar envio de mensagem ML (diagnóstico)',
    description:
      'Envia uma mensagem de teste para um pack específico. Use para diagnosticar permissões.',
  })
  @Post('mercadolivre/test-message')
  async testSendMessage(
    @TenantId() tenantId: string,
    @Body() body: { packId: string; buyerId: string; text?: string },
  ) {
    const accounts = await this.accountRepo.find({
      where: { tenantId, marketplace: 'mercadolivre', isActive: true },
    });
    if (!accounts.length) return { error: 'Nenhuma conta ML ativa' };

    const account = accounts[0];
    const isExpired =
      !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    const accessToken = isExpired
      ? await this.mlService.refreshAccountToken(account)
      : this.encryption.decrypt(account.accessTokenEnc);

    this.logger.log(
      `[test-message] packId=${body.packId} sellerId=${account.sellerId} buyerId=${body.buyerId}`,
    );
    try {
      const result = await this.mlService.sendMessage(
        accessToken,
        body.packId,
        account.sellerId,
        body.buyerId,
        body.text ?? 'Olá, teste de envio.',
      );
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
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

        let tokenTest: {
          ok: boolean;
          sellerId?: string;
          nickname?: string;
          error?: string;
        };
        let unread: { count: number | null; raw?: string } = { count: null };
        try {
          const accessToken = isExpired
            ? await this.mlService.refreshAccountToken(account)
            : this.encryption.decrypt(account.accessTokenEnc);
          const profile = await this.mlService.testConnection(accessToken);
          tokenTest = {
            ok: true,
            sellerId: String(profile.id),
            nickname: profile.nickname,
          };
          // Verifica quantas conversas com mensagem o ML realmente libera
          try {
            const u = (await this.mlService.getUnreadMessages(
              accessToken,
            )) as any;
            const count =
              u?.as_seller?.count ??
              u?.count ??
              u?.total ??
              (Array.isArray(u?.results) ? u.results.length : null);
            unread = {
              count: typeof count === 'number' ? count : null,
              raw: JSON.stringify(u).slice(0, 300),
            };
          } catch (ue) {
            unread = { count: null, raw: `erro: ${(ue as Error).message}` };
          }
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
          unread,
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
