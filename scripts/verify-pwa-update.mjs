// Duas versões de build em /tmp + API descartável. Não usa dados de produção.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { generateSW } from 'workbox-build';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nh-pwa-update-'));
const first = path.join(dir, 'first'), second = path.join(dir, 'second');
let browser, server, api;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  fs.cpSync('dist', first, { recursive: true }); fs.cpSync('dist', second, { recursive: true });
  const html = fs.readFileSync(path.join(second, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(second, 'index.html'), html.replace('</head>', '<meta name="nh-test-version" content="second"></head>'));
  const js = fs.readdirSync(path.join(second, 'assets')).find(name => name.startsWith('index-') && name.endsWith('.js') && fs.statSync(path.join(second, 'assets', name)).size < 1_000_000);
  fs.appendFileSync(path.join(second, 'assets', js), '\nwindow.__nhPwaVersion = "second";\n');
  await generateSW({ globDirectory: second, swDest: path.join(second, 'sw.js'), globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'], globIgnores: ['sw.js','workbox-*.js'], maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, navigateFallback: '/index.html', skipWaiting: false, clientsClaim: true, cleanupOutdatedCaches: true });
  api = spawn(process.execPath, ['scripts/e2e-isolated-backend.mjs'], { env: { ...process.env, E2E_ISOLATED_API_PORT: '4323', ORDER_AUTOGEN: 'off', ORDER_COOLDOWN_MS: '0' }, stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:4323/api/health')).ok) { ready = true; break; } } catch {} await delay(100); }
  assert(ready, 'API descartável disponível');
  let current = first;
  server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const headers = { ...req.headers };
        headers['x-forwarded-host'] = req.headers.host;
        const upstream = await fetch('http://127.0.0.1:4323' + req.url, { method: req.method, headers, body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
        res.writeHead(upstream.status, Object.fromEntries(upstream.headers)); res.end(Buffer.from(await upstream.arrayBuffer())); return;
      }
      const url = decodeURIComponent(req.url.split('?')[0]);
      const target = path.join(current, url === '/' ? 'index.html' : url);
      if (!target.startsWith(current + path.sep)) { res.writeHead(403); res.end(); return; }
      if (!fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(target));
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(5182, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5182', viewport: { width: 390, height: 640 }, hasTouch: true });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:5182');
  page.on('response', async response => { if (response.url().endsWith('/api/auth/login') && response.status() !== 200) console.log('login test status', response.status(), (await response.json()).error); });
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.locator('#login-username').fill('Bernardo'); await page.locator('#login-password').fill('dev-only-test-password-1'); await page.locator('#btn-submit-login').click();
  await page.locator('#tab-btn-catalog').waitFor();
  const p = await page.request.post('/api/plants', { data: { id: 'e2e_pwa_plant', name: 'Planta preservada', price: 100, stock_quantity: 5, image_path: '/pwa-192x192.png' } }); assert.equal(p.status(), 201);
  const order = await page.request.post('/api/orders', { data: { id: 'e2e_pwa_order', customer_name: 'Cliente PWA', destination_id: 'dest_manual', items: [{ plant_id: 'e2e_pwa_plant', quantity: 1 }] } }); assert.equal(order.status(), 201);
  const delivery = await (await page.request.post('/api/deliveries/start', { data: { order_id: 'e2e_pwa_order' } })).json();
  assert((await page.request.post(`/api/deliveries/${delivery.id}/finish`)).ok());
  assert((await page.request.post('/api/shop/upgrades/placa_madeira/purchase')).ok()); assert((await page.request.post('/api/shop/upgrades/placa_madeira/install')).ok());
  await page.evaluate(() => localStorage.setItem('nh-update-preserved', 'endereço e preferência preservados'));
  await page.reload();
  await page.getByRole('button', { name: 'Cadastrar planta', exact: true }).click();
  await page.locator('#input-plant-name').fill('Edição ainda aberta');
  current = second;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting), null, { timeout: 30000 });
  assert.equal(await page.locator('#btn-pwa-update').count(), 0);
  assert.equal(await page.locator('#input-plant-name').inputValue(), 'Edição ainda aberta');
  assert.equal(await page.evaluate(() => window.__nhPwaVersion), undefined);
  await page.locator('#btn-close-form').click();
  await page.locator('#btn-pwa-update').waitFor({ timeout: 30000 });
  await page.locator('#btn-pwa-update').click();
  await page.waitForFunction(() => window.__nhPwaVersion === 'second', null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('nh-update-preserved')), 'endereço e preferência preservados');
  assert.equal((await (await page.request.get('/api/plants')).json()).find(p => p.id === 'e2e_pwa_plant').stock_quantity, 4);
  assert.equal((await (await page.request.get('/api/cash')).json()).balance, 40);
  assert.equal((await (await page.request.get('/api/shop')).json()).upgrades.find(u => u.id === 'placa_madeira').state, 'installed');
  await page.locator('#tab-btn-catalog').waitFor();
  await page.getByText('Planta preservada', { exact: true }).first().waitFor();
  await page.screenshot({ path: 'docs/evidence/milestone-nine/pwa-atualizada.png' });
  const manifest = await (await page.request.get('/manifest.webmanifest')).json(); assert.equal(manifest.display, 'standalone'); assert.equal(manifest.orientation, 'any');
  const assets = await page.evaluate(async () => { const cache = await caches.open((await caches.keys()).find(key => key.startsWith('workbox-precache'))); return (await cache.keys()).map(req => req.url); });
  assert(assets.some(url => url.includes('novo-hiper-depth-v1'))); assert(assets.some(url => url.includes('bernardo')));
  console.log(JSON.stringify({ update: 'old page waits for confirmation; new code executes after update', session: 'preserved', plantStock: 4, cash: 40, upgrade: 'installed', localStorage: 'preserved', cachedAssets: assets.length }));
} finally {
  await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); api?.kill('SIGTERM'); await delay(500); fs.rmSync(dir, { recursive: true, force: true });
}
