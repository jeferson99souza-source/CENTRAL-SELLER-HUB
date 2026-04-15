import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
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
    this.logger.log(`Auth URL gerada para tenant=${tenantId} company=${companyId}`);
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
    const oauthData = await this.oauthState.consumeState(state);
    if (!oauthData) {
      throw new BadRequestException(
        'State OAuth inválido ou expirado. Reinicie o processo de conexão.',
      );
    }

    const tokens = await this.exchangeCodeForTokens(
      code,
      oauthData.codeVerifier,
    );

    const profile = await this.getSellerProfile(tokens.access_token);

    const tokenExpiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    );

    const account = await this.accountsService.upsertMarketplaceAccount({
      tenantId: oauthData.tenantId,
      companyId: oauthData.companyId,
      marketplace: 'mercadolivre',
      sellerId: String(profile.id),
      sellerName: profile.nickname,
      accessTokenEnc: this.encryption.encrypt(tokens.access_token),
      refreshTokenEnc: this.encryption.encrypt(tokens.refresh_token),
      tokenExpiresAt,
    });

    this.logger.log(
      `Conta ML conectada: seller=${profile.nickname} tenant=${oauthData.tenantId}`,
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

  async getMessages(accessToken: string, packId: string): Promise<unknown> {
    this.logger.log(`Buscando mensagens do pack ${packId}`);
    return this.mlGet(`/messages/packs/${packId}?tag=post_sale`, accessToken);
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
      `/post-purchase/v1/claims/search?seller_id=${sellerId}`,
      accessToken,
    );
  }

  async getOrders(accessToken: string, sellerId: string): Promise<unknown> {
    this.logger.log(`Buscando pedidos seller=${sellerId}`);
    return this.mlGet(
      `/orders/search?seller=${sellerId}&sort=date_desc`,
      accessToken,
    );
  }

  // ─── Privado ────────────────────────────────────────────────────────────────

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<MlTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.appId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
    });

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
      throw new UnauthorizedException('Falha ao renovar token do Mercado Livre');
    }

    return response.json() as Promise<MlTokenResponse>;
  }

  private async getSellerProfile(accessToken: string): Promise<MlUserProfile> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Não foi possível obter perfil do vendedor no ML');
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
