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

async function scenario(stock = 5, qty = 2, price = 10) {
  const plant = await createPlant(s, { stock_quantity: stock, price });
  const order = await createOrder(s, [{ plant_id: plant.id, quantity: qty }]);
  const delivery = await startDelivery(s, order.id);
  return { plant, order, delivery };
}

describe('ciclo de entrega — start / state', () => {
  it('start cria entrega "iniciada" e muda o pedido para "pronto" (sem mexer em estoque/caixa)', async () => {
    const { plant, order, delivery } = await scenario();
    expect(delivery.status).toBe('iniciada');
    expect((await s.get(`/api/orders/${order.id}`)).body.status).toBe('pronto');
    expect(await stockOf(s, plant.id)).toBe(5);
    expect(await cashRows(s)).toHaveLength(0);
  });

  it('start repetido devolve a MESMA entrega (200) e não duplica', async () => {
    const { order, delivery } = await scenario();
    const again = await s.post('/api/deliveries/start', { order_id: order.id });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(delivery.id);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM deliveries')).n).toBe(1);
  });

  it('start valida: order_id ausente (400), pedido inexistente (404), estoque insuficiente (400), pedido sem itens (400)', async () => {
    expect((await s.post('/api/deliveries/start', {})).status).toBe(400);
    expect((await s.post('/api/deliveries/start', { order_id: 'nao_existe' })).status).toBe(404);
    const p = await createPlant(s, { stock_quantity: 1 });
    const o = await createOrder(s, [{ plant_id: p.id, quantity: 2 }]);
    const res = await s.post('/api/deliveries/start', { order_id: o.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Estoque insuficiente/);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM deliveries')).n).toBe(0);
    await s.db.run('DELETE FROM order_items WHERE order_id = ?', o.id);
    expect((await s.post('/api/deliveries/start', { order_id: o.id })).status).toBe(400);
  });

  it('PATCH /:id/state: aceita a_caminho/iniciada e game_state; recusa "entregue" e status inválido', async () => {
    const { delivery } = await scenario();
    const ok = await s.patch(`/api/deliveries/${delivery.id}/state`, { status: 'a_caminho', game_state: { x: 1, y: 2 } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('a_caminho');
    expect(JSON.parse(ok.body.game_state)).toEqual({ x: 1, y: 2 });
    expect((await s.patch(`/api/deliveries/${delivery.id}/state`, { status: 'entregue' })).status).toBe(400);
    expect((await s.patch(`/api/deliveries/${delivery.id}/state`, { status: 'xyz' })).status).toBe(400);
    expect((await s.patch('/api/deliveries/nao_existe/state', { status: 'a_caminho' })).status).toBe(404);
  });

  it('GET de entrega e listagem; 404 para inexistente', async () => {
    const { delivery } = await scenario();
    expect((await s.get(`/api/deliveries/${delivery.id}`)).status).toBe(200);
    expect((await s.get('/api/deliveries')).body).toHaveLength(1);
    expect((await s.get('/api/deliveries/nao_existe')).status).toBe(404);
  });
});

describe('POST /deliveries/:id/finish — comportamento ATUAL', () => {
  it('finaliza: estoque baixa, caixa credita o total do pedido, entrega e pedido ficam "entregue"', async () => {
    const { plant, order, delivery } = await scenario(5, 2, 10);
    const res = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, alreadyApplied: false, cashBalance: 20, totalSales: 20 });
    expect(res.body.delivery.status).toBe('entregue');
    expect(res.body.delivery.finished_at).toBeTypeOf('number');
    expect(res.body.order.status).toBe('entregue');
    expect(await stockOf(s, plant.id)).toBe(3);
    const cash = await cashRows(s);
    expect(cash).toHaveLength(1);
    expect(cash[0]).toMatchObject({ order_id: order.id, delivery_id: delivery.id, amount: 20, type: 'credit' });
  });

  it('pedido com 2 plantas baixa o estoque de cada uma e credita uma vez só', async () => {
    const a = await createPlant(s, { stock_quantity: 4, price: 5 });
    const b = await createPlant(s, { stock_quantity: 3, price: 8 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 1 }, { plant_id: b.id, quantity: 2 }]);
    const d = await startDelivery(s, o.id);
    expect((await s.post(`/api/deliveries/${d.id}/finish`)).status).toBe(200);
    expect(await stockOf(s, a.id)).toBe(3);
    expect(await stockOf(s, b.id)).toBe(1);
    const cash = await cashRows(s);
    expect(cash).toHaveLength(1);
    expect(cash[0].amount).toBe(21);
  });

  it('finish de entrega inexistente → 404', async () => {
    expect((await s.post('/api/deliveries/nao_existe/finish')).status).toBe(404);
  });

  it('contrato da resposta: apenas success, alreadyApplied, delivery, order, cashBalance, totalSales (sem campos da Fase 2)', async () => {
    const { delivery } = await scenario();
    const res = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(Object.keys(res.body).sort()).toEqual(['alreadyApplied', 'cashBalance', 'delivery', 'order', 'success', 'totalSales']);
  });

  it('IDEMPOTÊNCIA — 2ª finalização: 200 + alreadyApplied=true, mesmo estado final, SEM nenhum efeito', async () => {
    const { plant, order, delivery } = await scenario(5, 2, 10);
    const first = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(first.status).toBe(200);
    expect(first.body.alreadyApplied).toBe(false);

    const snapshot = async () => ({
      plant: await s.db.get('SELECT * FROM plants WHERE id = ?', plant.id),
      order: await s.db.get('SELECT * FROM orders WHERE id = ?', order.id),
      delivery: await s.db.get('SELECT * FROM deliveries WHERE id = ?', delivery.id),
      cash: await cashRows(s),
      items: await s.db.all('SELECT * FROM order_items WHERE order_id = ?', order.id),
    });
    const before = await snapshot();

    const second = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ success: true, alreadyApplied: true });
    // representa a entrega/pedido já finalizados (inclusive o carimbo original)
    expect(second.body.delivery).toEqual(first.body.delivery);
    expect(second.body.order).toEqual(first.body.order);
    expect(second.body.order.status).toBe('entregue');
    expect(second.body.delivery.finished_at).toBe(first.body.delivery.finished_at);
    expect(second.body).toMatchObject({ cashBalance: 20, totalSales: 20 });

    // NENHUM efeito colateral: tabelas idênticas linha a linha (updated_at inclusive)
    expect(await snapshot()).toEqual(before);
    expect(await stockOf(s, plant.id)).toBe(3);
  });

  it('IDEMPOTÊNCIA — várias repetições sequenciais: sempre 200/alreadyApplied=true; estoque e caixa uma vez só', async () => {
    const { plant, order, delivery } = await scenario(5, 2, 10);
    expect((await s.post(`/api/deliveries/${delivery.id}/finish`)).body.alreadyApplied).toBe(false);
    for (let i = 0; i < 10; i++) {
      const again = await s.post(`/api/deliveries/${delivery.id}/finish`);
      expect(again.status).toBe(200);
      expect(again.body.alreadyApplied).toBe(true);
    }
    expect(await stockOf(s, plant.id)).toBe(3);
    const cash = await cashRows(s);
    expect(cash).toHaveLength(1);
    expect(cash.filter((c: any) => c.order_id === order.id)).toHaveLength(1);
  });

  it('a repetição não exige que o caixa global seja igual: outras operações legítimas entre as chamadas são aceitas', async () => {
    const { delivery } = await scenario(5, 2, 10);
    await s.post(`/api/deliveries/${delivery.id}/finish`);
    // outra operação legítima no caixa entre as chamadas (inserida direto: a rota manual foi desativada na 1E)
    await s.db.run("INSERT INTO cash_transactions (id, amount, type, description, created_at) VALUES ('tx_outra', 5, 'debit', 'outra operação', ?)", Date.now());
    const again = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(again.status).toBe(200);
    expect(again.body.alreadyApplied).toBe(true);
    expect(again.body.cashBalance).toBe(15); // saldo ATUAL
    expect(again.body.totalSales).toBe(20);
    expect(await cashRows(s)).toHaveLength(2); // o crédito do pedido + o débito, nenhum crédito extra
  });

  it('CONCORRÊNCIA: dois finish simultâneos → ambos 200; exatamente um alreadyApplied=false e um true; efeitos uma vez só', async () => {
    const { plant, order, delivery } = await scenario(5, 2, 10);
    const [r1, r2] = await Promise.all([
      s.post(`/api/deliveries/${delivery.id}/finish`),
      s.post(`/api/deliveries/${delivery.id}/finish`),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect([r1.body.alreadyApplied, r2.body.alreadyApplied].sort()).toEqual([false, true]);
    expect(await stockOf(s, plant.id)).toBe(3);
    const cash = await cashRows(s);
    expect(cash).toHaveLength(1);
    expect(cash.filter((c: any) => c.order_id === order.id)).toHaveLength(1);
  });

  it('CONCORRÊNCIA: 8 finish simultâneos → todos 200, um único alreadyApplied=false', async () => {
    const { plant, delivery } = await scenario(5, 2, 10);
    const results = await Promise.all(Array.from({ length: 8 }, () => s.post(`/api/deliveries/${delivery.id}/finish`)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.alreadyApplied === false)).toHaveLength(1);
    expect(results.filter((r) => r.body.alreadyApplied === true)).toHaveLength(7);
    expect(await stockOf(s, plant.id)).toBe(3);
    expect(await cashRows(s)).toHaveLength(1);
  });

  it('a decisão vem do estado PERSISTIDO (sem flag em memória): entrega já "entregue" no banco → alreadyApplied=true sem efeitos', async () => {
    const { plant, order, delivery } = await scenario(5, 2, 10);
    // estado criado "por fora" (como se outro processo/instância já tivesse finalizado): nenhuma chamada prévia ao /finish
    await s.db.run("UPDATE deliveries SET status = 'entregue', finished_at = 123, updated_at = 123 WHERE id = ?", delivery.id);
    const res = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(res.status).toBe(200);
    expect(res.body.alreadyApplied).toBe(true);
    expect(res.body.delivery.finished_at).toBe(123);
    expect(await stockOf(s, plant.id)).toBe(5); // nada foi baixado
    expect(await cashRows(s)).toHaveLength(0); // nada foi creditado
    expect((await s.db.get('SELECT status FROM orders WHERE id = ?', order.id)).status).toBe('pronto'); // pedido não foi tocado
  });

  it('ROLLBACK: falta de estoque no 2º item desfaz a baixa do 1º; entrega e pedido NÃO mudam; sem caixa', async () => {
    const a = await createPlant(s, { stock_quantity: 5, price: 10 });
    const b = await createPlant(s, { stock_quantity: 3, price: 10 });
    const o = await createOrder(s, [{ plant_id: a.id, quantity: 2 }, { plant_id: b.id, quantity: 3 }]);
    const d = await startDelivery(s, o.id);
    // entre o start e o finish, o estoque da planta B cai abaixo do necessário
    await s.put(`/api/plants/${b.id}`, { name: 'B', price: 10, stock_quantity: 1 });

    const res = await s.post(`/api/deliveries/${d.id}/finish`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Estoque insuficiente/);

    expect(await stockOf(s, a.id)).toBe(5); // a baixa de A foi revertida
    expect(await stockOf(s, b.id)).toBe(1);
    expect((await s.get(`/api/deliveries/${d.id}`)).body.status).toBe('iniciada');
    expect((await s.get(`/api/orders/${o.id}`)).body.status).toBe('pronto');
    expect(await cashRows(s)).toHaveLength(0);
    expect(res.body.alreadyApplied).toBeUndefined(); // falha real NUNCA vira alreadyApplied

    // e não "memoriza" a falha: corrigida a causa, a MESMA entrega finaliza normalmente (alreadyApplied=false)
    await s.put(`/api/plants/${b.id}`, { name: 'B', price: 10, stock_quantity: 3 });
    const retry = await s.post(`/api/deliveries/${d.id}/finish`);
    expect(retry.status).toBe(200);
    expect(retry.body.alreadyApplied).toBe(false);
    expect(await stockOf(s, a.id)).toBe(3);
    expect(await stockOf(s, b.id)).toBe(0);
    expect(await cashRows(s)).toHaveLength(1);
  });

  it('ROLLBACK (falha injetada no caixa): se o INSERT do caixa falha, nada do finish persiste', async () => {
    const { plant, order, delivery } = await scenario(5, 2, 10);
    // Sabotagem controlada NO BANCO DE TESTE: um gatilho que aborta qualquer crédito no caixa
    await s.db.run(`
      CREATE TRIGGER trg_test_bloqueia_caixa BEFORE INSERT ON cash_transactions
      BEGIN SELECT RAISE(ABORT, 'falha injetada no teste'); END;
    `);
    const res = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/falha injetada/);
    expect(await stockOf(s, plant.id)).toBe(5);
    expect((await s.get(`/api/deliveries/${delivery.id}`)).body.status).toBe('iniciada');
    expect((await s.get(`/api/orders/${order.id}`)).body.status).toBe('pronto');
    expect(await cashRows(s)).toHaveLength(0);
    expect(res.body.alreadyApplied).toBeUndefined();

    // removida a sabotagem, a mesma entrega finaliza e aplica (não ficou marcada como aplicada)
    await s.db.run('DROP TRIGGER trg_test_bloqueia_caixa');
    const retry = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(retry.status).toBe(200);
    expect(retry.body.alreadyApplied).toBe(false);
    expect(await stockOf(s, plant.id)).toBe(3);
    expect(await cashRows(s)).toHaveLength(1);
  });

  it('CARACTERIZAÇÃO: sem estoque no finish o erro é 400 (não 409) com mensagem de estoque', async () => {
    const { plant, delivery } = await scenario(2, 2, 10);
    await s.put(`/api/plants/${plant.id}`, { name: 'x', price: 10, stock_quantity: 0 });
    const res = await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect(res.status).toBe(400);
  });

  it('PATCH /state após finalizar → 400 (entrega não pode mais ser alterada)', async () => {
    const { delivery } = await scenario();
    await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect((await s.patch(`/api/deliveries/${delivery.id}/state`, { status: 'a_caminho' })).status).toBe(400);
  });

  it('start para pedido já entregue → 400', async () => {
    const { order, delivery } = await scenario();
    await s.post(`/api/deliveries/${delivery.id}/finish`);
    expect((await s.post('/api/deliveries/start', { order_id: order.id })).status).toBe(400);
  });

  it('o banco impede 2ª entrega para o mesmo pedido e 2º crédito no caixa para o mesmo pedido (UNIQUE)', async () => {
    const { order, delivery } = await scenario();
    await expect(
      s.db.run("INSERT INTO deliveries (id, order_id, status, created_at, updated_at) VALUES ('d2', ?, 'iniciada', 1, 1)", order.id)
    ).rejects.toThrow();
    await s.post(`/api/deliveries/${delivery.id}/finish`);
    await expect(
      s.db.run("INSERT INTO cash_transactions (id, order_id, amount, type, created_at) VALUES ('t2', ?, 1, 'credit', 1)", order.id)
    ).rejects.toThrow();
  });
});
