import { expect, test } from '@playwright/test';
import { login, PASSWORD, USERNAME } from './helpers';

const loginForm = (page: import('@playwright/test').Page) => page.getByPlaceholder('Digite a senha da loja');
const appTab = (page: import('@playwright/test').Page) => page.locator('#tab-btn-adventure');

test('login → app; o cookie é HttpOnly e nada de sessão/senha fica no navegador (localStorage/document.cookie)', async ({ page, context }) => {
  await login(page);
  await expect(appTab(page)).toBeVisible();

  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'nh_session');
  expect(session, 'cookie de sessão').toBeDefined();
  expect(session!.httpOnly).toBe(true);
  expect(session!.sameSite).toBe('Strict');
  expect(session!.path).toBe('/');

  const visible = await page.evaluate(() => ({
    cookie: document.cookie,
    storage: JSON.stringify(Object.fromEntries(Object.entries(localStorage))),
    session: JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))),
  }));
  expect(visible.cookie).not.toContain('nh_session'); // JS não enxerga o cookie
  for (const blob of [visible.storage, visible.session, visible.cookie]) {
    expect(blob).not.toContain(session!.value);
    expect(blob).not.toContain(PASSWORD);
  }
  expect(visible.storage).not.toContain('novo_hiper_session_auth'); // o antigo flag não é mais usado
});

test('a tela de login NÃO exibe senha nem "senha inicial"; e o bundle servido não contém a senha antiga', async ({ page }) => {
  await page.goto('/');
  await expect(loginForm(page)).toBeVisible();
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/senha inicial/i);
  expect(text).not.toContain('NovoHiper2026');
  expect(text).not.toContain(PASSWORD);
  // código-fonte do cliente carregado pela página (módulos do Vite): sem a senha antiga
  const sources = await page.evaluate(async () => {
    const urls = ['/src/components/LoginScreen.tsx', '/src/services/auth.ts', '/src/App.tsx'];
    return (await Promise.all(urls.map((u) => fetch(u).then((r) => r.text())))).join('\n');
  });
  expect(sources).not.toContain('NovoHiper2026');
});

test('reload mantém a sessão (autenticado)', async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(appTab(page)).toBeVisible();
  await expect(loginForm(page)).toHaveCount(0);
});

test('logout → tela de login; o servidor invalida a sessão (cookie antigo para de funcionar) e o reload continua no login', async ({ page, context, request }) => {
  await login(page);
  const oldCookie = (await context.cookies()).find((c) => c.name === 'nh_session')!.value;
  expect((await page.request.get('/api/plants')).status()).toBe(200);

  // botão de sair do cabeçalho
  await page.locator('#btn-logout-mobile, #btn-logout-desktop').locator('visible=true').first().click();
  await expect(loginForm(page)).toBeVisible();

  await page.reload();
  await expect(loginForm(page)).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'nh_session')).toBeUndefined();

  // reutilizar o cookie ANTIGO diretamente na API → 401 (invalidado no servidor, não só apagado no navegador)
  const replay = await request.get('/api/plants', { headers: { Cookie: `nh_session=${oldCookie}` } });
  expect(replay.status()).toBe(401);
});

test('sem sessão → login; e a API privada responde 401 a quem não tem cookie', async ({ page }) => {
  await page.goto('/');
  await expect(loginForm(page)).toBeVisible();
  await expect(appTab(page)).toHaveCount(0);
  for (const url of ['/api/plants', '/api/orders', '/api/cash', '/api/deliveries']) {
    expect((await page.request.get(url)).status(), url).toBe(401);
  }
  expect((await page.request.get('/api/health')).status()).toBe(200);
});

test('senha incorreta: mostra erro e permanece no login (sem cookie de sessão)', async ({ page, context }) => {
  await page.goto('/');
  await page.getByPlaceholder(/Nome do lojista/).fill(USERNAME);
  await loginForm(page).fill('senha-incorreta-xyz-123');
  await page.locator('form button[type=submit]').click();
  await expect(page.locator('#login-error-message')).toBeVisible();
  await expect(loginForm(page)).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'nh_session')).toBeUndefined();
});

test('401 no meio do uso (sessão expirou/foi revogada): volta ao login SEM apagar os dados do negócio guardados', async ({ page, context }) => {
  await login(page);
  await expect(appTab(page)).toBeVisible();
  await page.waitForTimeout(1500); // deixa a sincronização inicial terminar de gravar o localStorage
  const before = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k !== 'novo_hiper_session_auth').sort()));
  expect(before.length).toBeGreaterThan(10);

  await context.clearCookies(); // simula sessão perdida/expirada no servidor
  // qualquer chamada de API (pelo cliente real do app) recebe 401
  const result = await page.evaluate(async () => {
    const url = '/src/services/api.ts'; // módulo do Vite (mesma instância usada pelo app)
    const mod = await import(/* @vite-ignore */ url);
    return mod.api.getPlants().then(() => 'ok', (e: Error) => e.message);
  });
  expect(result).toMatch(/401|Sessão|Erro na requisição/);
  await expect(loginForm(page)).toBeVisible();

  const after = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => k !== 'novo_hiper_session_auth').sort()));
  expect(after).toBe(before); // nenhum dado do negócio foi apagado
});
