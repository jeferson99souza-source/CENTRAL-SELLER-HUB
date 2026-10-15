import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../../accounts/accounts.service';
import { MarketplaceAccount } from '../../accounts/entities/marketplace-account.entity';
import { TokenEncryptionService } from '../../../common/crypto/token-encryption.service';
import { OAuthStateService } from './oauth-state.service';

/**
 * A Shopee responde HTTP 200 mesmo quando dá erro, sinalizando no campo
 * `error`. Toda resposta precisa ser checada por esse campo — nunca pelo
 * status HTTP apenas.
 */
interface ShopeeEnvelope {
  error?: string;
  message?: string;
  request_id?: string;
}

interface ShopeeTokenResponse extends ShopeeEnvelope {
  access_token?: string;
  refresh_token?: string;
  /** Validade do access_token em segundos (≈4h). A Shopee chama de expire_in. */
  expire_in?: number;
  expires_in?: number;
  shop_id_list?: number[];
  merchant_id_list?: number[];
}

interface ShopeeShopInfo extends ShopeeEnvelope {
  shop_name?: string;
  region?: string;
  status?: string;
  shop_id?: number;
}

/**
 * Serviço de integração com a Shopee (Open Platform API v2).
 *
 * Diferenças importantes em relação ao Mercado Livre:
 *
 *  1. Não é OAuth padrão. Toda chamada é assinada com HMAC-SHA256 sobre
 *     `partner_id + caminho + timestamp [+ access_token + shop_id]`.
 *  2. O access_token dura ~4 horas (o do ML dura 6) e o refresh_token dura
 *     30 dias. Se ninguém sincronizar por 30 dias, a conta precisa ser
 *     reconectada à mão.
 *  3. Erro vem com HTTP 200 e campo `error` preenchido.
 *  4. O Brasil tem host próprio: openplatform.shopee.com.br
 *
 * Fluxo de conexão:
 *  1. buildAuthUrl()   → salva o state e devolve a URL de autorização
 *  2. handleCallback() → troca o code por tokens, busca o nome da loja, salva
 *  3. refreshAccountToken() → renova o access_token
 */
@Injectable()
export class ShopeeService {
  private readonly logger = new Logger(ShopeeService.name);
  private readonly baseUrl: string;
  private readonly partnerId: string;
  private readonly partnerKey: string;
  private readonly callbackUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly oauthState: OAuthStateService,
    private readonly encryption: TokenEncryptionService,
    private readonly accountsService: AccountsService,
  ) {
    // Brasil tem host próprio. O global (partner.shopeemobile.com) não
    // atende lojas brasileiras.
    this.baseUrl = this.config.get<string>(
      'SHOPEE_API_BASE_URL',
      'https://openplatform.shopee.com.br',
    );
    this.partnerId = this.config.get<string>('SHOPEE_PARTNER_ID', '');
    this.partnerKey = this.config.get<string>('SHOPEE_PARTNER_KEY', '');
    this.callbackUrl = this.config.get<string>(
      'SHOPEE_REDIRECT_URI',
      'https://central-seller-hub-production-c6ae.up.railway.app/api/v1/integration/shopee/callback',
    );
  }

  /** True quando as credenciais do app Shopee estão configuradas. */
  get isConfigured(): boolean {
    return Boolean(this.partnerId && this.partnerKey);
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new BadRequestException(
        'A integração com a Shopee não está configurada. ' +
          'Cadastre SHOPEE_PARTNER_ID e SHOPEE_PARTNER_KEY (obtidos em open.shopee.com) nas variáveis de ambiente.',
      );
    }
  }

  // ─── Assinatura HMAC-SHA256 ─────────────────────────────────────────────────

  /**
   * Monta a assinatura exigida em toda chamada.
   *
   * Base: partner_id + caminho + timestamp [+ access_token + shop_id]
   * Os dois últimos só entram nas chamadas com escopo de loja; nas públicas
   * (autenticação) ficam de fora.
   */
  private sign(
    path: string,
    timestamp: number,
    accessToken?: string,
    shopId?: string,
  ): string {
    const base = `${this.partnerId}${path}${timestamp}${accessToken ?? ''}${shopId ?? ''}`;
    return createHmac('sha256', this.partnerKey).update(base).digest('hex');
  }

  /** Erro da Shopee vem em HTTP 200 — checa o campo `error` sempre. */
  private unwrap<T extends ShopeeEnvelope>(data: T, context: string): T {
    if (data?.error) {
      const detail = data.message || data.error;
      // Token inválido/expirado tem tratamento próprio para a UI orientar a reconexão
      if (
        data.error.includes('token') ||
        data.error === 'error_auth' ||
        data.error === 'invalid_access_token'
      ) {
        throw new UnauthorizedException(
          `Sua conexão com a Shopee expirou (${data.error}). Vá em Contas e clique em Reconectar.`,
        );
      }
      throw new BadRequestException(`Shopee ${context}: ${detail}`);
    }
    return data;
  }

  // ─── Chamadas públicas (autenticação) ───────────────────────────────────────

  private async publicPost<T extends ShopeeEnvelope>(
    path: string,
    body: Record<string, unknown>,
    context: string,
  ): Promise<T> {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      partner_id: this.partnerId,
      timestamp: String(timestamp),
      sign: this.sign(path, timestamp),
    });

    try {
      const { data } = await axios.post<T>(
        `${this.baseUrl}${path}?${params.toString()}`,
        { ...body, partner_id: Number(this.partnerId) },
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
      );
      return this.unwrap(data, context);
    } catch (err) {
      throw this.toReadableError(err, context);
    }
  }

  // ─── Chamadas com escopo de loja ────────────────────────────────────────────

  async shopGet<T extends ShopeeEnvelope>(
    path: string,
    accessToken: string,
    shopId: string,
    extraParams: Record<string, string | number> = {},
  ): Promise<T> {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      partner_id: this.partnerId,
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: shopId,
      sign: this.sign(path, timestamp, accessToken, shopId),
    });
    for (const [key, value] of Object.entries(extraParams)) {
      params.set(key, String(value));
    }

    try {
      const { data } = await axios.get<T>(
        `${this.baseUrl}${path}?${params.toString()}`,
        { timeout: 20000 },
      );
      return this.unwrap(data, path);
    } catch (err) {
      throw this.toReadableError(err, path);
    }
  }

  async shopPost<T extends ShopeeEnvelope>(
    path: string,
    accessToken: string,
    shopId: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      partner_id: this.partnerId,
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: shopId,
      sign: this.sign(path, timestamp, accessToken, shopId),
    });

    try {
      const { data } = await axios.post<T>(
        `${this.baseUrl}${path}?${params.toString()}`,
        body,
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
      );
      return this.unwrap(data, path);
    } catch (err) {
      throw this.toReadableError(err, path);
    }
  }

  private toReadableError(err: unknown, context: string): Error {
    if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
      return err;
    }
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as ShopeeEnvelope | undefined;
      const detail = body?.message || body?.error || err.message;
      return new BadRequestException(
        `Shopee ${context} (${err.response?.status ?? 'sem resposta'}): ${detail}`,
      );
    }
    return new BadRequestException(
      `Shopee ${context}: ${(err as Error).message}`,
    );
  }

  // ─── Conexão da loja ────────────────────────────────────────────────────────

  /**
   * Monta a URL onde o vendedor autoriza a loja.
   *
   * O state vai no CAMINHO da URL de retorno (e não como query), porque a
   * Shopee acrescenta `code` e `shop_id` ao redirect e não há garantia de
   * como ela lida com uma query string já existente.
   */
  async buildAuthUrl(tenantId: string, companyId: string): Promise<string> {
    this.assertConfigured();

    const state = this.oauthState.generateState();
    await this.oauthState.saveState(state, {
      tenantId,
      companyId,
      codeVerifier: '', // a Shopee não usa PKCE
      marketplace: 'shopee',
    });

    const path = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({
      partner_id: this.partnerId,
      timestamp: String(timestamp),
      sign: this.sign(path, timestamp),
      redirect: `${this.callbackUrl}/${state}`,
    });

    this.logger.log(
      `Auth URL Shopee gerada para tenant=${tenantId} company=${companyId}`,
    );
    return `${this.baseUrl}${path}?${params.toString()}`;
  }

  /**
   * Processa o retorno da autorização: troca o code pelos tokens, descobre o
   * nome da loja e salva a conta com os tokens criptografados.
   */
  async handleCallback(
    code: string,
    shopId: string,
    state: string,
  ): Promise<MarketplaceAccount> {
    if (!code) throw new BadRequestException('Shopee não devolveu o code.');
    if (!shopId)
      throw new BadRequestException('Shopee não devolveu o shop_id.');

    const oauthData = state ? await this.oauthState.consumeState(state) : null;
    if (!oauthData) {
      throw new BadRequestException(
        'A autorização expirou ou é inválida. Tente conectar novamente.',
      );
    }

    const tokens = await this.publicPost<ShopeeTokenResponse>(
      '/api/v2/auth/token/get',
      { code, shop_id: Number(shopId) },
      'troca do code por tokens',
    );

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new BadRequestException(
        'A Shopee não devolveu os tokens de acesso.',
      );
    }

    // A Shopee chama de `expire_in`; aceita `expires_in` por segurança.
    const expiresInSeconds = tokens.expire_in ?? tokens.expires_in ?? 4 * 3600;

    // Nome da loja — se falhar, não impede a conexão
    let shopName = `Loja ${shopId}`;
    try {
      const info = await this.getShopInfo(tokens.access_token, shopId);
      if (info.shop_name) shopName = info.shop_name;
    } catch (err) {
      this.logger.warn(
        `Conta conectada, mas não foi possível ler o nome da loja: ${(err as Error).message}`,
      );
    }

    const account = await this.accountsService.upsertMarketplaceAccount({
      tenantId: oauthData.tenantId,
      companyId: oauthData.companyId,
      marketplace: 'shopee',
      sellerId: String(shopId),
      sellerName: shopName,
      accessTokenEnc: this.encryption.encrypt(tokens.access_token),
      refreshTokenEnc: this.encryption.encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    this.logger.log(
      `Conta Shopee conectada: loja=${shopName} (${shopId}) tenant=${oauthData.tenantId}`,
    );
    return account;
  }

  /**
   * Renovações em voo por conta. Mesma lição aprendida no Mercado Livre: se
   * duas renovações rodarem ao mesmo tempo, uma invalida a outra e a conta
   * "quebra". Todas as chamadas concorrentes compartilham a mesma renovação.
   */
  private readonly refreshInFlight = new Map<string, Promise<string>>();

  async refreshAccountToken(account: MarketplaceAccount): Promise<string> {
    const running = this.refreshInFlight.get(account.id);
    if (running) return running;

    const promise = this.doRefreshAccountToken(account).finally(() => {
      this.refreshInFlight.delete(account.id);
    });
    this.refreshInFlight.set(account.id, promise);
    return promise;
  }

  private async doRefreshAccountToken(
    account: MarketplaceAccount,
  ): Promise<string> {
    const refreshToken = this.encryption.decrypt(account.refreshTokenEnc);

    const tokens = await this.publicPost<ShopeeTokenResponse>(
      '/api/v2/auth/access_token/get',
      { refresh_token: refreshToken, shop_id: Number(account.sellerId) },
      'renovação do token',
    );

    if (!tokens.access_token) {
      throw new UnauthorizedException(
        'A Shopee não renovou o token. Vá em Contas e clique em Reconectar.',
      );
    }

    const expiresInSeconds = tokens.expire_in ?? tokens.expires_in ?? 4 * 3600;

    await this.accountsService.updateTokens(account.id, {
      accessTokenEnc: this.encryption.encrypt(tokens.access_token),
      // A Shopee pode rotacionar o refresh_token — guarda o novo quando vier
      refreshTokenEnc: tokens.refresh_token
        ? this.encryption.encrypt(tokens.refresh_token)
        : account.refreshTokenEnc,
      tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return tokens.access_token;
  }

  /** Devolve um access_token válido, renovando se já venceu. */
  async getValidAccessToken(account: MarketplaceAccount): Promise<string> {
    const isExpired =
      !account.tokenExpiresAt || account.tokenExpiresAt < new Date();
    return isExpired
      ? this.refreshAccountToken(account)
      : this.encryption.decrypt(account.accessTokenEnc);
  }

  // ─── Chamadas de leitura ────────────────────────────────────────────────────

  async getShopInfo(
    accessToken: string,
    shopId: string,
  ): Promise<ShopeeShopInfo> {
    return this.shopGet<ShopeeShopInfo>(
      '/api/v2/shop/get_shop_info',
      accessToken,
      shopId,
    );
  }

  /** Teste de conexão usado pelo diagnóstico. */
  async testConnection(
    accessToken: string,
    shopId: string,
  ): Promise<ShopeeShopInfo> {
    return this.getShopInfo(accessToken, shopId);
  }
}
