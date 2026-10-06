import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cashRows, createOrder, createPlant, startDelivery, stockOf } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await s.close();
});

const row = (id: string) => s.db.get('SELECT * FROM plants WHERE id = ?', id);

/** Planta com um pedido ENTREGUE (histórico). */
async function plantWithDeliveredOrder() {
  const p = await createPlant(s, { stock_quantity: 5, price: 10, name: 'Planta Histórica' });
  const o = await createOrder(s, [{ plant_id: p.id, quantity: 2 }]);
  const d = await startDelivery(s, o.id);
  expect((await s.post(`/api/deliveries/${d.id}/finish`)).status).toBe(200);
  return { plant: p, order: o, delivery: d };
}

describe('DELETE /api/plants/:id — exclusão LÓGICA (1D)', () => {
  it('planta SEM histórico: 200, "removida do catálogo", linha preservada com deleted_at', async () => {
    const p = await createPlant(s, { stock_quantity: 4 });
    const res = await s.del(`/api/plants/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, deleted: true, alreadyDeleted: false });
    expect(res.body.deletedAt).toBeTypeOf('number');
    expect(res.body.message).toMatch(/removida do catálogo/);
    const r = await row(p.id);
    expect(r).toBeDefined(); // NÃO foi apagada fisicamente
    expect(r.deleted_at).toBe(res.body.deletedAt);
    expect(r.stock_quantity).toBe(4); // estoque preservado
  });

  it('planta COM pedido concluído: 200 (antes dava 500 por FK), histórico 100% íntegro', async () => {
    const { plant, order } = await plantWithDeliveredOrder();
    const before = {
      orders: await s.db.all('SELECT * FROM orders'),
      items: await s.db.all('SELECT * FROM order_items'),
      deliveries: await s.db.all('SELECT * FROM deliveries'),
      cash: await cashRows(s),
    };
    const res = await s.del(`/api/plants/${plant.id}`);
    expect(res.status).toBe(200);
    expect(res.body.alreadyDeleted).toBe(false);

    // nada do histórico mudou
    expect(await s.db.all('SELECT * FROM orders')).toEqual(before.orders);
    expect(await s.db.all('SELECT * FROM order_items')).toEqual(before.items);
    expect(await s.db.all('SELECT * FROM deliveries')).toEqual(before.deliveries);
    expect(await cashRows(s)).toEqual(before.cash);
    expect(await stockOf(s, plant.id)).toBe(3);
    // e o pedido antigo continua legível, com o nome da planta excluída
    const old = await s.get(`/api/orders/${order.id}`);
    expect(old.status).toBe(200);
    expect(old.body.status).toBe('entregue');
    expect(old.body.items[0]).toMatchObject({ plant_id: plant.id, plant_name: 'Planta Histórica', quantity: 2, unit_price: 10 });
    const list = await s.get('/api/orders');
    expect(list.body.find((o: any) => o.id === order.id).items[0].plant_name).toBe('Planta Histórica');
    // caixa/vendas históricas inalterados
    expect((await s.get('/api/cash/summary')).body).toMatchObject({ balance: 20, totalSales: 20, transactionCount: 1 });
  });

  it('DELETE repetido é idempotente: 200 alreadyDeleted=true, mesmo deletedAt, nenhuma escrita', async () => {
    const p = await createPlant(s);
    const first = await s.del(`/api/plants/${p.id}`);
    const before = await row(p.id);
    for (let i = 0; i < 3; i++) {
      const again = await s.del(`/api/plants/${p.id}`);
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ success: true, deleted: true, alreadyDeleted: true, deletedAt: first.body.deletedAt });
    }
    expect(await row(p.id)).toEqual(before); // updated_at inclusive
  });

  it('planta inexistente → 404 (idempotência só vale para planta que existe)', async () => {
    expect((await s.del('/api/plants/nao_existe')).status).toBe(404);
  });

  it('REGRA MANTIDA: planta usada por pedido NÃO entregue não pode ser removida (400) e nada muda', async () => {
    const p = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: p.id }]);
    const before = await row(p.id);
    const res = await s.del(`/api/plants/${p.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pedidos em andamento/);
    expect(await row(p.id)).toEqual(before);
    await startDelivery(s, o.id); // pedido 'pronto' continua bloqueando
    expect((await s.del(`/api/plants/${p.id}`)).status).toBe(400);
    expect((await row(p.id)).deleted_at).toBeNull();
  });

  it('depois que o pedido é entregue, a planta passa a poder ser removida', async () => {
    const p = await createPlant(s, { stock_quantity: 3 });
    const o = await createOrder(s, [{ plant_id: p.id }]);
    const d = await startDelivery(s, o.id);
    expect((await s.del(`/api/plants/${p.id}`)).status).toBe(400);
    await s.post(`/api/deliveries/${d.id}/finish`);
    expect((await s.del(`/api/plants/${p.id}`)).status).toBe(200);
  });
});

describe('planta removida — catálogo (A) e operações novas (C)', () => {
  it('some do catálogo: GET /plants, GET /plants/:id, /stock e /:id/stock; as ativas continuam', async () => {
    const keep = await createPlant(s, { name: 'Fica', stock_quantity: 2 });
    const gone = await createPlant(s, { name: 'Sai', stock_quantity: 9 });
    await s.del(`/api/plants/${gone.id}`);

    const list = await s.get('/api/plants');
    expect(list.body.map((p: any) => p.id)).toEqual([keep.id]);
    expect((await s.get(`/api/plants/${gone.id}`)).status).toBe(404);
    expect((await s.get(`/api/plants/${gone.id}/stock`)).status).toBe(404);
    const stock = await s.get('/api/plants/stock');
    expect(stock.body.plants.map((p: any) => p.id)).toEqual([keep.id]);
    expect(stock.body.totalUnits).toBe(2); // não soma o estoque da planta removida
    expect((await s.get(`/api/plants/${keep.id}`)).status).toBe(200);
  });

  it('NÃO entra em novo pedido (400 PLANT_DELETED); pedido misto também é recusado por inteiro', async () => {
    const ok = await createPlant(s);
    const gone = await createPlant(s, { name: 'Removida' });
    await s.del(`/api/plants/${gone.id}`);
    const res = await s.post('/api/orders', { customer_name: 'X', items: [{ plant_id: gone.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PLANT_DELETED');
    expect(res.body.error).toMatch(/Removida/);
    const mixed = await s.post('/api/orders', { customer_name: 'X', items: [{ plant_id: ok.id, quantity: 1 }, { plant_id: gone.id, quantity: 1 }] });
    expect(mixed.status).toBe(400);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM orders')).n).toBe(0);
  });

  it('PUT (editar preço/estoque/foto) em planta removida → 409 PLANT_DELETED, sem alterar a linha', async () => {
    const p = await createPlant(s, { price: 10, stock_quantity: 5 });
    await s.del(`/api/plants/${p.id}`);
    const before = await row(p.id);
    const res = await s.put(`/api/plants/${p.id}`, { name: 'Novo', price: 99, stock_quantity: 1000 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PLANT_DELETED');
    expect(await row(p.id)).toEqual(before);
    expect((await s.put('/api/plants/nao_existe', { name: 'x', price: 1, stock_quantity: 1 })).status).toBe(404); // inexistente continua 404
  });

  it('PUT em planta ativa continua funcionando (regressão)', async () => {
    const p = await createPlant(s);
    expect((await s.put(`/api/plants/${p.id}`, { name: 'Editada', price: 11, stock_quantity: 6 })).status).toBe(200);
  });

  it('POST com o id de uma planta removida não "ressuscita" nem sobrescreve (conflito de PK → 500 atual, B7)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = await createPlant(s, { id: 'p_fixa', name: 'Original' });
    await s.del(`/api/plants/${p.id}`);
    const res = await s.post('/api/plants', { id: 'p_fixa', name: 'Outra', price: 1, stock_quantity: 1, image_path: '/a.jpg' });
    expect(res.status).toBe(500); // comportamento atual para id repetido (B7); a linha original segue removida e intacta
    const r = await row('p_fixa');
    expect(r.name).toBe('Original');
    expect(r.deleted_at).not.toBeNull();
  });
});

describe('política de PEDIDO ABERTO × exclusão lógica', () => {
  it('a regra de segurança impede a situação: pedido aberto → DELETE recusado, planta continua ativa e o fluxo conclui normalmente', async () => {
    const p = await createPlant(s, { stock_quantity: 5, price: 10 });
    const o = await createOrder(s, [{ plant_id: p.id, quantity: 2 }]);
    const d = await startDelivery(s, o.id);
    expect((await s.del(`/api/plants/${p.id}`)).status).toBe(400);
    const fin = await s.post(`/api/deliveries/${d.id}/finish`);
    expect(fin.status).toBe(200);
    expect(await stockOf(s, p.id)).toBe(3);
  });

  it('DEFENSIVO: se uma planta com pedido legitimamente aberto aparecer removida (ex.: dado antigo/ restauração), a entrega CONCLUI de forma consistente', async () => {
    const p = await createPlant(s, { stock_quantity: 5, price: 10 });
    const o = await createOrder(s, [{ plant_id: p.id, quantity: 2 }]);
    const d = await startDelivery(s, o.id);
    // força o estado "removida com pedido aberto" direto no banco (a API não permite chegar aqui)
    await s.db.run('UPDATE plants SET deleted_at = ? WHERE id = ?', 12345, p.id);

    const fin = await s.post(`/api/deliveries/${d.id}/finish`);
    expect(fin.status).toBe(200);
    expect(fin.body.alreadyApplied).toBe(false);
    expect(fin.body.order.status).toBe('entregue');
    expect(await stockOf(s, p.id)).toBe(3); // a baixa vale também para a planta removida (histórico consistente)
    const cash = await cashRows(s);
    expect(cash).toHaveLength(1);
    expect(cash[0].amount).toBe(20);
    expect((await row(p.id)).deleted_at).toBe(12345); // continua removida
    // e a planta segue fora do catálogo ativo
    expect((await s.get('/api/plants')).body).toEqual([]);
    // repetição segue idempotente
    expect((await s.post(`/api/deliveries/${d.id}/finish`)).body.alreadyApplied).toBe(true);
  });

  it('DEFENSIVO: também é possível INICIAR a entrega de pedido aberto cuja planta foi removida', async () => {
    const p = await createPlant(s, { stock_quantity: 5 });
    const o = await createOrder(s, [{ plant_id: p.id, quantity: 1 }]);
    await s.db.run('UPDATE plants SET deleted_at = ? WHERE id = ?', 12345, p.id);
    const start = await s.post('/api/deliveries/start', { order_id: o.id });
    expect(start.status).toBe(201);
  });
});

describe('histórico antigo continua legível e correto', () => {
  it('pedidos entregues e abertos de OUTRAS plantas não são afetados pela remoção; jogo (/game/current) funciona', async () => {
    const { plant: gone, order } = await plantWithDeliveredOrder();
    const other = await createPlant(s, { name: 'Outra', stock_quantity: 4, price: 7 });
    const o2 = await createOrder(s, [{ plant_id: other.id, quantity: 1 }]);
    const d2 = await startDelivery(s, o2.id);
    await s.del(`/api/plants/${gone.id}`);

    expect((await s.get(`/api/orders/${order.id}`)).body.items[0].plant_name).toBe('Planta Histórica');
    const game = await s.get('/api/game/current');
    expect(game.status).toBe(200);
    expect(JSON.stringify(game.body)).toContain('Outra');
    expect((await s.post(`/api/deliveries/${d2.id}/finish`)).status).toBe(200);
    expect((await s.get('/api/cash/summary')).body).toMatchObject({ balance: 27, totalSales: 27, transactionCount: 2 });
  });

  it('a remoção é reversível por dados: limpar deleted_at devolve a planta ao catálogo (base para um restore futuro, sem endpoint agora)', async () => {
    const p = await createPlant(s, { name: 'Volta' });
    await s.del(`/api/plants/${p.id}`);
    expect((await s.get('/api/plants')).body).toEqual([]);
    await s.db.run('UPDATE plants SET deleted_at = NULL WHERE id = ?', p.id);
    expect((await s.get('/api/plants')).body.map((x: any) => x.id)).toEqual([p.id]);
    expect((await s.get(`/api/plants/${p.id}`)).status).toBe(200);
  });
});
