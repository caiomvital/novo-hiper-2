import { expect, test } from '@playwright/test';
import { login, openAdventure, state, teleport, enterStore, leaveStore } from './helpers';
import { earn } from './isolatedData';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { ROSTER } from '../../src/shared/roster';
import { resolveDestination } from '../../src/phaser-game/config/houseCatalog';

test.use({ hasTouch: true, viewport: { width: 480, height: 500 } });
test('moradores passeiam, reagem, pausam e preservam a entrega após voltar da loja', async ({ page }) => {
  test.setTimeout(180_000);
  page.on('pageerror', e => console.error('game error:', e.message));
  await login(page); await closeSuiteOrders(page);
  console.log('fixture: loja autenticada');
  for (let i = 0; i < 6; i++) await earn(page, 100);
  for (const id of ['placa_madeira', 'jardineiras']) {
    const shop = await (await page.request.get('/api/shop')).json();
    const u = shop.upgrades.find((u: any) => u.id === id);
    if (u.state === 'available') expect((await page.request.post(`/api/shop/upgrades/${id}/purchase`)).ok()).toBe(true);
    if (u.state !== 'installed') expect((await page.request.post(`/api/shop/upgrades/${id}/install`)).ok()).toBe(true);
  }
  const progress = await (await page.request.get('/api/progress')).json();
  expect(progress.worldStage.environmentalNeighbors).toBe(3);
  if (progress.milestones.bairro_vivo.achieved) await page.request.post('/api/progress/celebrations/bairro_vivo/ack');
  console.log('fixture: três moradores liberados');
  await openAdventure(page);
  console.log('world: aberto');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().neighbors?.filter(n => n.visible).length === 3);
  // Afasta Bernardo para não interromper os passeios e aguarda uma pose de passo real.
  await teleport(page, 1032, 1290);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().neighbors?.some(n => n.moving && n.texture === 'moradores-walk-v1'));
  console.log('walk: pose encontrada');
  const first = (await state(page)).neighbors!;
  await page.waitForFunction(x => Math.abs((window.__NH_ADVENTURE__?.getState().neighbors?.[0].x ?? x) - x) > 8, first[0].x);
  const ana = (await state(page)).neighbors![0];
  await teleport(page, ana.x, ana.y - 65);
  await page.waitForFunction(() => {
    const n = window.__NH_ADVENTURE__?.getState().neighbors?.[0];
    return n?.attentive && !n.moving && n.facing === 'up' && n.texture === 'moradores-v1';
  });
  console.log('reaction: olhando');
  const stopped = (await state(page)).neighbors![0];
  await page.waitForTimeout(600);
  expect((await state(page)).neighbors![0].x).toBe(stopped.x);
  await page.locator('#adventure-root').screenshot({ path: 'docs/evidence/neighbor-walk/olha-para-bernardo.png' });
  await teleport(page, 1032, 1290);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().neighbors?.[0].moving);
  // Um painel aberto congela todos os passeios.
  await teleport(page, WORLD_MAP.utilities.interact.x, WORLD_MAP.utilities.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.shop.nearUtilities);
  await page.keyboard.press('KeyE'); await expect(page.locator('#shop-panel')).toBeVisible();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().neighbors?.every(n => !n.moving));
  console.log('panel: passeios pausados');
  const paused = (await state(page)).neighbors!.map(n => [n.x, n.y]);
  await page.waitForTimeout(600);
  expect((await state(page)).neighbors!.map(n => [n.x, n.y])).toEqual(paused);
  await page.locator('#btn-shop-close').click();
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('neighbor'), name: 'Planta dos vizinhos', price: 25, stock_quantity: 5, image_path: '/pwa-192x192.png' } })).json();
  const customers = await (await page.request.get('/api/customers')).json();
  if (!customers.some((c: any) => c.id === 'cust_ana')) {
    const ana = ROSTER.find(r => r.id === 'cust_ana')!;
    expect((await page.request.post('/api/customers', { data: { id: ana.id, name: ana.name, destination: ana.destinationId } })).ok()).toBe(true);
  }
  const order = await createSuiteOrder(page, { plantId: plant.id, customerId: 'cust_ana' });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(id => window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId === id, order.id);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().neighbors?.[0].visible === false);
  const customer = (await state(page)).delivery!;
  const destination = resolveDestination(order.destination_id);
  expect(destination.status).toBe('house');
  if (destination.status !== 'house') throw new Error('Destino sem casa no fixture');
  const house = destination.house;
  expect(customer.customerAppearance?.x).toBe(house.deliveryPoint.x);
  expect(customer.customerAppearance?.y).toBe(house.deliveryPoint.y);
  const cash = await (await page.request.get('/api/cash')).json();
  await enterStore(page);
  // Afasta-se da porta antes de sair, como exige a proteção contra reentrada imediata.
  await teleport(page, 320, 240);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.interior?.exitArmed);
  await leaveStore(page);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().neighbors?.filter(n => n.visible).length === 2);
  expect((await state(page)).delivery!.activeOrderId).toBe(order.id);
  expect((await state(page)).delivery!.customerAppearance?.x).toBe(house.deliveryPoint.x);
  expect((await (await page.request.get('/api/cash')).json()).balance).toBe(cash.balance);
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(5);
  await closeSuiteOrders(page);
});
