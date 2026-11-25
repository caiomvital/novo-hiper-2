import { expect, test } from '@playwright/test';
import { login, openAdventure, state } from './helpers';

test.use({ hasTouch: true });
test('direcionais ficam acima da faixa de aviso em tela cheia nas duas orientações', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 412, height: 820 });
  await login(page); await openAdventure(page);
  const before = await state(page);
  await page.locator('#btn-adventure-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'adventure-root');
  for (const viewport of [{ width: 412, height: 820 }, { width: 820, height: 412 }]) {
    await page.setViewportSize(viewport);
    // Modela uma faixa inferior sobreposta; o aviso real pertence ao navegador.
    await page.evaluate(() => {
      document.getElementById('simulated-browser-notice')?.remove();
      const notice = document.createElement('div');
      notice.id = 'simulated-browser-notice';
      notice.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:60px;z-index:9999;background:#333;color:white';
      notice.textContent = 'Aviso do navegador (simulado)';
      document.fullscreenElement!.append(notice);
    });
    for (const label of ['Andar para cima', 'Andar para baixo', 'Andar para a esquerda', 'Andar para a direita', 'Interagir']) {
      const button = page.getByRole('button', { name: label, exact: true });
      await expect(button).toBeInViewport({ ratio: 1 });
      const box = (await button.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 60);
      expect(await button.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    }
    const x = (await state(page)).player!.x;
    await page.getByRole('button', { name: 'Andar para a direita', exact: true }).dispatchEvent('touchstart', { touches: [{ identifier: 1 }] });
    await page.waitForFunction(start => (window.__NH_ADVENTURE__?.getState().player?.x ?? 0) > start + 10, x);
    await page.getByRole('button', { name: 'Andar para a direita', exact: true }).dispatchEvent('touchend', { touches: [] });
    expect((await state(page)).instance).toBe(before.instance);
  }
  await page.evaluate(() => document.getElementById('simulated-browser-notice')?.remove());
  await page.locator('#btn-adventure-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  expect((await state(page)).instance).toBe(before.instance);
});
