import { expect, test } from '@playwright/test';
import { login, openAdventure, state, teleport, enterStore, leaveStore } from './helpers';
import { earn } from './isolatedData';
import { createSuiteOrder, suiteId } from './suiteData';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { COUNTER } from '../../src/phaser-game/config/interiorMap';
import { DESTINATION_IDS } from '../../src/shared/destinations';
test.use({ hasTouch: true });

test('instalação pelo controle de toque atualiza o bairro; obra avança e a barreira permanece fechada', async ({ page }) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  await page.setViewportSize({ width: 640, height: 480 });
  await login(page);
  for (let i = 0; i < 3; i++) await earn(page, 100);
  await openAdventure(page);
  const stage = async (neighbors: number, obra: string) => page.waitForFunction(
    ([n, o]) => { const s = window.__NH_ADVENTURE__?.getState().delivery?.worldStage; return s?.environmentalNeighbors === n && s?.obraLeste === o; },
    [neighbors, obra] as const, { timeout: 30_000 }
  );
  await stage(0, 'parada');
  await teleport(page, WORLD_MAP.utilities.interact.x, WORLD_MAP.utilities.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.shop.nearUtilities, null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Interagir', exact: true }).dispatchEvent('touchstart');
  await page.waitForTimeout(180);
  await page.getByRole('button', { name: 'Interagir', exact: true }).dispatchEvent('touchend');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-panel')).toContainText('Instale a melhoria no balcão');
  await page.locator('#btn-shop-buy-placa_madeira').click();
  await expect(page.locator('#shop-message')).toContainText('entre e instale no balcão');
  await stage(0, 'parada'); // comprar não transforma o bairro
  await page.locator('#btn-shop-close').click();
  await enterStore(page);
  await teleport(page, COUNTER.interact.x, COUNTER.interact.y);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.shop.nearShop, null, { timeout: 30_000 });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await page.locator('#btn-shop-install-placa_madeira').click();
  await expect(page.locator('#shop-panel')).toHaveCount(0);
  await leaveStore(page);
  await stage(2, 'parada'); // três entregas + primeira instalação
  await teleport(page, WORLD_MAP.shop.door.x, WORLD_MAP.shop.door.y + 120);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'docs/evidence/milestone-six/vizinhos.png' });

  await earn(page, 100); await earn(page, 100); await earn(page, 100);
  expect((await page.request.post('/api/shop/upgrades/jardineiras/purchase')).ok()).toBe(true);
  expect((await page.request.post('/api/shop/upgrades/jardineiras/install')).ok()).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await stage(3, 'ativa');
  const gate = WORLD_MAP.gates.find(g => g.id === 'obras_leste')!.rect;
  await teleport(page, gate.x - 50, gate.y + gate.h / 2);
  await page.screenshot({ path: 'docs/evidence/milestone-six/obra-ativa.png' });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  expect((await state(page)).player!.x).toBeLessThan(gate.x);

  const created = await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Jardim do bairro', price: 20, stock_quantity: 10, image_path: '/uploads/plants/teste.jpg' } });
  expect(created.status()).toBe(201);
  const plant = await created.json();
  for (let i = 0; i < 4; i++) {
    const order = await createSuiteOrder(page, { plantId: plant.id, destination: DESTINATION_IDS[i] });
    const d = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
    expect((await page.request.post(`/api/deliveries/${d.id}/finish`)).ok()).toBe(true);
  }
  expect((await page.request.post('/api/shop/upgrades/banco/purchase')).ok()).toBe(true);
  expect((await page.request.post('/api/shop/upgrades/banco/install')).ok()).toBe(true);
  const before = await (await page.request.get('/api/progress')).json();
  expect(before.milestones.bairro_vivo.achieved).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await stage(3, 'quase_pronta');
  await page.screenshot({ path: 'docs/evidence/milestone-six/obra-quase-pronta.png' });
  expect((await page.request.delete(`/api/plants/${plant.id}`)).ok()).toBe(true);
  await page.reload(); await openAdventure(page);
  await stage(3, 'quase_pronta');
  const after = await (await page.request.get('/api/progress')).json();
  expect(after.milestones).toEqual(before.milestones);
  await teleport(page, gate.x - 50, gate.y + gate.h / 2);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  expect((await state(page)).player!.x).toBeLessThan(gate.x);
});
