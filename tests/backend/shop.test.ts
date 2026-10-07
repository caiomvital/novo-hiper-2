import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOrder, createPlant, startDelivery } from './helpers/builders';
import { startTestServer, TestServer } from './helpers/testServer';
import { SHOP_UPGRADES } from '../../backend/shop/catalog';
import { BANCO, JARDINEIRAS, PLACA_MADEIRA } from '../../src/shared/shop';

let s: TestServer;
beforeEach(async () => {
  s = await startTestServer();
});
afterEach(async () => {
  await s.close();
});

/** Ganha dinheiro pelo fluxo REAL (pedido → entrega → finish): cada chamada credita `amount` no caixa. */
async function earn(amount: number) {
  const plant = await createPlant(s, { price: amount, stock_quantity: 50 });
  const order = await createOrder(s, [{ plant_id: plant.id }]);
  const d = await startDelivery(s, order.id);
  const r = await s.post(`/api/deliveries/${d.id}/finish`);
  expect(r.status).toBe(200);
}
const balance = async () => (await s.get('/api/cash/summary')).body.balance as number;
const rows = (sql: string, ...p: any[]) => s.db.all(sql, ...p);
const buy = (id = PLACA_MADEIRA) => s.post(`/api/shop/upgrades/${id}/purchase`);
const install = (id = PLACA_MADEIRA) => s.post(`/api/shop/upgrades/${id}/install`);
const PRICE = 60;

describe('Loja de Utilidades — catálogo e estado', () => {
  it('o catálogo e o preço vêm do backend (autoridade): placa R$ 60, estado inicial "available"', async () => {
    const r = await s.get('/api/shop');
    expect(r.status).toBe(200);
    expect(r.body.balance).toBe(0);
    expect(r.body.upgrades).toEqual([
      expect.objectContaining({ id: PLACA_MADEIRA, price: 60, state: 'available', purchasedAt: null, installedAt: null }),
      expect.objectContaining({ id: JARDINEIRAS, price: 90, state: 'available' }),
      expect.objectContaining({ id: BANCO, price: 120, state: 'available' }),
    ]);
    expect(SHOP_UPGRADES.map((u) => u.id)).toEqual([PLACA_MADEIRA, JARDINEIRAS, BANCO]);
    expect(SHOP_UPGRADES.map((u) => u.id)).not.toContain('claraboia'); // ainda fora do catálogo
  });

  it('exige sessão (sem cookie → 401)', async () => {
    expect((await s.raw('GET', '/api/shop', { cookie: false })).status).toBe(401);
    expect((await s.raw('POST', `/api/shop/upgrades/${PLACA_MADEIRA}/purchase`, { cookie: false })).status).toBe(401);
    expect((await s.raw('POST', `/api/shop/upgrades/${PLACA_MADEIRA}/install`, { cookie: false })).status).toBe(401);
  });

  it('melhoria desconhecida → 404 (compra e instalação)', async () => {
    expect((await buy('nao_existe')).status).toBe(404);
    expect((await install('nao_existe')).status).toBe(404);
  });
});

describe('Loja de Utilidades — compra', () => {
  it('com saldo suficiente: debita exatamente R$ 60 uma vez e a melhoria fica "pending"; o preço enviado pelo cliente é ignorado', async () => {
    await earn(100);
    const r = await s.post(`/api/shop/upgrades/${PLACA_MADEIRA}/purchase`, { price: 1, amount: 0.01 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, alreadyApplied: false, balance: 40 });
    expect(r.body.upgrade).toMatchObject({ id: PLACA_MADEIRA, state: 'pending', installedAt: null });
    expect(await balance()).toBe(40);
    const tx = await rows(`SELECT * FROM cash_transactions WHERE type = 'upgrade_purchase'`);
    expect(tx).toHaveLength(1);
    expect(tx[0]).toMatchObject({ amount: 60, order_id: null, delivery_id: null, id: `shop_${PLACA_MADEIRA}` });
    expect(await rows('SELECT * FROM shop_upgrades')).toEqual([
      expect.objectContaining({ upgrade_id: PLACA_MADEIRA, price_paid: 60, installed_at: null, cash_transaction_id: `shop_${PLACA_MADEIRA}` }),
    ]);
  });

  it('o débito não conta como venda: totalSales e o resumo continuam coerentes', async () => {
    await earn(100);
    await buy();
    const summary = (await s.get('/api/cash/summary')).body;
    expect(summary).toMatchObject({ balance: 40, totalSales: 100 });
    const cash = (await s.get('/api/cash')).body;
    expect(cash.balance).toBe(40);
    expect(cash.totalSales).toBe(100);
  });

  it('saldo exatamente igual ao preço compra e zera o caixa (nunca negativo)', async () => {
    await earn(60);
    expect((await buy()).status).toBe(200);
    expect(await balance()).toBe(0);
  });

  it('sem saldo suficiente: 400 INSUFFICIENT_FUNDS, nenhum débito, nenhuma melhoria', async () => {
    await earn(59.99);
    const r = await buy();
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', balance: 59.99, price: 60 });
    expect(r.body.error).toMatch(/saldo insuficiente/i);
    expect(await balance()).toBe(59.99);
    expect(await rows('SELECT * FROM shop_upgrades')).toHaveLength(0);
    expect(await rows(`SELECT * FROM cash_transactions WHERE type = 'upgrade_purchase'`)).toHaveLength(0);
    expect((await s.get('/api/shop')).body.upgrades[0].state).toBe('available');
  });

  it('caixa vazio: não compra e o saldo permanece 0', async () => {
    expect((await buy()).status).toBe(400);
    expect(await balance()).toBe(0);
  });

  it('repetir a compra (clique duplo/retry) NÃO cobra de novo: alreadyApplied e um único débito', async () => {
    await earn(200);
    const first = await buy();
    const again = await buy();
    expect(first.body.alreadyApplied).toBe(false);
    expect(again.status).toBe(200);
    expect(again.body.alreadyApplied).toBe(true);
    expect(await balance()).toBe(140);
    expect(await rows(`SELECT * FROM cash_transactions WHERE type = 'upgrade_purchase'`)).toHaveLength(1);
    expect(await rows('SELECT * FROM shop_upgrades')).toHaveLength(1);
  });

  it('já comprada, a recompra não depende do saldo (não cobra nem falha)', async () => {
    await earn(60);
    await buy();
    expect(await balance()).toBe(0);
    const again = await buy();
    expect(again.status).toBe(200);
    expect(again.body.alreadyApplied).toBe(true);
    expect(await balance()).toBe(0);
  });

  it('concorrência: 10 compras simultâneas → exatamente uma cobrança e uma melhoria', async () => {
    await earn(200);
    const results = await Promise.all(Array.from({ length: 10 }, () => buy()));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.alreadyApplied === false)).toHaveLength(1);
    expect(await balance()).toBe(140);
    expect(await rows(`SELECT * FROM cash_transactions WHERE type = 'upgrade_purchase'`)).toHaveLength(1);
    expect(await rows('SELECT * FROM shop_upgrades')).toHaveLength(1);
  });

  it('concorrência sem saldo: nenhuma das compras passa e o saldo nunca fica negativo', async () => {
    await earn(30);
    const results = await Promise.all(Array.from({ length: 6 }, () => buy()));
    expect(results.every((r) => r.status === 400)).toBe(true);
    expect(await balance()).toBe(30);
    expect(await rows('SELECT * FROM shop_upgrades')).toHaveLength(0);
  });

  it('o banco recusa duplicidade mesmo fora da API (PK de shop_upgrades e do débito)', async () => {
    await earn(200);
    await buy();
    await expect(s.db.run(`INSERT INTO shop_upgrades (upgrade_id, price_paid, purchased_at, cash_transaction_id) VALUES (?, 60, 1, 'outro')`, PLACA_MADEIRA)).rejects.toThrow();
    await expect(
      s.db.run(`INSERT INTO cash_transactions (id, amount, type, created_at) VALUES (?, 60, 'upgrade_purchase', 1)`, `shop_${PLACA_MADEIRA}`)
    ).rejects.toThrow();
  });
});

describe('Loja de Utilidades — jardineiras e banco (mesmo modelo da placa)', () => {
  it.each([
    [JARDINEIRAS, 90],
    [BANCO, 120],
  ])('%s: preço do backend (R$ %i), débito único, pending → installed, idempotente', async (id, price) => {
    await earn(200);
    const r = await s.post(`/api/shop/upgrades/${id}/purchase`, { price: 0.01 }); // o preço do cliente é ignorado
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ alreadyApplied: false, balance: 200 - price });
    expect(r.body.upgrade).toMatchObject({ id, price, state: 'pending' });
    expect((await s.post(`/api/shop/upgrades/${id}/purchase`)).body.alreadyApplied).toBe(true);
    expect(await balance()).toBe(200 - price);
    expect(await rows(`SELECT * FROM cash_transactions WHERE id = ?`, `shop_${id}`)).toEqual([expect.objectContaining({ amount: price, type: 'upgrade_purchase' })]);

    expect((await install(id)).body.upgrade.state).toBe('installed');
    expect((await install(id)).body.alreadyApplied).toBe(true);
    // as outras continuam disponíveis e independentes
    const states = Object.fromEntries((await s.get('/api/shop')).body.upgrades.map((u: any) => [u.id, u.state]));
    expect(states[id]).toBe('installed');
    expect(Object.values(states).filter((v) => v === 'available')).toHaveLength(2);
  });

  it('instalar jardineiras/banco sem comprar → 409; sem saldo → 400 sem débito', async () => {
    await earn(100);
    for (const id of [JARDINEIRAS, BANCO]) expect((await install(id)).status).toBe(409);
    expect((await buy(BANCO)).status).toBe(400); // 100 < 120
    expect((await buy(BANCO)).body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', price: 120, balance: 100 });
    expect(await balance()).toBe(100);
    expect(await rows('SELECT * FROM shop_upgrades')).toHaveLength(0);
  });

  it('compras diferentes concorrentes: com saldo para só uma, uma passa e o saldo nunca fica negativo', async () => {
    await earn(130); // banco (120) OU jardineiras (90): não as duas (210)
    const results = await Promise.all([buy(BANCO), buy(JARDINEIRAS), buy(BANCO), buy(JARDINEIRAS)]);
    const ok = results.filter((r) => r.status === 200 && r.body.alreadyApplied === false);
    expect(ok).toHaveLength(1);
    expect(await balance()).toBeGreaterThanOrEqual(0);
    expect(await rows(`SELECT * FROM cash_transactions WHERE type = 'upgrade_purchase'`)).toHaveLength(1);
  });
});

describe('Loja de Utilidades — instalação', () => {
  it('instalar sem ter comprado → 409 NOT_PURCHASED e nada muda', async () => {
    await earn(100);
    const r = await install();
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('NOT_PURCHASED');
    expect(await rows('SELECT * FROM shop_upgrades')).toHaveLength(0);
    expect(await balance()).toBe(100);
  });

  it('comprada → instalada: estado muda para "installed" e é persistido; não mexe no saldo', async () => {
    await earn(100);
    await buy();
    const r = await install();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, alreadyApplied: false, balance: 40 });
    expect(r.body.upgrade.state).toBe('installed');
    expect(r.body.upgrade.installedAt).toBeGreaterThan(0);
    expect((await s.get('/api/shop')).body.upgrades[0].state).toBe('installed');
    expect(await balance()).toBe(40);
  });

  it('instalar de novo é idempotente: alreadyApplied e o installed_at original é preservado', async () => {
    await earn(100);
    await buy();
    const first = await install();
    const at = first.body.upgrade.installedAt;
    const again = await install();
    expect(again.status).toBe(200);
    expect(again.body.alreadyApplied).toBe(true);
    expect(again.body.upgrade.installedAt).toBe(at);
    const parallel = await Promise.all(Array.from({ length: 5 }, () => install()));
    expect(parallel.every((r) => r.body.alreadyApplied === true)).toBe(true);
  });

  it('comprar depois de instalada não desfaz a instalação nem cobra', async () => {
    await earn(200);
    await buy();
    await install();
    const again = await buy();
    expect(again.body.alreadyApplied).toBe(true);
    expect(again.body.upgrade.state).toBe('installed');
    expect(await balance()).toBe(140);
  });
});

describe('Loja de Utilidades — persistência', () => {
  it('o estado (comprada/instalada) e o débito sobrevivem a reiniciar o servidor sobre o mesmo banco', async () => {
    await earn(100);
    await buy();
    await install();
    await s.restart();
    const r = await s.get('/api/shop');
    expect(r.body.balance).toBe(40);
    expect(r.body.upgrades[0].state).toBe('installed');
  });
});
