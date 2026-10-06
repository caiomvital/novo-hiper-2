import { app } from './backend/app';
import { getDb } from './backend/db';
import { loadAuthConfig } from './backend/auth/config';
import { purgeExpiredSessions } from './backend/auth/sessions';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

async function startServer() {
  // FAIL-FAST: em produção, sem AUTH_USERNAME/AUTH_PASSWORD_HASH válidos o servidor NÃO sobe (sem senha padrão).
  const auth = loadAuthConfig();
  if (auth.mode === 'unconfigured') {
    console.warn('[Novo Hiper] Aviso: autenticação não configurada (defina AUTH_DEV_INSECURE_PASSWORD ou AUTH_PASSWORD_HASH). O login ficará indisponível.');
  }
  // Abre o banco já na inicialização: aplica as migrations pendentes (ou falha cedo) e limpa sessões expiradas.
  await purgeExpiredSessions(await getDb());

  // No ambiente de desenvolvimento e preview do AI Studio, o servidor DEVE rodar na porta 3000
  const port = process.env.NODE_ENV === 'production' && process.env.PORT 
    ? parseInt(process.env.PORT, 10) 
    : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('Aviso: pasta dist/ não encontrada. Rode npm run build para compilar o frontend.');
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Novo Hiper] Servidor rodando em http://0.0.0.0:${port} (${isProd ? 'produção' : 'desenvolvimento'})`);
  });
}

startServer().catch((err) => {
  console.error('[Novo Hiper] Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
