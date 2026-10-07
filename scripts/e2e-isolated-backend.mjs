#!/usr/bin/env node
// Backend ISOLADO e DESCARTÁVEL para testes E2E que precisam controlar estado (saldo, compras, pedidos).
//  - banco, dados e uploads novos num diretório temporário (apagado ao encerrar); nunca toca data-dev nem produção;
//  - sobe a MESMA API (dev-backend.ts) em 127.0.0.1:E2E_ISOLATED_API_PORT (padrão 4318), com credencial só de teste;
//  - precisa de Node >= 22.5 (node:sqlite): se o Node atual for mais antigo, usa o pacote npm "node@22" via npx.
// O data-dev continua sendo o ambiente de teste MANUAL; testes automatizados que mexem em dinheiro/estado usam este.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = process.env.E2E_ISOLATED_API_PORT || '4318';
// Diretório FIXO por porta, recriado do zero a cada subida: se o runner matar este processo sem aviso (SIGKILL),
// nada se acumula — o próximo início apaga o resto. Sempre dentro do diretório temporário do sistema.
const dir = path.join(os.tmpdir(), `novo-hiper-e2e-isolated-${port}`);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const env = { ...process.env };
for (const k of ['AUTH_PASSWORD_HASH', 'DATABASE_PATH', 'DATA_DIR', 'UPLOADS_DIR']) delete env[k];
Object.assign(env, {
  NODE_ENV: 'development',
  DATA_DIR: dir,
  DATABASE_PATH: path.join(dir, 'e2e.db'),
  UPLOADS_DIR: path.join(dir, 'uploads'),
  AUTH_USERNAME: 'Bernardo',
  AUTH_DEV_INSECURE_PASSWORD: 'dev-only-test-password-1',
  CORS_ORIGIN: '',
  DEV_API_PORT: port,
  DEV_API_BIND: '127.0.0.1',
});
fs.mkdirSync(path.join(dir, 'uploads', 'plants'), { recursive: true });

const [major, minor] = process.versions.node.split('.').map(Number);
const hasSqlite = major > 22 || (major === 22 && minor >= 5);
const tsx = path.resolve('node_modules/tsx/dist/cli.mjs');
const cmd = hasSqlite ? [process.execPath, tsx, 'dev-backend.ts'] : ['npx', '-y', 'node@22', tsx, 'dev-backend.ts'];

console.log(`[e2e-isolated] banco descartável em ${dir} (porta ${port})`);
const child = spawn(cmd[0], cmd.slice(1), { env, stdio: 'inherit' });

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  try {
    child.kill('SIGTERM');
  } catch {
    /* já encerrado */
  }
  fs.rmSync(dir, { recursive: true, force: true });
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);
child.on('exit', (code) => { cleanup(); process.exit(code ?? 0); });
