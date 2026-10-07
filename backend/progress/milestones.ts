import type { DbWrapper } from '../db';
import { computeStats, ProgressStats } from './stats';

/**
 * Marcos de progressão — REGRAS CENTRALIZADAS (único lugar com os números; o frontend nunca decide marcos).
 * Um marco é gravado UMA vez em `milestones` e é permanente. São fatos históricos internos, não missões do jogador.
 */

/** Limiares iniciais (regra de desenvolvimento, fácil de ajustar aqui). */
export const THRESHOLDS = {
  entregas: 10,
  casas: 4,
  plantas: 3,
  melhorias: 3,
} as const;

/**
 * Clientela crescente (grupos de moradores do roster). Internos, permanentes e NÃO mostrados como níveis:
 * o jogador só percebe que gente nova começou a comprar. Só contagens (nunca dinheiro).
 */
export const NEIGHBORS = {
  /** grupo 2: a loja já mudou (1ª melhoria instalada) e já houve algumas entregas */
  grupo2: { melhoriasInstaladas: 1, entregas: 3 },
  /** grupo 3: loja mais arrumada, mais entregas e um catálogo com alguma variedade */
  grupo3: { melhoriasInstaladas: 2, entregas: 6, plantasCadastradas: 2 },
} as const;

export interface MilestoneDef {
  id: string;
  reached: (s: ProgressStats) => boolean;
}

export const MILESTONES: readonly MilestoneDef[] = [
  { id: 'primeira_planta', reached: (s) => s.plantsRegisteredHistorical >= 1 },
  { id: 'primeira_entrega', reached: (s) => s.deliveriesCompleted >= 1 },
  // "melhoria" = a loja mudou: melhoria INSTALADA (comprar e deixar na caixa ainda não muda a loja)
  { id: 'primeira_melhoria', reached: (s) => s.upgradesInstalled >= 1 },
  { id: 'entregas_10', reached: (s) => s.deliveriesCompleted >= THRESHOLDS.entregas },
  { id: 'casas_4', reached: (s) => s.distinctHousesServed >= THRESHOLDS.casas },
  { id: 'plantas_cadastradas_3', reached: (s) => s.plantsRegisteredHistorical >= THRESHOLDS.plantas },
  { id: 'melhorias_3', reached: (s) => s.upgradesInstalled >= THRESHOLDS.melhorias },
  { id: 'vizinhos_2', reached: (s) => s.upgradesInstalled >= NEIGHBORS.grupo2.melhoriasInstaladas && s.deliveriesCompleted >= NEIGHBORS.grupo2.entregas },
  {
    id: 'vizinhos_3',
    reached: (s) =>
      s.upgradesInstalled >= NEIGHBORS.grupo3.melhoriasInstaladas &&
      s.deliveriesCompleted >= NEIGHBORS.grupo3.entregas &&
      s.plantsRegisteredHistorical >= NEIGHBORS.grupo3.plantasCadastradas,
  },
  // Gatilho interno do primeiro arco. NÃO tem efeito visual ainda (nenhuma barreira, região, dinheiro ou XP).
  {
    id: 'bairro_vivo',
    reached: (s) =>
      s.deliveriesCompleted >= THRESHOLDS.entregas &&
      s.distinctHousesServed >= THRESHOLDS.casas &&
      s.plantsRegisteredHistorical >= THRESHOLDS.plantas &&
      s.upgradesInstalled >= THRESHOLDS.melhorias,
  },
];

export const MILESTONE_IDS = MILESTONES.map((m) => m.id);

/**
 * Avalia e grava marcos novos. NÃO abre transação: use dentro de uma já aberta (ou via evaluateMilestones).
 * Idempotente: marco já gravado nunca é tocado (achieved_at original preservado); INSERT OR IGNORE como rede de segurança.
 */
export async function evaluateInTransaction(db: DbWrapper, now: number = Date.now()): Promise<string[]> {
  const stats = await computeStats(db);
  const have = new Set((await db.all('SELECT id FROM milestones')).map((r: any) => r.id as string));
  const achieved: string[] = [];
  for (const m of MILESTONES) {
    if (have.has(m.id) || !m.reached(stats)) continue;
    const r = await db.run('INSERT OR IGNORE INTO milestones (id, achieved_at) VALUES (?, ?)', [m.id, now]);
    if (r.changes > 0) achieved.push(m.id);
  }
  return achieved;
}

/** Avaliação com transação própria (BEGIN IMMEDIATE). Devolve os ids ganhos AGORA. */
export async function evaluateMilestones(db: DbWrapper, now: number = Date.now()): Promise<string[]> {
  let inTransaction = false;
  try {
    await db.run('BEGIN IMMEDIATE;');
    inTransaction = true;
    const achieved = await evaluateInTransaction(db, now);
    await db.run('COMMIT;');
    inTransaction = false;
    return achieved;
  } catch (err) {
    if (inTransaction) {
      try {
        await db.run('ROLLBACK;');
      } catch {
        /* já encerrada */
      }
    }
    throw err;
  }
}

/** Para os eventos (planta, entrega, melhoria): o marco é consequência do evento, mas nunca derruba a operação principal. */
export async function evaluateMilestonesSafe(db: DbWrapper): Promise<void> {
  try {
    await evaluateMilestones(db);
  } catch (err) {
    console.error('[progressão] falha ao avaliar marcos (será reavaliado no próximo evento):', err);
  }
}

export interface MilestoneState {
  achieved: boolean;
  achievedAt: number | null;
}

export async function readMilestones(db: DbWrapper): Promise<Record<string, MilestoneState>> {
  const rows = await db.all('SELECT id, achieved_at FROM milestones');
  const at = new Map<string, number>(rows.map((r: any) => [r.id, r.achieved_at]));
  return Object.fromEntries(MILESTONES.map((m) => [m.id, { achieved: at.has(m.id), achievedAt: at.get(m.id) ?? null }]));
}
