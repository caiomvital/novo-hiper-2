import { expect, test } from '@playwright/test';
import { login, openAdventure, PASSWORD, USERNAME } from './helpers';

test('A02/A03: campos vazios, erro e resposta lenta permitem tentar de novo sem duplicar login', async ({ page }) => {
  await page.goto('/');
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/auth/login', async (route) => {
    calls++;
    await gate;
    await route.continue();
  });
  await page.locator('#login-username').fill('');
  await page.locator('#btn-submit-login').click();
  expect(calls).toBe(0);
  await page.locator('#login-username').fill(USERNAME);
  await page.locator('#login-password').fill('incorreta');
  await page.locator('#btn-submit-login').click();
  await expect(page.locator('#btn-submit-login')).toBeDisabled();
  await expect(page.locator('#btn-submit-login')).toHaveText('Entrando…');
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(calls).toBe(1);
  release();
  await expect(page.getByRole('alert')).toContainText('Usuário ou senha incorretos');
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('#btn-submit-login').click();
  await expect(page.locator('#tab-btn-catalog')).toBeVisible();
  expect(calls).toBe(2);
});

test('A04: reabrir navegador com sessão persistida mantém os dados do servidor', async ({ page, context, browser }, testInfo) => {
  await login(page);
  const response = await page.request.post('/api/plants', { data: {
    name: 'Planta marco 1', price: 20, stock_quantity: 5, image_path: '/test-photo.png',
  } });
  expect(response.status()).toBe(201);
  const plant = await response.json();
  const saved = await context.storageState();
  expect(saved.cookies.find((c) => c.name === 'nh_session')!.expires).toBeGreaterThan(Date.now() / 1000);
  await page.close();
  const restored = await browser.newContext({ storageState: saved, baseURL: testInfo.project.use.baseURL });
  const reopened = await restored.newPage();
  await reopened.goto('/');
  await expect(reopened.getByText('Planta marco 1', { exact: true })).toBeVisible();
  expect((await reopened.request.delete(`/api/plants/${plant.id}`)).ok()).toBe(true);
  await restored.close();
});

test('A06: logout lento aguarda servidor, falha informa e nova tentativa invalida sessão; voltar não reabre loja', async ({ page, context }) => {
  await login(page);
  const token = (await context.cookies()).find((c) => c.name === 'nh_session')!.value;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route('**/api/auth/logout', async (route) => {
    calls++;
    await gate;
    await route.fulfill({ status: 503, json: { error: 'indisponível' } });
  });
  const exit = page.locator('#btn-logout-mobile:visible, #btn-logout-desktop:visible').first();
  await exit.click();
  await exit.click();
  expect(calls).toBe(1);
  await expect(page.locator('#tab-btn-catalog')).toBeVisible();
  release();
  await expect(page.getByRole('alert')).toContainText('Não foi possível sair');
  await page.unroute('**/api/auth/logout');
  await exit.click();
  await expect(page.locator('#login-password')).toBeVisible();
  await page.goto('/?reabertura=1');
  await page.goBack();
  await expect(page.locator('#login-password')).toBeVisible();
  await expect(page.locator('#tab-btn-catalog')).toHaveCount(0);
  expect((await page.request.get('/api/plants', { headers: { Cookie: `nh_session=${token}` } })).status()).toBe(401);
});

test('A05: sessão perdida durante operação protegida volta ao login sem confirmação de sucesso', async ({ page, context }) => {
  await login(page);
  await context.clearCookies();
  const result = await page.evaluate(async () => {
    const url = '/src/services/api.ts';
    const { api } = await import(/* @vite-ignore */ url);
    try {
      await api.createPlant({ name: 'Não salvar', price: 20, stock: 1, photoUrl: '/test.png' });
      return 'salvou';
    } catch { return 'recusou'; }
  });
  expect(result).toBe('recusou');
  await expect(page.locator('#login-password')).toBeVisible();
  await expect(page.locator('#tab-btn-catalog')).toHaveCount(0);
});

test('B01–B06: orientação, cadastro, pedidos, mapa, caixa e três estados vazios da Aventura', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  await expect(page.getByRole('heading', { name: 'Sua loja, Bernardo!' })).toBeVisible();
  await expect(page.locator('#btn-start-catalog')).toBeVisible();
  await expect(page.locator('#btn-start-adventure')).toBeVisible();
  await page.locator('#btn-empty-add-plant').click();
  await expect(page.locator('#plant-form-container')).toBeVisible();
  await page.locator('#btn-cancel-form').click();
  await page.locator('#tab-btn-orders').click();
  await expect(page.getByText('Cadastre suas plantas primeiro!')).toBeVisible();
  await page.locator('#tab-btn-deliveries').click();
  await expect(page.locator('main')).toContainText(/Entrega|entrega/);
  await page.locator('#btn-open-cash-mobile:visible, #btn-open-cash-desktop:visible').first().click();
  await expect(page.locator('#cash-register-modal-container')).toBeVisible();
  await page.locator('#btn-close-cash-register').click();
  await openAdventure(page);
  await expect.poll(() => page.evaluate(() => window.__NH_ADVENTURE__?.getState().delivery?.hud)).toContain('Cadastre uma planta');
  await page.screenshot({ path: testInfo.outputPath('aventura-sem-plantas.png') });
  await page.locator('#tab-btn-catalog').click();
  const response = await page.request.post('/api/plants', { data: {
    name: 'Planta orientação', price: 20, stock_quantity: 0, image_path: '/test-photo.png',
  } });
  expect(response.status()).toBe(201);
  const plant = await response.json();
  try {
    await openAdventure(page);
    await expect.poll(() => page.evaluate(() => window.__NH_ADVENTURE__?.getState().delivery?.hud)).toContain('sem estoque');
    await page.locator('#tab-btn-catalog').click();
    expect((await page.request.put(`/api/plants/${plant.id}`, { data: { name: plant.name, price: plant.price, stock_quantity: 5 } })).ok()).toBe(true);
    await openAdventure(page);
    await expect.poll(() => page.evaluate(() => window.__NH_ADVENTURE__?.getState().delivery?.hud)).toContain('Sem entregas no momento');
    await page.locator('#tab-btn-catalog').click();
    await page.reload();
    await expect(page.getByText('Planta orientação', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('loja-orientacao.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/plants/${plant.id}`);
  }
  await page.reload();
  await expect(page.locator('#btn-empty-add-plant')).toBeVisible();
  await expect(page.getByText('Planta orientação', { exact: true })).toHaveCount(0);
});

test('A03: falha de conexão libera o login para nova tentativa', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/auth/login', (route) => route.abort('failed'));
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('#btn-submit-login').click();
  await expect(page.getByRole('alert')).toContainText('Verifique sua conexão');
  await expect(page.locator('#btn-submit-login')).toBeEnabled();
  await page.unroute('**/api/auth/login');
  await page.locator('#btn-submit-login').click();
  await expect(page.locator('#tab-btn-catalog')).toBeVisible();
});
