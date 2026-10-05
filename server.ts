import { app } from './backend/app';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

async function startServer() {
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
