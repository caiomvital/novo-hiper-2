#!/usr/bin/env node
// Executa os testes do backend com Node >= 22.5 (necessário para node:sqlite).
// Se o Node atual for mais antigo, usa o pacote npm "node@22" via npx (sem instalar globalmente).
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const [major, minor] = process.versions.node.split('.').map(Number);
const hasSqlite = major > 22 || (major === 22 && minor >= 5);

// Recusa-se a rodar se o ambiente aponta para banco/dados reais (a checagem completa está em tests/backend/setup.ts)
const tmp = os.tmpdir();
for (const key of ['DATABASE_PATH', 'DATA_DIR', 'UPLOADS_DIR']) {
  const v = process.env[key];
  if (v && !path.resolve(v).startsWith(tmp + path.sep)) {
    console.error(`[SEGURANÇA DOS TESTES] ${key}="${v}" não está em ${tmp}. Remova a variável e rode de novo.`);
    process.exit(2);
  }
}
if (process.env.NODE_ENV === 'production') {
  console.error('[SEGURANÇA DOS TESTES] NODE_ENV=production. Recusado.');
  process.exit(2);
}

const vitest = path.resolve('node_modules/vitest/vitest.mjs');
const args = ['run', '--config', 'vitest.backend.config.ts', ...process.argv.slice(2)];
const cmd = hasSqlite ? [process.execPath, vitest, ...args] : ['npx', '-y', 'node@22', vitest, ...args];
const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
process.exit(r.status ?? 1);
