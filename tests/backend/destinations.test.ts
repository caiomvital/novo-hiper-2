import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOrder, createPlant, startDelivery } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';
import { DESTINATION_IDS, isLegacyDestination, isModernDestination, LEGACY_DESTINATIONS } from '../../src/shared/destinations';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  await s.close();
});

const customerOf = async (id: string) => (await s.get(`/api/customers/${id}`)).body;

describe('destinos — clientes e pedidos', () => {
  it('cliente novo recebe residência válida, gravada no cadastro (estável entre leituras)', async () => {
    const p = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Dona Maria' });
    const c1 = await customerOf(o.customer_id);
    expect(isModernDestination(c1.destination)).toBe(true);
    expect((await customerOf(o.customer_id)).destination).toBe(c1.destination);
    // reler o pedido não recalcula nada
    expect((await s.get(`/api/orders/${o.id}`)).body.destination_id).toBe(c1.destination);
  });

  it('o corpo da requisição NÃO escolhe o destino (cliente novo ignora destination_id enviado)', async () => {
    const p = await createPlant(s);
    const o2 = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Bia', destination_id: 'bairro9/house_999' });
    expect(isModernDestination((await customerOf(o2.customer_id)).destination)).toBe(true);
    expect(o2.destination_id).not.toBe('bairro9/house_999');
  });

  it('distribui novos clientes entre as casas habilitadas sem concentrar', async () => {
    const p = await createPlant(s, { stock_quantity: 100 });
    const got: string[] = [];
    for (let i = 0; i < DESTINATION_IDS.length; i++) {
      const o = await createOrder(s, [{ plant_id: p.id }], { customer_name: `Cliente ${i}` });
      got.push(o.destination_id);
    }
    // N clientes em N casas: todas diferentes
    expect(new Set(got).size).toBe(DESTINATION_IDS.length);
    // o próximo ciclo começa de novo sem repetir dentro do ciclo
    const next: string[] = [];
    for (let i = 0; i < DESTINATION_IDS.length; i++) {
      next.push((await createOrder(s, [{ plant_id: p.id }], { customer_name: `Outro ${i}` })).destination_id);
    }
    expect(new Set(next).size).toBe(DESTINATION_IDS.length);
  });

  it('clientes diferentes podem morar em casas diferentes e pedidos seguem o respectivo cliente', async () => {
    const p = await createPlant(s, { stock_quantity: 10 });
    const a = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Dona Maria' });
    const b = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Seu João' });
    expect(a.customer_id).not.toBe(b.customer_id);
    expect(a.destination_id).not.toBe(b.destination_id);
  });

  it('o pedido congela o destino: mudar o endereço do cliente afeta só pedidos NOVOS', async () => {
    const p = await createPlant(s, { stock_quantity: 10 });
    const old = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Dona Maria' });
    const before = old.destination_id;
    const target = DESTINATION_IDS.find((d) => d !== before)!;

    const moved = await s.put(`/api/customers/${old.customer_id}/destination`, { destination: target });
    expect(moved.status).toBe(200);
    expect(moved.body.destination).toBe(target);

    // pedido antigo: continua no destino original (tanto no GET por id quanto na lista)
    expect((await s.get(`/api/orders/${old.id}`)).body.destination_id).toBe(before);
    expect((await s.get('/api/orders')).body.find((o: any) => o.id === old.id).destination_id).toBe(before);

    // pedido novo do mesmo cliente: endereço novo
    const novo = await s.post('/api/orders', { customer_id: old.customer_id, items: [{ plant_id: p.id, quantity: 1 }] });
    expect(novo.status).toBe(201);
    expect(novo.body.destination_id).toBe(target);
    expect((await s.get(`/api/orders/${novo.body.id}`)).body.destination_id).toBe(target);
  });

  it('a entrega e o jogo expõem o destino congelado do pedido', async () => {
    const p = await createPlant(s, { stock_quantity: 10 });
    const o = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Dona Maria' });
    const frozen = o.destination_id;
    const other = DESTINATION_IDS.find((d) => d !== frozen)!;
    await s.put(`/api/customers/${o.customer_id}/destination`, { destination: other });
    await startDelivery(s, o.id);
    const list = (await s.get('/api/deliveries')).body.find((x: any) => x.order_id === o.id);
    expect(list.destination_id).toBe(frozen);
  });

  it('PUT /customers/:id/destination: só residências modernas existentes; cliente inexistente → 404', async () => {
    const p = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: p.id }]);
    for (const bad of ['bairro1/house_999', 'dest_vovo', '', null, 42, 'bairro2/house_002']) {
      const r = await s.put(`/api/customers/${o.customer_id}/destination`, { destination: bad });
      expect(r.status, String(bad)).toBe(400);
      expect(r.body.code).toBe('INVALID_DESTINATION');
    }
    expect((await s.put('/api/customers/nao_existe/destination', { destination: DESTINATION_IDS[0] })).status).toBe(404);
  });

  it('POST /customers: sem destino atribui; legado conhecido e moderno válido aceitos; id moderno inválido → 400', async () => {
    const auto = await s.post('/api/customers', { name: 'Auto' });
    expect(auto.status).toBe(201);
    expect(isModernDestination(auto.body.destination)).toBe(true);
    expect((await s.post('/api/customers', { name: 'Leg', destination: 'dest_vovo' })).body.destination).toBe('dest_vovo');
    expect((await s.post('/api/customers', { name: 'Mod', destination: DESTINATION_IDS[3] })).body.destination).toBe(DESTINATION_IDS[3]);
    expect((await s.post('/api/customers', { name: 'Ruim', destination: 'bairro1/house_999' })).status).toBe(400);
    expect((await s.post('/api/customers', { name: 'Ruim2', destination: 'qualquer_coisa' })).status).toBe(400);
  });

  it('cliente legado: o pedido novo congela o valor legado do cliente (compatibilidade explícita)', async () => {
    const p = await createPlant(s, { stock_quantity: 10 });
    const c = (await s.post('/api/customers', { name: 'Antigo', destination: 'dest_manual' })).body;
    const o = await s.post('/api/orders', { customer_id: c.id, items: [{ plant_id: p.id, quantity: 1 }] });
    expect(o.body.destination_id).toBe('dest_manual');
    expect(isLegacyDestination(o.body.destination_id)).toBe(true);
  });

  it('pedido sem snapshot (destination_id NULL, legado) lê o endereço do cliente (COALESCE)', async () => {
    const p = await createPlant(s, { stock_quantity: 10 });
    const o = await createOrder(s, [{ plant_id: p.id }], { customer_name: 'Sem Snapshot' });
    await s.db.run('UPDATE orders SET destination_id = NULL WHERE id = ?', o.id);
    expect((await s.get(`/api/orders/${o.id}`)).body.destination_id).toBe((await customerOf(o.customer_id)).destination);
  });

  it('catálogo: ids únicos no formato região/casa, sem posição no identificador; legados explícitos', () => {
    expect(new Set(DESTINATION_IDS).size).toBe(DESTINATION_IDS.length);
    for (const id of DESTINATION_IDS) expect(id).toMatch(/^bairro1\/house_\d{3}$/);
    for (const id of LEGACY_DESTINATIONS) expect(DESTINATION_IDS).not.toContain(id);
    expect(['dest_default', 'dest_manual', 'dest_e2e']).toEqual(expect.arrayContaining(['dest_default', 'dest_manual', 'dest_e2e'].filter(isLegacyDestination)));
    expect(isLegacyDestination('bairro1/house_999')).toBe(false);
  });
});
