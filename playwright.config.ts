import { defineConfig } from '@playwright/test';

// E2E roda contra um Vite de DEV em 127.0.0.1:5174 (porta própria, não interfere no 5173),
// com /api encaminhado ao backend ISOLADO de desenvolvimento (data-dev, nunca produção).
const API_TARGET = process.env.DEV_API_TARGET ?? 'http://127.0.0.1:4317';
const PORT = 5174;
// Stack ISOLADO (backend com banco temporário descartável + Vite próprio) para specs *.isolated.spec.ts:
// testes que controlam saldo/compras/estado. O data-dev compartilhado fica só para o teste MANUAL e specs comuns.
const ISOLATED_API_PORT = Number(process.env.E2E_ISOLATED_API_PORT ?? 4318);
const ISOLATED_PORT = 5175;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/globalSetup.ts',
  projects: [
    { name: 'dev', testIgnore: /\.isolated\.spec\.ts$/, use: { baseURL: `http://127.0.0.1:${PORT}` } },
    { name: 'isolated', testMatch: /\.isolated\.spec\.ts$/, use: { baseURL: `http://127.0.0.1:${ISOLATED_PORT}` } },
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
  webServer: [
    {
      command: `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { DEV_API_TARGET: API_TARGET },
    },
    {
      // banco novo a cada execução (nunca reaproveitado): sem reuseExistingServer
      command: 'node scripts/e2e-isolated-backend.mjs',
      url: `http://127.0.0.1:${ISOLATED_API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_ISOLATED_API_PORT: String(ISOLATED_API_PORT) },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${ISOLATED_PORT} --strictPort`,
      url: `http://127.0.0.1:${ISOLATED_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { DEV_API_TARGET: `http://127.0.0.1:${ISOLATED_API_PORT}` },
    },
  ],
});
