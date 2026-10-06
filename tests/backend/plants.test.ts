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

  it('CARACTERIZAÇÃO: estoque decimal é truncado (parseInt), "2.9" → 2', async () => {
    const created = await createPlant(s, { id: 'p_trunc', stock_quantity: '2.9' });
    expect(created.stock_quantity).toBe(2);
  });

  it('CARACTERIZAÇÃO: id duplicado vira 500 (erro de PK não tratado como 409)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await createPlant(s, { id: 'p_dup' });
    const dup = await s.post('/api/plants', { id: 'p_dup', name: 'Outra', price: 1, stock_quantity: 1, image_path: '/a.jpg' });
    expect(dup.status).toBe(500);
    vi.restoreAllMocks();
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
