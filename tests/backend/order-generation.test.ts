import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPlant } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';
import { ensureOrder, listAvailablePlants, ORDER_CAPACITY, unlockedGroup } from '../../backend/orders/ensureOrder';
import { ROSTER, rosterById } from '../../src/shared/roster';
import { isModernDestination } from '../../src/shared/destinations';
import { BANCO, JARDINEIRAS, PLACA_MADEIRA } from '../../src/shared/shop';

let s: TestServer;
const boot = async (env: Record<string, string> = {}) => {
  s = await startTestServer({ env: { ORDER_AUTOGEN: 'on', ORDER_COOLDOWN_MS: '0', ...env } });
};
afterEach(async () => {
  await s?.close();
});

const GROUP1 = ROSTER.filter((r) => r.group === 1).map((r) => r.id);
const ensure = () => s.post('/api/orders/ensure');
const orders = async (): Promise<any[]> => (await s.get('/api/orders')).body;
const open = async () => (await orders()).filter((o) => o.status !== 'entregue');
const cash = async () => (await s.get('/api/cash/summary')).body.balance as number;
async function deliverActive() {
  const o = (await open())[0];
  expect(o, 'há um pedido ativo para entregar').toBeTruthy();
  const d = await s.post('/api/deliveries/start', { order_id: o.id });
  expect(d.status).toBeLessThan(300);
  const f = await s.post(`/api/deliveries/${d.body.id}/finish`);
  expect(f.status).toBe(200);
  return o;
}
/** Roda `fn` com a geração LIGADA só dentro dela (o servidor de teste fica "off" por padrão). */
const withAutogen = async <T,>(on: boolean, fn: () => Promise<T>): Promise<T> => {
  const prev = process.env.ORDER_AUTOGEN;
  process.env.ORDER_AUTOGEN = on ? 'on' : 'off';
  try {
    return await fn();
  } finally {
    process.env.ORDER_AUTOGEN = prev;
  }
};

describe('ensure — motivos quando NÃO nasce pedido', () => {
  beforeEach(() => boot());

  it('exige sessão', async () => {
    expect((await s.raw('POST', '/api/orders/ensure', { cookie: false })).status).toBe(401);
  });

  it('sem plantas → no_plants', async () => {
    const r = await ensure();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ created: false, reason: 'no_plants' });
    expect(await orders()).toHaveLength(0);
  });

  it('plantas existem mas todas sem estoque → no_stock; a planta removida não conta como planta', async () => {
    const a = await createPlant(s, { stock_quantity: 0 });
    expect((await ensure()).body).toEqual({ created: false, reason: 'no_stock' });
    await s.del(`/api/plants/${a.id}`);
    expect((await ensure()).body).toEqual({ created: false, reason: 'no_plants' });
  });

  it('planta removida do catálogo nunca é escolhida: com estoque, mas removida → no_plants', async () => {
    const a = await createPlant(s, { stock_quantity: 0 });
    await withAutogen(false, async () => {
      await s.put(`/api/plants/${a.id}`, { name: 'x', price: 10, stock_quantity: 5 }); // com estoque, sem gerar pedido
      await s.del(`/api/plants/${a.id}`);
    });
    expect((await ensure()).body).toEqual({ created: false, reason: 'no_plants' });
    expect(await orders()).toHaveLength(0);
  });

  it('com a geração desligada (ambientes de teste) as verificações continuam e o último motivo é "disabled"', async () => {
    await withAutogen(false, async () => {
      expect((await ensure()).body.reason).toBe('no_plants');
      await createPlant(s, { stock_quantity: 3 });
      const r = await ensure();
      expect(r.body).toEqual({ created: false, reason: 'disabled' });
      expect(await orders()).toHaveLength(0);
    });
  });
});

describe('ensure — nasce pedido por eventos, com capacidade 1', () => {
  beforeEach(() => boot());

  it('cadastrar a primeira planta cria o primeiro pedido na hora (evento), sem timer', async () => {
    expect(ORDER_CAPACITY).toBe(1);
    const plant = await createPlant(s, { price: 42.5, stock_quantity: 5 });
    const list = await open();
    expect(list).toHaveLength(1);
    const o = list[0];
    expect(o.status).toBe('recebido');
    expect(GROUP1).toContain(o.customer_id);
    expect(o.items).toHaveLength(1);
    expect(o.items[0]).toMatchObject({ plant_id: plant.id, quantity: 1, unit_price: 42.5 });
    expect(o.total).toBe(42.5);
    expect(o.order_number).toBe(101);
    expect(isModernDestination(o.destination_id)).toBe(true);
    expect(o.destination_id).toBe(rosterById(o.customer_id)!.destinationId); // casa do roster, congelada no pedido
  });

  it('com um pedido ativo, ensure repetido NÃO cria outro (active_order)', async () => {
    await createPlant(s, { stock_quantity: 9 });
    for (let i = 0; i < 4; i++) expect((await ensure()).body).toEqual({ created: false, reason: 'active_order' });
    expect(await orders()).toHaveLength(1);
  });

  it('10 chamadas simultâneas criam no máximo 1 pedido (capacidade garantida no servidor)', async () => {
    await withAutogen(false, () => createPlant(s, { stock_quantity: 9 })); // planta SEM disparar o evento
    expect(await orders()).toHaveLength(0);
    const results = await Promise.all(Array.from({ length: 10 }, () => ensure()));
    expect(results.filter((r) => r.body.created === true)).toHaveLength(1);
    expect(results.filter((r) => r.body.reason === 'active_order')).toHaveLength(9);
    expect(await orders()).toHaveLength(1);
  });

  it('o corpo da requisição não decide nada (cliente, planta, preço, número)', async () => {
    await createPlant(s, { price: 10, stock_quantity: 9 });
    await deliverActive();
    const r = await s.post('/api/orders/ensure', { customer_id: 'cust_bia', plant_id: 'x', price: 0.01, order_number: 999, unit_price: 0 });
    const o = (await open())[0];
    expect(r.body.created === true || o !== undefined).toBe(true);
    expect(o.customer_id).not.toBe('cust_bia'); // grupo 3 ainda bloqueado
    expect(o.items[0].unit_price).toBe(10);
    expect(o.order_number).toBeLessThan(900);
  });

  it('entrega finalizada → o PRÓXIMO pedido nasce sem espera artificial', async () => {
    await createPlant(s, { stock_quantity: 9, price: 20 });
    const first = await deliverActive();
    const next = await open();
    expect(next).toHaveLength(1);
    expect(next[0].id).not.toBe(first.id);
    expect(next[0].order_number).toBe(first.order_number + 1);
    expect(await cash()).toBe(20);
  });

  it('repor estoque (de 0) cria o pedido que estava faltando', async () => {
    const plant = await createPlant(s, { stock_quantity: 0 });
    expect(await orders()).toHaveLength(0);
    await s.put(`/api/plants/${plant.id}`, { name: 'x', price: 10, stock_quantity: 4 });
    expect(await open()).toHaveLength(1);
  });

  it('não repete o último cliente nem a última planta quando há alternativa', async () => {
    await createPlant(s, { stock_quantity: 50, price: 11 });
    await createPlant(s, { stock_quantity: 50, price: 12 });
    const seq: Array<{ c: string; p: string }> = [];
    for (let i = 0; i < 12; i++) {
      const o = await deliverActive();
      seq.push({ c: o.customer_id, p: o.items[0].plant_id });
    }
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].c, `cliente repetido na entrega ${i}`).not.toBe(seq[i - 1].c);
      expect(seq[i].p, `planta repetida na entrega ${i}`).not.toBe(seq[i - 1].p);
    }
  });

  it('uma só planta: repete a planta (não há alternativa) mas nunca cria pedido impossível', async () => {
    await createPlant(s, { stock_quantity: 2 });
    await deliverActive();
    await deliverActive();
    expect((await ensure()).body).toEqual({ created: false, reason: 'no_stock' });
    expect(await open()).toHaveLength(0);
  });
});

describe('recuo técnico (não é mecânica)', () => {
  it('chamadas logo depois de criar um pedido recebem "cooldown" e não duplicam; passado o recuo, o pedido nasce', async () => {
    await boot({ ORDER_COOLDOWN_MS: '1200' });
    await createPlant(s, { stock_quantity: 9 }); // 1º pedido (nenhum anterior → sem recuo)
    const first = await deliverActive(); // o evento de entrega tenta criar o próximo, mas o recuo segura
    expect(await open()).toHaveLength(0);
    expect((await ensure()).body).toEqual({ created: false, reason: 'cooldown' });
    expect(await orders()).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 1300));
    const r = await ensure();
    expect(r.body.created).toBe(true);
    expect(r.body.order.id).not.toBe(first.id);
    expect(await orders()).toHaveLength(2);
  });

  it('o recuo padrão é curto (segundos), nunca algo de 20–40 s', async () => {
    const { DEFAULT_TECHNICAL_COOLDOWN_MS } = await import('../../backend/orders/ensureOrder');
    expect(DEFAULT_TECHNICAL_COOLDOWN_MS).toBeGreaterThanOrEqual(3000);
    expect(DEFAULT_TECHNICAL_COOLDOWN_MS).toBeLessThanOrEqual(5000);
  });
});

describe('clientela: roster, grupos e desbloqueio permanente', () => {
  beforeEach(() => boot());

  it('o roster tem 8 clientes fixos em 3 grupos (3 + 2 + 3), casas distintas e válidas', () => {
    expect(ROSTER.map((r) => r.name)).toEqual(['Dona Maria', 'Seu João', 'Ana', 'Carlos', 'Dona Lúcia', 'Floricultura', 'Seu Antônio', 'Bia']);
    expect(ROSTER.filter((r) => r.group === 1)).toHaveLength(3);
    expect(ROSTER.filter((r) => r.group === 2)).toHaveLength(2);
    expect(ROSTER.filter((r) => r.group === 3)).toHaveLength(3);
    expect(new Set(ROSTER.map((r) => r.id)).size).toBe(8);
    expect(new Set(ROSTER.map((r) => r.destinationId)).size).toBe(8);
    for (const r of ROSTER) {
      expect(isModernDestination(r.destinationId)).toBe(true);
      expect(r.thanks.length).toBeGreaterThan(8);
    }
    expect(Object.fromEntries(ROSTER.map((r) => [r.name, r.destinationId.split('/')[1]]))).toEqual({
      'Dona Maria': 'house_021',
      'Seu João': 'house_019',
      Ana: 'house_017',
      Carlos: 'house_029',
      'Dona Lúcia': 'house_007',
      Floricultura: 'house_026',
      'Seu Antônio': 'house_034',
      Bia: 'house_039',
    });
  });

  it('no início só o grupo 1 pede, sempre na casa do roster; o cliente é criado com o nome e a casa do roster', async () => {
    await createPlant(s, { stock_quantity: 99 });
    const seen = new Set<string>();
    for (let i = 0; i < 9; i++) {
      const o = await deliverActive();
      seen.add(o.customer_id);
      expect(GROUP1).toContain(o.customer_id);
      const c = (await s.get(`/api/customers/${o.customer_id}`)).body;
      expect(c.name).toBe(rosterById(c.id)!.name);
      expect(c.destination).toBe(rosterById(c.id)!.destinationId);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  async function reachGroup2() {
    await createPlant(s, { stock_quantity: 99, price: 100 });
    await deliverActive();
    await deliverActive();
    expect((await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/purchase`)).status).toBe(200);
    expect((await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/install`)).status).toBe(200);
    await withAutogen(false, () => deliverActive()); // 3ª entrega sem gerar o próximo (a escolha fica determinística abaixo)
  }

  it('grupo 2 (vizinhos_2): só com melhoria instalada E 3 entregas; antes disso nem aparece', async () => {
    await createPlant(s, { stock_quantity: 99, price: 100 });
    await deliverActive();
    await deliverActive();
    await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/purchase`);
    await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/install`);
    // 2 entregas + 1 melhoria: ainda grupo 1
    expect(await unlockedGroup(s.db as any)).toBe(1);
    await withAutogen(false, () => deliverActive()); // 3ª entrega
    expect(await unlockedGroup(s.db as any)).toBe(2);
    expect((await s.get('/api/progress')).body.milestones.vizinhos_2.achieved).toBe(true);
    expect((await s.get('/api/progress')).body.milestones.vizinhos_3.achieved).toBe(false);
  });

  it('grupo 2 não nasce só com entregas (sem melhoria instalada)', async () => {
    await createPlant(s, { stock_quantity: 99 });
    for (let i = 0; i < 5; i++) await deliverActive();
    expect(await unlockedGroup(s.db as any)).toBe(1);
  });

  it('com o grupo 2 liberado, Carlos/Dona Lúcia podem pedir (escolha determinística) e usam a casa do roster', async () => {
    await reachGroup2();
    const r = await withAutogen(true, () => ensureOrder(s.db as any, { rng: () => 0.999, now: Date.now() + 10_000 }));
    expect(r.created).toBe(true);
    expect(r.order!.customer_id).toBe('cust_dona_lucia'); // último elegível do grupo 1+2
    expect(r.order!.destination_id).toBe(rosterById('cust_dona_lucia')!.destinationId);
    const c = (await s.get('/api/customers/cust_dona_lucia')).body;
    expect(c).toMatchObject({ name: 'Dona Lúcia', destination: rosterById('cust_dona_lucia')!.destinationId });
  });

  it('grupo 3 (vizinhos_3): 2 melhorias instaladas + 6 entregas + 2 plantas cadastradas; Bia/Seu Antônio/Floricultura só depois', async () => {
    await reachGroup2(); // 3 entregas, 1 melhoria
    await withAutogen(true, () => ensureOrder(s.db as any, { rng: () => 0, now: Date.now() + 10_000 }));
    await createPlant(s, { stock_quantity: 99, price: 100 }); // 2ª planta
    expect(await unlockedGroup(s.db as any)).toBe(2);
    await withAutogen(false, () => deliverActive()); // 4
    await withAutogen(true, () => ensureOrder(s.db as any, { rng: () => 0, now: Date.now() + 20_000 }));
    await s.post(`/api/shop/upgrades/${JARDINEIRAS}/purchase`);
    await s.post(`/api/shop/upgrades/${JARDINEIRAS}/install`); // 2 melhorias
    await withAutogen(false, () => deliverActive()); // 5
    expect(await unlockedGroup(s.db as any)).toBe(2); // faltam entregas (precisa de 6)
    await withAutogen(true, () => ensureOrder(s.db as any, { rng: () => 0, now: Date.now() + 30_000 }));
    await withAutogen(false, () => deliverActive()); // 6
    expect(await unlockedGroup(s.db as any)).toBe(3);
    const r = await withAutogen(true, () => ensureOrder(s.db as any, { rng: () => 0.999, now: Date.now() + 40_000 }));
    expect(r.created).toBe(true);
    expect(r.order!.customer_id).toBe('cust_bia');
    expect(r.order!.destination_id.endsWith('house_039')).toBe(true);
  });

  it('o desbloqueio é PERMANENTE: remover planta, gastar dinheiro ou perder a condição não reduz o grupo', async () => {
    await reachGroup2();
    expect(await unlockedGroup(s.db as any)).toBe(2);
    const plants = (await s.get('/api/plants')).body;
    for (const p of plants) await s.del(`/api/plants/${p.id}`).catch(() => undefined);
    await s.db.run('PRAGMA foreign_keys = OFF');
    await s.db.run('DELETE FROM shop_upgrades'); // "desfaz" a condição à força
    await s.db.run(`DELETE FROM deliveries`);
    expect((await s.get('/api/progress')).body.stats.upgradesInstalled).toBe(0);
    expect(await unlockedGroup(s.db as any)).toBe(2);
    expect((await s.get('/api/progress')).body.milestones.vizinhos_2.achieved).toBe(true);
  });

  it('bairro_vivo continua com a regra de antes (10 entregas, 4 casas, 3 plantas, 3 melhorias)', async () => {
    const { THRESHOLDS } = await import('../../backend/progress/milestones');
    expect(THRESHOLDS).toEqual({ entregas: 10, casas: 4, plantas: 3, melhorias: 3 });
    const p = (await s.get('/api/progress')).body;
    expect(p.milestones.bairro_vivo.achieved).toBe(false);
    expect(p.milestones).toHaveProperty('vizinhos_2');
    expect(p.milestones).toHaveProperty('vizinhos_3');
  });
});

describe('clientes existentes e pedidos antigos', () => {
  beforeEach(() => boot());

  it('cliente com destino LEGADO recebe a casa do roster UMA vez; o pedido antigo mantém o destino congelado', async () => {
    await withAutogen(false, async () => {
      // como num banco anterior: cliente do app antigo com destino legado e um pedido antigo já entregue
      await s.db.run(`INSERT INTO customers (id, name, destination, created_at) VALUES ('cust_dona_maria', 'Dona Maria', 'dest_vovo', 1)`);
      const plant = await createPlant(s, { stock_quantity: 9, price: 20 });
      const old = await s.post('/api/orders', { customer_id: 'cust_dona_maria', items: [{ plant_id: plant.id, quantity: 1 }] });
      expect(old.body.destination_id).toBe('dest_vovo');
      const d = await s.post('/api/deliveries/start', { order_id: old.body.id });
      await s.post(`/api/deliveries/${d.body.id}/finish`);
    });

    // rng 0 → primeiro do grupo 1 = Dona Maria? (o último cliente foi ela: com alternativa não repete; força com 2 chamadas)
    const made: any[] = [];
    for (let i = 0; i < 6 && made.length === 0; i++) {
      const r = await withAutogen(true, () => ensureOrder(s.db as any, { rng: () => 0, now: Date.now() + 10_000 * (i + 1) }));
      if (r.created && r.order!.customer_id === 'cust_dona_maria') made.push(r.order);
      else if (r.created) await withAutogen(false, () => deliverActive());
    }
    expect(made).toHaveLength(1);
    const house = rosterById('cust_dona_maria')!.destinationId;
    expect(made[0].destination_id).toBe(house); // pedido NOVO: residência moderna
    expect((await s.get('/api/customers/cust_dona_maria')).body.destination).toBe(house);
    const oldRead = (await s.get(`/api/orders`)).body.find((o: any) => o.status === 'entregue' && o.customer_id === 'cust_dona_maria');
    expect(oldRead.destination_id).toBe('dest_vovo'); // pedido ANTIGO: imutável
  });

  it('cliente com destino MODERNO válido é preservado (nunca recalculado)', async () => {
    await s.db.run(`INSERT INTO customers (id, name, destination, created_at) VALUES ('cust_ana', 'Ana', 'bairro1/house_002', 1)`);
    await createPlant(s, { stock_quantity: 99 });
    for (let i = 0; i < 12; i++) {
      const o = (await open())[0];
      if (o?.customer_id === 'cust_ana') {
        expect(o.destination_id).toBe('bairro1/house_002'); // pedido usa a casa persistida do cliente
        break;
      }
      await deliverActive();
    }
    expect((await s.get('/api/customers/cust_ana')).body.destination).toBe('bairro1/house_002');
  });

  it('apresentar o cliente é idempotente: repetir não muda a residência de novo', async () => {
    await s.db.run(`INSERT INTO customers (id, name, destination, created_at) VALUES ('cust_seu_joao', 'Seu João', 'dest_amigo', 1)`);
    const { introduceCustomer } = await import('../../backend/orders/ensureOrder');
    const entry = rosterById('cust_seu_joao')!;
    await introduceCustomer(s.db as any, entry, 5);
    expect((await s.get('/api/customers/cust_seu_joao')).body.destination).toBe(entry.destinationId);
    await s.put('/api/customers/cust_seu_joao/destination', { destination: 'bairro1/house_002' }); // mudança EXPLÍCITA posterior
    await introduceCustomer(s.db as any, entry, 6);
    expect((await s.get('/api/customers/cust_seu_joao')).body.destination).toBe('bairro1/house_002'); // não volta ao roster
  });
});

describe('estoque', () => {
  beforeEach(() => boot());

  it('estoque livre = estoque − comprometido em pedidos abertos; só planta com sobra entra', async () => {
    const a = await createPlant(s, { stock_quantity: 1 });
    const b = await createPlant(s, { stock_quantity: 3 });
    // (1 pedido automático já ocupa 1 unidade de uma das plantas)
    const open1 = (await open())[0];
    const reservedPlant = open1.items[0].plant_id;
    const free = await listAvailablePlants(s.db as any);
    const byId = Object.fromEntries(free.map((p) => [p.id, p.free]));
    if (reservedPlant === a.id) expect(byId[a.id]).toBeUndefined(); // 1 − 1 = 0: sem sobra
    else expect(byId[b.id]).toBe(2); // 3 − 1
    expect(free.every((p) => p.free >= 1)).toBe(true);
  });

  it('o pedido criado SEMPRE é atendível no momento (estoque ≥ 1 livre) e o histórico não vira estoque negativo', async () => {
    await createPlant(s, { stock_quantity: 3 });
    for (let i = 0; i < 3; i++) {
      const o = (await open())[0];
      const plant = (await s.get(`/api/plants/${o.items[0].plant_id}`)).body;
      expect(plant.stock_quantity).toBeGreaterThanOrEqual(o.items[0].quantity);
      await deliverActive();
    }
    expect((await s.get('/api/plants')).body[0].stock_quantity).toBe(0);
    expect((await ensure()).body.reason).toBe('no_stock');
  });

  it('reduzir o estoque DEPOIS não apaga o pedido: ele fica "deliverable: false", a entrega falha sem estoque negativo e não nasce outro pedido', async () => {
    const plant = await createPlant(s, { stock_quantity: 2 });
    const o = (await open())[0];
    expect(o.deliverable).toBe(true);
    await s.put(`/api/plants/${plant.id}`, { name: 'x', price: 10, stock_quantity: 0 }); // dono baixa o estoque à mão

    const again = (await orders()).find((x) => x.id === o.id);
    expect(again).toBeTruthy(); // o pedido continua
    expect(again.deliverable).toBe(false);
    expect(again.status).toBe('recebido');
    expect(await open()).toHaveLength(1); // e não foi criado outro para "contornar"
    expect((await ensure()).body.reason).toBe('active_order');

    const d = await s.post('/api/deliveries/start', { order_id: o.id });
    expect(d.status).toBe(400); // sem estoque: recusa
    expect((await s.get(`/api/plants/${plant.id}`)).body.stock_quantity).toBe(0); // nunca negativo

    // repor → volta a ser atendível
    await s.put(`/api/plants/${plant.id}`, { name: 'x', price: 10, stock_quantity: 5 });
    expect((await orders()).find((x) => x.id === o.id).deliverable).toBe(true);
    expect((await s.post(`/api/deliveries/${(await s.post('/api/deliveries/start', { order_id: o.id })).body.id}/finish`)).status).toBe(200);
    expect((await s.get(`/api/plants/${plant.id}`)).body.stock_quantity).toBe(4);
  });

  it('pedidos entregues não são "deliverable"', async () => {
    await createPlant(s, { stock_quantity: 5 });
    const o = await deliverActive();
    expect((await orders()).find((x) => x.id === o.id).deliverable).toBe(false);
  });
});

describe('preço e número gerados pelo servidor', () => {
  beforeEach(() => boot());

  it('o preço do pedido automático é o da planta persistida e fica congelado; reprecificar não muda o pedido aberto', async () => {
    const plant = await createPlant(s, { price: 33, stock_quantity: 9 });
    const o = (await open())[0];
    expect(o.items[0].unit_price).toBe(33);
    await s.put(`/api/plants/${plant.id}`, { name: 'x', price: 77, stock_quantity: 9 });
    expect((await orders()).find((x) => x.id === o.id).items[0].unit_price).toBe(33);
    await deliverActive();
    expect(await cash()).toBe(33); // o caixa recebe o valor CONGELADO
    expect((await open())[0].items[0].unit_price).toBe(77); // o próximo pedido usa o preço novo
  });

  it('order_number sequencial pelo servidor também nos pedidos gerados, sem duplicar', async () => {
    await createPlant(s, { stock_quantity: 20 });
    const nums: number[] = [];
    for (let i = 0; i < 6; i++) nums.push((await deliverActive()).order_number);
    expect(nums).toEqual([101, 102, 103, 104, 105, 106]);
  });
});
