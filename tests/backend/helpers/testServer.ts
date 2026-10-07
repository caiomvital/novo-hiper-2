import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { assertSafeTestDbPath, TEST_DIR_PREFIX } from './safety';

export interface ApiResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
  /** Cabeçalhos Set-Cookie crus desta resposta. */
  setCookie: string[];
}

/** Credencial EXPLICITAMENTE de dev/teste (variável AUTH_DEV_INSECURE_PASSWORD — recusada em produção). */
export const TEST_USERNAME = 'Bernardo';
export const TEST_PASSWORD = 'dev-only-test-password-1';

export interface TestServer {
  baseUrl: string;
  dir: string;
  dbPath: string;
  /** Acesso direto ao banco DESCARTÁVEL, para asserções (leitura/escrita de apoio). */
  db: {
    all: (sql: string, ...params: any[]) => Promise<any[]>;
    get: (sql: string, ...params: any[]) => Promise<any | undefined>;
    run: (sql: string, ...params: any[]) => Promise<any>;
  };
  /** Cookie de sessão atual (valor cru) ou undefined. */
  cookie: () => string | undefined;
  /** Faz login (por padrão com a credencial de teste) e guarda o cookie para as próximas chamadas. */
  login: (password?: string, username?: string) => Promise<ApiResult>;
  /** Esquece o cookie (comporta-se como cliente anônimo). */
  forgetCookie: () => void;
  /** Requisição com controle total (cabeçalhos extras, sem cookie etc.). */
  raw: (method: string, url: string, opts?: { body?: unknown; headers?: Record<string, string>; cookie?: string | false }) => Promise<ApiResult>;
  /** Simula reinício do processo: fecha o HTTP, recarrega os módulos e reabre o MESMO arquivo de banco. */
  restart: () => Promise<void>;
  get: <T = any>(url: string) => Promise<ApiResult<T>>;
  post: <T = any>(url: string, body?: unknown) => Promise<ApiResult<T>>;
  put: <T = any>(url: string, body?: unknown) => Promise<ApiResult<T>>;
  patch: <T = any>(url: string, body?: unknown) => Promise<ApiResult<T>>;
  del: <T = any>(url: string) => Promise<ApiResult<T>>;
  close: () => Promise<void>;
}

const MANAGED_ENV = [
  'DATA_DIR', 'DATABASE_PATH', 'UPLOADS_DIR', 'NODE_ENV', 'CORS_ORIGIN',
  'AUTH_USERNAME', 'AUTH_PASSWORD_HASH', 'AUTH_DEV_INSECURE_PASSWORD', 'SESSION_TTL_DAYS', 'ENABLE_LEGACY_MIGRATION',
  'ORDER_AUTOGEN', 'ORDER_COOLDOWN_MS',
] as const;

/**
 * Sobe o app Express REAL do backend (sem mocks) numa porta efêmera de 127.0.0.1, apontando
 * para um banco SQLite recém-criado em diretório temporário. Cada chamada = banco novo, isolado.
 */
export interface StartOptions {
  /** Cria um banco PRÉ-EXISTENTE (ex.: schema antigo, sem migrations) antes de o backend abrir o arquivo. */
  seed?: (dbPath: string) => void;
  /** Faz login automaticamente depois de subir (padrão: true). Use false para testar o cliente anônimo. */
  autoLogin?: boolean;
  /** Variáveis de ambiente adicionais/sobrescritas (undefined = remove). */
  env?: Partial<Record<(typeof MANAGED_ENV)[number], string | undefined>>;
}

export async function startTestServer(options: StartOptions = {}): Promise<TestServer> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), TEST_DIR_PREFIX));
  const dbPath = path.join(dir, 'test.db');
  // Proteção explícita ANTES de qualquer abertura de banco
  assertSafeTestDbPath(dbPath);

  const saved: Record<string, string | undefined> = {};
  for (const k of MANAGED_ENV) saved[k] = process.env[k];
  process.env.DATA_DIR = dir;
  process.env.DATABASE_PATH = dbPath;
  process.env.UPLOADS_DIR = path.join(dir, 'uploads');
  process.env.NODE_ENV = 'test';
  delete process.env.CORS_ORIGIN;
  process.env.AUTH_USERNAME = TEST_USERNAME;
  process.env.AUTH_DEV_INSECURE_PASSWORD = TEST_PASSWORD;
  delete process.env.AUTH_PASSWORD_HASH;
  delete process.env.SESSION_TTL_DAYS;
  delete process.env.ENABLE_LEGACY_MIGRATION;
  // Por padrão os testes NÃO geram pedidos automáticos (os testes antigos controlam seus próprios pedidos); os de geração ligam.
  process.env.ORDER_AUTOGEN = 'off';
  process.env.ORDER_COOLDOWN_MS = '0';
  for (const [k, v] of Object.entries(options.env ?? {})) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  options.seed?.(dbPath);

  let server!: import('node:http').Server;
  let baseUrl = '';
  let db!: TestServer['db'];

  // O backend guarda o banco em um singleton de módulo: recarrega os módulos para ter um banco novo (ou reabrir o mesmo arquivo).
  const boot = async () => {
    vi.resetModules();
    const { app } = await import('../../../backend/app');
    const { getDb } = await import('../../../backend/db');
    db = await getDb();

    // Verificação em tempo de execução: o SQLite realmente abriu o arquivo descartável?
    const dbList = await db.all('PRAGMA database_list');
    const main = dbList.find((r: any) => r.name === 'main');
    const openedFile = fs.realpathSync(main.file);
    if (openedFile !== fs.realpathSync(dbPath)) {
      throw new Error(`[SEGURANÇA DOS TESTES] O banco aberto (${openedFile}) não é o banco de teste (${dbPath}).`);
    }
    assertSafeTestDbPath(openedFile);

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  };
  await boot();

  let sessionCookie: string | undefined;

  const raw: TestServer['raw'] = async (method, url, opts = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const cookie = opts.cookie === false ? undefined : (opts.cookie ?? sessionCookie);
    if (cookie) headers['Cookie'] = `nh_session=${cookie}`;
    const res = await fetch(baseUrl + url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed, headers: res.headers, setCookie: res.headers.getSetCookie?.() ?? [] };
  };
  const request = (method: string, url: string, body?: unknown) => raw(method, url, { body });

  const login: TestServer['login'] = async (password = TEST_PASSWORD, username = TEST_USERNAME) => {
    const res = await raw('POST', '/api/auth/login', { body: { username, password }, cookie: false });
    const sc = res.setCookie.find((c) => c.startsWith('nh_session='));
    if (res.status === 200 && sc) sessionCookie = sc.split(';')[0].slice('nh_session='.length);
    return res;
  };
  if (options.autoLogin !== false) {
    const r = await login();
    if (r.status !== 200) throw new Error(`login de teste falhou: ${r.status} ${JSON.stringify(r.body)}`);
  }

  return {
    get baseUrl() {
      return baseUrl;
    },
    dir,
    dbPath,
    get db() {
      return db;
    },
    cookie: () => sessionCookie,
    login,
    forgetCookie: () => {
      sessionCookie = undefined;
    },
    raw,
    restart: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await boot();
    },
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body ?? {}),
    put: (url, body) => request('PUT', url, body ?? {}),
    patch: (url, body) => request('PATCH', url, body ?? {}),
    del: (url) => request('DELETE', url),
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      for (const k of MANAGED_ENV) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
