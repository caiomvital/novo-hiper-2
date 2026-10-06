import { expect, test } from '@playwright/test';
import { PLATFORM } from '../../src/phaser-game/config/platformConfig';
import { BERNARDO_BODY_OFFSET, BERNARDO_SPRITE } from '../../src/phaser-game/config/spriteConfig';
import { enterPlatform, holdKeys, login, openAdventure, state, teleportToGoal } from './helpers';

test.beforeEach(async ({ page }) => {
  await login(page);
  await openAdventure(page);
  await enterPlatform(page);
});

const sprite = async (page: import('@playwright/test').Page) => (await state(page)).sprite!;

test('sprite do Bernardo: collider real do Arcade continua 28x44 e centrado na posição', async ({ page }) => {
  const s = await state(page);
  const sp = s.sprite!;
  expect(sp.scale).toBe(BERNARDO_SPRITE.scale);
  expect(sp.body.width).toBe(PLATFORM.playerWidth);
  expect(sp.body.height).toBe(PLATFORM.playerHeight);
  // centro do body == posição do sprite (mesma semântica do placeholder)
  expect(sp.body.x + sp.body.width / 2).toBeCloseTo(s.player!.x, 0);
  expect(sp.body.y + sp.body.height / 2).toBeCloseTo(s.player!.y, 0);
  // parado no chão: base do body na linha do chão
  expect(sp.body.y + sp.body.height).toBeCloseTo(PLATFORM.groundY, 0);
  expect(BERNARDO_BODY_OFFSET.x).toBeGreaterThan(0);
});

test('animações: idle → walk-right → walk-left → idle-left, e jump no ar sem ser sobrescrito pelo andar', async ({ page }) => {
  expect((await sprite(page)).anim).toBe('idle-right');
  expect((await sprite(page)).texture).toBe('bernardo-idle-right');

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.anim === 'walk-right');
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.anim === 'idle-right');

  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.anim === 'walk-left');
  await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.anim === 'idle-left');

  // pulo: segura direita + espaço; durante TODO o tempo no ar a animação é jump
  await page.keyboard.down('ArrowRight');
  await page.keyboard.down('Space');
  const seen = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const anims: string[] = [];
        const t0 = performance.now();
        const tick = () => {
          const s = window.__NH_ADVENTURE__!.getState();
          const airborne = s.player!.y < 590;
          if (airborne) anims.push(s.sprite!.anim);
          if (performance.now() - t0 < 700) requestAnimationFrame(tick);
          else resolve(anims);
        };
        requestAnimationFrame(tick);
      })
  );
  await page.keyboard.up('Space');
  await page.keyboard.up('ArrowRight');
  expect(seen.length).toBeGreaterThan(0);
  expect(new Set(seen)).toEqual(new Set(['jump']));

  // ao pousar volta a idle/walk
  await page.waitForFunction(() => {
    const a = window.__NH_ADVENTURE__?.getState().sprite?.anim;
    return a === 'idle-right' || a === 'walk-right';
  });
});

test('virar esquerda/direita não desloca o collider nem o tamanho visual', async ({ page }) => {
  const before = await sprite(page);
  await holdKeys(page, ['ArrowLeft'], 50);
  await holdKeys(page, ['ArrowRight'], 50);
  const after = await sprite(page);
  expect(after.scale).toBe(before.scale);
  expect(after.body.width).toBe(before.body.width);
  expect(after.body.height).toBe(before.body.height);
});

test('destino: Bernardo para, de frente, comemora UMA vez (sem loop) e a confirmação continua funcionando', async ({ page }) => {
  await teleportToGoal(page);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.anim === 'thumbs-up');
  expect((await sprite(page)).texture).toBe('bernardo-thumbs-up-front');
  expect((await sprite(page)).flipX).toBe(false);
  // a animação termina sozinha (repeat 0)
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.animPlaying === false, null, { timeout: 8000 });
  expect((await sprite(page)).anim).toBe('thumbs-up');
  // e a lógica de confirmação segue igual: Enter volta ao mapa
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
});
