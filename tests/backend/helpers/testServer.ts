import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { assertSafeTestDbPath, TEST_DIR_PREFIX } from './safety';

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

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
  get: <T = any>(url: string) => Promise<ApiResult<T>>;
  post: <T = any>(url: string, body?: unknown) => Promise<ApiResult<T>>;
  put: <T = any>(url: string, body?: unknown) => Promise<ApiResult<T>>;
  patch: <T = any>(url: string, body?: unknown) => Promise<ApiResult<T>>;
  del: <T = any>(url: string) => Promise<ApiResult<T>>;
  close: () => Promise<void>;
}

const MANAGED_ENV = ['DATA_DIR', 'DATABASE_PATH', 'UPLOADS_DIR', 'NODE_ENV', 'CORS_ORIGIN'] as const;

/**
 * Sobe o app Express REAL do backend (sem mocks) numa porta efêmera de 127.0.0.1, apontando
 * para um banco SQLite recém-criado em diretório temporário. Cada chamada = banco novo, isolado.
 */
export interface StartOptions {
  /** Cria um banco PRÉ-EXISTENTE (ex.: schema antigo, sem migrations) antes de o backend abrir o arquivo. */
  seed?: (dbPath: string) => void;
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

  options.seed?.(dbPath);

  // O backend guarda o banco em um singleton de módulo: recarrega os módulos para ter um banco novo.
  vi.resetModules();
  const { app } = await import('../../../backend/app');
  const { getDb } = await import('../../../backend/db');
  const db = await getDb();

  // Verificação em tempo de execução: o SQLite realmente abriu o arquivo descartável?
  const dbList = await db.all('PRAGMA database_list');
  const main = dbList.find((r: any) => r.name === 'main');
  const openedFile = fs.realpathSync(main.file);
  if (openedFile !== fs.realpathSync(dbPath)) {
    throw new Error(`[SEGURANÇA DOS TESTES] O banco aberto (${openedFile}) não é o banco de teste (${dbPath}).`);
  }
  assertSafeTestDbPath(openedFile);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (method: string, url: string, body?: unknown): Promise<ApiResult> => {
    const res = await fetch(baseUrl + url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed };
  };

  return {
    baseUrl,
    dir,
    dbPath,
    db,
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
