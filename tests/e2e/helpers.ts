import { expect, Page } from '@playwright/test';
import { PLATFORM, PLATFORM_GOAL, getGaps } from '../../src/phaser-game/config/platformConfig';
import type { AdventureDiagnostics } from '../../src/phaser-game/debug/diagnostics';

export const USERNAME = 'Bernardo';
// Senha padrão de desenvolvimento (já exibida na tela de login e documentada em .env.example)
export const PASSWORD = process.env.E2E_PASSWORD ?? 'NovoHiper2026';

export async function login(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder(/Nome do lojista/).fill(USERNAME);
  await page.getByPlaceholder('Digite a senha da loja').fill(PASSWORD);
  await page.locator('form button[type=submit]').click();
  await expect(page.locator('#tab-btn-adventure')).toBeVisible();
}

export async function openAdventure(page: Page) {
  await page.locator('#tab-btn-adventure').click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await waitForPlayer(page);
}

export async function leaveAdventure(page: Page) {
  await page.locator('#tab-btn-catalog').click();
  await page.waitForFunction(() => !window.__NH_ADVENTURE__);
}

export async function state(page: Page): Promise<AdventureDiagnostics> {
  return page.evaluate(() => window.__NH_ADVENTURE__!.getState());
}

export async function waitForPlayer(page: Page) {
  await page.waitForFunction(() => {
    const s = window.__NH_ADVENTURE__?.getState();
    return Boolean(s && s.player && !s.transitioning);
  });
  // deixa a câmera/fade e a primeira física assentarem
  await page.waitForTimeout(400);
}

export async function waitForScene(page: Page, scene: 'world' | 'platform') {
  await page.waitForFunction((sc) => window.__NH_ADVENTURE__?.getState().scene === sc, scene);
  await waitForPlayer(page);
}

export async function holdKeys(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(80);
}

export async function tap(page: Page, key: string, ms = 120) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/**
 * Anda (top-down) até chegar perto de (x, y), ou até a cena mudar (ex.: entrou na plataforma).
 * Roda DENTRO da página, a cada quadro, com KeyboardEvents reais (ver runToGoal).
 */
export async function walkTo(page: Page, x: number, y: number, tolerance = 12, timeoutMs = 30_000) {
  const result = await page.evaluate(
    ([tx, ty, tol, timeout]) =>
      new Promise<'arrived' | 'scene-changed' | 'timeout'>((resolve) => {
        const pressed = new Set<string>();
        const set = (code: string, on: boolean) => {
          if (on === pressed.has(code)) return;
          pressed[on ? 'add' : 'delete'](code);
          window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }));
        };
        const finish = (r: 'arrived' | 'scene-changed' | 'timeout') => {
          [...pressed].forEach((c) => set(c, false));
          resolve(r);
        };
        const t0 = performance.now();
        const tick = () => {
          const s = window.__NH_ADVENTURE__!.getState();
          if (s.scene !== 'world' || s.transitioning || !s.player) return finish('scene-changed');
          const dx = tx - s.player.x;
          const dy = ty - s.player.y;
          if (Math.abs(dx) < tol && Math.abs(dy) < tol) return finish('arrived');
          if (performance.now() - t0 > timeout) return finish('timeout');
          set('ArrowRight', dx > tol);
          set('ArrowLeft', dx < -tol);
          set('ArrowDown', dy > tol);
          set('ArrowUp', dy < -tol);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [x, y, tolerance, timeoutMs] as const
  );
  expect(result, `walkTo(${x}, ${y})`).not.toBe('timeout');
}

/** Anda para a direita SEM pular, soltando a tecla no mesmo quadro em que detecta a queda. */
export async function walkRightUntilFall(page: Page, timeoutMs = 20_000) {
  const result = await page.evaluate(
    (timeout) =>
      new Promise<'fell' | 'timeout'>((resolve) => {
        const fire = (type: 'keydown' | 'keyup') =>
          window.dispatchEvent(new KeyboardEvent(type, { code: 'ArrowRight', bubbles: true, cancelable: true }));
        const t0 = performance.now();
        fire('keydown');
        const tick = () => {
          const s = window.__NH_ADVENTURE__!.getState();
          if (s.fallRespawns >= 1) {
            fire('keyup');
            return resolve('fell');
          }
          if (performance.now() - t0 > timeout) {
            fire('keyup');
            return resolve('timeout');
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    timeoutMs
  );
  expect(result, 'caiu no buraco').toBe('fell');
}

/**
 * Corre para a direita pulando antes de cada buraco, até alcançar o destino.
 * O "piloto" roda DENTRO da página, a cada quadro, enviando KeyboardEvents reais (mesmo caminho
 * do teclado → InputState). Evita a latência de ida e volta do Playwright, que em CI/headless
 * sem GPU é maior que a janela de tempo do salto.
 */
export async function runToGoal(page: Page, timeoutMs = 40_000) {
  const gapStarts = getGaps().map((g) => g.start);
  const result = await page.evaluate(
    ([starts, timeout]) =>
      new Promise<'goal' | 'timeout'>((resolve) => {
        const fire = (type: 'keydown' | 'keyup', code: string) =>
          window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }));
        const jumped = new Set<number>();
        const t0 = performance.now();
        fire('keydown', 'ArrowRight');
        const finish = (r: 'goal' | 'timeout') => {
          fire('keyup', 'ArrowRight');
          resolve(r);
        };
        const tick = () => {
          const s = window.__NH_ADVENTURE__!.getState();
          if (s.goalReached) return finish('goal');
          if (performance.now() - t0 > timeout) return finish('timeout');
          if (s.player) {
            starts.forEach((start, i) => {
              if (!jumped.has(i) && s.player!.x >= start - 8 && s.player!.x < start + 14) {
                jumped.add(i);
                fire('keydown', 'Space');
                setTimeout(() => fire('keyup', 'Space'), 150);
              }
            });
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [gapStarts, timeoutMs] as const
  );
  expect(result, 'alcançou o destino').toBe('goal');
}

export async function teleport(page: Page, x: number, y: number) {
  await page.evaluate(([px, py]) => window.__NH_ADVENTURE__!.teleportPlayer(px, py), [x, y]);
}

export async function enterPlatform(page: Page) {
  // vai até a zona de entrada (1300, 900)
  await walkTo(page, 1300, 900, 10);
  await waitForScene(page, 'platform');
}

export async function teleportToGoal(page: Page) {
  await teleport(page, PLATFORM_GOAL.x - 60, PLATFORM.groundY - 30);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().goalReached === true);
}

