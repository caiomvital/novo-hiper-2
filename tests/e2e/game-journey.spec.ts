import { expect, test, type Page } from '@playwright/test';
import { login, openAdventure, pickUpActiveOrder, state, teleportToGoal, waitForScene } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';
test.setTimeout(120_000);
test.use({ viewport: { width: 480, height: 500 }, hasTouch: true });
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));
const get = async (page: Page, url: string) => (await page.request.get(url)).json();
async function fixture(page: Page, destination = 'bairro1/house_007') {
  await login(page); await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('journey'), name: 'Planta da aventura', price: 100, stock_quantity: 20, image_path: '/pwa-192x192.png' } })).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Cliente da aventura', destination });
  await openAdventure(page); await page.locator('#btn-adventure-fullscreen').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await pickUpActiveOrder(page);
  await page.locator('#btn-start-delivery-route').click(); await waitForScene(page, 'platform');
  return { plant, order };
}
async function arrive(page: Page) {
  await teleportToGoal(page);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press('Enter');
}
test('pedido → plataforma real → casa correta → entrega única e orientação de melhoria', async ({ page }) => {
  test.setTimeout(120_000);
  const { plant, order } = await fixture(page);
  const before = await get(page, '/api/cash');
  const { runToGoal } = await import('./helpers'); await runToGoal(page);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
  await page.keyboard.press('Enter'); await waitForScene(page, 'world');
  const house = HOUSE_CATALOG.find(h => h.destinationId === order.destination_id)!;
  const s = await state(page);
  expect(s.delivery?.destination?.id).toBe(order.destination_id);
  expect(Math.hypot(s.player!.x - house.deliveryPoint.x, s.player!.y - house.deliveryPoint.y)).toBeLessThan(50);
  expect((await get(page, '/api/cash')).balance).toBe(before.balance);
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(20);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.near);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'done');
  await expect(page.locator('#story-guidance')).toContainText('Loja de Utilidades');
  const after = await get(page, '/api/cash');
  expect(after.balance).toBe(before.balance + 100);
  expect(after.transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(19);
  await page.screenshot({ path: 'docs/evidence/game-journey/entrega-apos-plataforma.png' });
});
test('abandonar preserva pedido e retorna ao ponto de partida', async ({ page }) => {
  const { order, plant } = await fixture(page);
  const before = await get(page, '/api/cash');
  await page.locator('#btn-platform-exit').click(); await waitForScene(page, 'world');
  expect((await state(page)).delivery?.activeOrderId).toBe(order.id);
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(20);
  expect((await get(page, '/api/cash')).balance).toBe(before.balance);
});
test('pedido concluído em outra aba não leva a um novo cliente; saída segue possível', async ({ page }) => {
  const { order } = await fixture(page);
  const delivery = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
  await page.request.post(`/api/deliveries/${delivery.id}/finish`);
  const before = await get(page, '/api/cash');
  await arrive(page); await page.waitForTimeout(700);
  expect((await state(page)).scene).toBe('platform');
  expect((await get(page, '/api/cash')).balance).toBe(before.balance);
  await page.locator('#btn-platform-exit').click(); await waitForScene(page, 'world');
});
test('falha ao conferir chegada permite repetir sem crédito antecipado', async ({ page }) => {
  const { order } = await fixture(page);
  const before = await get(page, '/api/cash');
  await page.route('**/api/orders', route => route.fulfill({ status: 503, json: { error: 'Falha de teste' } }));
  await arrive(page); await page.waitForTimeout(500);
  expect((await state(page)).scene).toBe('platform');
  expect((await get(page, '/api/cash')).balance).toBe(before.balance);
  await page.unroute('**/api/orders');
  await page.keyboard.press('Enter'); await waitForScene(page, 'world');
  expect((await state(page)).delivery?.activeOrderId).toBe(order.id);
});
test('primeiro arco celebra uma vez e continua jogável depois da recarga', async ({ page }) => {
  await login(page); await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('arc'), name: 'Planta do bairro vivo', price: 100, stock_quantity: 20, image_path: '/pwa-192x192.png' } })).json();
  for (let i = 0; i < 2; i++) {
    const response = await page.request.post('/api/plants', { data: { id: suiteId('arc-species'), name: `Espécie do arco ${i}`, price: 10, stock_quantity: 1, image_path: '/pwa-192x192.png' } });
    expect(response.ok()).toBe(true);
  }
  for (let i = 0; i < 10; i++) {
    const order = await createSuiteOrder(page, { plantId: plant.id, destination: HOUSE_CATALOG[i % 4].destinationId });
    const d = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
    expect((await page.request.post(`/api/deliveries/${d.id}/finish`)).ok()).toBe(true);
  }
  for (const id of ['placa_madeira', 'jardineiras', 'banco']) { expect((await page.request.post(`/api/shop/upgrades/${id}/purchase`)).ok()).toBe(true); expect((await page.request.post(`/api/shop/upgrades/${id}/install`)).ok()).toBe(true); }
  await openAdventure(page);
  await expect(page.locator('#story-celebration')).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/game-journey/primeiro-arco.png' });
  const before = await get(page, '/api/cash');
  await page.locator('#btn-story-continue').click(); await expect(page.locator('#story-celebration')).toHaveCount(0);
  expect((await get(page, '/api/cash')).balance).toBe(before.balance);
  await page.reload(); await openAdventure(page);
  await expect(page.locator('#story-guidance')).toBeVisible(); await expect(page.locator('#story-celebration')).toHaveCount(0);
});
