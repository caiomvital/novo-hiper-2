import { expect, Page, test } from '@playwright/test';
import { DELIVERY_FEEDBACK_MS } from '../../src/phaser-game/bridge/adventureBridge';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { destinationInfoFor } from './destinationHelpers';
import { login, openAdventure, state, teleport } from './helpers';
import { closeSuiteOrders, createSuiteCustomer, createSuiteOrder, suiteId } from './suiteData';

test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

// pontos livres (cruzamentos/ruas) bem espalhados: o mais distante do destino garante o indicador fora de "Destino próximo"
const START_POINTS = [WORLD_MAP.spawn, { x: 2800, y: 2000 }, { x: 720, y: 560 }, { x: 2800, y: 560 }];
const farthestFrom = (t: { x: number; y: number }) => START_POINTS.reduce((a, b) => (Math.hypot(a.x - t.x, a.y - t.y) >= Math.hypot(b.x - t.x, b.y - t.y) ? a : b));
const house = (id: string) => HOUSE_CATALOG.find((h) => h.houseId === id)!;
const waitDelivery = (page: Page, pred: string, timeout = 30_000) =>
  page.waitForFunction(`(() => { const d = window.__NH_ADVENTURE__?.getState().delivery; return Boolean(d && (${pred})); })()`, null, { timeout });
const delivery = async (page: Page) => (await state(page)).delivery!;
const get = async (page: Page, url: string) => (await page.request.get(url)).json();
const stock = async (page: Page, id: string) => (await get(page, `/api/plants/${id}`)).stock_quantity as number;
const cashRows = async (page: Page, orderId: string) => ((await get(page, '/api/cash')).transactions as any[]).filter((t) => t.order_id === orderId);

function countRequests(page: Page) {
  const calls = { start: 0, finish: 0 };
  page.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().endsWith('/api/deliveries/start')) calls.start++;
    if (/\/api\/deliveries\/[^/]+\/finish$/.test(r.url())) calls.finish++;
  });
  return calls;
}

test.describe('clientes em casas diferentes', () => {
  test('três clientes, três casas: destaque/NPC/indicador na casa certa; casa errada não entrega; casa certa entrega uma vez', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Planta Destinos', price: 12.5, stock_quantity: 10, image_path: '/a.jpg' } })).json();
    const people = [
      { name: 'Dona Maria D', houseId: 'house_007' },
      { name: 'Seu João D', houseId: 'house_021' },
      { name: 'Ana D', houseId: 'house_034' },
    ];
    const orders = [];
    for (const p of people) {
      const c = await createSuiteCustomer(page, p.name, house(p.houseId).destinationId);
      orders.push(await createSuiteOrder(page, { plantId: plant.id, customerId: c.id }));
      expect(orders[orders.length - 1].destination_id).toBe(house(p.houseId).destinationId); // congelado no pedido
    }

    const calls = countRequests(page);
    await openAdventure(page);

    for (let i = 0; i < people.length; i++) {
      const target = house(people[i].houseId);
      const wrong = house(people[(i + 1) % people.length].houseId);
      await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(orders[i].id)}`, DELIVERY_FEEDBACK_MS + 20_000);
      await waitDelivery(page, "d.phase === 'idle'");

      // destino resolvido, NPC/nome/destaque/anel no ponto da casa certa
      const d0 = await delivery(page);
      expect(d0.destination).toMatchObject({ id: target.destinationId, status: 'house', houseId: target.houseId, legacy: false });
      expect(d0.customer).toEqual(target.deliveryPoint);
      expect(d0.customerName).toBe(people[i].name);
      expect(d0.customerVisible).toBe(true);
      expect(d0.highlightVisible).toBe(true);

      // indicador aponta para a casa certa (e a distância bate com o ponto dela)
      const from = farthestFrom(target.deliveryPoint);
      await teleport(page, from.x, from.y);
      await waitDelivery(page, 'd.indicator && !d.indicator.near');
      const ind = (await delivery(page)).indicator!;
      const p = (await state(page)).player!;
      const expected = destinationInfoFor(p, target.deliveryPoint);
      expect(ind.angle).toBeCloseTo(expected.angle, 1);
      expect(ind.meters).toBeCloseTo(expected.meters, 0);

      // casa ERRADA (a de outro cliente): sem prompt e E não chama a API
      await teleport(page, wrong.deliveryPoint.x, wrong.deliveryPoint.y);
      await page.waitForTimeout(500);
      expect((await delivery(page)).promptVisible).toBe(false);
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(700);
      expect(calls.start).toBe(i);
      expect((await get(page, `/api/orders/${orders[i].id}`)).status).not.toBe('entregue');

      // casa CERTA: entrega uma única vez
      await teleport(page, target.deliveryPoint.x, target.deliveryPoint.y + (target.facing === 's' ? 20 : -20));
      await waitDelivery(page, 'd.near');
      const stockBefore = await stock(page, plant.id);
      const cashBefore = ((await get(page, '/api/cash')).transactions as any[]).length;
      await page.keyboard.press('KeyE');
      await waitDelivery(page, "d.phase === 'done'");
      expect((await get(page, `/api/orders/${orders[i].id}`)).status).toBe('entregue');
      expect(await stock(page, plant.id)).toBe(stockBefore - 1);
      expect(await cashRows(page, orders[i].id)).toHaveLength(1);
      expect(((await get(page, '/api/cash')).transactions as any[]).length).toBe(cashBefore + 1);
      expect(calls).toEqual({ start: i + 1, finish: i + 1 });
    }
  });

  test('destino legado conhecido usa a casa amarela (compatibilidade explícita)', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Planta Legada', price: 10, stock_quantity: 5, image_path: '/a.jpg' } })).json();
    const legacy = await createSuiteCustomer(page, 'Cliente Legado', 'dest_manual');
    const order = await createSuiteOrder(page, { plantId: plant.id, customerId: legacy.id });
    expect(order.destination_id).toBe('dest_manual');

    await openAdventure(page);
    await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
    const d = await delivery(page);
    expect(d.destination).toMatchObject({ id: 'dest_manual', status: 'house', legacy: true });
    expect(d.customer).toEqual({ x: CUSTOMER_SPOT.x, y: CUSTOMER_SPOT.y });
    expect(d.highlightVisible).toBe(true);
  });

  test('destino moderno INEXISTENTE não entrega em lugar nenhum, mostra diagnóstico e a exploração continua', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Planta Invalida', price: 10, stock_quantity: 5, image_path: '/a.jpg' } })).json();
    const customer = await createSuiteCustomer(page, 'Cliente Sem Casa');
    const order = await createSuiteOrder(page, { plantId: plant.id, customerId: customer.id });

    // a API "devolve" o pedido com um destino moderno que não existe (corrupção/versão futura do catálogo)
    await page.route(/\/api\/orders(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await route.fetch();
      const body = (await res.json()) as any[];
      await route.fulfill({ response: res, json: body.filter((o) => o.id.startsWith('e2e_')).map((o) => (o.id === order.id ? { ...o, destination_id: 'bairro1/house_999' } : o)) });
    });
    const calls = countRequests(page);
    await openAdventure(page);
    await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
    const d = await delivery(page);
    expect(d.destination).toMatchObject({ id: 'bairro1/house_999', status: 'unknown', houseId: null });
    expect(d.customerVisible).toBe(false);
    expect(d.highlightVisible).toBe(false);
    expect(d.indicator).toBeNull();
    expect(d.hud).toMatch(/endereço desconhecido/i);

    // mesmo junto da casa amarela (o antigo ponto único) NÃO há prompt nem entrega
    await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 20);
    await page.waitForTimeout(600);
    expect((await delivery(page)).promptVisible).toBe(false);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(800);
    expect(calls).toEqual({ start: 0, finish: 0 });
    expect((await get(page, `/api/orders/${order.id}`)).status).not.toBe('entregue');

    // a exploração segue funcionando: Bernardo ainda anda
    const p0 = (await state(page)).player!;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');
    expect((await state(page)).player!.x).toBeLessThan(p0.x - 20);
  });
});
