import { expect, test } from '@playwright/test';
import { login, openAdventure, pickUpActiveOrder, state, teleport, waitForScene, teleportToGoal } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';

test.use({ viewport: { width: 480, height: 500 }, hasTouch: true });
test('NPC permanece na casa real após retirada, abandono e conclusão da plataforma', async ({ page }) => {
  test.setTimeout(150_000);
  await login(page); await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('npc-pickup'), name: 'Planta da retirada', price: 80, stock_quantity: 5, image_path: '/pwa-192x192.png' } })).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, destination: 'bairro1/house_007' });
  const house = HOUSE_CATALOG.find(h => h.destinationId === order.destination_id)!;
  const cash = await (await page.request.get('/api/cash')).json();
  await openAdventure(page); await page.locator('#btn-adventure-fullscreen').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.waitForFunction(id => window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId === id, order.id);
  async function assertNpcAtHouse() {
    const d = (await state(page)).delivery!;
    expect(d.customerVisible).toBe(true);
    expect(d.customerAppearance?.texture).toBe('moradores-v1');
    expect(d.customerAppearance?.x).toBe(house.deliveryPoint.x);
    expect(d.customerAppearance?.y).toBe(house.deliveryPoint.y);
    expect(d.customerAppearance?.depth).toBeGreaterThan(1);
    expect(d.highlightVisible).toBe(true);
    expect(d.activeOrderId).toBe(order.id);
  }
  await assertNpcAtHouse();
  await pickUpActiveOrder(page);
  await assertNpcAtHouse();
  await teleport(page, house.deliveryPoint.x, house.deliveryPoint.y + (house.facing === 's' ? 100 : -100));
  await page.waitForFunction(() => {
    const s = window.__NH_ADVENTURE__?.getState(), c = s?.camera, npc = s?.delivery?.customerAppearance;
    if (!c || npc?.x == null || npc.y == null) return false;
    return npc.x > c.scrollX + 24 && npc.x < c.scrollX + c.width / c.zoom - 24 && npc.y > c.scrollY + 64 && npc.y < c.scrollY + c.height / c.zoom - 30;
  });
  await page.screenshot({ path: 'docs/evidence/npc-pickup/apos-retirar.png' });
  await page.locator('#btn-start-delivery-route').click(); await waitForScene(page, 'platform');
  await page.locator('#btn-platform-exit').click(); await waitForScene(page, 'world');
  await assertNpcAtHouse();
  await page.locator('#btn-start-delivery-route').click(); await waitForScene(page, 'platform');
  await teleportToGoal(page);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
  await page.keyboard.press('Enter'); await waitForScene(page, 'world');
  await assertNpcAtHouse();
  expect((await (await page.request.get('/api/cash')).json()).balance).toBe(cash.balance);
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(5);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.near);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'done');
  expect((await (await page.request.get('/api/cash')).json()).balance).toBe(cash.balance + 80);
});
