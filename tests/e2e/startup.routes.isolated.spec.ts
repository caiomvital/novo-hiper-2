import { expect, test } from '@playwright/test';
import { USERNAME, PASSWORD } from './helpers';

test.use({ viewport: { width: 1366, height: 768 }, serviceWorkers: 'block' });
test('abre sem servidores de estilos externos e carrega o mapa sob demanda', async ({ page }) => {
  const externalStyles: string[] = [], errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/https:\/\/(fonts.googleapis.com|fonts.gstatic.com|unpkg.com)\//, async route => {
    externalStyles.push(route.request().url());
    await route.abort();
  });
  await page.goto('/');
  await expect(page.locator('#login-username')).toBeVisible();
  expect(externalStyles).toEqual([]);
  expect(await page.locator('.leaflet-container').count()).toBe(0);
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(r => /DeliveryMap|leaflet/.test(r.name)))).toBe(false);
  await page.locator('#login-username').fill(USERNAME);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('form button[type=submit]').click();
  await expect(page.locator('#tab-btn-catalog')).toBeVisible();
  await page.reload();
  await expect(page.locator('#tab-btn-catalog')).toBeVisible();
  await page.locator('#tab-btn-deliveries').click();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect.poll(() => page.locator('.leaflet-container').evaluate(el => getComputedStyle(el).overflow)).toBe('hidden');
  await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
  await page.locator('#tab-btn-catalog').click();
  await expect(page.locator('.leaflet-container')).toHaveCount(0);
  expect(externalStyles).toEqual([]);
  expect(errors).toEqual([]);
});
