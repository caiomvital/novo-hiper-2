import { Router, Request, Response } from 'express';
import { getDb, DbWrapper } from '../db';
import { findUpgrade, SHOP_UPGRADES, UpgradeDef } from '../shop/catalog';
import type { ShopUpgradeState } from '../../src/shared/shop';
import { evaluateMilestonesSafe } from '../progress/milestones';

export const shopRouter = Router();

// ── Loja de Utilidades (marco "dinheiro → compra → instalação") ───────────────────────────────────
// O backend é a AUTORIDADE de preço, saldo, propriedade e instalação; o Phaser/React só apresentam.
//  - Compra: transacional (BEGIN IMMEDIATE) e idempotente. A decisão "já comprada?" e o saldo são lidos DENTRO da
//    transação de escrita; o débito (cash_transactions.type='upgrade_purchase', id determinístico) e a linha em
//    shop_upgrades nascem juntos ou não nascem. Repetir a compra devolve alreadyApplied:true SEM cobrar de novo.
//    Rede de segurança: PK(shop_upgrades.upgrade_id) e PK(cash_transactions.id = 'shop_<upgradeId>').
//  - Saldo nunca fica negativo: saldo < preço → 400 INSUFFICIENT_FUNDS e rollback (nada é gravado).
//  - Instalação: só de melhoria comprada (409 NOT_PURCHASED); idempotente.
//  - Nada aqui conhece coordenadas do mapa.
// Dentro das transações só há operações síncronas do SQLite (sem I/O assíncrono real), como em /deliveries/:id/finish.

class ShopError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const toCents = (v: number) => Math.round(v * 100);

/** Mesma fórmula do caixa (/api/cash/summary): créditos somam; qualquer outro tipo subtrai. */
async function readBalance(db: DbWrapper): Promise<number> {
  const row = await db.get(`SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance FROM cash_transactions`);
  return Math.round((row?.balance || 0) * 100) / 100;
}

function stateOf(row: any | undefined): ShopUpgradeState {
  if (!row) return 'available';
  return row.installed_at ? 'installed' : 'pending';
}

function view(def: UpgradeDef, row: any | undefined) {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    price: def.price,
    state: stateOf(row),
    purchasedAt: row?.purchased_at ?? null,
    installedAt: row?.installed_at ?? null,
  };
}

async function snapshot(db: DbWrapper) {
  const rows = await db.all('SELECT * FROM shop_upgrades');
  const byId = new Map(rows.map((r: any) => [r.upgrade_id, r]));
  return {
    balance: await readBalance(db),
    upgrades: SHOP_UPGRADES.map((u) => view(u, byId.get(u.id))),
  };
}

function sendError(res: Response, err: unknown, fallback: string) {
  if (err instanceof ShopError) {
    res.status(err.status).json({ code: err.code, error: err.message, ...err.extra });
    return;
  }
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

// GET /api/shop — catálogo (preços vêm daqui), estado de cada melhoria e saldo atual do caixa
shopRouter.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await snapshot(await getDb()));
  } catch (err) {
    sendError(res, err, 'Erro ao consultar a Loja de Utilidades.');
  }
});

// POST /api/shop/upgrades/:id/purchase — compra (débito no caixa + melhoria "aguardando instalação")
shopRouter.post('/upgrades/:id/purchase', async (req: Request, res: Response) => {
  const def = findUpgrade(String(req.params.id));
  if (!def) {
    res.status(404).json({ code: 'UNKNOWN_UPGRADE', error: 'Melhoria não encontrada.' });
    return;
  }
  const db = await getDb();
  let inTransaction = false;
  try {
    let alreadyApplied = false;
    await db.run('BEGIN IMMEDIATE;');
    inTransaction = true;

    const existing = await db.get('SELECT upgrade_id FROM shop_upgrades WHERE upgrade_id = ?', def.id);
    if (existing) {
      alreadyApplied = true; // já comprada (clique duplo/retry): nenhuma escrita, nenhuma cobrança
    } else {
      const balance = await readBalance(db);
      if (toCents(balance) < toCents(def.price)) {
        throw new ShopError(400, 'INSUFFICIENT_FUNDS', `Saldo insuficiente: a ${def.name.toLowerCase()} custa R$ ${def.price.toFixed(2).replace('.', ',')}.`, {
          balance,
          price: def.price,
        });
      }
      const now = Date.now();
      const txId = `shop_${def.id}`;
      await db.run(
        `INSERT INTO cash_transactions (id, order_id, delivery_id, amount, type, description, created_at)
         VALUES (?, NULL, NULL, ?, 'upgrade_purchase', ?, ?)`,
        [txId, def.price, `Loja de Utilidades: ${def.name}`, now]
      );
      await db.run(
        `INSERT INTO shop_upgrades (upgrade_id, price_paid, purchased_at, installed_at, cash_transaction_id) VALUES (?, ?, ?, NULL, ?)`,
        [def.id, def.price, now, txId]
      );
    }
    await db.run('COMMIT;');
    inTransaction = false;

    await evaluateMilestonesSafe(db); // primeira_melhoria, melhorias_3, bairro_vivo…
    const snap = await snapshot(db);
    res.json({ success: true, alreadyApplied, ...snap, upgrade: snap.upgrades.find((u) => u.id === def.id) });
  } catch (err) {
    if (inTransaction) {
      try {
        await db.run('ROLLBACK;');
      } catch {
        /* já encerrada */
      }
    }
    sendError(res, err, 'Erro ao comprar a melhoria.');
  }
});

// POST /api/shop/upgrades/:id/install — instala uma melhoria JÁ comprada (idempotente)
shopRouter.post('/upgrades/:id/install', async (req: Request, res: Response) => {
  const def = findUpgrade(String(req.params.id));
  if (!def) {
    res.status(404).json({ code: 'UNKNOWN_UPGRADE', error: 'Melhoria não encontrada.' });
    return;
  }
  const db = await getDb();
  let inTransaction = false;
  try {
    let alreadyApplied = false;
    await db.run('BEGIN IMMEDIATE;');
    inTransaction = true;

    const row = await db.get('SELECT * FROM shop_upgrades WHERE upgrade_id = ?', def.id);
    if (!row) throw new ShopError(409, 'NOT_PURCHASED', 'Esta melhoria ainda não foi comprada.');
    if (row.installed_at) {
      alreadyApplied = true;
    } else {
      await db.run('UPDATE shop_upgrades SET installed_at = ? WHERE upgrade_id = ? AND installed_at IS NULL', [Date.now(), def.id]);
    }
    await db.run('COMMIT;');
    inTransaction = false;

    await evaluateMilestonesSafe(db); // primeira_melhoria, melhorias_3, bairro_vivo…
    const snap = await snapshot(db);
    res.json({ success: true, alreadyApplied, ...snap, upgrade: snap.upgrades.find((u) => u.id === def.id) });
  } catch (err) {
    if (inTransaction) {
      try {
        await db.run('ROLLBACK;');
      } catch {
        /* já encerrada */
      }
    }
    sendError(res, err, 'Erro ao instalar a melhoria.');
  }
});
