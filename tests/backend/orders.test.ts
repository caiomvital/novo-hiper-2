import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cashRows, createOrder, createPlant, stockOf } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await s.close();
});

describe('pedidos — comportamento ATUAL', () => {
  it('cria pedido com cliente novo, itens, total e número sequencial (101, 102…)', async () => {
    const a = await createPlant(s, { price: 10 });
    const b = await createPlant(s, { price: 7.5 });
    const o1 = await createOrder(s, [{ plant_id: a.id, quantity: 2 }, { plant_id: b.id, quantity: 1 }]);
    expect(o1.status).toBe('recebido');
    expect(o1.total).toBe(27.5);
    expect(o1.order_number).toBe(101);
    expect(o1.items).toHaveLength(2);
    expect(o1.customer_name).toBe('Cliente Fictício');
    const o2 = await createOrder(s, [{ plant_id: a.id }]);
    expect(o2.order_number).toBe(102);
  });

  it('usa order_number informado quando vier', async () => {
    const a = await createPlant(s);
    expect((await createOrder(s, [{ plant_id: a.id }], { order_number: 500 })).order_number).toBe(500);
  });

  it('preço do item é "congelado" na criação; unit_price do cliente é aceito se número ≥ 0', async () => {
    const a = await createPlant(s, { price: 10 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 2, unit_price: 3 }]);
    expect(o.items[0].unit_price).toBe(3);
    expect(o.total).toBe(6);
    await s.put(`/api/plants/${a.id}`, { name: 'x', price: 99, stock_quantity: 5 });
    const read = await s.get(`/api/orders/${o.id}`);
    expect(read.body.items[0].unit_price).toBe(3);
  });

  it('reutiliza cliente existente por customer_id; cliente inexistente sem nome → 400', async () => {
    const a = await createPlant(s);
    const first = await createOrder(s, [{ plant_id: a.id }]);
    const again = await s.post('/api/orders', { customer_id: first.customer_id, items: [{ plant_id: a.id, quantity: 1 }] });
    expect(again.status).toBe(201);
    expect(again.body.customer_id).toBe(first.customer_id);
    const bad = await s.post('/api/orders', { customer_id: 'cust_nao_existe', items: [{ plant_id: a.id, quantity: 1 }] });
    expect(bad.status).toBe(400);
    expect((await s.post('/api/orders', { items: [{ plant_id: a.id }] })).status).toBe(400);
  });

  it('valida itens: vazio, planta inexistente, quantidade ≤ 0', async () => {
    const a = await createPlant(s);
    expect((await s.post('/api/orders', { customer_name: 'x', items: [] })).status).toBe(400);
    expect((await s.post('/api/orders', { customer_name: 'x', items: [{ plant_id: 'nao_existe', quantity: 1 }] })).status).toBe(400);
    expect((await s.post('/api/orders', { customer_name: 'x', items: [{ plant_id: a.id, quantity: -2 }] })).status).toBe(400);
  });

  it('CARACTERIZAÇÃO: quantidade 0 ou não numérica vira 1 (parseInt(...) || 1)', async () => {
    const a = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 0 as any }]);
    expect(o.items[0].quantity).toBe(1);
  });

  it('CARACTERIZAÇÃO: criar pedido NÃO verifica nem reserva estoque (pode pedir mais que o estoque)', async () => {
    const a = await createPlant(s, { stock_quantity: 1 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 50 }]);
    expect(o.items[0].quantity).toBe(50);
    expect(await stockOf(s, a.id)).toBe(1); // nada mudou no estoque
  });

  it('CARACTERIZAÇÃO: pedido com item inválido no meio deixa o CLIENTE criado (cliente é criado antes da validação)', async () => {
    const a = await createPlant(s);
    const res = await s.post('/api/orders', {
      customer_name: 'Cliente Órfão',
      items: [{ plant_id: a.id, quantity: 1 }, { plant_id: 'nao_existe', quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect((await s.db.get("SELECT COUNT(*) AS n FROM customers WHERE name = 'Cliente Órfão'")).n).toBe(1);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM orders')).n).toBe(0);
  });

  it('CARACTERIZAÇÃO: id de pedido duplicado → 500 e não deixa pedido pela metade', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const a = await createPlant(s);
    await createOrder(s, [{ plant_id: a.id }], { id: 'ord_dup' });
    const dup = await s.post('/api/orders', { id: 'ord_dup', customer_name: 'x', items: [{ plant_id: a.id, quantity: 1 }] });
    expect(dup.status).toBe(500);
    expect((await s.db.get("SELECT COUNT(*) AS n FROM orders WHERE id='ord_dup'")).n).toBe(1);
    expect((await s.db.get("SELECT COUNT(*) AS n FROM order_items WHERE order_id='ord_dup'")).n).toBe(1);
  });

  it('lista e consulta pedidos; 404 para inexistente', async () => {
    const a = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: a.id }]);
    const list = await s.get('/api/orders');
    expect(list.status).toBe(200);
    expect(list.body.find((x: any) => x.id === o.id).items).toHaveLength(1);
    expect((await s.get(`/api/orders/${o.id}`)).status).toBe(200);
    expect((await s.get('/api/orders/nao_existe')).status).toBe(404);
  });

  it('atualiza status; rejeita status inválido e pedido inexistente', async () => {
    const a = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: a.id }]);
    expect((await s.put(`/api/orders/${o.id}`, { status: 'preparando' })).body.status).toBe('preparando');
    expect((await s.put(`/api/orders/${o.id}`, { status: 'voando' })).status).toBe(400);
    expect((await s.put('/api/orders/nao_existe', { status: 'pronto' })).status).toBe(404);
  });

  it('🐞 BUG DOCUMENTADO: PUT /orders/:id aceita status "entregue" sem baixar estoque nem creditar caixa', async () => {
    const a = await createPlant(s, { stock_quantity: 5 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 2 }]);
    const res = await s.put(`/api/orders/${o.id}`, { status: 'entregue' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('entregue');
    expect(await stockOf(s, a.id)).toBe(5); // estoque intacto
    expect(await cashRows(s)).toHaveLength(0); // caixa intacto
    // e a entrega posterior é bloqueada ("já foi entregue"), então o pedido nunca vira dinheiro/estoque
    const start = await s.post('/api/deliveries/start', { order_id: o.id });
    expect(start.status).toBe(400);
  });
});
