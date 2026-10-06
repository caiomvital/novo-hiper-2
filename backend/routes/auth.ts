import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { getAuthConfig } from '../auth/config';
import { loginRateLimit } from '../auth/middleware';
import {
  createSession,
  purgeExpiredSessions,
  readSessionToken,
  revokeSession,
  SESSION_COOKIE,
} from '../auth/sessions';
import { safeEqual } from '../auth/password';

export const authRouter = Router();

const cookieOptions = () => {
  const cfg = getAuthConfig();
  return {
    httpOnly: true,
    secure: cfg.cookieSecure,
    sameSite: 'strict' as const,
    path: '/',
  };
};

// POST /api/auth/login — valida no servidor, cria sessão no banco e envia cookie HttpOnly.
// O corpo da resposta NÃO contém token nem segredo reutilizável.
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const cfg = getAuthConfig();
    if (cfg.mode === 'unconfigured') {
      res.status(503).json({ code: 'AUTH_NOT_CONFIGURED', error: 'Autenticação não configurada neste ambiente.' });
      return;
    }

    const key = req.ip || 'unknown';
    const wait = loginRateLimit.blockedFor(key);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      res.status(429).json({ code: 'TOO_MANY_ATTEMPTS', error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
      return;
    }

    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password.trim()) {
      res.status(400).json({ error: 'Informe usuário e senha.' });
      return;
    }

    // Sempre calcula a senha (mesmo com usuário errado) para não vazar, por tempo, qual campo falhou.
    const passwordOk = cfg.checkPassword(password.trim());
    const userOk = safeEqual(username.trim().toLowerCase(), cfg.username.toLowerCase());
    if (!(passwordOk && userOk)) {
      loginRateLimit.fail(key);
      res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
      return;
    }

    loginRateLimit.success(key);
    const db = await getDb();
    await purgeExpiredSessions(db); // limpeza oportunista, sem cron
    const { token, expiresAt } = await createSession(db, cfg.sessionTtlMs);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: cfg.sessionTtlMs });
    res.json({ success: true, user: cfg.username, expiresAt });
  } catch (error) {
    console.error('Erro no login:', (error as Error)?.message);
    res.status(500).json({ error: 'Erro ao processar o login.' });
  }
});

// GET /api/auth/session — privada: 200 com a sessão válida; sem sessão válida o middleware responde 401.
authRouter.get('/session', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const cfg = getAuthConfig();
  const session = (req as any).session as { expiresAt: number } | undefined;
  res.json({ authenticated: true, user: cfg.username, expiresAt: session?.expiresAt });
});

// POST /api/auth/logout — pública e idempotente: invalida a sessão no servidor (se houver) e limpa o cookie.
authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const db = await getDb();
    const token = readSessionToken(req.headers.cookie);
    await revokeSession(db, token);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ success: true });
  } catch (error) {
    console.error('Erro no logout:', (error as Error)?.message);
    res.status(500).json({ error: 'Erro ao encerrar a sessão.' });
  }
});

