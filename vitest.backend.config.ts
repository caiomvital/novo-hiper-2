import { defineConfig } from 'vitest/config';

// Testes do backend: precisam de Node >= 22.5 (node:sqlite). Rode com `npm run test:backend`.
export default defineConfig({
  test: {
    include: ['tests/backend/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/backend/setup.ts'],
    pool: 'forks', // processo isolado por arquivo: cada arquivo tem seu próprio singleton de banco
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
