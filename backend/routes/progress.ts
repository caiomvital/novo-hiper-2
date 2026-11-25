import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { deriveWorldStage, evaluateMilestones, readMilestones } from '../progress/milestones';
import { computeStats } from '../progress/stats';
import { readResidentStory } from '../stories/residentStory';
import { MARIA_STORY_ID } from '../../src/shared/residentStory';
import { ensureOrder } from '../orders/ensureOrder';

export const progressRouter = Router();

// GET /api/progress — estado de progressão (estatísticas históricas internas + marcos permanentes) e o
// ESTÁGIO VISUAL do mundo (Progressão 2B), derivado dos marcos. O backend é a autoridade: o frontend NÃO
// decide marcos nem estágios, só renderiza o que vem aqui. Os marcos também são avaliados nos eventos
// (planta cadastrada, entrega finalizada, melhoria comprada/instalada); aqui a avaliação (idempotente) só garante
// que o estado devolvido esteja consistente, inclusive para dados anteriores a este recurso.
progressRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    await evaluateMilestones(db);
    const milestones = await readMilestones(db);
    const acknowledgement = await db.get("SELECT seen_at FROM story_acknowledgements WHERE id = 'bairro_vivo'");
    res.json({ stats: await computeStats(db), milestones, worldStage: deriveWorldStage(milestones), story: { bairroVivoSeenAt: acknowledgement?.seen_at ?? null }, residentStory: await readResidentStory(db) });
  } catch (error) {
    console.error('Erro ao consultar progressão:', error);
    res.status(500).json({ error: 'Erro ao consultar a progressão.' });
  }
});

progressRouter.post('/celebrations/bairro_vivo/ack', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const milestone = await db.get("SELECT achieved_at FROM milestones WHERE id = 'bairro_vivo'");
    if (!milestone) { res.status(409).json({ error: 'O primeiro arco ainda não foi concluído.' }); return; }
    await db.run("INSERT OR IGNORE INTO story_acknowledgements (id, seen_at) VALUES ('bairro_vivo', ?)", Date.now());
    const acknowledgement = await db.get("SELECT seen_at FROM story_acknowledgements WHERE id = 'bairro_vivo'");
    res.json({ seenAt: acknowledgement.seen_at });
  } catch { res.status(500).json({ error: 'Não foi possível guardar a confirmação. Tente novamente.' }); }
});

// Aceitar apenas reserva a próxima vaga. Pedidos existentes e estoque nunca são descartados.
progressRouter.post('/stories/cantinho_maria/accept', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    await db.run('INSERT OR IGNORE INTO resident_stories (id, accepted_at) VALUES (?, ?)', [MARIA_STORY_ID, Date.now()]);
    if ((await readResidentStory(db)).status === 'waiting') await ensureOrder(db);
    res.json(await readResidentStory(db));
  } catch { res.status(500).json({ error: 'Não foi possível confirmar a história. Tente novamente.' }); }
});

progressRouter.post('/stories/cantinho_maria/ack', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const story = await readResidentStory(db);
    if (story.status !== 'completed') { res.status(409).json({ error: 'Entregue a planta para conhecer o resultado da história.' }); return; }
    await db.run('UPDATE resident_stories SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE id = ?', [Date.now(), MARIA_STORY_ID]);
    res.json(await readResidentStory(db));
  } catch { res.status(500).json({ error: 'Não foi possível guardar a conversa. Tente novamente.' }); }
});
