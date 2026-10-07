import { defineConfig } from '@playwright/test';

// Os E2E rodam SEMPRE contra backends ISOLADOS e DESCARTÁVEIS (banco temporário novo a cada execução; ver
// scripts/e2e-isolated-backend.mjs). O `data-dev` (localhost:5173 + container novo-hiper-dev-api) é só do teste MANUAL
// e nunca é tocado pelos testes automatizados.
//
// Três pilhas (backend + Vite), por precisarem de estados diferentes:
//  • general: todos os specs comuns (estado cumulativo, asserções relativas); geração automática de pedidos DESLIGADA;
//  • shop:    shop.isolated.spec.ts — roteiro serial com saldo/compras absolutos; geração desligada;
//  • orders:  orders.isolated.spec.ts — roteiro serial da geração de pedidos pelo backend; geração LIGADA.
const stacks = [
  { name: 'general', api: 4318, web: 5175, env: { ORDER_AUTOGEN: 'off', ORDER_COOLDOWN_MS: '0' } },
  { name: 'shop', api: 4319, web: 5176, env: { ORDER_AUTOGEN: 'off', ORDER_COOLDOWN_MS: '0' } },
  { name: 'orders', api: 4320, web: 5177, env: { ORDER_AUTOGEN: 'on', ORDER_COOLDOWN_MS: '1000' } },
] as const;
const [general, shop, orders] = stacks;
const base = (s: (typeof stacks)[number]) => ({ baseURL: `http://127.0.0.1:${s.web}` });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  projects: [
    { name: 'general', testIgnore: /(shop|orders)\.isolated\.spec\.ts$/, use: base(general) },
    { name: 'shop', testMatch: /shop\.isolated\.spec\.ts$/, use: base(shop) },
    { name: 'orders', testMatch: /orders\.isolated\.spec\.ts$/, use: base(orders) },
  ],
  use: {
    launchOptions: {
      executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
      args: ['--no-sandbox'],
    },
    // Viewport pequeno de propósito: o WebGL por software do Chrome headless é lento em telas grandes
    viewport: { width: 480, height: 360 },
    trace: 'retain-on-failure',
  },
  webServer: stacks.flatMap((s) => [
    {
      // banco novo a cada execução (nunca reaproveitado): sem reuseExistingServer
      command: 'node scripts/e2e-isolated-backend.mjs',
      url: `http://127.0.0.1:${s.api}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_ISOLATED_API_PORT: String(s.api), ...s.env },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${s.web} --strictPort`,
      url: `http://127.0.0.1:${s.web}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { DEV_API_TARGET: `http://127.0.0.1:${s.api}` },
    },
  ]),
});
