import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../../accounts/accounts.service';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { TokenEncryptionService } from '../../../common/crypto/token-encryption.service';
import { OAuthStateService } from './oauth-state.service';

interface MlTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // segundos
  user_id: number;
  token_type: string;
}

interface MlUserProfile {
  id: number;
  nickname: string;
  email: string;
}

/**
 * Serviço de integração com o Mercado Livre.
 *
 * Fluxo OAuth 2.0 + PKCE (S256):
 *  1. buildAuthUrl()   → gera PKCE, salva state no Redis, retorna URL de autorização
 *  2. handleCallback() → valida state + code_verifier, troca code por tokens, salva criptografado
 *  3. refreshToken()   → usa refresh_token para obter novo access_token
 *
 * Regra: operações de sync vão para fila RabbitMQ, NÃO chamam a API diretamente no request.
 */
@Injectable()
export class MercadoLivreService {
  private readonly logger = new Logger(MercadoLivreService.name);
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl: string;
  private readonly tokenUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly oauthState: OAuthStateService,
    private readonly encryption: TokenEncryptionService,
    private readonly accountsService: AccountsService,
  ) {
    this.baseUrl = this.config.getOrThrow<string>('ML_API_BASE_URL');
    this.appId = this.config.getOrThrow<string>('ML_APP_ID');
    this.clientSecret = this.config.getOrThrow<string>('ML_CLIENT_SECRET');
    this.redirectUri = this.config.getOrThrow<string>('ML_REDIRECT_URI');
    this.authUrl = this.config.getOrThrow<string>('ML_AUTH_URL');
    this.tokenUrl = this.config.getOrThrow<string>('ML_TOKEN_URL');
  }

  // ─── OAuth ─────────────────────────────────────────────────────────────────

  /**
   * Monta a URL de autorização do ML com PKCE S256.
   * Salva state + code_verifier no Redis (TTL 10 min).
   */
  async buildAuthUrl(tenantId: string, companyId: string): Promise<string> {
    const { codeVerifier, codeChallenge } = this.oauthState.generatePKCE();
    const state = this.oauthState.generateState();

    await this.oauthState.saveState(state, {
      tenantId,
      companyId,
      codeVerifier,
      marketplace: 'mercadolivre',
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const url = `${this.authUrl}?${params.toString()}`;
    this.logger.log(
      `Auth URL gerada para tenant=${tenantId} company=${companyId}`,
    );
    return url;
  }

  /**
   * Processa o callback do ML:
   * 1. Valida e consome o state do Redis (evita replay)
   * 2. Troca code + code_verifier por tokens
   * 3. Busca perfil do vendedor
   * 4. Criptografa tokens e salva na conta
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<MarketplaceAccount> {
    const oauthData = state ? await this.oauthState.consumeState(state) : null;
    const tenantId = oauthData?.tenantId || '00000000-0000-0000-0000-000000000001';
    let companyId = oauthData?.companyId;

    if (!companyId) {
      const companies = await this.accountsService.findAllCompanies(tenantId);
      if (companies.length > 0) {
        companyId = companies[0].id;
      } else {
        const defaultCompany = await this.accountsService.createCompany(tenantId, {
          name: 'Empresa Principal',
          cnpj: '00.000.000/0001-00',
        });
        companyId = defaultCompany.id;
      }
    }

    const tokens = await this.exchangeCodeForTokens(
      code,
      oauthData?.codeVerifier,
    );

    const profile = await this.getSellerProfile(tokens.access_token);

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const account = await this.accountsService.upsertMarketplaceAccount({
      tenantId,
      companyId,
      marketplace: 'mercadolivre',
      sellerId: String(profile.id),
      sellerName: profile.nickname,
      accessTokenEnc: this.encryption.encrypt(tokens.access_token),
      refreshTokenEnc: this.encryption.encrypt(tokens.refresh_token),
      tokenExpiresAt,
    });

    this.logger.log(
      `Conta ML conectada: seller=${profile.nickname} tenant=${tenantId}`,
    );
    return account;
  }

  /**
   * Renova o access_token usando o refresh_token criptografado armazenado.
   * Atualiza a conta com os novos tokens.
   */
  async refreshAccountToken(account: MarketplaceAccount): Promise<string> {
    const refreshToken = this.encryption.decrypt(account.refreshTokenEnc);
    const tokens = await this.exchangeRefreshToken(refreshToken);

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.accountsService.updateTokens(account.id, {
      accessTokenEnc: this.encryption.encrypt(tokens.access_token),
      refreshTokenEnc: this.encryption.encrypt(tokens.refresh_token),
      tokenExpiresAt,
    });

    return tokens.access_token;
  }

  // ─── API Calls ──────────────────────────────────────────────────────────────

  async getMessages(
    accessToken: string,
    packId: string,
    sellerId: string,
  ): Promise<unknown> {
    this.logger.log(`Buscando mensagens do pack ${packId}`);
    // Endpoint correto: /messages/packs/{pack_id}/sellers/{seller_id}?tag=post_sale&mark_as_read=false
    const data = await this.mlGet(
      `/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale&mark_as_read=false`,
      accessToken,
    );
    const messages = (data as any)?.messages ?? [];
    this.logger.log(`Pack ${packId}: ${messages.length} mensagens encontradas`);
    return data;
  }

  async sendMessage(
    accessToken: string,
    packId: string,
    sellerId: string,
    buyerId: string,
    text: string,
  ): Promise<unknown> {
    const sellerNum = parseInt(sellerId, 10);
    const buyerNum = parseInt(buyerId, 10);

    if (isNaN(sellerNum))
      throw new Error(`sellerId inválido para envio: "${sellerId}"`);
    if (isNaN(buyerNum) || buyerNum <= 0)
      throw new Error(`buyerId inválido para envio: "${buyerId}"`);

    // ML infere o remetente pelo token OAuth — 'from' explícito pode causar conflito
    const payload = {
      to: [{ user_id: buyerNum }],
      text: { plain: text },
      attachments: [],
    };

    const url = `${this.baseUrl}/messages/packs/${packId}/sellers/${sellerNum}?tag=post_sale`;
    const bodyStr = JSON.stringify(payload);
    this.logger.log(`[sendMessage] URL=${url}`);
    this.logger.log(`[sendMessage] body=${bodyStr}`);

    try {
      const { data } = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      this.logger.log(`[sendMessage] Sucesso: ${JSON.stringify(data)}`);
      return data;
    } catch (err) {
      const status = err?.response?.status;
      const mlError = err?.response?.data;
      const detail = JSON.stringify(mlError ?? (err as Error).message);
      this.logger.error(
        `[sendMessage] ERRO ${status} | URL=${url} | body=${bodyStr} | response=${detail}`,
      );
      throw new Error(`ML ${status}: ${detail}`);
    }
  }

  async getUnansweredQuestions(
    accessToken: string,
    sellerId: string,
  ): Promise<unknown> {
    this.logger.log(`Buscando perguntas sem resposta seller=${sellerId}`);
    return this.mlGet(
      `/questions/search?seller_id=${sellerId}&status=UNANSWERED`,
      accessToken,
    );
  }

  async getClaims(accessToken: string, sellerId: string): Promise<unknown> {
    this.logger.log(`Buscando reclamações seller=${sellerId}`);
    return this.mlGet(
      `/post-purchase/v1/claims/search?seller_id=${sellerId}&player_role=respondent&player_user_id=${sellerId}&limit=50`,
      accessToken,
    );
  }

  async getClaimDetail(accessToken: string, claimId: string): Promise<unknown> {
    this.logger.log(`Buscando detalhes da reclamação ${claimId}`);
    return this.mlGet(`/post-purchase/v1/claims/${claimId}`, accessToken);
  }

  async getClaimReturns(
    accessToken: string,
    claimId: string,
  ): Promise<unknown> {
    this.logger.log(`Buscando devolução da reclamação ${claimId}`);
    return this.mlGet(
      `/post-purchase/v1/claims/${claimId}/returns`,
      accessToken,
    );
  }

  async getOrderById(accessToken: string, orderId: string): Promise<unknown> {
    this.logger.log(`Buscando pedido ${orderId}`);
    return this.mlGet(`/orders/${orderId}`, accessToken);
  }

  async getItem(accessToken: string, itemId: string): Promise<unknown> {
    return this.mlGet(`/items/${itemId}`, accessToken);
  }

  /**
   * Testa se o token está válido fazendo uma chamada ao /users/me.
   * Retorna os dados do usuário logado ou lança exceção se inválido.
   */
  async testConnection(accessToken: string): Promise<MlUserProfile> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(
        `Teste de conexão ML falhou ${response.status}: ${err}`,
      );
      if (response.status === 429) {
        throw new Error(
          `Rate limit do Mercado Livre atingido (HTTP 429) — aguarde alguns segundos e tente novamente`,
        );
      }
      throw new UnauthorizedException(
        `Token inválido ou sem permissão (HTTP ${response.status})`,
      );
    }

    return response.json() as Promise<MlUserProfile>;
  }

  async getUser(accessToken: string, userId: string): Promise<unknown> {
    return this.mlGet(`/users/${userId}`, accessToken);
  }

  async answerQuestion(
    accessToken: string,
    questionId: number,
    text: string,
  ): Promise<unknown> {
    this.logger.log(`Respondendo pergunta ${questionId}`);
    const response = await fetch(`${this.baseUrl}/answers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question_id: questionId, text }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Erro ao responder pergunta ${questionId}: ${err}`);
      throw new Error(`Erro ao responder no ML: ${response.status} — ${err}`);
    }

    return response.json();
  }

  async blockBuyer(
    accessToken: string,
    sellerId: string,
    buyerId: string,
  ): Promise<unknown> {
    this.logger.log(`Bloqueando comprador ${buyerId} para seller=${sellerId}`);
    const response = await fetch(
      `${this.baseUrl}/users/${sellerId}/blacklisted_users`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user: { id: Number(buyerId) } }),
      },
    );
    if (!response.ok) {
      const err = await response.text();
      this.logger.warn(`Aviso ao bloquear comprador ${buyerId}: ${err}`);
      // Não lança exceção — bloqueio local continua mesmo se ML rejeitar
    }
    return { blocked: true };
  }

  async getOrders(
    accessToken: string,
    sellerId: string,
    daysBack = 90,
    offset = 0,
  ): Promise<unknown> {
    const now = new Date();
    const from = new Date();
    from.setDate(from.getDate() - daysBack);

    // Usamos date_last_updated para trazer pedidos antigos que tiveram mensagens/alterações recentes
    const dateFrom = from.toISOString().split('.')[0] + '.000-00:00';
    const dateTo = now.toISOString().split('.')[0] + '.000-00:00';

    this.logger.log(
      `Buscando pedidos seller=${sellerId} offset=${offset} limit=50 de ${dateFrom} ate ${dateTo}`,
    );

    return this.mlGet(
      `/orders/search?seller=${sellerId}&sort=date_desc&offset=${offset}&limit=50&order.date_last_updated.from=${encodeURIComponent(dateFrom)}&order.date_last_updated.to=${encodeURIComponent(dateTo)}`,
      accessToken,
    );
  }

  // ─── Privado ────────────────────────────────────────────────────────────────

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier?: string,
  ): Promise<MlTokenResponse> {
    const params: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: this.appId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    };
    if (codeVerifier) {
      params.code_verifier = codeVerifier;
    }

    const body = new URLSearchParams(params);

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Erro ao trocar code por token: ${err}`);
      throw new UnauthorizedException('Falha ao obter tokens do Mercado Livre');
    }

    return response.json() as Promise<MlTokenResponse>;
  }

  private async exchangeRefreshToken(
    refreshToken: string,
  ): Promise<MlTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.appId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Erro ao renovar token: ${err}`);
      throw new UnauthorizedException(
        'Falha ao renovar token do Mercado Livre',
      );
    }

    return response.json() as Promise<MlTokenResponse>;
  }

  private async getSellerProfile(accessToken: string): Promise<MlUserProfile> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        'Não foi possível obter perfil do vendedor no ML',
      );
    }

    return response.json() as Promise<MlUserProfile>;
  }

  private async mlGet(path: string, accessToken: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`ML API error ${response.status}: ${err}`);
      throw new Error(`Erro na API do Mercado Livre: ${response.status}`);
    }

    return response.json();
  }
}
