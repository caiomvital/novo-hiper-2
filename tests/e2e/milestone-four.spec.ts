import { expect, Page, test } from '@playwright/test';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { PLACA_MADEIRA } from '../../src/shared/shop';
import { login, openAdventure, pickUpActiveOrder, state, teleport, holdKeys } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { earn } from './isolatedData';

const get = async (page: Page, path: string) => (await page.request.get(path)).json();
const waitPhase = (page: Page, phase: string) => page.waitForFunction(p => window.__NH_ADVENTURE__?.getState().delivery?.phase === p, phase);
async function fixture(page: Page) {
  await login(page);
  await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('m4'), name: 'Samambaia Marco 4', price: 20, stock_quantity: 5, image_path: '/assets/test.png' } })).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Cliente Marco 4' });
  const cash = await get(page, '/api/cash');
  await openAdventure(page);
  await pickUpActiveOrder(page);
  await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 20);
  await page.waitForFunction(() => !!window.__NH_ADVENTURE__?.getState().delivery?.promptVisible);
  return { plant, order, cash };
}
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

test('caixa vazio explica a primeira venda e dinheiro fictício', async ({ page }) => {
  await login(page);
  await page.route('**/api/cash', route => route.fulfill({ json: { balance: 0, totalSales: 0, transactions: [] } }));
  await page.reload();
  await page.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  const modal = page.locator('#cash-register-modal-container');
  await expect(modal).toContainText('Nenhuma venda registrada ainda');
  await expect(modal).toContainText('Pegue a planta na Novo Hiper');
  await expect(modal).toContainText('sem cobrança real');
});

test('resposta lenta: confirmação única, preço congelado e resultado em todas as telas', async ({ page }) => {
  const { plant, order, cash } = await fixture(page);
  await page.request.put(`/api/plants/${plant.id}`, { data: { name: plant.name, price: 99, stock_quantity: 5 } });
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let finishes = 0;
  await page.route(/\/api\/deliveries\/[^/]+\/finish$/, async route => {
    finishes++;
    await gate;
    await route.continue();
  });
  await page.keyboard.press('KeyE');
  await waitPhase(page, 'delivering');
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(5);
  expect((await get(page, '/api/cash')).balance).toBe(cash.balance);
  expect(finishes).toBe(1);
  release();
  await waitPhase(page, 'done');
  expect((await state(page)).delivery!.lastReward).toBe(20);
  expect((await state(page)).delivery!.hud).toContain('concluída');
  expect((await state(page)).delivery!.feedbackLine).toBeTruthy();
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(4);
  const after = await get(page, '/api/cash');
  expect(after.balance).toBe(cash.balance + 20);
  expect(after.totalSales).toBe(cash.totalSales + 20);
  expect(after.transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
  const delivery = (await get(page, '/api/deliveries')).find((d: any) => d.order_id === order.id);
  expect(delivery.status).toBe('entregue');
  await page.request.post(`/api/deliveries/${delivery.id}/finish`);
  expect((await get(page, '/api/cash')).balance).toBe(after.balance);
  await page.locator('#tab-btn-catalog').click();
  await expect(page.getByText(plant.name, { exact: true }).first()).toBeVisible();
  await page.locator('#tab-btn-orders').click();
  await expect(page.locator(`#order-card-${order.id}`)).toContainText('Entregue');
  await page.locator('#tab-btn-deliveries').click();
  await expect(page.getByText('Cliente Marco 4', { exact: false }).first()).toBeVisible();
  await page.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  const modal = page.locator('#cash-register-modal-container');
  await expect(modal).toContainText('1 × Samambaia Marco 4');
  await expect(modal).toContainText('Cliente Marco 4');
  await expect(modal).toContainText('Destino:');
  await expect(modal).toContainText('20,00');
  await page.setViewportSize({ width: 720, height: 800 });
  await modal.screenshot({ path: 'docs/evidence/milestone-four/venda-confirmada.png' });
  await page.reload();
  await expect(page.locator('#tab-btn-adventure')).toBeVisible();
  expect((await get(page, '/api/cash')).balance).toBe(after.balance);
  await page.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  await expect(modal).toContainText('1 × Samambaia Marco 4');
});

test('conexão interrompida antes de gravar: pedido e vaso preservados, retry vende uma vez', async ({ page }) => {
  const { plant, order, cash } = await fixture(page);
  await page.route(/\/api\/deliveries\/[^/]+\/finish$/, route => route.abort('failed'));
  await page.keyboard.press('KeyE');
  await waitPhase(page, 'error');
  expect((await state(page)).delivery!.hud).toContain('conexão');
  expect((await get(page, `/api/orders/${order.id}`)).status).toBe('pronto');
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(5);
  expect((await get(page, '/api/cash')).balance).toBe(cash.balance);
  await page.unroute(/\/api\/deliveries\/[^/]+\/finish$/);
  await waitPhase(page, 'idle');
  await page.keyboard.press('KeyE');
  await waitPhase(page, 'done');
  expect((await get(page, '/api/cash')).balance).toBe(cash.balance + 20);
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(4);
});

test('resposta perdida depois de gravar: recupera confirmação sem segunda venda', async ({ page }) => {
  const { plant, order, cash } = await fixture(page);
  let finishes = 0;
  await page.route(/\/api\/deliveries\/[^/]+\/finish$/, async route => {
    finishes++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort('failed');
  });
  await page.keyboard.press('KeyE');
  await waitPhase(page, 'done');
  expect((await state(page)).delivery!.lastReward).toBe(20);
  expect(finishes).toBe(1);
  expect((await get(page, `/api/plants/${plant.id}`)).stock_quantity).toBe(4);
  expect((await get(page, '/api/cash')).balance).toBe(cash.balance + 20);
  expect((await get(page, '/api/cash')).transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
  await page.locator('#tab-btn-catalog').click();
  await page.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  await expect(page.locator('#cash-register-modal-container')).toContainText('1 × Samambaia Marco 4');
});

test('caixa separa compra de vendas e recupera o saldo em nova sessão', async ({ page, browser }) => {
  await login(page);
  await closeSuiteOrders(page);
  await earn(page, 100);
  const before = await get(page, '/api/cash');
  const saleCount = before.transactions.filter((t: any) => t.type === 'credit').length;
  expect((await page.request.post(`/api/shop/upgrades/${PLACA_MADEIRA}/purchase`)).ok()).toBe(true);
  const after = await get(page, '/api/cash');
  expect(after.balance).toBe(before.balance - 60);
  expect(after.totalSales).toBe(before.totalSales);
  await page.reload();
  await page.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  const modal = page.locator('#cash-register-modal-container');
  await expect(modal).toContainText(new RegExp(`Entregas\\s*${saleCount}\\s*Venda${saleCount === 1 ? '' : 's'} realizada${saleCount === 1 ? '' : 's'}`));
  await expect(modal).not.toContainText('Compra:');
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const other = await context.newPage();
  await login(other);
  await other.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().click();
  await expect(other.locator('#cash-register-modal-container')).toContainText(new RegExp(`Entregas\\s*${saleCount}\\s*Venda${saleCount === 1 ? '' : 's'} realizada${saleCount === 1 ? '' : 's'}`));
  expect((await get(other, '/api/cash')).balance).toBe(after.balance);
  await other.locator('#btn-close-cash-register').click();
  await other.locator('#btn-logout-mobile:visible, #btn-logout-desktop:visible').first().click();
  await expect(other.getByPlaceholder(/Nome do lojista/)).toBeVisible();
  await login(other);
  expect((await get(other, '/api/cash')).balance).toBe(after.balance);
  await context.close();
});

test.describe('toque e colisões restantes', () => {
  test.use({ hasTouch: true });
  test('toque solta movimento; casa e árvore impedem atravessar; resize preserva estado', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    await openAdventure(page);
    const before = await state(page);
    const button = page.getByRole('button', { name: 'Andar para a direita' });
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForTimeout(500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    const stopped = (await state(page)).player!;
    expect(stopped.x).toBeGreaterThan(before.player!.x + 20);
    await page.waitForTimeout(300);
    expect((await state(page)).player!.x).toBeCloseTo(stopped.x, 0);
    for (const solid of [WORLD_MAP.houses[0].rect, WORLD_MAP.solids.find(r => r.x === WORLD_MAP.plaza.trees[0].x - 18)!]) {
      expect(solid).toBeTruthy();
      await teleport(page, solid.x - 60, solid.y + solid.h / 2);
      await holdKeys(page, ['ArrowRight'], 1400);
      expect((await state(page)).player!.x).toBeLessThanOrEqual(solid.x - 15);
    }
    await page.keyboard.down('KeyD');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const s = await state(page);
    await page.keyboard.up('KeyD');
    await page.setViewportSize({ width: 600, height: 440 });
    await page.waitForTimeout(500);
    const resized = await state(page);
    expect(resized.instance).toBe(s.instance);
    expect(resized.player!.x).toBeCloseTo(s.player!.x, 0);
    expect(resized.delivery!.activeOrderId).toBe(s.delivery!.activeOrderId);
    await page.locator('#adventure-root').screenshot({ path: 'docs/evidence/milestone-four/bairro-validado.png' });
  });
});
