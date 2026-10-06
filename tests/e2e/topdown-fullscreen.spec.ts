import { expect, test } from '@playwright/test';
import { login, openAdventure, state, holdKeys } from './helpers';

const sprite = async (page: import('@playwright/test').Page) => (await state(page)).sprite!;
const waitAnim = (page: import('@playwright/test').Page, anim: string) =>
  page.waitForFunction((a) => window.__NH_ADVENTURE__?.getState().sprite?.anim === a, anim, { timeout: 20_000 });

test.describe('Bernardo top-down no WorldScene', () => {
  test('anda nas 4 direções com a animação correspondente e volta ao idle da última direção', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    let s = await sprite(page);
    expect(s.texture).toBe('bernardo-topdown');
    expect(s.anim).toBe('idle-down');

    const cases: Array<[string[], string, string]> = [
      [['ArrowRight'], 'walk-right', 'idle-right'],
      [['ArrowLeft'], 'walk-left', 'idle-left'],
      [['ArrowDown'], 'walk-down', 'idle-down'],
      [['ArrowUp'], 'walk-up', 'idle-up'],
      [['KeyD'], 'walk-right', 'idle-right'],
      [['KeyA'], 'walk-left', 'idle-left'],
      [['KeyS'], 'walk-down', 'idle-down'],
      [['KeyW'], 'walk-up', 'idle-up'],
    ];
    for (const [keys, walk, idle] of cases) {
      for (const k of keys) await page.keyboard.down(k);
      await waitAnim(page, walk);
      expect((await sprite(page)).animPlaying).toBe(true);
      for (const k of keys) await page.keyboard.up(k);
      await waitAnim(page, idle); // parou: idle da MESMA direção
    }
  });

  test('diagonal usa a direção horizontal; parar mantém a última direção', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    await page.keyboard.down('ArrowUp');
    await page.keyboard.down('ArrowLeft');
    await waitAnim(page, 'walk-left');
    await page.keyboard.up('ArrowLeft');
    await waitAnim(page, 'walk-up'); // sobrou só "cima"
    await page.keyboard.up('ArrowUp');
    await waitAnim(page, 'idle-up');
  });

  test('o collider continua 32x44 centrado na posição (o sprite é maior que o body) e a escala é 1', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    const st = await state(page);
    const sp = st.sprite!;
    expect(sp.scale).toBe(1);
    expect(sp.body.width).toBe(32);
    expect(sp.body.height).toBe(44);
    expect(sp.body.x + sp.body.width / 2).toBeCloseTo(st.player!.x, 0);
    expect(sp.body.y + sp.body.height / 2).toBeCloseTo(st.player!.y, 0);
  });

  test('o movimento top-down continua o mesmo: as 4 direções movem Bernardo (velocidade inalterada)', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    for (const [key, axis, sign] of [['ArrowRight', 'x', 1], ['ArrowDown', 'y', 1], ['ArrowLeft', 'x', -1], ['ArrowUp', 'y', -1]] as const) {
      const before = (await state(page)).player!;
      await holdKeys(page, [key], 450);
      const after = (await state(page)).player!;
      expect((after[axis] - before[axis]) * sign).toBeGreaterThan(30);
    }
  });
});

test.describe('fullscreen no PC', () => {
  test('o botão põe o container inteiro em tela cheia sem recriar Game nem cena, sem mudar posição, mundo ou pedido', async ({ page }) => {
    await login(page);
    // pedido real aberto para provar que o pedido ativo não se perde
    const plant = await (await page.request.post('/api/plants', { data: { id: `plant_fs_${Date.now()}`, name: 'Planta FS', price: 10, stock_quantity: 3, image_path: '/a.jpg' } })).json();
    const order = await (await page.request.post('/api/orders', { data: { id: `ord_fs_${Date.now()}`, customer_name: 'Cliente FS', destination_id: 'd', items: [{ plant_id: plant.id, quantity: 1 }] } })).json();
    await openAdventure(page);
    await page.waitForFunction(`window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId`);
    const activeBefore = (await state(page)).delivery!.activeOrderId;
    await holdKeys(page, ['ArrowRight', 'ArrowDown'], 500); // posição qualquer, parado depois
    await page.waitForTimeout(400);

    const before = await state(page);
    const games = await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames());
    const canvasBefore = await page.locator('canvas').evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight }));

    const button = page.locator('#btn-adventure-fullscreen');
    await expect(button).toBeVisible();
    await button.click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'adventure-root', null, { timeout: 15_000 });
    await page.waitForTimeout(800);

    const inFs = await state(page);
    expect(await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames())).toBe(games); // mesmo Phaser.Game
    expect(inFs.instance).toBe(before.instance); // mesma cena (não reiniciou)
    expect(inFs.scene).toBe('world');
    expect(inFs.canvasCount).toBe(1);
    // coordenadas do mundo e limites inalterados; só o viewport muda
    expect(inFs.camera!.world).toEqual(before.camera!.world);
    expect(inFs.camera!.bounds).toEqual(before.camera!.bounds);
    expect(inFs.camera!.zoom).toBe(before.camera!.zoom);
    expect(Math.abs(inFs.player!.x - before.player!.x)).toBeLessThan(1);
    expect(Math.abs(inFs.player!.y - before.player!.y)).toBeLessThan(1);
    expect(inFs.delivery!.activeOrderId).toBe(activeBefore);
    expect(inFs.delivery!.activeOrderId).toBe(order.id);
    // o canvas acompanhou o container (redimensionou) sem esticar o sprite (escala 1 e body 32x44)
    const canvasFs = await page.locator('canvas').evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight }));
    const root = await page.locator('#adventure-root').evaluate((r) => ({ w: r.clientWidth, h: r.clientHeight }));
    expect(canvasFs.h).toBeGreaterThan(canvasBefore.h);
    expect(root.w).toBe(await page.evaluate(() => window.innerWidth));
    expect(root.h).toBe(await page.evaluate(() => window.innerHeight));
    expect(inFs.camera!.width).toBe(canvasFs.w);
    expect(inFs.camera!.height).toBe(canvasFs.h);
    expect(inFs.sprite!.scale).toBe(1);
    expect(inFs.sprite!.body.width).toBe(32);

    // HUD continua dentro do container em tela cheia, e o jogo continua jogável
    expect((await state(page)).delivery!.hud).toContain('Cliente FS');
    const p0 = (await state(page)).player!;
    await holdKeys(page, ['ArrowLeft'], 400);
    expect((await state(page)).player!.x).toBeLessThan(p0.x - 20);

    // sair (equivalente ao Esc nativo): volta ao tamanho original, mesma cena/jogo/posição/pedido
    const p1 = (await state(page)).player!;
    await page.evaluate(() => document.exitFullscreen());
    await page.waitForFunction(() => document.fullscreenElement === null, null, { timeout: 15_000 });
    await page.waitForTimeout(800);
    const out = await state(page);
    expect(out.instance).toBe(before.instance);
    expect(await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames())).toBe(games);
    expect(Math.abs(out.player!.x - p1.x)).toBeLessThan(1);
    expect(out.camera!.world).toEqual(before.camera!.world);
    expect(out.delivery!.activeOrderId).toBe(order.id);
    const canvasOut = await page.locator('canvas').evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight }));
    expect(canvasOut).toEqual(canvasBefore);

    // limpeza: fecha o pedido pelo fluxo oficial
    const d = await page.request.post('/api/deliveries/start', { data: { order_id: order.id } });
    if (d.ok()) await page.request.post(`/api/deliveries/${(await d.json()).id}/finish`);
  });

  test('sem Fullscreen API o botão não aparece', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true });
      Object.defineProperty(document, 'webkitFullscreenEnabled', { value: false, configurable: true });
    });
    await login(page);
    await openAdventure(page);
    await expect(page.locator('#btn-adventure-fullscreen')).toHaveCount(0);
  });

  test('não entra em tela cheia sozinho', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    expect(await page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  });
});
