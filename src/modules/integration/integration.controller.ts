import {
  Controller,
  Get,
  Post,
  Param,
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
import { ShopeeService } from './services/shopee.service';
import { ShopeeSyncService } from './services/shopee-sync.service';
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
    private readonly shopeeService: ShopeeService,
    private readonly shopeeSyncService: ShopeeSyncService,
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
        let claims: { count: number | null; raw?: string } = { count: null };
        let questions: { count: number | null; raw?: string } = { count: null };
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

          // Verifica quantas reclamações/devoluções o ML retorna
          try {
            const c = (await this.mlService.getClaims(
              accessToken,
              account.sellerId,
            )) as any;
            const count =
              c?.paging?.total ??
              c?.total ??
              (Array.isArray(c?.results) ? c.results.length : null);
            claims = {
              count: typeof count === 'number' ? count : null,
              raw: JSON.stringify(c).slice(0, 300),
            };
          } catch (ce) {
            claims = { count: null, raw: `erro: ${(ce as Error).message}` };
          }

          // Quantas perguntas sem resposta o ML diz que existem
          try {
            const q = (await this.mlService.getUnansweredQuestions(
              accessToken,
              account.sellerId,
            )) as any;
            const count =
              q?.total ??
              (Array.isArray(q?.questions) ? q.questions.length : null);
            questions = {
              count: typeof count === 'number' ? count : null,
              raw: JSON.stringify(q).slice(0, 250),
            };
          } catch (qe) {
            questions = { count: null, raw: `erro: ${(qe as Error).message}` };
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
          claims,
          questions,
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

  // ─── Shopee ─────────────────────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Iniciar conexão com a Shopee',
    description:
      'Assina a chamada com HMAC-SHA256, salva o state e devolve a URL onde o vendedor autoriza a loja.',
  })
  @ApiQuery({ name: 'companyId', description: 'UUID da empresa a conectar' })
  @Get('shopee/connect')
  async connectShopee(
    @TenantId() tenantId: string,
    @Query() dto: ConnectAccountDto,
  ) {
    const url = await this.shopeeService.buildAuthUrl(tenantId, dto.companyId);
    return { data: { authUrl: url } };
  }

  /**
   * Retorno da autorização da Shopee.
   *
   * O state vem no CAMINHO (não na query) porque a Shopee acrescenta `code` e
   * `shop_id` ao redirect por conta própria.
   */
  @ApiOperation({ summary: 'Callback de autorização da Shopee' })
  @Redirect('', 302)
  @Get('shopee/callback/:state')
  async callbackShopee(
    @Param('state') state: string,
    @Query('code') code?: string,
    @Query('shop_id') shopId?: string,
  ) {
    try {
      const account = await this.shopeeService.handleCallback(
        code ?? '',
        shopId ?? '',
        state,
      );
      this.logger.log(
        `Conta Shopee conectada: shop=${account.sellerId} name=${account.sellerName}`,
      );
      return {
        url: `${this.frontendUrl}/contas?shopeeConnected=${encodeURIComponent(account.sellerName)}`,
      };
    } catch (err) {
      const msg = (err as Error).message ?? 'Falha ao conectar a loja Shopee';
      this.logger.error(`Erro no callback Shopee: ${msg}`);
      return {
        url: `${this.frontendUrl}/contas?shopeeError=${encodeURIComponent(msg)}`,
      };
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Sincronizar pedidos, devoluções e conversas da Shopee',
    description:
      'Roda em segundo plano. Pedidos e devoluções dos últimos 30 dias, conversas dos últimos 7.',
  })
  @Post('shopee/sync')
  syncShopee(@TenantId() tenantId: string) {
    // Igual ao ML: roda em background para não estourar o timeout do request.
    void this.shopeeSyncService
      .syncForTenant(tenantId)
      .catch((err) =>
        this.logger.error(
          `Sync Shopee em background falhou: ${(err as Error).message}`,
        ),
      );
    return { data: { started: true } };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiOperation({
    summary: 'Diagnosticar conexão com a Shopee',
    description:
      'Mostra se as credenciais do app estão configuradas, a validade dos tokens e faz um teste real na API.',
  })
  @Get('shopee/diagnose')
  async diagnoseShopee(@TenantId() tenantId: string) {
    if (!this.shopeeService.isConfigured) {
      return {
        data: {
          ok: false,
          configured: false,
          message:
            'As credenciais do app Shopee não estão configuradas. Cadastre SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY (obtidos em open.shopee.com) nas variáveis de ambiente do servidor.',
          accounts: [],
        },
      };
    }

    const accounts = await this.accountRepo.find({
      where: { tenantId, marketplace: 'shopee', isActive: true },
    });

    if (!accounts.length) {
      return {
        data: {
          ok: false,
          configured: true,
          message:
            'Nenhuma loja Shopee conectada. Conecte uma loja na aba Contas.',
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
          shopName?: string;
          region?: string;
          status?: string;
          error?: string;
        };

        // Cada área usa uma permissão separada no app do open.shopee.com.
        // Testar uma por uma diz exatamente qual está faltando, em vez de um
        // "deu erro" genérico no meio do sync.
        type Teste = { ok: boolean; count?: number; error?: string };
        let pedidos: Teste | null = null;
        let devolucoes: Teste | null = null;
        let chat: Teste | null = null;

        try {
          const accessToken =
            await this.shopeeService.getValidAccessToken(account);
          const info = await this.shopeeService.testConnection(
            accessToken,
            account.sellerId,
          );
          tokenTest = {
            ok: true,
            shopName: info.shop_name,
            region: info.region,
            status: info.status,
          };

          const agora = Math.floor(Date.now() / 1000);
          const seteDias = agora - 7 * 86400;

          const [p, d, c] = await Promise.allSettled([
            this.shopeeService.getOrderList(accessToken, account.sellerId, {
              timeFrom: seteDias,
              timeTo: agora,
              pageSize: 100,
            }),
            this.shopeeService.getReturnList(accessToken, account.sellerId, {
              createTimeFrom: seteDias,
              createTimeTo: agora,
              pageSize: 100,
            }),
            this.shopeeService.getConversationList(
              accessToken,
              account.sellerId,
              { pageSize: 50 },
            ),
          ]);

          pedidos =
            p.status === 'fulfilled'
              ? { ok: true, count: p.value.response?.order_list?.length ?? 0 }
              : { ok: false, error: (p.reason as Error).message };
          devolucoes =
            d.status === 'fulfilled'
              ? { ok: true, count: d.value.response?.return?.length ?? 0 }
              : { ok: false, error: (d.reason as Error).message };
          chat =
            c.status === 'fulfilled'
              ? {
                  ok: true,
                  count: c.value.response?.conversations?.length ?? 0,
                }
              : { ok: false, error: (c.reason as Error).message };
        } catch (err) {
          tokenTest = { ok: false, error: (err as Error).message };
        }

        return {
          accountId: account.id,
          shopId: account.sellerId,
          sellerName: account.sellerName,
          companyId: account.companyId,
          lastSyncAt: account.lastSyncAt,
          tokenExpiresAt: account.tokenExpiresAt,
          tokenExpired: isExpired,
          minutesUntilExpiry,
          tokenTest,
          pedidos,
          devolucoes,
          chat,
        };
      }),
    );

    const tokensOk = results.every((r) => r.tokenTest.ok);
    const permissoesOk = results.every(
      (r) => r.pedidos?.ok && r.devolucoes?.ok && r.chat?.ok,
    );
    return {
      data: {
        ok: tokensOk && permissoesOk,
        configured: true,
        totalAccounts: accounts.length,
        accounts: results,
        tip: !tokensOk
          ? 'Reconecte a loja na aba Contas. Atenção: se ninguém sincronizar por 30 dias, a Shopee invalida a autorização.'
          : !permissoesOk
            ? 'A loja conecta, mas falta permissão em alguma área. Habilite-a no app em open.shopee.com e reconecte a loja.'
            : 'Conexão com a Shopee funcionando em todas as áreas.',
      },
    };
  }
}
