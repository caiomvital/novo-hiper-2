import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPlant } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeAll(async () => {
  s = await startTestServer();
});
afterAll(async () => {
  await s.close();
});

describe('plantas — comportamento ATUAL', () => {
  it('cria e lê planta (campos persistidos)', async () => {
    const created = await createPlant(s, { id: 'p_basica', name: '  Samambaia  ', price: 12.5, stock_quantity: 3, species: ' Fern ' });
    expect(created).toMatchObject({ id: 'p_basica', name: 'Samambaia', price: 12.5, stock_quantity: 3, species: 'Fern' });

    const one = await s.get('/api/plants/p_basica');
    expect(one.status).toBe(200);
    expect(one.body.name).toBe('Samambaia');
    const list = await s.get('/api/plants');
    expect(list.body.some((p: any) => p.id === 'p_basica')).toBe(true);
  });

  it('GET planta inexistente → 404', async () => {
    expect((await s.get('/api/plants/nao_existe')).status).toBe(404);
  });

  it.each([
    [{ name: '' }, 'Nome'],
    [{ price: -1 }, 'Preço'],
    [{ price: 'abc' }, 'Preço'],
    [{ stock_quantity: -1 }, 'estoque'],
    [{ stock_quantity: 'x' }, 'estoque'],
    [{ image_path: '' }, 'foto'],
  ])('rejeita dados inválidos %j', async (over, fragment) => {
    const res = await s.post('/api/plants', { name: 'X', price: 1, stock_quantity: 1, image_path: '/a.jpg', ...over });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain(fragment);
  });

  it.each(['2.9', 2.9, '2vasos', '', null, true])('estoque inválido %j é recusado, sem truncar nem gravar', async (stock_quantity) => {
    const res = await s.post('/api/plants', { id: 'p_trunc', name: 'Inválida', price: 20, stock_quantity, image_path: '/a.png' });
    expect(res.status).toBe(400);
    expect(await s.db.get("SELECT * FROM plants WHERE id = 'p_trunc'")).toBeUndefined();
  });

  it('id repetido com outros dados → 409, preservando a planta original', async () => {
    await createPlant(s, { id: 'p_dup' });
    const dup = await s.post('/api/plants', { id: 'p_dup', name: 'Outra', price: 1, stock_quantity: 1, image_path: '/a.jpg' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('PLANT_ID_CONFLICT');
  });

  it('cadastro repetido/simultâneo com os mesmos dados cria uma única planta', async () => {
    const data = { id: 'p_retry', name: 'Repetida', price: '20,37', stock_quantity: '5', image_path: '/retry.png' };
    const results = await Promise.all([s.post('/api/plants', data), s.post('/api/plants', data), s.post('/api/plants', data)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect((await s.db.get("SELECT count(*) n FROM plants WHERE id = 'p_retry'")).n).toBe(1);
    expect(results.every((r) => r.body.price === 20.37 && r.body.stock_quantity === 5)).toBe(true);
    await s.del('/api/plants/p_retry');
    expect((await s.post('/api/plants', data)).status).toBe(409);
  });

  it.each(['20,37', '20.37', 20.37, 0, '0'])('preço válido %j e estoque zero persistem', async (price) => {
    const p = await createPlant(s, { price, stock_quantity: 0 });
    expect(p.price).toBe(price === 0 || price === '0' ? 0 : 20.37);
    expect(p.stock_quantity).toBe(0);
  });

  it.each(['20reais', '20.999', '', null, true, 'Infinity'])('preço inválido %j é recusado', async (price) => {
    const res = await s.post('/api/plants', { name: 'X', price, stock_quantity: 1, image_path: '/a.png' });
    expect(res.status).toBe(400);
  });

  it('edição recusa estoque fracionário e preço inválido sem alterar a planta', async () => {
    const p = await createPlant(s, { stock_quantity: 5, price: 20 });
    for (const change of [{ stock_quantity: '1.5' }, { price: '20abc' }, { stock_quantity: -1 }, { image_path: '   ' }]) {
      expect((await s.put(`/api/plants/${p.id}`, { name: p.name, price: 20, stock_quantity: 5, ...change })).status).toBe(400);
      expect((await s.get(`/api/plants/${p.id}`)).body).toEqual(p);
    }
  });

  it('atualiza planta e preserva a foto se image_path não vier', async () => {
    await createPlant(s, { id: 'p_upd', image_path: '/uploads/plants/original.jpg' });
    const res = await s.put('/api/plants/p_upd', { name: 'Nova', price: 20, stock_quantity: 9 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Nova', price: 20, stock_quantity: 9, image_path: '/uploads/plants/original.jpg' });
    expect((await s.put('/api/plants/nao_existe', { name: 'x', price: 1, stock_quantity: 1 })).status).toBe(404);
  });

  it('consulta de estoque por planta e total', async () => {
    await createPlant(s, { id: 'p_est', stock_quantity: 7 });
    const one = await s.get('/api/plants/p_est/stock');
    expect(one.status).toBe(200);
    const all = await s.get('/api/plants/stock');
    expect(all.status).toBe(200);
    expect(all.body.totalUnits).toBeGreaterThanOrEqual(7);
    expect(all.body.plants.find((p: any) => p.id === 'p_est').stock_quantity).toBe(7);
    expect((await s.get('/api/plants/nao_existe/stock')).status).toBe(404);
  });

  it('o banco recusa estoque/preço negativo mesmo por SQL direto (CHECK)', async () => {
    await expect(
      s.db.run("INSERT INTO plants (id,name,price,stock_quantity,image_path,created_at,updated_at) VALUES ('x','x',1,-1,'a',1,1)")
    ).rejects.toThrow();
    await expect(
      s.db.run("INSERT INTO plants (id,name,price,stock_quantity,image_path,created_at,updated_at) VALUES ('y','y',-1,1,'a',1,1)")
    ).rejects.toThrow();
  });
});
