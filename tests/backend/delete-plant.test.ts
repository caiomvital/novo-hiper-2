import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrder, createPlant, startDelivery } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await s.close();
});

const exists = async (id: string) => (await s.db.get('SELECT 1 AS x FROM plants WHERE id = ?', id)) !== undefined;

describe('exclusão de planta — comportamento ATUAL', () => {
  it('exclui planta sem histórico', async () => {
    const p = await createPlant(s);
    const res = await s.del(`/api/plants/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await exists(p.id)).toBe(false);
    expect((await s.get(`/api/plants/${p.id}`)).status).toBe(404);
  });

  it('planta inexistente → 404', async () => {
    expect((await s.del('/api/plants/nao_existe')).status).toBe(404);
  });

  it('planta em pedido NÃO entregue (recebido/pronto…) → 400 e a planta permanece', async () => {
    const p = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: p.id }]);
    const res = await s.del(`/api/plants/${p.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/pedidos em andamento/);
    expect(await exists(p.id)).toBe(true);
    await startDelivery(s, o.id); // 'pronto' continua bloqueando
    expect((await s.del(`/api/plants/${p.id}`)).status).toBe(400);
  });

  it('🐞 HIPÓTESE DA FK — planta referenciada por pedido ENTREGUE: o que acontece?', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = await createPlant(s, { stock_quantity: 3 });
    const o = await createOrder(s, [{ plant_id: p.id }]);
    const d = await startDelivery(s, o.id);
    expect((await s.post(`/api/deliveries/${d.id}/finish`)).status).toBe(200);

    const res = await s.del(`/api/plants/${p.id}`);

    // CONFIRMADA: a rota só checa pedidos não entregues; o DELETE bate na FK de order_items
    // (sem ON DELETE) e o erro cai no catch genérico → 500, sem mensagem útil.
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Erro ao excluir planta/);
    expect(await exists(p.id)).toBe(true); // a planta continua lá
    // e o histórico segue íntegro
    expect((await s.db.get('SELECT COUNT(*) AS n FROM order_items WHERE plant_id = ?', p.id)).n).toBe(1);
  });

  it('a FK é a causa: com foreign_keys=ON o SQLite recusa o DELETE direto', async () => {
    const p = await createPlant(s);
    const o = await createOrder(s, [{ plant_id: p.id }]);
    const d = await startDelivery(s, o.id);
    await s.post(`/api/deliveries/${d.id}/finish`);
    expect((await s.db.get('PRAGMA foreign_keys')).foreign_keys).toBe(1);
    await expect(s.db.run('DELETE FROM plants WHERE id = ?', p.id)).rejects.toThrow(/FOREIGN KEY/i);
  });
});
