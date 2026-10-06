import crypto from 'crypto';

/**
 * Hash de senha com scrypt (nativo do Node, sem dependências).
 * Formato: scrypt:N:r:p:<salt base64>:<hash base64>
 * (separador ":" de propósito: sem "$", que o docker compose/.env tentaria interpolar)
 * Gere com `node scripts/hash-password.mjs` — a senha NUNCA é gravada em arquivo/log.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64')}:${key.toString('base64')}`;
}

export interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

export function parsePasswordHash(value: string | undefined): ParsedHash | null {
  if (!value) return null;
  const parts = value.trim().split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N_, r_, p_] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N_, r_, p_].every((n) => Number.isInteger(n) && n > 0)) return null;
  if (N_ < 16384 || (N_ & (N_ - 1)) !== 0) return null; // custo mínimo e potência de 2
  const salt = Buffer.from(parts[4], 'base64');
  const key = Buffer.from(parts[5], 'base64');
  if (salt.length < 8 || key.length < 32) return null;
  return { N: N_, r: r_, p: p_, salt, key };
}

export function verifyPassword(password: string, parsed: ParsedHash): boolean {
  const candidate = crypto.scryptSync(password, parsed.salt, parsed.key.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: 256 * parsed.N * parsed.r,
  });
  return crypto.timingSafeEqual(candidate, parsed.key);
}

/** Comparação em tempo constante de strings (via digest SHA-256 de tamanho fixo). */
export function safeEqual(a: string, b: string): boolean {
  const da = crypto.createHash('sha256').update(a).digest();
  const db = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(da, db);
}
