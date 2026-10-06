import { expect, test } from '@playwright/test';
import { ENTRANCE_ZONE, WORLD } from '../../src/phaser-game/config/worldConfig';
import { GOAL_UI, PLATFORM, PLATFORM_FALL_LIMIT_Y, getGaps, getGroundSegments } from '../../src/phaser-game/config/platformConfig';
import { REARM_DISTANCE } from '../../src/phaser-game/logic/worldEntrance';
import {
  enterPlatform,
  holdKeys,
  login,
  openAdventure,
  runToGoal,
  state,
  tap,
  teleport,
  teleportToGoal,
  waitForScene,
  walkRightUntilFall,
  walkRoute,
  walkTo,
} from './helpers';
import { ROUTE_TO_ENTRANCE_NORTH_SIDE } from './routes';

test.beforeEach(async ({ page }) => {
  await login(page);
  await openAdventure(page);
});

const distToEntrance = (p: { x: number; y: number }) => Math.hypot(p.x - ENTRANCE_ZONE.x, p.y - ENTRANCE_ZONE.y);

async function expectReturnedSafely(page: import('@playwright/test').Page) {
  await waitForScene(page, 'world');
  const s = await state(page);
  const p = s.player!;
  // posição válida, perto da entrada e FORA da trigger
  expect(p.x).toBeGreaterThanOrEqual(0);
  expect(p.x).toBeLessThanOrEqual(WORLD.width);
  expect(p.y).toBeGreaterThanOrEqual(0);
  expect(p.y).toBeLessThanOrEqual(WORLD.height);
  expect(distToEntrance(p)).toBeLessThanOrEqual(160);
  expect(distToEntrance(p)).toBeGreaterThan(ENTRANCE_ZONE.radius);
  // sem loop: continua no mapa depois de um tempo parado
  await page.waitForTimeout(1500);
  const later = await state(page);
  expect(later.scene).toBe('world');
  expect(later.transitioning).toBe(false);
}

test('vertical slice: mapa → plataforma (atravessando os buracos) → destino → mapa', async ({ page }) => {
  await enterPlatform(page);
  expect((await state(page)).scene).toBe('platform');

  await runToGoal(page);
  expect((await state(page)).goalReached).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);

  await page.waitForTimeout(800); // passa do atraso de proteção do Espaço
  await tap(page, 'Space');
  await expectReturnedSafely(page);

  // e dá para continuar andando normalmente
  const before = (await state(page)).player!;
  await holdKeys(page, ['ArrowLeft'], 400);
  const after = (await state(page)).player!;
  expect(after.x).toBeLessThan(before.x - 40);
});

for (const confirm of ['Space', 'Enter'] as const) {
  test(`destino alcançado: ${confirm} confirma e volta ao WorldScene (sem loop de reentrada)`, async ({ page }) => {
    await enterPlatform(page);
    await teleportToGoal(page);
    await page.waitForTimeout(800);
    await tap(page, confirm);
    await expectReturnedSafely(page);
  });
}

test('destino alcançado: o botão visível funciona por toque/clique', async ({ page }) => {
  await enterPlatform(page);
  await teleportToGoal(page);
  await page.waitForTimeout(800); // passa do atraso de proteção
  const box = (await page.locator('canvas').boundingBox())!;
  await page.waitForTimeout(1200); // o botão só aparece depois da comemoração
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * GOAL_UI.titleYRatio + GOAL_UI.buttonOffsetY);
  await expectReturnedSafely(page);
});

test('Espaço segurado ao chegar NÃO pula a confirmação "Destino encontrado!"', async ({ page }) => {
  await enterPlatform(page);
  await page.keyboard.down('Space');
  await teleportToGoal(page);
  await page.waitForTimeout(300);
  expect((await state(page)).scene).toBe('platform');
  await page.keyboard.up('Space');
});

test('entrando pela borda de cima, o retorno não dispara a plataforma de novo', async ({ page }) => {
  // bug original: retorno = y + 70 caía dentro do raio quando se entrava por cima
  await walkRoute(page, ROUTE_TO_ENTRANCE_NORTH_SIDE, 8); // dentro do lote, ao norte da zona
  await page.keyboard.down('ArrowDown'); // desce até tocar a borda de cima da zona
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'platform');
  await page.keyboard.up('ArrowDown');
  await waitForScene(page, 'platform');
  await teleportToGoal(page);
  await page.waitForTimeout(800);
  await tap(page, 'Space');
  await expectReturnedSafely(page);
  expect((await state(page)).player!.y).toBeLessThan(ENTRANCE_ZONE.y); // voltou pelo lado de cima
});

test('depois de voltar, a entrada rearma ao se afastar e pode ser usada de novo', async ({ page }) => {
  await enterPlatform(page);
  await teleportToGoal(page);
  await page.waitForTimeout(800);
  await tap(page, 'Space');
  await expectReturnedSafely(page);
  await walkTo(page, ENTRANCE_ZONE.x, ENTRANCE_ZONE.y + REARM_DISTANCE + 60, 10);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().entranceArmed === true);
  await walkTo(page, ENTRANCE_ZONE.x, ENTRANCE_ZONE.y, 10);
  await waitForScene(page, 'platform');
});

test('controles top-down: as quatro direções movem Bernardo', async ({ page }) => {
  const cases: [string[], 'x' | 'y', 1 | -1][] = [
    [['ArrowRight'], 'x', 1],
    [['ArrowLeft'], 'x', -1],
    [['ArrowDown'], 'y', 1],
    [['ArrowUp'], 'y', -1],
    [['KeyD'], 'x', 1],
    [['KeyA'], 'x', -1],
    [['KeyS'], 'y', 1],
    [['KeyW'], 'y', -1],
  ];
  for (const [keys, axis, sign] of cases) {
    const before = (await state(page)).player!;
    await holdKeys(page, keys, 450);
    const after = (await state(page)).player!;
    expect((after[axis] - before[axis]) * sign, keys[0]).toBeGreaterThan(30);
  }
});

test('controles de plataforma: esquerda, direita e pulo', async ({ page }) => {
  await enterPlatform(page);
  const start = (await state(page)).player!;

  await holdKeys(page, ['ArrowRight'], 400);
  const right = (await state(page)).player!;
  expect(right.x).toBeGreaterThan(start.x + 40);

  await holdKeys(page, ['ArrowLeft'], 400);
  const left = (await state(page)).player!;
  expect(left.x).toBeLessThan(right.x - 40);

  // pulo: acompanha a altura mínima atingida
  const ground = (await state(page)).player!.y;
  await page.keyboard.down('Space');
  let minY = ground;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(25);
    minY = Math.min(minY, (await state(page)).player!.y);
  }
  await page.keyboard.up('Space');
  expect(ground - minY).toBeGreaterThan(40);
  // volta ao chão (pulo não é voo)
  await page.waitForTimeout(1200);
  expect(Math.abs((await state(page)).player!.y - ground)).toBeLessThan(3);
});

test('não dá para pular no ar (sem pulo duplo acidental)', async ({ page }) => {
  await enterPlatform(page);
  const ground = (await state(page)).player!.y;
  await page.keyboard.down('Space');
  await page.waitForTimeout(450); // ~ topo do salto, ainda segurando
  const apex = (await state(page)).player!.y;
  await page.waitForTimeout(250);
  await page.keyboard.up('Space');
  expect(ground - apex).toBeLessThan(PLATFORM_HEIGHT_LIMIT());
});

function PLATFORM_HEIGHT_LIMIT() {
  // altura máxima física de um único salto + folga de 10%
  return (PLATFORM.jumpVelocity ** 2 / (2 * PLATFORM.gravityY)) * 1.1;
}

test('queda real no buraco: reaparece em ponto seguro, sem Game Over, e a fase segue jogável', async ({ page }) => {
  await enterPlatform(page);
  const firstGap = getGaps()[0];
  await walkRightUntilFall(page); // anda sem pular e cai na vala; solta a tecla ao reaparecer
  await page.waitForTimeout(1000); // deixa pousar no checkpoint

  const s = await state(page);
  expect(s.scene).toBe('platform');
  expect(s.goalReached).toBe(false);
  const p = s.player!;
  expect(p.y).toBeLessThan(PLATFORM_FALL_LIMIT_Y);
  expect(p.y).toBeLessThan(PLATFORM.groundY); // em cima do chão, não dentro dele
  expect(p.x).toBeLessThanOrEqual(firstGap.start + PLATFORM.playerWidth); // checkpoint antes do buraco
  const overGround = getGroundSegments().some((seg) => p.x >= seg.x && p.x <= seg.x + seg.width);
  expect(overGround).toBe(true);
  await expect(page.getByText(/game over/i)).toHaveCount(0);

  // continua jogável: ainda dá para vencer a fase depois de cair
  await runToGoal(page);
  expect((await state(page)).goalReached).toBe(true);
});

test('queda por teleporte abaixo do limite também reaparece em checkpoint seguro', async ({ page }) => {
  await enterPlatform(page);
  await holdKeys(page, ['ArrowRight'], 500); // aterrissa/registra chão seguro mais à frente
  await teleport(page, 300, PLATFORM_FALL_LIMIT_Y + 50);
  await page.waitForFunction(() => (window.__NH_ADVENTURE__?.getState().fallRespawns ?? 0) >= 1);
  await page.waitForTimeout(300);
  const s = await state(page);
  expect(s.scene).toBe('platform');
  expect(s.player!.y).toBeLessThan(PLATFORM.groundY);
  expect(s.player!.x).toBeGreaterThan(0);
});
