import { Router, Request, Response } from 'express';
import crypto from 'crypto';

export const authRouter = Router();

// Hash padrão de 'NovoHiper2026' com salt 'novohiper_salt_'
const DEFAULT_SALT = process.env.AUTH_SALT || 'novohiper_salt_';
const DEFAULT_PASSWORD_HASH = 
  process.env.AUTH_PASSWORD_HASH || 
  'dd1749e9e97004e46f4208d372ba40b4ae5e34521c8e8da05c9708ab7c20c9cd';

function verifyPasswordHash(password: string): boolean {
  try {
    const inputHash = crypto
      .createHash('sha256')
      .update(DEFAULT_SALT + password)
      .digest('hex');

    const targetHash = (process.env.AUTH_PASSWORD_HASH || DEFAULT_PASSWORD_HASH).trim().toLowerCase();

    const bufInput = Buffer.from(inputHash, 'hex');
    const bufTarget = Buffer.from(targetHash, 'hex');

    if (bufInput.length !== bufTarget.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufInput, bufTarget);
  } catch (err) {
    console.error('Erro na validação de hash da senha:', err);
    return false;
  }
}

// POST /api/auth/login - Validação de credenciais no servidor
authRouter.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: 'Nome de usuário é obrigatório.' });
    return;
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    res.status(400).json({ error: 'Senha é obrigatória.' });
    return;
  }

  const expectedUser = (process.env.AUTH_USERNAME || 'Bernardo').trim().toLowerCase();
  const inputUser = username.trim().toLowerCase();

  const isUserValid = inputUser === expectedUser;
  const isPasswordValid = verifyPasswordHash(password.trim());

  if (isUserValid && isPasswordValid) {
    const sessionToken = `nh_sess_${crypto.randomBytes(24).toString('hex')}`;
    res.json({
      success: true,
      user: process.env.AUTH_USERNAME || 'Bernardo',
      token: sessionToken,
      timestamp: Date.now(),
    });
    return;
  }

  res.status(401).json({
    success: false,
    error: 'Usuário ou senha incorretos. Verifique e tente novamente.',
  });
});
