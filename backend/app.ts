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
import { getDb } from './db';

export const app = express();

// Configuração de CORS por variável de ambiente
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parser de JSON com limite seguro
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Servir arquivos estáticos de uploads de imagens (/uploads/plants/...)
const uploadsBaseDir = path.resolve(process.env.UPLOADS_DIR || './uploads');
app.use('/uploads', express.static(uploadsBaseDir, {
  maxAge: '7d',
  immutable: false,
}));

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
  console.error('[API Error]:', err);
  const status = err.status || 500;
  const message = err.message || 'Erro interno no servidor.';
  res.status(status).json({ error: message });
});
