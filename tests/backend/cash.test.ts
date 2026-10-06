import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOrder, createPlant, startDelivery } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  await s.close();
});

const tx = (body: Record<string, unknown>) => s.post('/api/cash/transactions', body);

describe('caixa — comportamento ATUAL', () => {
  it('caixa vazio: saldo 0', async () => {
    expect((await s.get('/api/cash/summary')).body).toEqual({ balance: 0, totalSales: 0, transactionCount: 0 });
    const full = await s.get('/api/cash');
    expect(full.body.balance).toBe(0);
    expect(full.body.transactions).toEqual([]);
  });

  it('crédito soma; débito e upgrade_purchase subtraem; totalSales só conta créditos', async () => {
    expect((await tx({ amount: 100, type: 'credit' })).status).toBe(201);
    expect((await tx({ amount: 30, type: 'debit' })).body.balance).toBe(70);
    const up = await tx({ amount: 20, type: 'upgrade_purchase', description: 'Ventilador' });
    expect(up.status).toBe(201);
    expect(up.body.balance).toBe(50);
    const sum = (await s.get('/api/cash/summary')).body;
    expect(sum).toEqual({ balance: 50, totalSales: 100, transactionCount: 3 });
  });

  it('débito/compra sem saldo suficiente → 400 e nada é gravado', async () => {
    await tx({ amount: 10, type: 'credit' });
    const res = await tx({ amount: 11, type: 'debit' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Saldo insuficiente/);
    expect((await s.get('/api/cash/summary')).body.transactionCount).toBe(1);
  });

  it('valida valor e tipo', async () => {
    expect((await tx({ amount: 0, type: 'credit' })).status).toBe(400);
    expect((await tx({ amount: -5, type: 'credit' })).status).toBe(400);
    expect((await tx({ amount: 'abc', type: 'credit' })).status).toBe(400);
    expect((await tx({ amount: 5, type: 'estorno' })).status).toBe(400);
    expect((await tx({ amount: 5 })).status).toBe(400);
  });

  it('transação com order_id já usado → 409', async () => {
    const p = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: p.id }]);
    expect((await tx({ amount: 10, type: 'credit', order_id: o.id })).status).toBe(201);
    expect((await tx({ amount: 10, type: 'credit', order_id: o.id })).status).toBe(409);
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

  it('🐞 DOCUMENTADO (G2): crédito LIVRE, sem pedido nem entrega, é aceito — dinheiro "do nada"', async () => {
    const res = await tx({ amount: 99999, type: 'credit', description: 'sem pedido' });
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe(99999);
  });

  it('🐞 DOCUMENTADO: o tipo "adjustment" é tratado como DÉBITO no saldo (CASE credit … ELSE -amount)', async () => {
    await tx({ amount: 50, type: 'credit' });
    const adj = await tx({ amount: 10, type: 'adjustment' });
    expect(adj.status).toBe(201);
    expect(adj.body.balance).toBe(40);
  });

  it('CARACTERIZAÇÃO: valores com frações são arredondados a 2 casas só na EXIBIÇÃO (armazenado em REAL)', async () => {
    await tx({ amount: 0.1, type: 'credit' });
    await tx({ amount: 0.2, type: 'credit' });
    expect((await s.get('/api/cash/summary')).body.balance).toBe(0.3);
    const raw = await s.db.get('SELECT SUM(amount) AS s FROM cash_transactions');
    expect(raw.s).not.toBe(0.3); // 0.30000000000000004 no armazenamento (por isso D8: centavos nas tabelas novas)
  });
});
