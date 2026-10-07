import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOrder, createPlant, startDelivery } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';
import { MILESTONES, MILESTONE_IDS, THRESHOLDS } from '../../backend/progress/milestones';
import { DESTINATION_IDS } from '../../src/shared/destinations';
import { BANCO, JARDINEIRAS, PLACA_MADEIRA } from '../../src/shared/shop';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  await s.close();
});

const progress = async () => (await s.get('/api/progress')).body;
const achieved = async (): Promise<string[]> => {
  const m = (await progress()).milestones as Record<string, { achieved: boolean }>;
  return Object.keys(m).filter((k) => m[k].achieved);
};
const at = async (id: string): Promise<number | null> => (await progress()).milestones[id].achievedAt;

let seq = 0;
/** Entrega REAL de um pedido (pelo fluxo oficial) para um cliente na casa pedida; a planta é a informada ou nova. */
async function deliver(opts: { house?: string; plantId?: string; price?: number } = {}) {
  const plantId = opts.plantId ?? (await createPlant(s, { price: opts.price ?? 20, stock_quantity: 50 })).id;
  const customer = (
    await s.post('/api/customers', { id: `c_${++seq}`, name: `Cliente ${seq}`, destination: opts.house ?? DESTINATION_IDS[seq % DESTINATION_IDS.length] })
  ).body;
  const order = await s.post('/api/orders', { customer_id: customer.id, items: [{ plant_id: plantId, quantity: 1 }] });
  const d = await startDelivery(s, order.body.id);
  const r = await s.post(`/api/deliveries/${d.id}/finish`);
  expect(r.status).toBe(200);
  return { plantId, orderId: order.body.id, customerId: customer.id };
}
const earnFor = (amount: number) => deliver({ price: amount });
const buyAndInstall = async (id: string) => {
  expect((await s.post(`/api/shop/upgrades/${id}/purchase`)).status).toBe(200);
  expect((await s.post(`/api/shop/upgrades/${id}/install`)).status).toBe(200);
};

describe('GET /api/progress — estado inicial e autenticação', () => {
  it('exige sessão', async () => {
    expect((await s.raw('GET', '/api/progress', { cookie: false })).status).toBe(401);
  });

  it('jogo novo: estatísticas zeradas e nenhum marco; devolve todos os marcos conhecidos', async () => {
    const p = await progress();
    expect(p.stats).toEqual({
      deliveriesCompleted: 0,
      distinctCustomersServed: 0,
      distinctHousesServed: 0,
      plantsRegisteredHistorical: 0,
      distinctPlantsSold: 0,
      upgradesPurchased: 0,
      upgradesInstalled: 0,
    });
    expect(Object.keys(p.milestones).sort()).toEqual([...MILESTONE_IDS].sort());
    expect(Object.values(p.milestones).every((m: any) => m.achieved === false && m.achievedAt === null)).toBe(true);
  });

  it('a regra do bairro_vivo e os limiares estão centralizados (10 entregas, 4 casas, 3 plantas, 3 melhorias)', () => {
    expect(THRESHOLDS).toEqual({ entregas: 10, casas: 4, plantas: 3, melhorias: 3 });
    expect(MILESTONE_IDS).toEqual([
      'primeira_planta',
      'primeira_entrega',
      'primeira_melhoria',
      'entregas_10',
      'casas_4',
      'plantas_cadastradas_3',
      'melhorias_3',
      'bairro_vivo',
    ]);
    expect(MILESTONES.length).toBe(8);
  });
});

describe('marcos são consequência dos eventos (sem depender do GET)', () => {
  it('primeira_planta: gravado ao cadastrar a planta, uma única vez', async () => {
    await createPlant(s);
    const rows = await s.db.all('SELECT * FROM milestones');
    expect(rows.map((r: any) => r.id)).toEqual(['primeira_planta']);
    const first = rows[0].achieved_at;
    await createPlant(s);
    await createPlant(s);
    const again = await s.db.all('SELECT * FROM milestones WHERE id = ?', 'primeira_planta');
    expect(again).toHaveLength(1);
    expect(again[0].achieved_at).toBe(first); // não é regravado
  });

  it('primeira_entrega: gravado quando a entrega é finalizada (e só então)', async () => {
    const plant = await createPlant(s);
    const order = await createOrder(s, [{ plant_id: plant.id }]);
    const d = await startDelivery(s, order.id);
    expect((await s.db.all('SELECT id FROM milestones')).map((r: any) => r.id)).not.toContain('primeira_entrega');
    await s.post(`/api/deliveries/${d.id}/finish`);
    expect((await s.db.all('SELECT id FROM milestones')).map((r: any) => r.id)).toContain('primeira_entrega');
    const t = (await s.db.get(`SELECT achieved_at FROM milestones WHERE id = 'primeira_entrega'`)).achieved_at;
    await s.post(`/api/deliveries/${d.id}/finish`); // repetição não muda nada
    expect((await s.db.get(`SELECT achieved_at FROM milestones WHERE id = 'primeira_entrega'`)).achieved_at).toBe(t);
  });

  it('primeira_melhoria: só quando a melhoria é INSTALADA (comprar ainda não muda a loja)', async () => {
    await earnFor(100);
    await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/purchase`);
    expect(await achieved()).not.toContain('primeira_melhoria');
    expect((await progress()).stats).toMatchObject({ upgradesPurchased: 1, upgradesInstalled: 0 });
    await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/install`);
    expect(await achieved()).toContain('primeira_melhoria');
  });

  it('melhorias_3: com as três instaladas; com duas ainda não', async () => {
    await earnFor(400);
    await buyAndInstall(PLACA_MADEIRA);
    await buyAndInstall(JARDINEIRAS);
    expect(await achieved()).not.toContain('melhorias_3');
    await buyAndInstall(BANCO);
    expect(await achieved()).toContain('melhorias_3');
    expect((await progress()).stats).toMatchObject({ upgradesPurchased: 3, upgradesInstalled: 3 });
  });

  it('plantas_cadastradas_3: conta plantas cadastradas HISTORICAMENTE, inclusive as removidas (soft delete)', async () => {
    const a = await createPlant(s);
    const b = await createPlant(s);
    await createPlant(s);
    expect(await achieved()).toContain('plantas_cadastradas_3');
    // remover do catálogo não desconquista nada e continua contando no histórico
    await s.del(`/api/plants/${a.id}`);
    await s.del(`/api/plants/${b.id}`);
    expect((await s.get('/api/plants')).body).toHaveLength(1);
    expect((await progress()).stats.plantsRegisteredHistorical).toBe(3);
    expect(await achieved()).toContain('plantas_cadastradas_3');
  });

  it('plantas removidas antes de chegar a 3 também contam: 2 removidas + 1 ativa = 3 cadastradas → marco', async () => {
    const a = await createPlant(s);
    const b = await createPlant(s);
    await s.del(`/api/plants/${a.id}`);
    await s.del(`/api/plants/${b.id}`);
    expect(await achieved()).not.toContain('plantas_cadastradas_3');
    await createPlant(s);
    expect(await achieved()).toContain('plantas_cadastradas_3');
  });

  it('entregas_10: na 10ª entrega, não na 9ª', async () => {
    const { plantId } = await deliver();
    for (let i = 0; i < 8; i++) await deliver({ plantId });
    expect((await progress()).stats.deliveriesCompleted).toBe(9);
    expect(await achieved()).not.toContain('entregas_10');
    await deliver({ plantId });
    expect(await achieved()).toContain('entregas_10');
  });

  it('casas_4: conta CASAS diferentes (não entregas); clientes na mesma casa contam uma vez; legado conta como a casa amarela', async () => {
    const { plantId } = await deliver({ house: DESTINATION_IDS[0] });
    await deliver({ plantId, house: DESTINATION_IDS[0] }); // outro cliente, mesma casa
    await deliver({ plantId, house: DESTINATION_IDS[1] });
    await deliver({ plantId, house: 'dest_manual' }); // legado → casa amarela
    await deliver({ plantId, house: 'dest_vovo' }); // legado → a mesma casa amarela
    let st = (await progress()).stats;
    expect(st.distinctCustomersServed).toBe(5);
    expect(st.distinctHousesServed).toBe(3);
    expect(await achieved()).not.toContain('casas_4');
    await deliver({ plantId, house: DESTINATION_IDS[2] });
    st = (await progress()).stats;
    expect(st.distinctHousesServed).toBe(4);
    expect(await achieved()).toContain('casas_4');
  });

  it('plantas diferentes vendidas: só conta o que foi ENTREGUE', async () => {
    await deliver();
    await deliver();
    const unsold = await createPlant(s);
    await createOrder(s, [{ plant_id: unsold.id }]); // pedido aberto, não entregue
    expect((await progress()).stats).toMatchObject({ distinctPlantsSold: 2, plantsRegisteredHistorical: 3 });
  });
});

describe('bairro_vivo', () => {
  async function everythingExceptOne(skip: 'entregas' | 'casas' | 'plantas' | 'melhorias') {
    const houses = DESTINATION_IDS;
    const plants = skip === 'plantas' ? 2 : 3;
    const ids: string[] = [];
    for (let i = 0; i < plants; i++) ids.push((await createPlant(s, { price: 100, stock_quantity: 50 })).id);
    const n = skip === 'entregas' ? 9 : 10;
    for (let i = 0; i < n; i++) {
      const house = skip === 'casas' ? houses[i % 3] : houses[i % 5];
      await deliver({ plantId: ids[i % ids.length], house });
    }
    const upgrades = skip === 'melhorias' ? [PLACA_MADEIRA, JARDINEIRAS] : [PLACA_MADEIRA, JARDINEIRAS, BANCO];
    for (const u of upgrades) await buyAndInstall(u);
  }

  for (const skip of ['entregas', 'casas', 'plantas', 'melhorias'] as const) {
    it(`NÃO é atingido quando falta só ${skip}`, async () => {
      await everythingExceptOne(skip);
      expect(await achieved()).not.toContain('bairro_vivo');
    });
  }

  it('é atingido quando TODAS as condições são verdadeiras e fica registrado sem efeito colateral (sem dinheiro)', async () => {
    const cashBefore = async () => (await s.get('/api/cash/summary')).body.balance as number;
    await everythingExceptOne('entregas'); // 9 entregas
    expect(await achieved()).not.toContain('bairro_vivo');
    const { plantId } = await deliver();
    expect(plantId).toBeTruthy();
    const p = await progress();
    expect(p.milestones.bairro_vivo.achieved).toBe(true);
    expect(p.milestones.bairro_vivo.achievedAt).toBeGreaterThan(0);
    // nenhum dinheiro/transação nasce do marco: o caixa só tem vendas e compras
    const types = (await s.db.all(`SELECT DISTINCT type FROM cash_transactions`)).map((r: any) => r.type).sort();
    expect(types).toEqual(['credit', 'upgrade_purchase']);
    expect(await cashBefore()).toBeGreaterThan(0);
  });
});

describe('permanência e idempotência', () => {
  it('um marco já ganho permanece (e com o mesmo achieved_at) mesmo que a condição deixe de ser verdadeira', async () => {
    const a = await createPlant(s);
    const b = await createPlant(s);
    const c = await createPlant(s);
    const t = await at('plantas_cadastradas_3');
    expect(t).toBeGreaterThan(0);
    // "desfaz" o histórico à força (cenário extremo): apaga plantas e crédito/entregas
    await s.db.run('PRAGMA foreign_keys = OFF');
    await s.db.run('DELETE FROM plants WHERE id IN (?, ?, ?)', a.id, b.id, c.id);
    expect((await progress()).stats.plantsRegisteredHistorical).toBe(0);
    expect(await achieved()).toContain('plantas_cadastradas_3');
    expect(await at('plantas_cadastradas_3')).toBe(t);
  });

  it('gastar dinheiro não desconquista nada (marcos ligados a entregas permanecem)', async () => {
    await earnFor(200);
    await buyAndInstall(JARDINEIRAS);
    expect(await achieved()).toEqual(expect.arrayContaining(['primeira_planta', 'primeira_entrega', 'primeira_melhoria']));
    expect((await s.get('/api/cash/summary')).body.balance).toBe(110);
    expect(await achieved()).toContain('primeira_entrega');
  });

  it('avaliações simultâneas e repetidas gravam cada marco uma única vez', async () => {
    await earnFor(100);
    await Promise.all(Array.from({ length: 12 }, () => s.get('/api/progress')));
    const rows = await s.db.all('SELECT id, COUNT(*) AS n FROM milestones GROUP BY id');
    expect(rows.every((r: any) => r.n === 1)).toBe(true);
    expect(rows.map((r: any) => r.id).sort()).toEqual(['primeira_entrega', 'primeira_planta']);
  });

  it('dados anteriores ao recurso são reconhecidos na primeira consulta (sem depender de evento novo)', async () => {
    await earnFor(100);
    await s.db.run('DELETE FROM milestones'); // como num banco que já tinha histórico antes da migration 006
    expect(await achieved()).toEqual(['primeira_planta', 'primeira_entrega']);
  });

  it('o marco sobrevive a reiniciar o servidor', async () => {
    await earnFor(100);
    const t = await at('primeira_entrega');
    await s.restart();
    expect(await at('primeira_entrega')).toBe(t);
  });

  it('o estado do GET /api/progress é consistente com o que os eventos gravaram', async () => {
    await earnFor(100);
    const before = await s.db.all('SELECT id, achieved_at FROM milestones ORDER BY id');
    await progress();
    expect(await s.db.all('SELECT id, achieved_at FROM milestones ORDER BY id')).toEqual(before);
  });
});
