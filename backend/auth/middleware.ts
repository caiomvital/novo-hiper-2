import type { NextFunction, Request, Response } from 'express';
import { getDb } from '../db';
import { getAuthConfig } from './config';
import { readSessionToken, validateSession } from './sessions';

/**
 * Rotas /api PÚBLICAS (allowlist exata). Todo o resto de /api exige sessão válida.
 *  - GET  /api/health          monitoramento (Docker healthcheck / checagem de disponibilidade)
 *  - POST /api/auth/login      precisa ser acessível sem sessão
 *  - POST /api/auth/logout     idempotente e sem dados: invalida a sessão se houver e limpa o cookie
 * (/uploads/* — fotos de plantas — é servido fora de /api e permanece público de propósito.)
 */
export const PUBLIC_API_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'GET', path: '/api/health' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/logout' },
];

const normalize = (p: string) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);

export function isPublicApiRoute(method: string, path: string): boolean {
  const m = method.toUpperCase();
  const p = normalize(path);
  return PUBLIC_API_ROUTES.some((r) => r.method === (m === 'HEAD' ? 'GET' : m) && r.path === p);
}

/** 401 para qualquer /api que não esteja na allowlist e não tenha sessão válida NO SERVIDOR. */
export async function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    // montado em app.use('/api', …): baseUrl = '/api', path = restante
    if (isPublicApiRoute(req.method, `${req.baseUrl}${req.path}`)) return next();

    const cfg = getAuthConfig();
    const db = await getDb();
    const session = await validateSession(db, readSessionToken(req.headers.cookie), cfg.sessionTtlMs);
    if (!session) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(401).json({ code: 'UNAUTHENTICATED', error: 'Sessão ausente ou expirada. Faça login.' });
      return;
    }
    (req as any).session = session;
    next();
  } catch (err) {
    next(err);
  }
}

// ───────────────────────────── CSRF ─────────────────────────────
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Hosts aceitos como "este mesmo site": Host / X-Forwarded-Host da requisição + hosts de CORS_ORIGIN. */
export function allowedOriginHosts(req: { headers: Request['headers'] }): Set<string> {
  const hosts = new Set<string>();
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (host) hosts.add(host.split(',')[0].trim().toLowerCase());
  for (const o of (process.env.CORS_ORIGIN || '').split(',')) {
    const t = o.trim();
    if (!t || t === '*') continue;
    try {
      hosts.add(new URL(t).host.toLowerCase());
    } catch {
      /* ignora entrada inválida */
    }
  }
  return hosts;
}

/** `origin` (cabeçalho Origin) pertence ao próprio site ou a uma origem explicitamente permitida? */
export function isTrustedOrigin(req: { headers: Request['headers'] }, origin: string): boolean {
  try {
    return allowedOriginHosts(req).has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Proteção CSRF para métodos mutáveis (defesa em profundidade além de SameSite=Strict):
 *  1. `Sec-Fetch-Site: cross-site|same-site` → recusa (navegadores modernos sempre enviam; não é forjável por página web).
 *  2. Com `Origin`: o host precisa ser o do próprio site (Host / X-Forwarded-Host) ou estar em CORS_ORIGIN.
 *  3. Sem Origin nem Sec-Fetch-Site (curl, scripts, servidor→servidor): permitido — não é um vetor CSRF,
 *     pois o navegador sempre envia Origin em POST/PUT/PATCH/DELETE cross-origin; e a sessão (cookie) continua exigida.
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

  const fetchSite = req.headers['sec-fetch-site'];
  const origin = req.headers.origin;

  const deny = () => {
    res.status(403).json({ code: 'CSRF_BLOCKED', error: 'Requisição de origem não autorizada.' });
  };

  if (typeof origin === 'string' && origin !== 'null') {
    return isTrustedOrigin(req, origin) ? next() : deny();
  }
  if (origin === 'null') return deny(); // contextos opacos (iframes sandbox, file://)
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return deny();
  return next();
}

// ───────────────────────── limite de tentativas de login ─────────────────────────
interface Bucket {
  failures: number;
  firstAt: number;
}
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const buckets = new Map<string, Bucket>();

export const loginRateLimit = {
  /** Segundos restantes se este cliente está bloqueado, senão 0. */
  blockedFor(key: string, now = Date.now()): number {
    const b = buckets.get(key);
    if (!b) return 0;
    if (now - b.firstAt > WINDOW_MS) {
      buckets.delete(key);
      return 0;
    }
    return b.failures >= MAX_FAILURES ? Math.ceil((b.firstAt + WINDOW_MS - now) / 1000) : 0;
  },
  fail(key: string, now = Date.now()) {
    const b = buckets.get(key);
    if (!b || now - b.firstAt > WINDOW_MS) buckets.set(key, { failures: 1, firstAt: now });
    else b.failures++;
  },
  success(key: string) {
    buckets.delete(key);
  },
  reset() {
    buckets.clear();
  },
};
