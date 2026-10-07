import type { DbWrapper } from '../db';
import { evaluateInTransaction } from '../progress/milestones';
import { isModernDestination } from '../../src/shared/destinations';
import { ROSTER, RosterEntry } from '../../src/shared/roster';
import { fetchOrderView, insertOrderRows } from './createOrder';

/**
 * ÚNICA autoridade que decide se nasce um pedido AUTOMÁTICO.
 *
 * Eventos (cadastro de planta, reposição de estoque, entrega finalizada, abertura do app/Aventura) apenas PEDEM uma
 * verificação; quem decide é esta função, dentro de uma transação de escrita (BEGIN IMMEDIATE), então chamadas
 * simultâneas (duas abas, retry, race) nunca criam mais pedidos que a capacidade.
 *
 * Regras (nesta ordem): pedido ativo → recuo técnico → plantas → estoque livre → clientes desbloqueados → escolhas.
 * Não há timer, cronômetro nem fila: se cabe um pedido agora, ele nasce agora.
 */

/** Pedidos ATIVOS (não entregues) permitidos ao mesmo tempo neste marco. */
export const ORDER_CAPACITY = 1;
/** Recuo técnico (ms) só contra chamadas repetidas/race/retry — não é mecânica de jogo. Env ORDER_COOLDOWN_MS sobrescreve. */
export const DEFAULT_TECHNICAL_COOLDOWN_MS = 4000;

export type EnsureReason = 'active_order' | 'cooldown' | 'no_plants' | 'no_stock' | 'no_customers' | 'disabled';

export interface EnsureResult {
  created: boolean;
  order?: Awaited<ReturnType<typeof fetchOrderView>>;
  reason?: EnsureReason;
}

export interface EnsureOptions {
  now?: number;
  /** Sorteio injetável (testes determinísticos). Padrão: Math.random. */
  rng?: () => number;
}

const technicalCooldownMs = (): number => {
  const v = Number(process.env.ORDER_COOLDOWN_MS);
  return process.env.ORDER_COOLDOWN_MS !== undefined && Number.isFinite(v) && v >= 0 ? v : DEFAULT_TECHNICAL_COOLDOWN_MS;
};
/** Geração automática liga por padrão; ORDER_AUTOGEN=off só para ambientes de teste (as verificações e motivos continuam valendo). */
const autogenEnabled = (): boolean => process.env.ORDER_AUTOGEN !== 'off';

/** Grupos de clientes liberados (permanente: vêm dos marcos gravados, nunca recalculados "para baixo"). */
export async function unlockedGroup(db: DbWrapper): Promise<1 | 2 | 3> {
  const rows = await db.all(`SELECT id FROM milestones WHERE id IN ('vizinhos_2', 'vizinhos_3')`);
  const have = new Set(rows.map((r: any) => r.id));
  return have.has('vizinhos_3') ? 3 : have.has('vizinhos_2') ? 2 : 1;
}

/**
 * Apresenta o cliente do roster ao banco (idempotente). Residência:
 *  - cliente novo → casa do roster;
 *  - existente com destino MODERNO válido → preservado (nunca recalculado);
 *  - existente só com destino legado/desconhecido → atribuição ÚNICA à casa do roster (depois disso é moderno).
 * Pedidos antigos NÃO são tocados: o destino deles já está congelado em orders.destination_id.
 */
export async function introduceCustomer(db: DbWrapper, entry: RosterEntry, now: number): Promise<void> {
  const row = await db.get('SELECT id, destination FROM customers WHERE id = ?', entry.id);
  if (!row) {
    await db.run(`INSERT INTO customers (id, name, avatar_path, destination, role_description, address, created_at) VALUES (?, ?, NULL, ?, NULL, NULL, ?)`, [
      entry.id,
      entry.name,
      entry.destinationId,
      now,
    ]);
  } else if (!isModernDestination(row.destination)) {
    await db.run('UPDATE customers SET destination = ? WHERE id = ?', [entry.destinationId, entry.id]);
  }
}

/**
 * Plantas reais (não removidas) com ESTOQUE LIVRE suficiente para mais uma unidade:
 * estoque atual − quantidade já comprometida em pedidos abertos.
 */
export async function listAvailablePlants(db: DbWrapper): Promise<Array<{ id: string; price: number; stock_quantity: number; free: number }>> {
  const plants = await db.all(`SELECT id, price, stock_quantity FROM plants WHERE deleted_at IS NULL`);
  const reserved = new Map<string, number>(
    (
      await db.all(
        `SELECT oi.plant_id, SUM(oi.quantity) AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status != 'entregue' GROUP BY oi.plant_id`
      )
    ).map((r: any) => [r.plant_id, Number(r.q)])
  );
  return plants
    .map((p: any) => ({ id: p.id, price: Number(p.price), stock_quantity: Number(p.stock_quantity), free: Number(p.stock_quantity) - (reserved.get(p.id) ?? 0) }))
    .filter((p) => p.free >= 1);
}

const pick = <T>(list: T[], rng: () => number): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

export async function ensureOrder(db: DbWrapper, opts: EnsureOptions = {}): Promise<EnsureResult> {
  const now = opts.now ?? Date.now();
  const rng = opts.rng ?? Math.random;
  let inTransaction = false;
  try {
    await db.run('BEGIN IMMEDIATE;');
    inTransaction = true;
    const result = await decide(db, now, rng);
    await db.run('COMMIT;');
    inTransaction = false;
    return result;
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

async function decide(db: DbWrapper, now: number, rng: () => number): Promise<EnsureResult> {
  // 1. capacidade: pedido ativo (qualquer origem) ocupa a vaga
  const active = Number((await db.get(`SELECT COUNT(*) AS n FROM orders WHERE status != 'entregue'`))?.n ?? 0);
  if (active >= ORDER_CAPACITY) return { created: false, reason: 'active_order' };

  // 2. recuo técnico (proteção contra repetição/race; sem relação com o ritmo do jogo)
  const last = await db.get(`SELECT customer_id, created_at, (SELECT plant_id FROM order_items WHERE order_id = o.id LIMIT 1) AS plant_id FROM orders o ORDER BY created_at DESC, rowid DESC LIMIT 1`);
  if (last && now - Number(last.created_at) < technicalCooldownMs()) return { created: false, reason: 'cooldown' };

  // 3. plantas reais (não removidas)
  const plantCount = Number((await db.get(`SELECT COUNT(*) AS n FROM plants WHERE deleted_at IS NULL`))?.n ?? 0);
  if (plantCount === 0) return { created: false, reason: 'no_plants' };

  // 4. estoque livre = estoque − quantidade comprometida em pedidos abertos
  const available = await listAvailablePlants(db);
  if (available.length === 0) return { created: false, reason: 'no_stock' };

  // 5. clientes desbloqueados (marcos atualizados dentro desta transação) e sem pedido ativo
  await evaluateInTransaction(db, now);
  const group = await unlockedGroup(db);
  const busy = new Set((await db.all(`SELECT DISTINCT customer_id FROM orders WHERE status != 'entregue'`)).map((r: any) => r.customer_id));
  const customers = ROSTER.filter((c) => c.group <= group && !busy.has(c.id));
  if (customers.length === 0) return { created: false, reason: 'no_customers' };

  // 6. escolhas simples: não repete o último cliente/planta quando há alternativa
  const customerPool = customers.filter((c) => c.id !== last?.customer_id);
  const customer = pick(customerPool.length > 0 ? customerPool : customers, rng);
  const plantPool = available.filter((p: any) => p.id !== last?.plant_id);
  const plant = pick(plantPool.length > 0 ? plantPool : available, rng);

  if (!autogenEnabled()) return { created: false, reason: 'disabled' };

  // 7. cria: cliente apresentado, preço da planta PERSISTIDA, número e destino atribuídos aqui
  await introduceCustomer(db, customer, now);
  const orderId = await insertOrderRows(
    db,
    { customerId: customer.id, items: [{ plant_id: plant.id, quantity: 1, unit_price: plant.price }], total: Math.round(plant.price * 100) / 100 },
    now
  );
  return { created: true, order: await fetchOrderView(db, orderId) };
}

/** Para os eventos: pedir a verificação nunca derruba a operação principal. */
export async function ensureOrderSafe(db: DbWrapper): Promise<void> {
  try {
    await ensureOrder(db);
  } catch (err) {
    console.error('[pedidos] falha ao verificar novo pedido (será reavaliado no próximo evento):', err);
  }
}
