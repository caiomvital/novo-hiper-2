import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { login, openAdventure, enterStore, leaveStore, teleport, state } from './helpers';
import { createSuiteOrder } from './suiteData';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { PREP_BENCH, COUNTER } from '../../src/phaser-game/config/interiorMap';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
test.use({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
const photo = fs.readFileSync('public/pwa-192x192.png');
const interact = async (page: any) => { const button = page.getByRole('button', { name: 'Interagir', exact: true }); await button.dispatchEvent('touchstart'); await page.waitForTimeout(150); await button.dispatchEvent('touchend'); };

test('celular: cadastro, pedido, venda por toque, caixa e instalação de melhoria', async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(30_000);
  await login(page);
  await page.locator('#btn-start-catalog').tap();
  await expect(page.getByRole('dialog', { name: 'Cadastro de planta' })).toBeVisible();
  await page.locator('#input-gallery-photo').setInputFiles({ name: 'planta.png', mimeType: 'image/png', buffer: photo });
  await expect(page.locator('#btn-save-plant')).toBeEnabled();
  await page.locator('#input-plant-name').fill('Planta do celular');
  await page.locator('#input-plant-price').fill('60');
  await page.locator('#input-plant-stock').fill('5');
  expect(await page.locator('#input-plant-price').getAttribute('inputmode')).toBe('decimal');
  await page.locator('#btn-save-plant').tap();
  await expect(page.locator('#plant-form-container')).toHaveCount(0);
  const plant = (await (await page.request.get('/api/plants')).json()).find((p: any) => p.name === 'Planta do celular');
  const order = await createSuiteOrder(page, { plantId: plant.id });
  await page.reload(); await page.locator('#tab-btn-orders').tap();
  const card = page.locator(`#order-card-${order.id}`);
  await card.getByRole('button', { name: 'Preparar Planta', exact: true }).tap();
  await openAdventure(page);
  await page.locator('#btn-adventure-fullscreen').tap();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await enterStore(page); await teleport(page, PREP_BENCH.interact.x, PREP_BENCH.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.interior?.canPickup);
  await interact(page); await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.interior?.carrying);
  await leaveStore(page); await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 20);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.near);
  await interact(page); await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'done');
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(4);
  expect((await (await page.request.get('/api/cash')).json()).balance).toBe(60);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'idle');
  await teleport(page, WORLD_MAP.utilities.interact.x, WORLD_MAP.utilities.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.shop.nearUtilities);
  await interact(page); await page.locator('#btn-shop-buy-placa_madeira').tap();
  await expect(page.locator('#shop-state-placa_madeira')).toContainText('Comprada');
  await page.locator('#btn-shop-close').tap();
  await enterStore(page); await teleport(page, COUNTER.interact.x, COUNTER.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.shop.nearShop);
  await interact(page); await page.locator('#btn-shop-install-placa_madeira').tap();
  await expect(page.locator('#shop-panel')).toHaveCount(0); await leaveStore(page);
  expect((await state(page)).delivery?.shop.installedUpgrades).toContain('placa_madeira');
  await page.screenshot({ path: 'docs/evidence/milestone-nine/jornada-toque.png' });
  await page.reload(); await page.locator('#btn-open-cash-mobile').tap();
  await expect(page.locator('#cash-register-modal-container')).toContainText('60,00');
  await page.keyboard.press('Escape');
  await page.locator('#btn-toggle-sound-mobile').tap();
  const preference = await page.evaluate(() => localStorage.getItem('novo_hiper_muted'));
  await page.reload(); expect(await page.evaluate(() => localStorage.getItem('novo_hiper_muted'))).toBe(preference);
  for (const width of [320, 390, 640]) { await page.setViewportSize({ width, height: 640 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); }
});

test('formulário em espaço reduzido: erro, salvar, fechar e foco; instalação indisponível não aparece', async ({ page }) => {
  await login(page); await page.getByRole('button', { name: 'Cadastrar planta', exact: true }).tap();
  await page.locator('#input-gallery-photo').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: photo });
  await expect(page.locator('#btn-save-plant')).toBeEnabled();
  await page.setViewportSize({ width: 360, height: 360 });
  await page.locator('#input-plant-name').fill('Teste de teclado'); await page.locator('#input-plant-price').fill('abc');
  await page.locator('#btn-save-plant').tap();
  await expect(page.getByRole('alert')).toBeInViewport();
  const close = page.locator('#btn-close-form'); const box = (await close.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape'); await expect(page.locator('#plant-form-container')).toHaveCount(0);
  await expect(page.locator('#btn-pwa-install:visible')).toHaveCount(0);
});

test('instalação: cancelamento consome o convite em ambas as barras; sons não duplicam ao abrir aba', async ({ page }) => {
  await login(page);
  await page.evaluate(async (modulePath) => {
    const sounds = (await import(modulePath)).sounds;
    const original = sounds.playPlim.bind(sounds);
    (window as any).__plims = 0;
    sounds.playPlim = () => { (window as any).__plims++; original(); };
  }, '/src/services/sound.ts');
  await page.locator('#tab-btn-orders').tap();
  expect(await page.evaluate(() => (window as any).__plims)).toBe(1);
  await page.evaluate(() => {
    (window as any).__installCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { (window as any).__installCalls++; }, userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }) });
    window.dispatchEvent(event);
  });
  await page.locator('#btn-pwa-install:visible').tap();
  await expect(page.locator('#btn-pwa-install:visible')).toHaveCount(0);
  await page.setViewportSize({ width: 800, height: 640 });
  await expect(page.locator('#btn-pwa-install:visible')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__installCalls)).toBe(1);
});
