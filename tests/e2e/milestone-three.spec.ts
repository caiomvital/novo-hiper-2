import { expect, test } from '@playwright/test';
import { PREP_BENCH } from '../../src/phaser-game/config/interiorMap';
import { enterStore, leaveStore, login, openAdventure, teleport } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';

test.beforeEach(async ({ page }) => { await login(page); await closeSuiteOrders(page); });
const carrying = async (page: import('@playwright/test').Page) => page.evaluate(() => window.__NH_ADVENTURE__?.getState().delivery?.interior?.carrying);

test('H03/H04/H06: retirada lenta não duplica nem mexe em estoque/caixa; reload preserva planta', async ({ page }, info) => {
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Vaso da bancada', price: 20, stock_quantity: 5, image_path: '/pwa-192x192.png' } })).json();
  const order = await createSuiteOrder(page, { plantId: plant.id });
  const before = await (await page.request.get('/api/cash')).json();
  const completedBefore = (await (await page.request.get('/api/deliveries')).json()).filter((d: any) => d.status === 'entregue').length;
  await openAdventure(page); await enterStore(page); await teleport(page, PREP_BENCH.interact.x, PREP_BENCH.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.interior?.canPickup);
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await page.route('**/api/deliveries/start', async (route) => { calls++; await gate; await route.continue(); });
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => window.__NH_ADVENTURE__?.getState().delivery?.hud)).toContain('Aguarde');
  await page.keyboard.press('KeyE'); await page.keyboard.press('KeyE');
  expect(calls).toBe(1); expect(await carrying(page)).toBe(false);
  release(); await expect.poll(() => carrying(page)).toBe(true);
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(5);
  expect(await (await page.request.get('/api/cash')).json()).toEqual(before);
  const records = await (await page.request.get('/api/deliveries')).json();
  expect(records.filter((d: any) => d.order_id === order.id)).toHaveLength(1);
  const completedInApp = await page.evaluate(async () => {
    const url = '/src/services/api.ts';
    const { api } = await import(/* @vite-ignore */ url);
    return (await api.getDeliveries()).length;
  });
  expect(completedInApp).toBe(completedBefore);
  await page.setViewportSize({ width: 720, height: 800 });
  await page.locator('#adventure-root').screenshot({ path: info.outputPath('retirada-confirmada.png') });
  await leaveStore(page); await page.reload(); await openAdventure(page); await enterStore(page);
  await expect.poll(() => carrying(page)).toBe(true);
});

test('H03/H05: falha de retirada informa no HUD e permite nova tentativa', async ({ page }) => {
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Recuperar retirada', price: 20, stock_quantity: 5, image_path: '/pwa-192x192.png' } })).json();
  await createSuiteOrder(page, { plantId: plant.id });
  await openAdventure(page); await enterStore(page); await teleport(page, PREP_BENCH.interact.x, PREP_BENCH.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.interior?.canPickup);
  await page.route('**/api/deliveries/start', (route) => route.fulfill({ status: 503, json: { error: 'Não foi possível retirar agora.' } }));
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => window.__NH_ADVENTURE__?.getState().delivery?.hud)).toContain('Tentar novamente');
  expect(await carrying(page)).toBe(false);
  await page.unroute('**/api/deliveries/start'); await page.keyboard.press('KeyE');
  await expect.poll(() => carrying(page)).toBe(true);
});

test('F04/F02: consulta antiga não desfaz preparo confirmado; botão abre Aventura com pedido pronto', async ({ page }) => {
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Preparo confirmado', price: 20, stock_quantity: 5, image_path: '/pwa-192x192.png' } })).json();
  const order = await createSuiteOrder(page, { plantId: plant.id });
  await page.reload(); await page.locator('#tab-btn-orders').click();
  const card = page.locator(`#order-card-${order.id}`); await expect(card).toBeVisible();
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; }); let held = false;
  await page.route('**/api/orders', async (route) => {
    const response = await route.fetch();
    if (!held) { held = true; await gate; }
    await route.fulfill({ response });
  });
  await expect.poll(() => held, { timeout: 20000 }).toBe(true);
  await card.getByRole('button', { name: 'Preparar Planta', exact: true }).click();
  await expect(card.getByText('Preparando', { exact: true })).toBeVisible();
  const stockResponse = page.waitForResponse('**/api/plants'); release(); await (await stockResponse).finished();
  await expect(card.getByText('Preparando', { exact: true })).toBeVisible({ timeout: 500 });
  await card.getByRole('button', { name: 'Marcar como Pronto', exact: true }).click();
  await card.getByRole('button', { name: 'Continuar na Aventura' }).click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await enterStore(page); await expect.poll(() => carrying(page)).toBe(true);
});
