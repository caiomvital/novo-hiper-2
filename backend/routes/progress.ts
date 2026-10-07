import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { evaluateMilestones, readMilestones } from '../progress/milestones';
import { computeStats } from '../progress/stats';

export const progressRouter = Router();

// GET /api/progress — estado de progressão (estatísticas históricas internas + marcos permanentes).
// O backend é a autoridade: o frontend NÃO decide marcos. Os marcos também são avaliados nos eventos
// (planta cadastrada, entrega finalizada, melhoria comprada/instalada); aqui a avaliação (idempotente) só garante
// que o estado devolvido esteja consistente, inclusive para dados anteriores a este recurso.
progressRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    await evaluateMilestones(db);
    res.json({ stats: await computeStats(db), milestones: await readMilestones(db) });
  } catch (error) {
    console.error('Erro ao consultar progressão:', error);
    res.status(500).json({ error: 'Erro ao consultar a progressão.' });
  }
});
