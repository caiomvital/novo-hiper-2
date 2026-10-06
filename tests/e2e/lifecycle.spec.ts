import { expect, test } from '@playwright/test';
import { leaveAdventure, login, openAdventure, state } from './helpers';

// Conta listeners adicionados/removidos em window/document/visualViewport, por tipo.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const counts: Record<string, number> = {};
    (window as any).__listenerCounts = () => ({ ...counts });
    const wrap = (target: any, label: string) => {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      const seen = new Map<string, Set<any>>();
      target.addEventListener = (type: string, fn: any, opts?: any) => {
        const key = `${label}:${type}`;
        const set = seen.get(key) ?? new Set();
        if (fn && !set.has(fn)) {
          set.add(fn);
          counts[key] = (counts[key] ?? 0) + 1;
        }
        seen.set(key, set);
        return add(type, fn, opts);
      };
      target.removeEventListener = (type: string, fn: any, opts?: any) => {
        const key = `${label}:${type}`;
        const set = seen.get(key);
        if (set?.delete(fn)) counts[key] = (counts[key] ?? 0) - 1;
        return remove(type, fn, opts);
      };
    };
    wrap(window, 'window');
    wrap(document, 'document');
  });
  await login(page);
});

const listeners = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__listenerCounts() as Record<string, number>);

test('entrar/sair da Aventura várias vezes: uma única instância, sem canvas nem listeners acumulados', async ({ page }) => {
  const baselineCanvas = await page.locator('canvas').count();
  // primeira entrada carrega o chunk lazy; mede o baseline de listeners depois do primeiro ciclo completo
  await openAdventure(page);
  await leaveAdventure(page);
  const baselineListeners = await listeners(page);

  for (let i = 0; i < 4; i++) {
    await openAdventure(page);
    expect(await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames())).toBe(1);
    expect((await state(page)).canvasCount).toBe(1);
    expect(await page.locator('canvas').count()).toBe(baselineCanvas + 1);

    await leaveAdventure(page);
    expect(await page.locator('canvas').count()).toBe(baselineCanvas);
    expect(await listeners(page)).toEqual(baselineListeners);
  }
});

test('depois de sair da Aventura, as teclas voltam ao comportamento normal da página', async ({ page }) => {
  await openAdventure(page);
  await leaveAdventure(page);
  // setas/espaço não podem continuar sendo engolidos (preventDefault) fora do jogo
  const prevented = await page.evaluate(() =>
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].map((code) => {
      const ev = new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    })
  );
  expect(prevented.every((p) => !p)).toBe(true);
});

test('trocar para outra aba e voltar rapidamente não duplica o jogo', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.locator('#tab-btn-adventure').click();
    await page.locator('#tab-btn-catalog').click();
  }
  await openAdventure(page);
  expect(await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames())).toBe(1);
  expect((await state(page)).canvasCount).toBe(1);
});
