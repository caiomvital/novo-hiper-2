import { expect, test } from '@playwright/test';
import { login, openAdventure, state, teleport } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { ROSTER } from '../../src/shared/roster';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';

test.use({ viewport: { width: 480, height: 500 }, hasTouch: true });
test('oito identidades com sprites reais e entrega única por interação', async ({ page }) => {
  test.setTimeout(180_000);
  await login(page); await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('npcs'), name: 'Planta dos moradores', price: 100, stock_quantity: 20, image_path: '/pwa-192x192.png' } })).json();
  const customers = await (await page.request.get('/api/customers')).json();
  for (const r of ROSTER) if (!customers.some((c: any) => c.id === r.id)) {
    expect((await page.request.post('/api/customers', { data: { id: r.id, name: r.name, destination: r.destinationId } })).ok()).toBe(true);
  }
  await openAdventure(page); await page.locator('#btn-adventure-fullscreen').click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  for (const [index, resident] of ROSTER.entries()) {
    const order = await createSuiteOrder(page, { plantId: plant.id, customerId: resident.id });
    const delivery = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(id => window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId === id, order.id);
    const house = HOUSE_CATALOG.find(h => h.destinationId === order.destination_id)!;
    await teleport(page, house.deliveryPoint.x, house.deliveryPoint.y + (house.facing === 's' ? 100 : -100));
    await page.waitForFunction(id => window.__NH_ADVENTURE__?.getState().delivery?.customerAppearance?.frame.startsWith(id + '-'), resident.id);
    const d = (await state(page)).delivery!;
    expect(d.customerAppearance?.texture).toBe('moradores-v1');
    expect(d.customerAppearance?.scale).toBe(0.36);
    expect(d.customerVisible).toBe(true);
    expect(d.customerName).toBe(resident.name);
    if ([0, 1, 3].includes(index)) await page.screenshot({ path: `docs/evidence/npcs/${resident.id}.png` });
    if (index === ROSTER.length - 1) {
      const before = await (await page.request.get('/api/cash')).json();
      await teleport(page, house.deliveryPoint.x, house.deliveryPoint.y + (house.facing === 's' ? 20 : -20));
      await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.near);
      await page.keyboard.press('KeyE');
      await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'done');
      const after = await (await page.request.get('/api/cash')).json();
      expect(after.balance).toBe(before.balance + 100);
      expect(after.transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
      expect((await state(page)).delivery?.feedbackLine).toBe(resident.thanks);
    } else expect((await page.request.post(`/api/deliveries/${delivery.id}/finish`)).ok()).toBe(true);
  }
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(12);
});
