import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './migrations/runner';

export interface DbWrapper {
  all: (sql: string, ...params: any[]) => Promise<any[]>;
  get: (sql: string, ...params: any[]) => Promise<any | undefined>;
  run: (sql: string, ...params: any[]) => Promise<{ changes: number; lastInsertRowid: number | bigint }>;
  exec: (sql: string) => Promise<void>;
}

let dbInstance: DbWrapper | null = null;

function normalizeParams(params: any[]): any[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export async function getDb(): Promise<DbWrapper> {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = path.resolve(process.env.DATA_DIR || './data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'novo-hiper.db');
  const rawDb = new DatabaseSync(dbPath);

  // Performance e integridade
  rawDb.exec('PRAGMA journal_mode = WAL;');
  rawDb.exec('PRAGMA foreign_keys = ON;');
  rawDb.exec('PRAGMA synchronous = NORMAL;');

  const wrapper: DbWrapper = {
    async all(sql: string, ...params: any[]) {
      const cleanParams = normalizeParams(params);
      const stmt = rawDb.prepare(sql);
      const rows = cleanParams.length > 0 ? stmt.all(...cleanParams) : stmt.all();
      return rows.map((r: any) => ({ ...r }));
    },
    async get(sql: string, ...params: any[]) {
      const cleanParams = normalizeParams(params);
      const stmt = rawDb.prepare(sql);
      const row = cleanParams.length > 0 ? stmt.get(...cleanParams) : stmt.get();
      return row ? { ...row } : undefined;
    },
    async run(sql: string, ...params: any[]) {
      const cleanParams = normalizeParams(params);
      const trimmed = sql.trim().toUpperCase();
      if (
        cleanParams.length === 0 &&
        (trimmed.startsWith('BEGIN') ||
          trimmed.startsWith('COMMIT') ||
          trimmed.startsWith('ROLLBACK') ||
          trimmed.startsWith('PRAGMA'))
      ) {
        rawDb.exec(sql);
        return { changes: 0, lastInsertRowid: 0 };
      }
      const stmt = rawDb.prepare(sql);
      const result = cleanParams.length > 0 ? stmt.run(...cleanParams) : stmt.run();
      return {
        changes: Number(result.changes),
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    async exec(sql: string) {
      rawDb.exec(sql);
    },
  };

  // Evolução de schema: SOMENTE por migrations versionadas (backend/migrations). Ver docs/MIGRATIONS.md
  await runMigrations(wrapper);
  dbInstance = wrapper;
  return dbInstance;
}
