import { parsePasswordHash, ParsedHash, safeEqual, verifyPassword } from './password';

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(`[AUTENTICAÇÃO] ${message}`);
    this.name = 'AuthConfigError';
  }
}

export interface AuthConfig {
  mode: 'production' | 'dev-insecure' | 'unconfigured';
  username: string;
  /** Cookie `Secure`: somente em produção (HTTPS). */
  cookieSecure: boolean;
  sessionTtlMs: number;
  /** Retorna true se a senha confere. Sempre executa trabalho equivalente (resistência a timing). */
  checkPassword: (password: string) => boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_SESSION_DAYS = 30;

/**
 * Lê e VALIDA a configuração de autenticação do ambiente.
 *  - PRODUÇÃO: exige AUTH_USERNAME e AUTH_PASSWORD_HASH (scrypt). Ausente/inválido → lança (fail-fast).
 *    Jamais existe senha padrão. AUTH_DEV_INSECURE_PASSWORD em produção também é recusada.
 *  - FORA de produção: credencial só se AUTH_PASSWORD_HASH ou AUTH_DEV_INSECURE_PASSWORD forem definidas
 *    explicitamente (o nome deixa claro que é só para dev/teste). Sem nenhuma, o login fica indisponível.
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const isProduction = env.NODE_ENV === 'production';
  const username = (env.AUTH_USERNAME || '').trim();
  const ttlDays = Number(env.SESSION_TTL_DAYS || DEFAULT_SESSION_DAYS);
  if (!Number.isFinite(ttlDays) || ttlDays <= 0 || ttlDays > 365) {
    throw new AuthConfigError('SESSION_TTL_DAYS inválido (use 1–365).');
  }
  const sessionTtlMs = ttlDays * DAY_MS;

  if (isProduction) {
    if (env.AUTH_DEV_INSECURE_PASSWORD) {
      throw new AuthConfigError('AUTH_DEV_INSECURE_PASSWORD não pode ser usada em produção. Remova-a do ambiente.');
    }
    if (!username) throw new AuthConfigError('AUTH_USERNAME é obrigatório em produção.');
    if (!env.AUTH_PASSWORD_HASH) {
      throw new AuthConfigError('AUTH_PASSWORD_HASH é obrigatório em produção. Gere com: node scripts/hash-password.mjs');
    }
    const parsed = parsePasswordHash(env.AUTH_PASSWORD_HASH);
    if (!parsed) {
      throw new AuthConfigError(
        'AUTH_PASSWORD_HASH inválido. Formato esperado: scrypt:N:r:p:salt:hash (o formato SHA-256 antigo não é mais aceito). Gere com: node scripts/hash-password.mjs'
      );
    }
    return { mode: 'production', username, cookieSecure: true, sessionTtlMs, checkPassword: (pw) => verifyPassword(pw, parsed) };
  }

  const name = username || 'Bernardo';
  if (env.AUTH_PASSWORD_HASH) {
    const parsed = parsePasswordHash(env.AUTH_PASSWORD_HASH);
    if (!parsed) throw new AuthConfigError('AUTH_PASSWORD_HASH inválido (formato scrypt:N:r:p:salt:hash).');
    return { mode: 'dev-insecure', username: name, cookieSecure: false, sessionTtlMs, checkPassword: (pw) => verifyPassword(pw, parsed) };
  }
  if (env.AUTH_DEV_INSECURE_PASSWORD) {
    const expected = env.AUTH_DEV_INSECURE_PASSWORD;
    return { mode: 'dev-insecure', username: name, cookieSecure: false, sessionTtlMs, checkPassword: (pw) => safeEqual(pw, expected) };
  }
  return { mode: 'unconfigured', username: name, cookieSecure: false, sessionTtlMs, checkPassword: () => false };
}

let cached: { key: string; config: AuthConfig } | null = null;

/** Configuração em cache por conteúdo relevante do ambiente (recarrega se o ambiente mudar, ex.: testes). */
export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const key = JSON.stringify([env.NODE_ENV, env.AUTH_USERNAME, env.AUTH_PASSWORD_HASH, env.AUTH_DEV_INSECURE_PASSWORD, env.SESSION_TTL_DAYS]);
  if (!cached || cached.key !== key) cached = { key, config: loadAuthConfig(env) };
  return cached.config;
}
