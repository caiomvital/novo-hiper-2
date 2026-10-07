import { expect, test } from '@playwright/test';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { PIXELS_PER_METER, PLAYABLE_RECT, WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { NEAR_DESTINATION_PX } from '../../src/phaser-game/logic/destination';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { holdKeys, login, openAdventure, state, teleport } from './helpers';

const waitDelivery = (page: import('@playwright/test').Page, pred: string, timeout = 30_000) =>
  page.waitForFunction(`(() => { const d = window.__NH_ADVENTURE__?.getState().delivery; return Boolean(d && (${pred})); })()`, null, { timeout });

// não deixa pedido aberto da suíte no DEV (o teste manual não deve vê-lo); só toca em ids da suíte
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

test.describe('o bairro (3200x2400) em viewport pequeno (celular)', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('o mundo é maior que a tela; a câmera segue Bernardo e respeita os limites do mundo', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    const s0 = await state(page);
    expect(s0.camera!.world).toEqual({ width: PLAYABLE_RECT.w, height: PLAYABLE_RECT.h }); // física = área jogável
    expect(s0.camera!.bounds).toEqual({ x: 0, y: 0, width: WORLD_MAP.width, height: WORLD_MAP.height }); // câmera = mundo inteiro
    expect(s0.camera!.width).toBeLessThan(WORLD_MAP.width / 5); // o viewport é independente (e bem menor) que o mundo
    expect(s0.player).toMatchObject({ x: WORLD_MAP.spawn.x });

    for (const [x, y] of [[200, 200], [3000, 200], [3000, 2200], [200, 2200], [1600, 1200]] as const) {
      await teleport(page, x, y);
      // a câmera "persegue" Bernardo (lerp): espera ela alcançá-lo
      await page.waitForFunction(() => {
        const st = window.__NH_ADVENTURE__?.getState();
        const c = st?.camera;
        const p = st?.player;
        return Boolean(c && p && p.x >= c.scrollX && p.x <= c.scrollX + c.width && p.y >= c.scrollY && p.y <= c.scrollY + c.height);
      }, null, { timeout: 30_000 });
      const s = await state(page);
      const cam = s.camera!;
      expect(cam.scrollX).toBeGreaterThanOrEqual(-1);
      expect(cam.scrollY).toBeGreaterThanOrEqual(-1);
      expect(cam.scrollX + cam.width).toBeLessThanOrEqual(WORLD_MAP.width + 1);
      expect(cam.scrollY + cam.height).toBeLessThanOrEqual(WORLD_MAP.height + 1);
      // Bernardo está dentro da janela visível da câmera
      expect(s.player!.x).toBeGreaterThanOrEqual(cam.scrollX);
      expect(s.player!.x).toBeLessThanOrEqual(cam.scrollX + cam.width);
      expect(s.player!.y).toBeGreaterThanOrEqual(cam.scrollY);
      expect(s.player!.y).toBeLessThanOrEqual(cam.scrollY + cam.height);
    }
  });

  test('colisões: Novo Hiper, fonte e margem externa barram Bernardo', async ({ page }) => {
    await login(page);
    await openAdventure(page);

    // Novo Hiper: andando para cima a partir da calçada, para na parede (base do prédio em y=1000; corpo 44 de altura)
    await holdKeys(page, ['ArrowUp'], 3500);
    let p = (await state(page)).player!;
    expect(p.y).toBeGreaterThanOrEqual(1000 + 22 - 1);
    expect(p.y).toBeLessThan(WORLD_MAP.spawn.y); // andou, mas parou antes de entrar
    // contra a parede ele continua parado (não atravessa mesmo segurando a tecla)
    await holdKeys(page, ['ArrowUp'], 1200);
    expect((await state(page)).player!.y).toBeGreaterThanOrEqual(1000 + 22 - 1);

    // fonte da praça (x=1768): subindo pela rua do sul da praça, para antes de atravessá-la
    await teleport(page, WORLD_MAP.plaza.fountain.x, 1060);
    await page.waitForTimeout(500);
    await holdKeys(page, ['ArrowUp'], 3000);
    p = (await state(page)).player!;
    expect(p.y).toBeGreaterThanOrEqual(WORLD_MAP.plaza.fountain.y + WORLD_MAP.plaza.fountain.r + 22 - 1);

    // margem externa: não caminhável (limite da área jogável)
    await teleport(page, 240, 1200);
    await page.waitForTimeout(500);
    await holdKeys(page, ['ArrowLeft'], 1500);
    expect((await state(page)).player!.x).toBeGreaterThanOrEqual(PLAYABLE_RECT.x + 16 - 1);
    await teleport(page, 2960, 1060); // junto à barreira "EM OBRAS" do leste (x=2990)
    await page.waitForTimeout(500);
    await holdKeys(page, ['ArrowDown'], 300);
    await holdKeys(page, ['ArrowRight'], 2000);
    expect((await state(page)).player!.x).toBeLessThanOrEqual(PLAYABLE_RECT.x + PLAYABLE_RECT.w - 16 + 1);
  });

  test('a barreira "EM OBRAS" da avenida fecha a saída leste', async ({ page }) => {
    await login(page);
    await openAdventure(page);
    await teleport(page, 2900, 1200);
    await page.waitForTimeout(500);
    await holdKeys(page, ['ArrowRight'], 2500);
    const gate = WORLD_MAP.gates.find((g) => g.id === 'obras_leste')!.rect;
    expect((await state(page)).player!.x).toBeLessThanOrEqual(gate.x - 16 + 1);
  });
});

test.describe('indicador de destino (direção e distância)', () => {
  test('aponta para o destino real e mostra a distância em metros; perto muda para "Destino próximo"', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await (await page.request.post('/api/plants', { data: { id: suiteId('plant_ind'), name: 'Planta Ind', price: 10, stock_quantity: 3, image_path: '/a.jpg' } })).json();
    const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Seu João IND' });
    // abre sem outros pedidos abertos mais antigos competindo: o teste confere qual é o ativo
    await openAdventure(page);
    await page.waitForFunction(`window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId`);
    const active = (await state(page)).delivery!.activeOrderId;

    // longe: seta + metros
    await teleport(page, WORLD_MAP.spawn.x, WORLD_MAP.spawn.y);
    await waitDelivery(page, 'd.indicator && !d.indicator.near');
    let d = (await state(page)).delivery!;
    const p = (await state(page)).player!;
    const dx = CUSTOMER_SPOT.x - p.x;
    const dy = CUSTOMER_SPOT.y - p.y;
    const meters = Math.hypot(dx, dy) / PIXELS_PER_METER;
    expect(d.indicator!.meters).toBeCloseTo(meters, 0);
    expect(d.indicator!.angle).toBeCloseTo(Math.atan2(dy, dx), 2);
    expect(d.indicator!.text).toBe(`${Math.round(d.indicator!.meters)} m`);
    expect(d.indicator!.arrowVisible).toBe(true);
    expect(d.promptVisible).toBe(false);

    // mudar de posição muda a direção continuamente (agora o destino está ao norte-oeste)
    await teleport(page, CUSTOMER_SPOT.x + 600, CUSTOMER_SPOT.y + 400);
    await page.waitForTimeout(500);
    d = (await state(page)).delivery!;
    expect(d.indicator!.angle).toBeLessThan(-Math.PI / 2); // aponta para cima e para a esquerda

    // perto (< 240 px): "Destino próximo", sem seta; ainda sem prompt de entrega (raio 80)
    await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + NEAR_DESTINATION_PX - 20);
    await waitDelivery(page, 'd.indicator && d.indicator.near');
    d = (await state(page)).delivery!;
    expect(d.indicator!.text).toBe('Destino próximo');
    expect(d.indicator!.arrowVisible).toBe(false);
    expect(d.promptVisible).toBe(false);

    // dentro do raio de interação aparece o prompt (comportamento da entrega inalterado)
    await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 30);
    await waitDelivery(page, 'd.near && d.promptVisible');

    // limpeza: fecha o pedido pelo fluxo oficial
    const start = await page.request.post('/api/deliveries/start', { data: { order_id: order.id } });
    if (start.ok()) await page.request.post(`/api/deliveries/${(await start.json()).id}/finish`);
    expect(active).toBeTruthy();
  });

  test('sem entrega ativa o indicador não aparece', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    await openAdventure(page);
    await waitDelivery(page, 'd.loaded');
    const d = (await state(page)).delivery!;
    expect(d.activeOrderId).toBeNull();
    expect(d.indicator).toBeNull();
  });
});
