import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cashRows, createOrder, createPlant, startDelivery, stockOf } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  await s.close();
});

/** Insere lançamentos direto no banco de teste (a rota manual foi desativada na 1E). */
const seedTx = (id: string, amount: number, type: string) =>
  s.db.run('INSERT INTO cash_transactions (id, amount, type, description, created_at) VALUES (?, ?, ?, ?, ?)', id, amount, type, 'seed', Date.now());

describe('caixa — leitura', () => {
  it('caixa vazio: saldo 0', async () => {
    expect((await s.get('/api/cash/summary')).body).toEqual({ balance: 0, totalSales: 0, transactionCount: 0 });
    const full = await s.get('/api/cash');
    expect(full.body.balance).toBe(0);
    expect(full.body.transactions).toEqual([]);
  });

  it('saldo: crédito soma; débito e upgrade_purchase subtraem; totalSales só conta créditos', async () => {
    await seedTx('t1', 100, 'credit');
    await seedTx('t2', 30, 'debit');
    await seedTx('t3', 20, 'upgrade_purchase');
    expect((await s.get('/api/cash/summary')).body).toEqual({ balance: 50, totalSales: 100, transactionCount: 3 });
  });

  it('o crédito da entrega aparece na listagem com nº do pedido e cliente', async () => {
    const p = await createPlant(s, { price: 10 });
    const o = await createOrder(s, [{ plant_id: p.id, quantity: 1 }], { customer_name: 'Ana Fictícia' });
    const d = await startDelivery(s, o.id);
    await s.post(`/api/deliveries/${d.id}/finish`);
    const list = (await s.get('/api/cash')).body;
    expect(list.balance).toBe(10);
    expect(list.transactions[0]).toMatchObject({ order_number: o.order_number, customer_name: 'Ana Fictícia', type: 'credit', amount: 10 });
  });

  it('CARACTERIZAÇÃO: frações são arredondadas a 2 casas só na EXIBIÇÃO (armazenado em REAL)', async () => {
    await seedTx('a', 0.1, 'credit');
    await seedTx('b', 0.2, 'credit');
    expect((await s.get('/api/cash/summary')).body.balance).toBe(0.3);
    expect((await s.db.get('SELECT SUM(amount) AS s FROM cash_transactions')).s).not.toBe(0.3); // por isso D8: centavos nas tabelas novas
  });
});

describe('POST /api/cash/transactions — DESATIVADA na 1E (nenhum crédito arbitrário)', () => {
  it.each([
    [{ amount: 99999, type: 'credit', description: 'dinheiro do nada' }],
    [{ amount: 1, type: 'credit' }],
    [{ amount: 10, type: 'adjustment' }],
    [{ amount: 10, type: 'debit' }],
    [{ amount: 10, type: 'upgrade_purchase' }],
    [{ amount: 5, type: 'credit', order_id: 'ord_qualquer' }],
    [{}],
  ])('sessão VÁLIDA não consegue lançar %j → 403 CASH_TRANSACTIONS_DISABLED e nada é gravado', async (body) => {
    const res = await s.post('/api/cash/transactions', body);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CASH_TRANSACTIONS_DISABLED');
    expect(await cashRows(s)).toHaveLength(0);
    expect((await s.get('/api/cash/summary')).body.balance).toBe(0);
  });

  it('o único crédito de venda de pedido nasce do finish (e o frontend não consegue forjá-lo com order_id)', async () => {
    const p = await createPlant(s, { price: 10, stock_quantity: 3 });
    const o = await createOrder(s, [{ plant_id: p.id, quantity: 1 }]);
    // tentativa de "pré-pagar" o pedido com valor arbitrário por order_id
    const forged = await s.post('/api/cash/transactions', { amount: 999999, type: 'credit', order_id: o.id });
    expect(forged.status).toBe(403);
    const d = await startDelivery(s, o.id);
    expect((await s.post(`/api/deliveries/${d.id}/finish`)).status).toBe(200);
    const rows = await cashRows(s);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ order_id: o.id, amount: 10, type: 'credit' });
  });
});

describe('não existe venda avulsa: dinheiro só nasce do fluxo de pedido/entrega', () => {
  it('POST /api/cash/direct-sale NÃO existe (404 mesmo com sessão) e nada é gravado', async () => {
    const p = await createPlant(s, { price: 10, stock_quantity: 3 });
    const r = await s.post('/api/cash/direct-sale', { plant_id: p.id, request_id: 'req_0001_abcdef' });
    expect(r.status).toBe(404);
    expect(await cashRows(s)).toHaveLength(0);
    expect(await stockOf(s, p.id)).toBe(3);
  });

  it('nenhuma rota de /api/cash aceita escrita além da desativada: só GET / e GET /summary + POST /transactions (403)', async () => {
    const { app } = await import('../../backend/app');
    const routes: string[] = [];
    const cashLayer = (app as any)._router.stack.find((l: any) => l.name === 'router' && String(l.regexp.source).includes('cash'));
    for (const l of cashLayer.handle.stack) {
      if (l.route) for (const m of Object.keys(l.route.methods)) routes.push(`${m.toUpperCase()} ${l.route.path}`);
    }
    expect(routes.sort()).toEqual(['GET /', 'GET /summary', 'POST /transactions']);
  });
});
