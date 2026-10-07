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

  it('order_number é atribuído pelo BACKEND (sequencial); o que o cliente enviar é ignorado', async () => {
    const a = await createPlant(s);
    expect((await createOrder(s, [{ plant_id: a.id }], { order_number: 500 })).order_number).toBe(101);
    expect((await createOrder(s, [{ plant_id: a.id }], { order_number: 7 })).order_number).toBe(102);
    expect((await createOrder(s, [{ plant_id: a.id }])).order_number).toBe(103);
  });

  it('criações simultâneas não repetem order_number', async () => {
    const a = await createPlant(s, { stock_quantity: 50 });
    const made = await Promise.all(Array.from({ length: 12 }, () => createOrder(s, [{ plant_id: a.id }], { order_number: 1 })));
    const numbers = made.map((o) => o.order_number);
    expect(new Set(numbers).size).toBe(12);
    expect(Math.min(...numbers)).toBe(101);
    expect(Math.max(...numbers)).toBe(112);
  });

  it('o PREÇO é o da planta persistida, congelado no item: unit_price do cliente é IGNORADO', async () => {
    const a = await createPlant(s, { price: 10 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 2, unit_price: 3 }]);
    expect(o.items[0].unit_price).toBe(10);
    expect(o.total).toBe(20);
    const free = await createOrder(s, [{ plant_id: a.id, unit_price: 0 }]);
    const huge = await createOrder(s, [{ plant_id: a.id, unit_price: 999999 }]);
    expect(free.total).toBe(10);
    expect(huge.total).toBe(10);
    // reprecificar a planta depois NÃO muda pedidos antigos
    await s.put(`/api/plants/${a.id}`, { name: 'x', price: 99, stock_quantity: 5 });
    const read = await s.get(`/api/orders/${o.id}`);
    expect(read.body.items[0].unit_price).toBe(10);
    expect(read.body.total).toBe(20);
    // e pedidos NOVOS usam o preço novo
    expect((await createOrder(s, [{ plant_id: a.id }])).total).toBe(99);
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

  it('PUT /orders/:id com status "entregue" é REJEITADO (400 USE_FINISH_ENDPOINT): sem estoque, sem caixa, pedido intacto', async () => {
    const a = await createPlant(s, { stock_quantity: 5 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 2 }]);
    const before = await s.db.get('SELECT * FROM orders WHERE id = ?', o.id);

    const res = await s.put(`/api/orders/${o.id}`, { status: 'entregue' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USE_FINISH_ENDPOINT');
    expect(res.body.error).toMatch(/\/deliveries\/:id\/finish/);

    expect(await s.db.get('SELECT * FROM orders WHERE id = ?', o.id)).toEqual(before); // nem updated_at mudou
    expect(await stockOf(s, a.id)).toBe(5);
    expect(await cashRows(s)).toHaveLength(0);
    expect((await s.get(`/api/orders/${o.id}`)).body.status).toBe('recebido');
  });

  it('PUT entregue rejeitado também com entrega em andamento — e o fluxo oficial segue funcionando', async () => {
    const a = await createPlant(s, { stock_quantity: 5, price: 10 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 2 }]);
    const d = await s.post('/api/deliveries/start', { order_id: o.id });
    expect(d.status).toBe(201);

    expect((await s.put(`/api/orders/${o.id}`, { status: 'entregue' })).status).toBe(400);
    expect((await s.get(`/api/orders/${o.id}`)).body.status).toBe('pronto');
    expect(await stockOf(s, a.id)).toBe(5);
    expect(await cashRows(s)).toHaveLength(0);

    // o único caminho para "entregue" continua válido e consistente
    const fin = await s.post(`/api/deliveries/${d.body.id}/finish`);
    expect(fin.status).toBe(200);
    expect(fin.body.order.status).toBe('entregue');
    expect(await stockOf(s, a.id)).toBe(3);
    expect(await cashRows(s)).toHaveLength(1);
  });

  it('PUT entregue é rejeitado mesmo para pedido inexistente (a regra vem antes da busca) e com status inválido continua 400', async () => {
    expect((await s.put('/api/orders/nao_existe', { status: 'entregue' })).status).toBe(400);
    const a = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: a.id }]);
    const bad = await s.put(`/api/orders/${o.id}`, { status: 'voando' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).not.toMatch(/entregue/); // "valores aceitos" não oferece mais 'entregue'
  });

  it('as atualizações legítimas do PUT continuam permitidas (recebido/preparando/pronto)', async () => {
    const a = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: a.id }]);
    for (const st of ['preparando', 'pronto', 'recebido']) {
      const r = await s.put(`/api/orders/${o.id}`, { status: st });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe(st);
    }
  });

  describe('"entregue" é TERMINAL (B11 fechado na 1C)', () => {
    async function deliveredOrder() {
      const a = await createPlant(s, { stock_quantity: 5, price: 10 });
      const o = await createOrder(s, [{ plant_id: a.id, quantity: 2 }]);
      const d = await s.post('/api/deliveries/start', { order_id: o.id });
      expect((await s.post(`/api/deliveries/${d.body.id}/finish`)).status).toBe(200);
      return { plant: a, order: o, deliveryId: d.body.id as string };
    }
    const dump = async (orderId: string, deliveryId: string, plantId: string) => ({
      order: await s.db.get('SELECT * FROM orders WHERE id = ?', orderId),
      delivery: await s.db.get('SELECT * FROM deliveries WHERE id = ?', deliveryId),
      plant: await s.db.get('SELECT * FROM plants WHERE id = ?', plantId),
      cash: await cashRows(s),
      items: await s.db.all('SELECT * FROM order_items WHERE order_id = ?', orderId),
    });

    it.each(['recebido', 'preparando', 'pronto'])('entregue → %s é rejeitado (409 ORDER_ALREADY_DELIVERED) sem alterar nada', async (target) => {
      const { plant, order, deliveryId } = await deliveredOrder();
      const before = await dump(order.id, deliveryId, plant.id);

      const res = await s.put(`/api/orders/${order.id}`, { status: target });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ORDER_ALREADY_DELIVERED');
      expect(res.body.error).toMatch(/estado final/);

      // pedido, entrega, estoque, caixa e itens IDÊNTICOS (updated_at inclusive)
      expect(await dump(order.id, deliveryId, plant.id)).toEqual(before);
      expect(before.order.status).toBe('entregue');
      expect(before.plant.stock_quantity).toBe(3);
      expect(before.cash).toHaveLength(1);
      expect((await s.get(`/api/orders/${order.id}`)).body.status).toBe('entregue');
    });

    it('várias tentativas de reabrir seguidas continuam sem efeito; "entregue → entregue" também é rejeitado', async () => {
      const { plant, order, deliveryId } = await deliveredOrder();
      const before = await dump(order.id, deliveryId, plant.id);
      for (const st of ['recebido', 'preparando', 'pronto', 'recebido']) {
        expect((await s.put(`/api/orders/${order.id}`, { status: st })).status).toBe(409);
      }
      const same = await s.put(`/api/orders/${order.id}`, { status: 'entregue' });
      expect(same.status).toBe(400);
      expect(same.body.code).toBe('USE_FINISH_ENDPOINT');
      expect(await dump(order.id, deliveryId, plant.id)).toEqual(before);
    });

    it('o finish repetido continua idempotente depois das tentativas de reabrir (estoque/caixa uma vez só)', async () => {
      const { plant, order, deliveryId } = await deliveredOrder();
      await s.put(`/api/orders/${order.id}`, { status: 'recebido' });
      const again = await s.post(`/api/deliveries/${deliveryId}/finish`);
      expect(again.status).toBe(200);
      expect(again.body.alreadyApplied).toBe(true);
      expect(again.body.order.status).toBe('entregue');
      expect(await stockOf(s, plant.id)).toBe(3);
      expect(await cashRows(s)).toHaveLength(1);
    });

    it('status inválido ou pedido inexistente mantêm 400/404 (a regra terminal só vale para pedido entregue)', async () => {
      const { order } = await deliveredOrder();
      expect((await s.put(`/api/orders/${order.id}`, { status: 'voando' })).status).toBe(400);
      expect((await s.put('/api/orders/nao_existe', { status: 'pronto' })).status).toBe(404);
    });
  });
});
