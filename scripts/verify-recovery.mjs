#!/usr/bin/env node
// Ensaio destrutivo somente no diretório temporário criado aqui; nunca usa dados da loja.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'novo-hiper-test-recovery-'));
assert(root.startsWith(path.join(os.tmpdir(), 'novo-hiper-test-recovery-')));
const data = path.join(root, 'live');
const backup = path.join(root, 'backup');
fs.mkdirSync(data);
const db = path.join(data, 'test.db');
const uploads = path.join(data, 'uploads');
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env, NODE_ENV: 'test', DATA_DIR: data, DATABASE_PATH: db, UPLOADS_DIR: uploads,
  DEV_API_PORT: String(port), DEV_API_BIND: '127.0.0.1', AUTH_USERNAME: 'Bernardo',
  AUTH_DEV_INSECURE_PASSWORD: 'dev-only-test-password-1', ORDER_AUTOGEN: 'off', ORDER_COOLDOWN_MS: '0',
  ENABLE_LEGACY_MIGRATION: 'false', CORS_ORIGIN: '' };
delete env.AUTH_PASSWORD_HASH;
let child;
let output = '';
let cookie = '';
async function start() {
  child = spawn(process.execPath, ['--import', 'tsx', 'dev-backend.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output = (output + bytes.toString()).slice(-4000); });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(`API de teste encerrou: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('API de teste não iniciou.');
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  const ended = new Promise(resolve => current.once('exit', resolve));
  current.kill('SIGTERM');
  await ended;
  child = null;
}
async function request(method, route, body) {
  const response = await fetch(origin + route, { method, headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert(response.ok, `${method} ${route}: ${response.status}`);
  if (route === '/api/auth/login') cookie = response.headers.getSetCookie()[0].split(';')[0];
  return response.json();
}
const get = route => request('GET', route);
const post = (route, body) => request('POST', route, body ?? {});
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const snapshot = async () => Object.fromEntries(await Promise.all(['/plants', '/orders', '/deliveries', '/cash', '/shop', '/progress'].map(async route => [route, await get('/api' + route)])));
try {
  await start();
  await post('/api/auth/login', { username: env.AUTH_USERNAME, password: env.AUTH_DEV_INSECURE_PASSWORD });
  const png = fs.readFileSync('public/pwa-192x192.png');
  const photoForm = new FormData();
  photoForm.append('image', new Blob([png], { type: 'image/png' }), 'planta.png');
  const response = await fetch(origin + '/api/upload', { method: 'POST', headers: { Cookie: cookie }, body: photoForm });
  assert.equal(response.status, 201);
  const photo = await response.json();
  const plant = await post('/api/plants', { id: 'recovery-plant', name: 'Planta de recuperação', price: 20, stock_quantity: 8, image_path: photo.filePath });
  const order = await post('/api/orders', { id: 'recovery-sale', customer_name: 'Cliente do ensaio', items: [{ plant_id: plant.id, quantity: 5 }] });
  const delivery = await post('/api/deliveries/start', { order_id: order.id });
  await post(`/api/deliveries/${delivery.id}/finish`);
  await post('/api/shop/upgrades/placa_madeira/purchase');
  await post('/api/shop/upgrades/placa_madeira/install');
  const pending = await post('/api/orders', { id: 'recovery-pending', customer_name: 'Pedido pendente', items: [{ plant_id: plant.id, quantity: 1 }] });
  await post('/api/deliveries/start', { order_id: pending.id });
  const expected = await snapshot();
  assert.equal(expected['/cash'].balance, 40);
  assert.equal(expected['/cash'].totalSales, 100);
  assert.equal(expected['/plants'][0].stock_quantity, 3);
  await stop();
  await start(); // novo processo, mesmo banco e fotografias
  assert.deepEqual(await snapshot(), expected);
  assert.equal(digest(Buffer.from(await (await fetch(origin + photo.filePath)).arrayBuffer())), digest(png));
  fs.mkdirSync(backup);
  const copied = spawnSync('python3', ['-c', 'import sqlite3,sys; a=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); b=sqlite3.connect(sys.argv[2]); a.backup(b); assert b.execute("PRAGMA integrity_check").fetchone()[0]=="ok"; b.close(); a.close()', db, path.join(backup, 'test.db')]);
  assert.equal(copied.status, 0, copied.stderr.toString());
  fs.cpSync(uploads, path.join(backup, 'uploads'), { recursive: true });
  // Altera dados e apaga a foto SOMENTE no ambiente descartável.
  await request('PUT', `/api/plants/${plant.id}`, { name: 'Alteração após backup', price: 99, stock_quantity: 0 });
  fs.rmSync(path.join(uploads, photo.filePath.replace('/uploads/', '')));
  assert.notDeepEqual(await snapshot(), expected);
  await stop();
  fs.copyFileSync(path.join(backup, 'test.db'), db);
  for (const suffix of ['-wal', '-shm']) fs.rmSync(db + suffix, { force: true });
  fs.rmSync(uploads, { recursive: true, force: true });
  fs.cpSync(path.join(backup, 'uploads'), uploads, { recursive: true });
  await start();
  await post('/api/auth/login', { username: env.AUTH_USERNAME, password: env.AUTH_DEV_INSECURE_PASSWORD });
  assert.deepEqual(await snapshot(), expected);
  assert.equal(digest(Buffer.from(await (await fetch(origin + photo.filePath)).arrayBuffer())), digest(png));
  assert.equal((await post(`/api/deliveries/${delivery.id}/finish`)).alreadyApplied, true);
  assert.deepEqual(await snapshot(), expected);
  console.log(JSON.stringify({ result: 'ok', processRestart: true, backupRestore: true, photoSha256: digest(png), balance: 40, totalSales: 100, stock: 3, pendingOrderPreserved: true, installedUpgradePreserved: true }));
} finally {
  await stop();
  fs.rmSync(root, { recursive: true, force: true });
}
