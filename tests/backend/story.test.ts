import { afterEach, beforeEach, expect, it } from 'vitest';
import { startTestServer, type TestServer } from './helpers/testServer';
import { createPlant, createOrder, startDelivery } from './helpers/builders';
let s: TestServer;
beforeEach(async () => { s = await startTestServer(); });
afterEach(async () => { await s.close(); });
const endpoint = '/api/progress/celebrations/bairro_vivo/ack';
it('celebração exige sessão e conquista oficial', async () => {
  expect((await s.raw('POST', endpoint, { cookie: false })).status).toBe(401);
  expect((await s.post(endpoint)).status).toBe(409);
  expect((await s.get('/api/progress')).body.story.bairroVivoSeenAt).toBeNull();
});
it('primeiro arco real: confirmação única, persistente e sem novos efeitos financeiros', async () => {
  const plants = [];
  for (let i = 0; i < 3; i++) plants.push(await createPlant(s, { price: 100, stock_quantity: 20 }));
  const houses = ['bairro1/house_007', 'bairro1/house_017', 'bairro1/house_021', 'bairro1/house_045'];
  for (let i = 0; i < 10; i++) {
    const order = await createOrder(s, [{ plant_id: plants[i % 3].id }], { destination_id: houses[i % 4] });
    const d = await startDelivery(s, order.id); expect((await s.post(`/api/deliveries/${d.id}/finish`)).status).toBe(200);
  }
  for (const id of ['placa_madeira', 'jardineiras', 'banco']) {
    expect((await s.post(`/api/shop/upgrades/${id}/purchase`)).status).toBe(200);
    expect((await s.post(`/api/shop/upgrades/${id}/install`)).status).toBe(200);
  }
  const before = (await s.get('/api/cash')).body;
  const first = await s.post(endpoint); expect(first.status).toBe(200);
  expect(first.body.seenAt).toBeGreaterThan(0);
  expect((await s.post(endpoint)).body).toEqual(first.body);
  expect((await s.get('/api/cash')).body).toEqual(before);
  expect((await s.get('/api/progress')).body.story.bairroVivoSeenAt).toBe(first.body.seenAt);
  await s.restart();
  expect((await s.get('/api/progress')).body.story.bairroVivoSeenAt).toBe(first.body.seenAt);
  expect((await s.db.all('SELECT * FROM story_acknowledgements')).length).toBe(1);
});
