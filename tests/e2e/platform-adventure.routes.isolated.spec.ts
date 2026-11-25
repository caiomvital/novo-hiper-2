import { expect, test } from '@playwright/test';
import { login, openAdventure, state, teleport, waitForScene, runToGoal } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { PLATFORM } from '../../src/phaser-game/config/platformConfig';
import { ENTRANCE_ZONE } from '../../src/phaser-game/config/worldConfig';

test.use({ hasTouch: true, viewport: { width: 480, height: 700 } });
test('horizontal, zoom, caminho alto, carrinho e entrega preservam a partida', async ({ page }) => {
  test.setTimeout(240_000);
  page.on('pageerror', error => console.error('game error:', error.message));
  await page.addInitScript(() => {
    (window as any).__orientation = { locks: 0, unlocks: 0 };
    Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async () => { (window as any).__orientation.locks++; await new Promise(resolve => setTimeout(resolve, 50)); } });
    Object.defineProperty(screen.orientation, 'unlock', { configurable: true, value: () => { (window as any).__orientation.unlocks++; } });
  });
  await login(page); await closeSuiteOrders(page);
  const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('adventure'), name: 'Planta da aventura', price: 50, stock_quantity: 5, image_path: '/pwa-192x192.png' } })).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, destination: 'bairro1/house_007' });
  expect((await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).ok()).toBe(true);
  const cash = await (await page.request.get('/api/cash')).json();
  await openAdventure(page);
  await page.waitForFunction(id => window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId === id, order.id);
  await page.locator('#btn-start-delivery-route').click(); await waitForScene(page, 'platform');
  await page.waitForFunction(() => Math.abs((window.__NH_ADVENTURE__?.getState().player?.y ?? 0) - 598) < 2);
  const before = await state(page), games = await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames());
  await expect(page.locator('#platform-rotate-hint')).toBeVisible();
  await page.locator('#btn-platform-zoom-out').click();
  await expect.poll(async () => (await state(page)).platform?.zoom).toBe(1);
  await page.locator('#btn-platform-zoom-out').click();
  await expect.poll(async () => (await state(page)).platform?.zoom).toBe(.75);
  await expect(page.locator('#btn-platform-zoom-out')).toBeDisabled();
  expect((await state(page)).platform?.visit).toBe(before.platform?.visit);
  expect((await state(page)).player!.x).toBeCloseTo(before.player!.x, 0);
  expect((await state(page)).sprite!.body.width).toBe(before.sprite!.body.width);
  await page.locator('#btn-platform-landscape').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'adventure-root');
  await expect.poll(() => page.evaluate(() => (window as any).__orientation.locks)).toBe(1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#platform-rotate-hint')).toBeHidden();
  for (const name of ['Andar para a esquerda', 'Andar para a direita', 'Pular', 'Diminuir zoom', 'Restaurar zoom', 'Aumentar zoom']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 1 });
  expect((await state(page)).platform?.visit).toBe(before.platform?.visit);
  expect(await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames())).toBe(games);
  await page.locator('#btn-platform-zoom-reset').click();
  await expect.poll(async () => (await state(page)).platform?.zoom).toBe(1.5);
  console.log('horizontal e zoom: ok');
  const ledges = (await state(page)).platform!.ledges!;
  // Sobe as duas plataformas com saltos reais; a flor alta é opcional.
  await teleport(page, ledges[0].x + 30, PLATFORM.groundY - 22);
  async function jumpOnto(x: number, y: number) {
    const landed = await page.evaluate(([targetX, targetY]) => new Promise<boolean>(resolve => {
      const fire = (type: 'keydown' | 'keyup', code: string) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
      let jumped = false, released = false;
      const start = performance.now();
      const tick = () => {
        const s = window.__NH_ADVENTURE__!.getState();
        if (performance.now() - start > 25000) { fire('keyup', 'Space'); fire('keyup', 'ArrowRight'); resolve(false); return; }
        if (!jumped && s.platform?.grounded) { fire('keydown', 'Space'); jumped = true; }
        if (jumped && !s.platform?.grounded && !released) { fire('keyup', 'Space'); released = true; }
        fire(s.player!.x < targetX - 2 ? 'keydown' : 'keyup', 'ArrowRight');
        if (released && s.platform?.grounded && Math.abs(s.player!.y - (targetY - 22)) < 3) {
          fire('keyup', 'ArrowRight'); resolve(true); return;
        }
        requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    }), [x, y]);
    expect(landed).toBe(true);
  }
  await jumpOnto(ledges[0].x + 30, ledges[0].y);
  await jumpOnto(ledges[1].x + 55, ledges[1].y);
  await page.waitForFunction(() => (window.__NH_ADVENTURE__?.getState().platform?.flowers ?? 0) >= 1);
  await page.screenshot({ path: 'docs/evidence/platform-adventure/caminho-alto-horizontal.png' });
  console.log('caminho alto e flor: ok');
  const cp = (await state(page)).platform!.checkpoints![1];
  await teleport(page, cp.x, cp.y - 22);
  await page.waitForFunction(x => window.__NH_ADVENTURE__?.getState().platform?.checkpoint?.x === x, cp.x);
  const cart = (await state(page)).platform!.cart!;
  await page.waitForFunction(x => Math.abs((window.__NH_ADVENTURE__?.getState().platform?.cart?.x ?? x) - x) > 8, cart.x);
  const movingCart = (await state(page)).platform!.cart!;
  await teleport(page, movingCart.x, PLATFORM.groundY - 22);
  await page.waitForFunction(() => (window.__NH_ADVENTURE__?.getState().platform?.obstacleHits ?? 0) === 1);
  expect((await state(page)).player!.x).toBeCloseTo(cp.x, 0);
  expect((await (await page.request.get('/api/cash')).json()).balance).toBe(cash.balance);
  await teleport(page, 120, PLATFORM.groundY - 22);
  console.log('carrinho e ponto seguro: ok');
  await runToGoal(page, 90_000);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
  await page.setViewportSize({ width: 480, height: 700 });
  await page.locator('#btn-platform-zoom-out').click();
  await page.keyboard.press('Enter'); await waitForScene(page, 'world');
  await expect.poll(() => page.evaluate(() => (window as any).__orientation.unlocks)).toBeGreaterThan(0);
  expect((await state(page)).delivery?.activeOrderId).toBe(order.id);
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(5);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.near);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().delivery?.phase === 'done');
  const after = await (await page.request.get('/api/cash')).json();
  expect(after.balance).toBe(cash.balance + 50);
  expect(after.transactions.filter((t: any) => t.order_id === order.id)).toHaveLength(1);
  await teleport(page, ENTRANCE_ZONE.x, ENTRANCE_ZONE.y); await waitForScene(page, 'platform');
  expect((await state(page)).platform?.flowers).toBe(0);
  expect((await state(page)).platform?.zoom).toBe(1);
  await page.locator('#btn-platform-exit').click(); await waitForScene(page, 'world');
});

test('rotação manual funciona quando o navegador recusa fullscreen e orientação', async ({ page }) => {
  test.setTimeout(100_000);
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = async () => { throw new Error('Fullscreen indisponível no teste'); };
    Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async () => { throw new Error('Orientação indisponível no teste'); } });
  });
  await login(page); await openAdventure(page);
  await teleport(page, ENTRANCE_ZONE.x, ENTRANCE_ZONE.y); await waitForScene(page, 'platform');
  const visit = (await state(page)).platform?.visit;
  await page.locator('#btn-platform-landscape').click();
  await expect(page.locator('#platform-rotate-hint')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#platform-rotate-hint')).toBeHidden();
  expect((await state(page)).platform?.visit).toBe(visit);
  await page.locator('#btn-platform-zoom-out').click();
  await expect.poll(async () => (await state(page)).platform?.zoom).toBe(1);
  await page.locator('#btn-platform-exit').click(); await waitForScene(page, 'world');
});
