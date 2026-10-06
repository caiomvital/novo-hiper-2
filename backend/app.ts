import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { plantsRouter } from './routes/plants';
import { customersRouter } from './routes/customers';
import { ordersRouter } from './routes/orders';
import { deliveriesRouter } from './routes/deliveries';
import { cashRouter } from './routes/cash';
import { gameRouter } from './routes/game';
import { uploadRouter } from './routes/upload';
import { migrationRouter } from './routes/migration';
import { authRouter } from './routes/auth';
import { getDb } from './db';
import { csrfGuard, isTrustedOrigin, requireSession } from './auth/middleware';

export const app = express();

// Atrás do Nginx (1 proxy): req.ip passa a ser o IP real do cliente (X-Forwarded-For), usado no limite de tentativas de login
app.set('trust proxy', 1);

const isProd = process.env.NODE_ENV === 'production';

// CORS (a API usa cookie de sessão SameSite=Strict, então cross-site não carrega credenciais):
//  • sem Origin (curl/servidor) ou mesma origem do site (PWA no mesmo domínio) → liberado;
//  • origens listadas em CORS_ORIGIN (sem '*') → liberadas;
//  • desenvolvimento: também localhost/127.0.0.1;
//  • qualquer outra → NÃO recebe cabeçalhos CORS (o navegador bloqueia a leitura) e métodos mutáveis são barrados pelo
//    csrfGuard (403). Nunca se reflete uma origem arbitrária.
const isLocalOrigin = (origin: string) => {
  try {
    const h = new URL(origin).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  } catch {
    return false;
  }
};
const corsBase = {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    const allowed = !origin || isTrustedOrigin(req, origin) || (!isProd && isLocalOrigin(origin));
    if (!allowed && isProd) {
      console.warn(`[CORS Aviso]: origem não autorizada bloqueada: ${origin}`);
    }
    callback(null, { ...corsBase, origin: allowed });
  })
);

// Parser de JSON com limite seguro
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// CSRF: valida Origin / Sec-Fetch-Site em métodos mutáveis (além de SameSite=Strict no cookie de sessão)
app.use(csrfGuard);

// Servir arquivos estáticos de uploads de imagens (/uploads/plants/...)
const uploadsBaseDir = path.resolve(process.env.UPLOADS_DIR || './uploads');
app.use('/uploads', express.static(uploadsBaseDir, {
  maxAge: '7d',
  immutable: false,
}));

// Autenticação: TODA rota /api exige sessão válida no servidor, exceto a allowlist de auth/middleware.ts
// (GET /api/health, POST /api/auth/login, POST /api/auth/logout). /uploads (fotos de plantas) é público.
app.use('/api', requireSession);

// Health check para monitoramento e validação de inicialização
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.get('SELECT 1');
    res.json({
      status: 'ok',
      service: 'Novo Hiper Backend API',
      database: 'SQLite (connected)',
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      message: 'Banco de dados indisponível',
      timestamp: Date.now(),
    });
  }
});

// Rotas da API REST
app.use('/api/auth', authRouter);
app.use('/api/plants', plantsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/cash', cashRouter);
app.use('/api/game', gameRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/migration', migrationRouter);

// Tratamento central de erros
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]:', err?.message || err);
  const status = err.status || 500;
  const message = err.message || 'Erro interno no servidor.';
  res.status(status).json({ error: message });
});
