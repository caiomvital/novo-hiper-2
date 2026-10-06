import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthConfigError, loadAuthConfig } from '../../backend/auth/config';
import { hashPassword, parsePasswordHash, verifyPassword } from '../../backend/auth/password';
import { PUBLIC_API_ROUTES } from '../../backend/auth/middleware';
import { startTestServer, TEST_PASSWORD, TEST_USERNAME, TestServer } from './helpers/testServer';

const servers: TestServer[] = [];
async function boot(options: Parameters<typeof startTestServer>[0] = {}) {
  const s = await startTestServer(options);
  servers.push(s);
  return s;
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const s of servers.splice(0)) await s.close();
});

const DAY = 24 * 60 * 60 * 1000;
const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const PROD_PASSWORD = 'senha-de-producao-so-para-teste-123'; // nunca é a senha real; gerada só para estes testes
const prodEnv = () => ({ NODE_ENV: 'production', AUTH_USERNAME: 'Bernardo', AUTH_PASSWORD_HASH: hashPassword(PROD_PASSWORD), AUTH_DEV_INSECURE_PASSWORD: undefined });

describe('login', () => {
  it('credencial correta → 200, cookie de sessão; o corpo NÃO traz token nem segredo reutilizável', async () => {
    const s = await boot({ autoLogin: false });
    const res = await s.login();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, user: TEST_USERNAME });
    expect(Object.keys(res.body).sort()).toEqual(['expiresAt', 'success', 'user']);
    const cookie = s.cookie()!;
    expect(cookie).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(res.body)).not.toContain(cookie);
    expect(JSON.stringify(res.body)).not.toContain(TEST_PASSWORD);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('o cookie é HttpOnly, SameSite=Strict, Path=/, 30 dias — e NÃO é Secure fora de produção', async () => {
    const s = await boot({ autoLogin: false });
    const res = await s.login();
    const c = res.setCookie.find((x) => x.startsWith('nh_session='))!;
    expect(c).toMatch(/;\s*HttpOnly/i);
    expect(c).toMatch(/;\s*SameSite=Strict/i);
    expect(c).toMatch(/;\s*Path=\//i);
    expect(c).toMatch(new RegExp(`Max-Age=${30 * 24 * 60 * 60}`));
    expect(c).not.toMatch(/;\s*Secure/i);
  });

  it('em PRODUÇÃO o cookie também é Secure (e a credencial vem do hash scrypt do ambiente)', async () => {
    const s = await boot({ autoLogin: false, env: prodEnv() });
    const res = await s.login(PROD_PASSWORD);
    expect(res.status).toBe(200);
    const c = res.setCookie.find((x) => x.startsWith('nh_session='))!;
    expect(c).toMatch(/;\s*Secure/i);
    expect(c).toMatch(/;\s*HttpOnly/i);
    expect(c).toMatch(/;\s*SameSite=Strict/i);
    // a senha de DESENVOLVIMENTO não funciona em produção
    expect((await s.login(TEST_PASSWORD)).status).toBe(401);
  });

  it('senha ou usuário incorretos → 401 com a MESMA mensagem, sem cookie', async () => {
    const s = await boot({ autoLogin: false });
    const badPass = await s.login('senha-errada-123');
    const badUser = await s.login(TEST_PASSWORD, 'outra-pessoa');
    expect(badPass.status).toBe(401);
    expect(badUser.status).toBe(401);
    expect(badPass.body).toEqual(badUser.body);
    expect(badPass.setCookie).toEqual([]);
    expect(badUser.setCookie).toEqual([]);
    expect(s.cookie()).toBeUndefined();
  });

  it('corpo inválido → 400; ambiente sem credencial configurada → 503 (login indisponível)', async () => {
    const s = await boot({ autoLogin: false });
    expect((await s.raw('POST', '/api/auth/login', { body: {}, cookie: false })).status).toBe(400);
    expect((await s.raw('POST', '/api/auth/login', { body: { username: 'a', password: 123 }, cookie: false })).status).toBe(400);
    const none = await boot({ autoLogin: false, env: { AUTH_DEV_INSECURE_PASSWORD: undefined } });
    const r = await none.raw('POST', '/api/auth/login', { body: { username: 'Bernardo', password: 'x'.repeat(12) }, cookie: false });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('AUTH_NOT_CONFIGURED');
  });

  it('limite de tentativas: 5 falhas bloqueiam o cliente (429 + Retry-After), inclusive com a senha certa', async () => {
    const s = await boot({ autoLogin: false });
    for (let i = 0; i < 5; i++) expect((await s.login(`errada-${i}-xxxxx`)).status).toBe(401);
    const blocked = await s.login(); // senha correta, mas bloqueado
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(blocked.setCookie).toEqual([]);
  });

  it('um login bem-sucedido zera o contador de falhas', async () => {
    const s = await boot({ autoLogin: false });
    for (let i = 0; i < 4; i++) await s.login(`errada-${i}-xxxxx`);
    expect((await s.login()).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await s.login(`errada-${i}-yyyyy`)).status).toBe(401);
  });
});

describe('sessão (validada SEMPRE no servidor)', () => {
  it('GET /api/auth/session: válida → 200 authenticated; sem cookie / cookie lixo / token bem-formado inexistente → 401', async () => {
    const s = await boot({ autoLogin: false });
    expect((await s.get('/api/auth/session')).status).toBe(401);
    await s.login();
    const ok = await s.get('/api/auth/session');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ authenticated: true, user: TEST_USERNAME });
    expect((await s.raw('GET', '/api/auth/session', { cookie: 'lixo' })).status).toBe(401);
    expect((await s.raw('GET', '/api/auth/session', { cookie: crypto.randomBytes(32).toString('base64url') })).status).toBe(401);
    expect((await s.raw('GET', '/api/auth/session', { cookie: false })).status).toBe(401);
  });

  it('um flag/valor no navegador não autentica: só o token que existe no banco', async () => {
    const s = await boot();
    const res = await s.raw('GET', '/api/plants', { cookie: false, headers: { Cookie: 'novo_hiper_session_auth={"user":"Bernardo"}; logged_in=true' } });
    expect(res.status).toBe(401);
  });

  it('sessão EXPIRADA → 401 e a linha é removida', async () => {
    const s = await boot();
    const id = sha256(s.cookie()!);
    await s.db.run('UPDATE sessions SET expires_at = ? WHERE id = ?', Date.now() - 1000, id);
    expect((await s.get('/api/plants')).status).toBe(401);
    expect(await s.db.get('SELECT id FROM sessions WHERE id = ?', id)).toBeUndefined();
  });

  it('sessão deslizante: uso depois de 1h renova o prazo para ~30 dias; uso imediato não escreve', async () => {
    const s = await boot();
    const id = sha256(s.cookie()!);
    const before = await s.db.get('SELECT * FROM sessions WHERE id = ?', id);
    await s.get('/api/plants');
    expect(await s.db.get('SELECT * FROM sessions WHERE id = ?', id)).toEqual(before); // sem escrita
    await s.db.run('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?', Date.now() - 2 * 3600_000, Date.now() + 2 * DAY, id);
    await s.get('/api/plants');
    const after = await s.db.get('SELECT * FROM sessions WHERE id = ?', id);
    expect(after.expires_at).toBeGreaterThan(Date.now() + 29 * DAY);
  });

  it('o token NUNCA é gravado: o banco guarda apenas o SHA-256', async () => {
    const s = await boot();
    const token = s.cookie()!;
    const rows = await s.db.all('SELECT * FROM sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sha256(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('PERSISTE depois de reinício simulado do app (processo novo, mesmo banco)', async () => {
    const s = await boot();
    const cookie = s.cookie();
    expect((await s.get('/api/auth/session')).status).toBe(200);
    await s.restart();
    expect(s.cookie()).toBe(cookie);
    expect((await s.get('/api/auth/session')).status).toBe(200);
    expect((await s.get('/api/plants')).status).toBe(200);
  });

  it('login limpa sessões expiradas (sem cron)', async () => {
    const s = await boot();
    await s.db.run('INSERT INTO sessions (id, created_at, last_seen_at, expires_at) VALUES (?, 1, 1, 2), (?, 1, 1, 3)', 'velha1', 'velha2');
    await s.login();
    expect((await s.db.all("SELECT id FROM sessions WHERE id LIKE 'velha%'"))).toEqual([]);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM sessions')).n).toBe(2); // a do autoLogin + a nova
  });
});

describe('logout', () => {
  it('invalida a sessão NO SERVIDOR e limpa o cookie; o mesmo cookie deixa de funcionar', async () => {
    const s = await boot();
    const cookie = s.cookie()!;
    const res = await s.post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cleared = res.setCookie.find((c) => c.startsWith('nh_session='))!;
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    expect(await s.db.get('SELECT id FROM sessions WHERE id = ?', sha256(cookie))).toBeUndefined();
    // reutilizar o cookie ANTIGO (ex.: roubado/copiado) já não funciona
    expect((await s.raw('GET', '/api/plants', { cookie })).status).toBe(401);
    expect((await s.raw('GET', '/api/auth/session', { cookie })).status).toBe(401);
  });

  it('é idempotente e público: sem sessão também responde 200', async () => {
    const s = await boot({ autoLogin: false });
    expect((await s.raw('POST', '/api/auth/logout', { cookie: false })).status).toBe(200);
    expect((await s.raw('POST', '/api/auth/logout', { cookie: 'qualquer-coisa' })).status).toBe(200);
  });

  it('só encerra a sessão do próprio cookie (outra sessão continua válida)', async () => {
    const s = await boot();
    const first = s.cookie()!;
    await s.login();
    const second = s.cookie()!;
    expect(second).not.toBe(first);
    await s.post('/api/auth/logout');
    expect((await s.raw('GET', '/api/plants', { cookie: first })).status).toBe(200);
  });
});

/** Descobre TODAS as rotas registradas no app Express (método + caminho completo). */
function enumerateRoutes(app: any): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  const mountOf = (layer: any): string => {
    const src: string = layer.regexp.source;
    if (src === '^\\/?(?=\\/|$)') return '';
    return src.replace(/^\^/, '').replace(/\\\//g, '/').replace(/\/\?\(\?=\/\|\$\)$/, '').replace(/\(\?:\(\[\^\/\]\+\?\)\)/g, ':p');
  };
  const walk = (stack: any[], base: string) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const m of Object.keys(layer.route.methods)) out.push({ method: m.toUpperCase(), path: base + layer.route.path });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, base + mountOf(layer));
      }
    }
  };
  walk(app._router.stack, '');
  return out.filter((r) => r.path.startsWith('/api'));
}

describe('fronteira pública × privada (TODAS as rotas /api enumeradas)', () => {
  it('a allowlist pública é exatamente: GET /api/health, POST /api/auth/login, POST /api/auth/logout', () => {
    expect(PUBLIC_API_ROUTES.map((r) => `${r.method} ${r.path}`).sort()).toEqual(['GET /api/health', 'POST /api/auth/login', 'POST /api/auth/logout']);
  });

  it('anônimo → 401 em TODA rota privada; com sessão nenhuma rota responde 401; públicas respondem sem sessão', async () => {
    const s = await boot();
    const { app } = await import('../../backend/app');
    const routes = enumerateRoutes(app);
    expect(routes.length).toBeGreaterThanOrEqual(30); // garante que a enumeração realmente encontrou a API

    const publicSet = new Set(PUBLIC_API_ROUTES.map((r) => `${r.method} ${r.path}`));
    const found = new Set(routes.map((r) => `${r.method} ${r.path}`));
    for (const p of publicSet) expect(found.has(p), `rota pública inexistente: ${p}`).toBe(true);

    const privateRoutes = routes.filter((r) => !publicSet.has(`${r.method} ${r.path}`));
    expect(privateRoutes.length).toBeGreaterThan(25);
    const withSession: string[] = [];
    for (const r of privateRoutes) {
      const url = r.path.replace(/:[A-Za-z_]+/g, 'x');
      const anon = await s.raw(r.method, url, { cookie: false, body: ['POST', 'PUT', 'PATCH'].includes(r.method) ? {} : undefined });
      expect(anon.status, `${r.method} ${r.path} (anônimo)`).toBe(401);
      expect(anon.body.code).toBe('UNAUTHENTICATED');
      const auth = await s.raw(r.method, url, { body: ['POST', 'PUT', 'PATCH'].includes(r.method) ? {} : undefined });
      expect(auth.status, `${r.method} ${r.path} (com sessão)`).not.toBe(401);
      withSession.push(`${r.method} ${r.path} → ${auth.status}`);
    }
    // públicas funcionam sem sessão
    expect((await s.raw('GET', '/api/health', { cookie: false })).status).toBe(200);
    expect((await s.raw('POST', '/api/auth/logout', { cookie: false })).status).toBe(200);
    expect((await s.raw('POST', '/api/auth/login', { cookie: false, body: {} })).status).toBe(400); // alcançável (validação), não 401
    expect(withSession.length).toBe(privateRoutes.length);
  });

  it('caminhos inexistentes sob /api: anônimo 401 (não revela rotas); com sessão 404', async () => {
    const s = await boot();
    expect((await s.raw('GET', '/api/nao-existe', { cookie: false })).status).toBe(401);
    expect((await s.raw('POST', '/api/plants/../orders', { cookie: false, body: {} })).status).toBe(401);
    expect((await s.get('/api/nao-existe')).status).toBe(404);
  });

  it('variações de caminho não contornam a proteção (barra final, maiúsculas, query string)', async () => {
    const s = await boot();
    for (const u of ['/api/plants/', '/api/PLANTS', '/api/plants?x=1', '/api//plants', '/api/plants/.', '/api/health/../plants']) {
      const r = await s.raw('GET', u, { cookie: false });
      expect([401, 404], u).toContain(r.status);
      if (r.status === 404) expect(JSON.stringify(r.body)).not.toMatch(/plant_|stock_quantity/); // nunca devolve dados
    }
  });

  it('/uploads (fotos de plantas) é público de propósito: sem sessão não dá 401', async () => {
    const s = await boot({ autoLogin: false });
    const r = await s.raw('GET', '/uploads/plants/inexistente.jpg', { cookie: false });
    expect(r.status).toBe(404);
  });

  it('dados privados nunca vazam sem sessão (GET de plantas/pedidos/caixa)', async () => {
    const s = await boot();
    await s.post('/api/plants', { id: 'p_secreta', name: 'Segredo', price: 1, stock_quantity: 1, image_path: '/a.jpg' });
    for (const u of ['/api/plants', '/api/orders', '/api/cash', '/api/cash/summary', '/api/deliveries', '/api/customers', '/api/game/current']) {
      const r = await s.raw('GET', u, { cookie: false });
      expect(r.status, u).toBe(401);
      expect(JSON.stringify(r.body)).not.toContain('Segredo');
    }
  });
});

describe('CSRF (SameSite=Strict + validação de Origin/Sec-Fetch-Site em métodos mutáveis)', () => {
  const evil = { Origin: 'https://evil.example' };

  it('POST/PUT/DELETE/PATCH com sessão válida mas Origin de outro site → 403 CSRF_BLOCKED, sem efeito', async () => {
    const s = await boot();
    const p = await s.post('/api/plants', { id: 'p_csrf', name: 'X', price: 1, stock_quantity: 1, image_path: '/a.jpg' });
    expect(p.status).toBe(201);
    for (const [method, url, body] of [
      ['POST', '/api/plants', { name: 'Y', price: 1, stock_quantity: 1, image_path: '/a.jpg' }],
      ['PUT', '/api/plants/p_csrf', { name: 'Hack', price: 99, stock_quantity: 99 }],
      ['DELETE', '/api/plants/p_csrf', undefined],
      ['POST', '/api/auth/logout', {}],
    ] as const) {
      const r = await s.raw(method, url, { headers: evil, body });
      expect(r.status, `${method} ${url}`).toBe(403);
      expect(r.body.code).toBe('CSRF_BLOCKED');
    }
    const plant = await s.get('/api/plants/p_csrf');
    expect(plant.body).toMatchObject({ name: 'X', price: 1 });
    expect(await s.db.get('SELECT id FROM sessions')).toBeDefined(); // o logout forjado não derrubou a sessão
  });

  it('login forjado de outro site (login CSRF) também é bloqueado', async () => {
    const s = await boot({ autoLogin: false });
    const r = await s.raw('POST', '/api/auth/login', { cookie: false, headers: evil, body: { username: TEST_USERNAME, password: TEST_PASSWORD } });
    expect(r.status).toBe(403);
    expect(r.setCookie).toEqual([]);
  });

  it('Sec-Fetch-Site cross-site/same-site e Origin "null" são bloqueados mesmo sem Origin válido', async () => {
    const s = await boot();
    const body = { name: 'Z', price: 1, stock_quantity: 1, image_path: '/a.jpg' };
    expect((await s.raw('POST', '/api/plants', { headers: { 'Sec-Fetch-Site': 'cross-site' }, body })).status).toBe(403);
    expect((await s.raw('POST', '/api/plants', { headers: { 'Sec-Fetch-Site': 'same-site' }, body })).status).toBe(403);
    expect((await s.raw('POST', '/api/plants', { headers: { Origin: 'null' }, body })).status).toBe(403);
  });

  it('mesma origem do PWA funciona: Origin igual ao Host, Sec-Fetch-Site same-origin e clientes sem cabeçalhos (curl)', async () => {
    const s = await boot();
    const mk = (id: string) => ({ id, name: 'Ok', price: 1, stock_quantity: 1, image_path: '/a.jpg' });
    expect((await s.raw('POST', '/api/plants', { headers: { Origin: s.baseUrl }, body: mk('p_a') })).status).toBe(201);
    expect((await s.raw('POST', '/api/plants', { headers: { 'Sec-Fetch-Site': 'same-origin' }, body: mk('p_b') })).status).toBe(201);
    expect((await s.raw('POST', '/api/plants', { headers: { 'Sec-Fetch-Site': 'none' }, body: mk('p_c') })).status).toBe(201);
    expect((await s.raw('POST', '/api/plants', { body: mk('p_d') })).status).toBe(201);
    // atrás do Nginx: Host/X-Forwarded-Host é o domínio público
    expect((await s.raw('POST', '/api/plants', { headers: { Origin: 'https://novohiper.fluxos.dev.br', 'X-Forwarded-Host': 'novohiper.fluxos.dev.br' }, body: mk('p_e') })).status).toBe(201);
  });

  it('métodos seguros (GET) não são bloqueados por Origin; CORS_ORIGIN explícito é respeitado', async () => {
    const s = await boot({ env: { CORS_ORIGIN: 'https://app.exemplo.com.br' } });
    expect((await s.raw('GET', '/api/plants', { headers: { Origin: 'https://app.exemplo.com.br' } })).status).toBe(200);
    expect((await s.raw('POST', '/api/plants', { headers: { Origin: 'https://app.exemplo.com.br' }, body: { id: 'p_cors', name: 'x', price: 1, stock_quantity: 1, image_path: '/a.jpg' } })).status).toBe(201);
    expect((await s.raw('POST', '/api/plants', { headers: evil, body: { name: 'x', price: 1, stock_quantity: 1, image_path: '/a.jpg' } })).status).not.toBe(201);
  });
});

describe('credenciais e fail-fast', () => {
  const hash = hashPassword('uma-senha-longa-de-teste');

  it('PRODUÇÃO sem AUTH_PASSWORD_HASH → erro (sem senha padrão)', () => {
    expect(() => loadAuthConfig({ NODE_ENV: 'production', AUTH_USERNAME: 'Bernardo' } as any)).toThrow(AuthConfigError);
    expect(() => loadAuthConfig({ NODE_ENV: 'production', AUTH_USERNAME: 'Bernardo' } as any)).toThrow(/AUTH_PASSWORD_HASH é obrigatório/);
  });
  it('PRODUÇÃO sem AUTH_USERNAME → erro', () => {
    expect(() => loadAuthConfig({ NODE_ENV: 'production', AUTH_PASSWORD_HASH: hash } as any)).toThrow(/AUTH_USERNAME/);
  });
  it('PRODUÇÃO recusa o hash SHA-256 antigo e hashes malformados/fracos', () => {
    const oldSha = 'dd1749e9e97004e46f4208d372ba40b4ae5e34521c8e8da05c9708ab7c20c9cd';
    for (const bad of [oldSha, 'scrypt:1:8:1:AAAA:BBBB', 'scrypt:16384:8:1:curto:curto', 'scrypt$16384$8$1$AAAAAAAAAAAAAAAA$BBBB', 'qualquer-coisa']) {
      expect(() => loadAuthConfig({ NODE_ENV: 'production', AUTH_USERNAME: 'B', AUTH_PASSWORD_HASH: bad } as any), bad).toThrow(AuthConfigError);
    }
  });
  it('PRODUÇÃO recusa a variável de dev AUTH_DEV_INSECURE_PASSWORD', () => {
    expect(() => loadAuthConfig({ NODE_ENV: 'production', AUTH_USERNAME: 'B', AUTH_PASSWORD_HASH: hash, AUTH_DEV_INSECURE_PASSWORD: 'x'.repeat(12) } as any)).toThrow(/não pode ser usada em produção/);
  });
  it('PRODUÇÃO com configuração válida: Secure + 30 dias + senha correta/incorreta', () => {
    const cfg = loadAuthConfig({ NODE_ENV: 'production', AUTH_USERNAME: 'B', AUTH_PASSWORD_HASH: hash } as any);
    expect(cfg.mode).toBe('production');
    expect(cfg.cookieSecure).toBe(true);
    expect(cfg.sessionTtlMs).toBe(30 * DAY);
    expect(cfg.checkPassword('uma-senha-longa-de-teste')).toBe(true);
    expect(cfg.checkPassword('outra')).toBe(false);
  });
  it('fora de produção sem credencial: modo "unconfigured" (login indisponível), nunca uma senha padrão', () => {
    const cfg = loadAuthConfig({ NODE_ENV: 'development' } as any);
    expect(cfg.mode).toBe('unconfigured');
    expect(cfg.checkPassword('qualquer-coisa-123')).toBe(false);
    expect(cfg.checkPassword('NovoHiper2026')).toBe(false);
  });
  it('SESSION_TTL_DAYS inválido é recusado', () => {
    expect(() => loadAuthConfig({ SESSION_TTL_DAYS: '0' } as any)).toThrow();
    expect(() => loadAuthConfig({ SESSION_TTL_DAYS: '9999' } as any)).toThrow();
  });

  it('scrypt: hash verifica a senha certa, recusa a errada, é salgado (dois hashes diferentes) e tem formato validado', () => {
    const a = hashPassword('abc-def-ghi-jkl');
    const b = hashPassword('abc-def-ghi-jkl');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt:16384:8:1:')).toBe(true);
    expect(a).not.toContain('$'); // seguro para .env/docker compose
    expect(verifyPassword('abc-def-ghi-jkl', parsePasswordHash(a)!)).toBe(true);
    expect(verifyPassword('abc-def-ghi-jkm', parsePasswordHash(a)!)).toBe(false);
    expect(a).not.toContain('abc-def-ghi-jkl');
  });

  it('o SERVIDOR (server.ts) NÃO sobe em produção sem a credencial obrigatória (fail-fast, sem abrir banco)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novo-hiper-test-failfast-'));
    try {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: path.resolve('.'),
      env: { PATH: process.env.PATH, NODE_ENV: 'production', AUTH_USERNAME: 'Bernardo', DATA_DIR: tmp, DATABASE_PATH: path.join(tmp, 'x.db'), UPLOADS_DIR: path.join(tmp, 'u'), PORT: '0' },
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toMatch(/AUTH_PASSWORD_HASH é obrigatório/);
    expect(r.stderr + r.stdout).not.toMatch(/Servidor rodando/);
    // e também sem o usuário
    const r2 = spawnSync(process.execPath, ['--import', 'tsx', 'server.ts'], {
      cwd: path.resolve('.'),
      env: { PATH: process.env.PATH, NODE_ENV: 'production', DATA_DIR: tmp, DATABASE_PATH: path.join(tmp, 'x.db'), UPLOADS_DIR: path.join(tmp, 'u'), PORT: '0' },
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(r2.status).not.toBe(0);
    expect(r2.stderr + r2.stdout).toMatch(/AUTH_USERNAME é obrigatório/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('scripts/hash-password.mjs gera um hash que verifica; a senha não aparece na saída; senha curta é recusada', () => {
    const run = (pw: string) => spawnSync(process.execPath, ['scripts/hash-password.mjs', '--stdin'], { input: pw, encoding: 'utf8', cwd: path.resolve('.') });
    const ok = run('senha-muito-segura-123');
    expect(ok.status).toBe(0);
    const out = ok.stdout.trim();
    expect(out).not.toContain('senha-muito-segura-123');
    expect(verifyPassword('senha-muito-segura-123', parsePasswordHash(out)!)).toBe(true);
    const short = run('curta');
    expect(short.status).toBe(1);
    expect(short.stdout).toBe('');
  });
});

describe('segredos nunca em logs', () => {
  it('login (ok e falho), uso autenticado, logout e erros não registram senha, token/cookie nem hash', async () => {
    const lines: string[] = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lines.push(a.map(String).join(' ')));
    }
    const s = await boot({ autoLogin: false });
    await s.login('senha-errada-x-1234');
    await s.login();
    const token = s.cookie()!;
    await s.get('/api/plants');
    await s.get('/api/rota-inexistente');
    await s.post('/api/orders', { items: 'quebrado' });
    await s.post('/api/auth/logout');
    await s.raw('GET', '/api/plants', { cookie: token }); // 401 com o token já revogado
    const all = lines.join('\n');
    expect(all).not.toContain(TEST_PASSWORD);
    expect(all).not.toContain('senha-errada-x-1234');
    expect(all).not.toContain(token);
    expect(all).not.toContain(sha256(token));
    expect(all).not.toMatch(/scrypt:/);
  });
});

describe('/api/migration (importação legada)', () => {
  const payload = { plants: [{ id: 'leg_1', name: 'Importada', price: 5, stock: 2, photoUrl: '/a.jpg' }], cashRegister: { balance: 777, salesHistory: [{ id: 'v1', value: 777, plantName: 'x' }] } };

  it('exige sessão (anônimo → 401), inclusive o status', async () => {
    const s = await boot();
    expect((await s.raw('GET', '/api/migration/status', { cookie: false })).status).toBe(401);
    expect((await s.raw('POST', '/api/migration', { cookie: false, body: payload })).status).toBe(401);
    expect((await s.get('/api/migration/status')).status).toBe(200);
  });

  it('PRODUÇÃO: DESATIVADA por padrão (403 LEGACY_MIGRATION_DISABLED) mesmo com sessão; nada é importado', async () => {
    const s = await boot({ autoLogin: false, env: prodEnv() });
    await s.login(PROD_PASSWORD);
    const status = await s.get('/api/migration/status');
    expect(status.body.legacyMigrationEnabled).toBe(false);
    const r = await s.post('/api/migration', payload);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('LEGACY_MIGRATION_DISABLED');
    expect((await s.db.get('SELECT COUNT(*) AS n FROM plants')).n).toBe(0);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM cash_transactions')).n).toBe(0);
  });

  it('PRODUÇÃO com ENABLE_LEGACY_MIGRATION=true: só importa para banco SEM operações; depois recusa (409)', async () => {
    const s = await boot({ autoLogin: false, env: { ...prodEnv(), ENABLE_LEGACY_MIGRATION: 'true' } });
    await s.login(PROD_PASSWORD);
    expect((await s.get('/api/migration/status')).body.legacyMigrationEnabled).toBe(true);
    const first = await s.post('/api/migration', payload);
    expect(first.status).toBe(200);
    expect((await s.db.get('SELECT COUNT(*) AS n FROM plants')).n).toBe(1);
    // agora o banco tem operações (a importação legada cria crédito de caixa): não aceita nova importação
    await s.db.run("INSERT INTO cash_transactions (id, amount, type, created_at) VALUES ('x', 1, 'credit', 1)");
    const second = await s.post('/api/migration', payload);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('MIGRATION_NOT_ALLOWED');
  });

  it('banco com pedidos/entregas/caixa recusa a importação mesmo em desenvolvimento (não mescla dinheiro)', async () => {
    const s = await boot();
    await s.db.run("INSERT INTO cash_transactions (id, amount, type, created_at) VALUES ('existente', 5, 'credit', 1)");
    const r = await s.post('/api/migration', payload);
    expect(r.status).toBe(409);
    expect((await s.get('/api/cash/summary')).body.balance).toBe(5); // os 777 forjados NÃO entraram
  });

  it('fora de produção (dev/teste) segue habilitada em banco vazio', async () => {
    const s = await boot();
    expect((await s.get('/api/migration/status')).body.legacyMigrationEnabled).toBe(true);
    expect((await s.post('/api/migration', { plants: payload.plants })).status).toBe(200);
  });
});
