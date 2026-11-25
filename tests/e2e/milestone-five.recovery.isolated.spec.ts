import fs from 'node:fs';
import { expect, Page, test } from '@playwright/test';
import { login, openAdventure, state, teleport } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { earn } from './isolatedData';
import { formatPrice } from '../../src/services/storage';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { PLACA_MADEIRA, JARDINEIRAS } from '../../src/shared/shop';
const PHOTO = fs.readFileSync('public/pwa-192x192.png');
const get = async (page: Page, path: string) => (await page.request.get(path)).json();
async function plant(page: Page, name = 'Planta da continuidade') {
  const uploaded = await page.request.post('/api/upload', { multipart: { image: { name: 'planta.png', mimeType: 'image/png', buffer: PHOTO } } });
  expect(uploaded.ok()).toBe(true);
  const image = (await uploaded.json()).filePath;
  const response = await page.request.post('/api/plants', { data: { id: suiteId('m5'), name, price: 20, stock_quantity: 5, image_path: image } });
  expect(response.status()).toBe(201);
  return response.json();
}
async function nativeApi(page: Page, method: string, args: unknown[]) {
  return page.evaluate(async ({ method, args }) => {
    const { api } = await new Function('return import("/src/services/api.ts")')();
    return api[method](...args);
  }, { method, args });
}
async function form(page: Page) {
  await page.locator('#btn-start-catalog').click();
  const choosing = page.waitForEvent('filechooser');
  await page.locator('#btn-gallery-photo').click();
  await (await choosing).setFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(page.getByRole('img', { name: 'Fotografia da planta', exact: true })).toBeVisible();
  await page.locator('#input-plant-name').fill('Planta retry Marco 5');
  await page.locator('#input-plant-price').fill('20');
  await page.locator('#input-plant-stock').fill('5');
}
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

test('P04: servidor realmente vazio remove plantas, pedidos, entregas e caixa antigos do navegador', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('novo_hiper_sqlite_migrated_v1', 'true');
    localStorage.setItem('novo_hiper_plantas_v2', JSON.stringify([{ id: 'cache-antigo', name: 'Planta antiga', price: 999, stock: 99, photoUrl: '/x.png', createdAt: 1 }]));
    localStorage.setItem('novo_hiper_pedidos_v1', JSON.stringify([{ id: 'pedido-antigo', status: 'recebido', customerName: 'Antigo', totalPrice: 999 }]));
    localStorage.setItem('novo_hiper_entregas_v1', JSON.stringify([{ id: 'entrega-antiga', status: 'entregue' }]));
    localStorage.setItem('novo_hiper_caixa_v1', JSON.stringify({ balance: 999, totalSales: 999, salesHistory: [{ id: 'venda-antiga' }] }));
  });
  await login(page, { filterOrders: false });
  for (const url of ['/api/plants', '/api/orders', '/api/deliveries']) expect(await get(page, url)).toEqual([]);
  await expect(page.getByText('Planta antiga', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('novo_hiper_caixa_v1')!).balance)).toBe(0);
  for (const key of ['novo_hiper_plantas_v2', 'novo_hiper_pedidos_v1', 'novo_hiper_entregas_v1']) {
    await expect.poll(() => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), key)).toEqual([]);
  }
});

test('P01/P02: resposta perdida no cadastro mantém formulário e repetir salva somente uma planta', async ({ page }) => {
  await login(page);
  await form(page);
  let attempts = 0;
  await page.route('**/api/plants', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort('failed');
  });
  await page.locator('#btn-save-plant').click();
  await expect(page.locator('#plant-form-container')).toContainText('Não foi possível confirmar o cadastro');
  expect((await get(page, '/api/plants')).filter((p: any) => p.name === 'Planta retry Marco 5')).toHaveLength(1);
  await page.unroute('**/api/plants');
  await page.locator('#btn-save-plant').click();
  await expect(page.locator('#plant-form-container')).toHaveCount(0);
  expect(attempts).toBe(1);
  expect((await get(page, '/api/plants')).filter((p: any) => p.name === 'Planta retry Marco 5')).toHaveLength(1);
});

test('P03: offline permite consulta, recusa gravação e reconectar atualiza automaticamente', async ({ page }) => {
  await login(page);
  const p = await plant(page, 'Planta offline');
  await page.reload();
  await expect(page.locator(`#btn-view-${p.id}`)).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.locator('#pwa-offline-banner')).toContainText('precisam de conexão');
  await expect(page.locator(`#btn-view-${p.id}`)).toBeVisible();
  await page.locator(`#btn-view-${p.id}`).click();
  await page.locator('#btn-edit-detail').click();
  await page.locator('#input-plant-name').fill('Não deve salvar offline');
  await page.locator('#btn-save-plant').click();
  await expect(page.locator('#plant-form-container')).toContainText('Não foi possível confirmar o cadastro');
  expect((await get(page, `/api/plants/${p.id}`)).name).toBe('Planta offline');
  await page.locator('#btn-close-form').click();
  await page.request.put(`/api/plants/${p.id}`, { data: { name: 'Atualizada enquanto offline', price: 99, stock_quantity: 8 } });
  await page.setViewportSize({ width: 480, height: 800 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'docs/evidence/milestone-five/consulta-offline.png' });
  await page.context().setOffline(false);
  await expect(page.getByText('Atualizada enquanto offline', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#pwa-offline-banner')).toHaveCount(0);
});

test('P05: duas abas sincronizam catálogo e não duplicam retirada, venda ou compra', async ({ page }) => {
  await login(page);
  const p = await plant(page, 'Planta em duas abas');
  const order = await createSuiteOrder(page, { plantId: p.id });
  await page.reload();
  const other = await page.context().newPage();
  await other.goto('/');
  await expect(other.locator(`#btn-view-${p.id}`)).toBeVisible();
  await page.locator(`#btn-view-${p.id}`).click();
  await page.locator('#btn-edit-detail').click();
  await page.locator('#input-plant-name').fill('Atualizada na outra aba');
  await page.locator('#btn-save-plant').click();
  await expect(page.locator('#plant-form-container')).toHaveCount(0);
  await expect(other.getByText('Atualizada na outra aba', { exact: true }).first()).toBeVisible();
  const started = await Promise.all([nativeApi(page, 'startDelivery', [order.id]), nativeApi(other, 'startDelivery', [order.id])]);
  expect(started[0].id).toBe(started[1].id);
  const before = await get(page, '/api/cash');
  await Promise.all([nativeApi(page, 'finishDelivery', [started[0].id]), nativeApi(other, 'finishDelivery', [started[1].id])]);
  const after = await get(page, '/api/cash');
  expect(after.balance).toBe(before.balance + 20);
  expect(after.transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
  expect((await get(page, `/api/plants/${p.id}`)).stock_quantity).toBe(4);
  await earn(page, 100);
  const beforeBuy = await get(page, '/api/cash');
  await Promise.all([nativeApi(page, 'purchaseShopUpgrade', [PLACA_MADEIRA]), nativeApi(other, 'purchaseShopUpgrade', [PLACA_MADEIRA])]);
  expect((await get(page, '/api/cash')).balance).toBe(beforeBuy.balance - 60);
  expect((await get(page, '/api/cash')).transactions.filter((t: any) => t.type === 'upgrade_purchase' && t.id === `shop_${PLACA_MADEIRA}`)).toHaveLength(1);
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem('novo_hiper_caixa_v1')!).balance)).toBe(beforeBuy.balance - 60);
  await other.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  await expect(other.locator('#cash-register-modal-container').getByText(formatPrice(beforeBuy.balance - 60), { exact: true }).first()).toBeVisible();
  await other.close();
});

test('P01/P02: compra recusada não cobra; resposta perdida depois de gravar recupera confirmação', async ({ page }) => {
  await login(page);
  await earn(page, 150);
  const before = await get(page, '/api/cash');
  await openAdventure(page);
  await teleport(page, WORLD_MAP.utilities.interact.x, WORLD_MAP.utilities.interact.y);
  await page.waitForFunction(() => !!window.__NH_ADVENTURE__?.getState().delivery?.shop.nearUtilities);
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();
  const pattern = `**/api/shop/upgrades/${JARDINEIRAS}/purchase`;
  await page.route(pattern, route => route.fulfill({ status: 503, json: { error: 'Compra indisponível no teste. Tente novamente.' } }));
  await page.locator(`#btn-shop-buy-${JARDINEIRAS}`).click();
  await expect(page.locator('#shop-message')).toContainText('Compra indisponível');
  expect((await get(page, '/api/cash')).balance).toBe(before.balance);
  await page.unroute(pattern);
  await page.route(pattern, async route => { const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort('failed'); });
  await page.locator(`#btn-shop-buy-${JARDINEIRAS}`).click();
  await expect(page.locator('#shop-message')).toContainText('Compra confirmada');
  const shop = await get(page, '/api/shop');
  const price = shop.upgrades.find((u: any) => u.id === JARDINEIRAS).price;
  expect((await get(page, '/api/cash')).balance).toBe(before.balance - price);
  expect(shop.upgrades.find((u: any) => u.id === JARDINEIRAS).state).toBe('pending');
});

test('P06: navegador novo recupera todos os dados e melhorias sem armazenamento anterior', async ({ page, browser }) => {
  await login(page);
  const p = await plant(page, 'Recuperada em novo navegador');
  const order = await createSuiteOrder(page, { plantId: p.id });
  await page.request.post(`/api/shop/upgrades/${PLACA_MADEIRA}/install`);
  const expected = await get(page, '/api/cash');
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await context.newPage();
  await login(other, { filterOrders: false });
  await expect(other.locator(`#btn-view-${p.id}`)).toBeVisible();
  await expect.poll(() => other.getByRole('img', { name: p.name, exact: true }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(192);
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem('novo_hiper_caixa_v1')!).balance)).toBe(expected.balance);
  await expect.poll(() => other.evaluate(() => JSON.parse(localStorage.getItem('novo_hiper_entregas_v1')!).length)).toBe((await get(page, '/api/deliveries')).filter((d: any) => d.status === 'entregue').length);
  await other.locator('#tab-btn-orders').click();
  await expect(other.locator(`#order-card-${order.id}`)).toBeVisible();
  await openAdventure(other);
  await other.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.shop.installedUpgrades.includes('placa_madeira'));
  expect((await state(other)).delivery!.shop.installedUpgrades).toContain(PLACA_MADEIRA);
  await context.close();
});

// A restauração e o reinício em novo processo são executados por scripts/verify-recovery.mjs.
