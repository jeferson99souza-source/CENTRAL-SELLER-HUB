import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';

const STATE_TTL_SECONDS = 1800; // 30 minutos para o usuário completar o OAuth

export interface OAuthState {
  tenantId: string;
  companyId: string;
  codeVerifier: string;
  marketplace: string;
}

/**
 * Gerencia o estado PKCE do OAuth armazenado no Redis.
 * O `state` é uma string aleatória usada como chave no Redis.
 * Após o callback, o estado é consumido (deletado) para evitar replay attacks.
 */
@Injectable()
export class OAuthStateService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Gera o par PKCE: code_verifier (segredo local) e code_challenge (enviado ao ML).
   * Método: S256 — code_challenge = BASE64URL(SHA256(code_verifier))
   */
  generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  generateState(): string {
    return randomBytes(16).toString('hex');
  }

  async saveState(state: string, data: OAuthState): Promise<void> {
    await this.redis.set(
      `oauth:state:${state}`,
      JSON.stringify(data),
      'EX',
      STATE_TTL_SECONDS,
    );
  }

  /**
   * Recupera e deleta o estado — uso único para prevenir replay attacks.
   * Retorna null se o estado expirou ou não existe.
   */
  async consumeState(state: string): Promise<OAuthState | null> {
    const key = `oauth:state:${state}`;
    const data = await this.redis.get(key);
    if (!data) return null;
    await this.redis.del(key);
    return JSON.parse(data) as OAuthState;
  }
}
