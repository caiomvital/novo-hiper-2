import { expect, test } from '@playwright/test';
import { login, openAdventure, runToGoal, state, teleport, waitForScene } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { PLATFORM, PLATFORM_FALL_LIMIT_Y, PLATFORM_SPAWN } from '../../src/phaser-game/config/platformConfig';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';

test.use({ viewport: { width: 480, height: 500 }, hasTouch: true });
for (const [index, routeId] of ['rua', 'jardim', 'praca'].entries()) test(`${routeId}: percurso real, checkpoint e entrega única no marco oficial`, async ({ page }) => {
  test.setTimeout(240_000);
  await login(page); await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('routes'), name: 'Planta dos caminhos', price: 100, stock_quantity: 30, image_path: '/pwa-192x192.png' } })).json();
  expect((await page.request.post('/api/plants', { data: { id: suiteId('routes-species'), name: 'Outra espécie', price: 10, stock_quantity: 1, image_path: '/pwa-192x192.png' } })).ok()).toBe(true);
  async function sale() {
    const order = await createSuiteOrder(page, { plantId: plant.id });
    const d = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
    expect((await page.request.post(`/api/deliveries/${d.id}/finish`)).ok()).toBe(true);
  }
  async function upgrade(id: string) {
    expect((await page.request.post(`/api/shop/upgrades/${id}/purchase`)).ok()).toBe(true);
    expect((await page.request.post(`/api/shop/upgrades/${id}/install`)).ok()).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  }
  if (index > 0) {
    for (let i = 0; i < (index === 1 ? 3 : 6); i++) await sale();
    await upgrade('placa_madeira');
    if (index === 2) await upgrade('jardineiras');
  }
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Cliente dos caminhos', destination: 'bairro1/house_007' });
  expect((await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).ok()).toBe(true);
  await openAdventure(page); await page.locator('#btn-adventure-fullscreen').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  if (index > 0) await page.waitForFunction(stage => window.__NH_ADVENTURE__?.getState().delivery?.worldStage?.environmentalNeighbors === stage, index + 1);
  await page.waitForFunction(id => window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId === id, order.id);
  await page.locator('#btn-start-delivery-route').click(); await waitForScene(page, 'platform');
  expect((await state(page)).platform?.routeId).toBe(routeId);
  const gaps = (await state(page)).platform!.gaps!;
  expect(gaps).toHaveLength(index === 0 ? 2 : 3);
  await page.screenshot({ path: `docs/evidence/platform-routes/${routeId}.png` });
  // Salva checkpoint no segundo trecho: um ponto válido depende do percurso atual.
  const safeX = gaps[0].end + 80;
  await teleport(page, safeX, PLATFORM.groundY - PLATFORM.playerHeight / 2);
  await page.waitForFunction(x => Math.abs((window.__NH_ADVENTURE__?.getState().lastSafeGround?.x ?? 0) - x) < 5, safeX);
  await teleport(page, (gaps[1].start + gaps[1].end) / 2, PLATFORM_FALL_LIMIT_Y + 30);
  await page.waitForFunction(() => (window.__NH_ADVENTURE__?.getState().fallRespawns ?? 0) > 0);
  expect(Math.abs((await state(page)).player!.x - safeX)).toBeLessThan(5);
  await teleport(page, PLATFORM_SPAWN.x, PLATFORM_SPAWN.y);
  const before = await (await page.request.get('/api/cash')).json();
  await runToGoal(page);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
  await page.keyboard.press('Enter'); await waitForScene(page, 'world');
  const house = HOUSE_CATALOG.find(h => h.destinationId === order.destination_id)!;
  const point = (await state(page)).player!;
  expect(Math.hypot(point.x - house.deliveryPoint.x, point.y - house.deliveryPoint.y)).toBeLessThan(50);
  expect((await (await page.request.get('/api/cash')).json()).balance).toBe(before.balance);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.near);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'done');
  const after = await (await page.request.get('/api/cash')).json();
  expect(after.balance).toBe(before.balance + 100);
  expect(after.transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
});
