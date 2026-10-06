import crypto from 'crypto';
import type { DbWrapper } from '../db';

export const SESSION_COOKIE = 'nh_session';
/** Renova o prazo (sessão deslizante) no máximo a cada hora, para não escrever a cada requisição. */
const RENEW_AFTER_MS = 60 * 60 * 1000;

const sha256 = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
/** Token com 256 bits de entropia. Formato fixo para rejeitar lixo antes de consultar o banco. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export interface SessionInfo {
  expiresAt: number;
  createdAt: number;
}

export async function createSession(db: DbWrapper, ttlMs: number, now = Date.now()): Promise<{ token: string; expiresAt: number }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = now + ttlMs;
  await db.run('INSERT INTO sessions (id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)', [sha256(token), now, now, expiresAt]);
  return { token, expiresAt };
}

/** Valida o token contra o banco (única autoridade). Sessão expirada é removida e tratada como inexistente. */
export async function validateSession(db: DbWrapper, token: string | undefined, ttlMs: number, now = Date.now()): Promise<SessionInfo | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const id = sha256(token);
  const row = await db.get('SELECT id, created_at, last_seen_at, expires_at FROM sessions WHERE id = ?', id);
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.run('DELETE FROM sessions WHERE id = ?', id);
    return null;
  }
  let expiresAt = row.expires_at as number;
  if (now - row.last_seen_at >= RENEW_AFTER_MS) {
    expiresAt = now + ttlMs;
    await db.run('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?', [now, expiresAt, id]);
  }
  return { expiresAt, createdAt: row.created_at };
}

export async function revokeSession(db: DbWrapper, token: string | undefined): Promise<boolean> {
  if (!token || !TOKEN_RE.test(token)) return false;
  const r = await db.run('DELETE FROM sessions WHERE id = ?', sha256(token));
  return r.changes > 0;
}

/** Limpeza oportunista (sem cron): chamada no login e na inicialização. */
export async function purgeExpiredSessions(db: DbWrapper, now = Date.now()): Promise<number> {
  const r = await db.run('DELETE FROM sessions WHERE expires_at <= ?', now);
  return r.changes;
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === SESSION_COOKIE) {
      const raw = part.slice(i + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
