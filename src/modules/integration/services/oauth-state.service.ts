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
 * Gerencia o estado PKCE do OAuth.
 * Usa o Redis quando disponível, mas mantém um fallback em memória para que
 * o fluxo de conexão continue funcionando mesmo se o Redis estiver fora do ar
 * (o mesmo processo trata o buildAuthUrl e o callback — 1 réplica).
 * O `state` é uma string aleatória usada como chave. Após o callback, o estado
 * é consumido (deletado) para evitar replay attacks.
 */
@Injectable()
export class OAuthStateService {
  private readonly memStore = new Map<
    string,
    { data: OAuthState; expiresAt: number }
  >();

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
    const key = `oauth:state:${state}`;
    // Sempre guarda na memória como garantia
    this.memStore.set(key, {
      data,
      expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
    });
    this.pruneMemStore();
    // Tenta o Redis também, mas não quebra se estiver fora
    try {
      await this.redis.set(key, JSON.stringify(data), 'EX', STATE_TTL_SECONDS);
    } catch {
      // Redis indisponível — o fallback em memória cobre o fluxo
    }
  }

  /**
   * Recupera e deleta o estado — uso único para prevenir replay attacks.
   * Retorna null se o estado expirou ou não existe.
   */
  async consumeState(state: string): Promise<OAuthState | null> {
    const key = `oauth:state:${state}`;

    // 1) Tenta a memória primeiro
    const mem = this.memStore.get(key);
    if (mem) {
      this.memStore.delete(key);
      if (mem.expiresAt > Date.now()) return mem.data;
    }

    // 2) Tenta o Redis (caso o processo que salvou tenha sido outro)
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      await this.redis.del(key);
      return JSON.parse(data) as OAuthState;
    } catch {
      // Redis fora e não estava na memória — não há como validar
      return null;
    }
  }

  private pruneMemStore(): void {
    const now = Date.now();
    for (const [key, value] of this.memStore) {
      if (value.expiresAt <= now) this.memStore.delete(key);
    }
  }
}
