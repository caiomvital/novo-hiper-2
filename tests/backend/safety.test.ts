import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertEnvironmentIsSafeForTests, assertSafeTestDbPath, TEST_DIR_PREFIX, UnsafeTestDatabaseError } from './helpers/safety';
import { startTestServer } from './helpers/testServer';

describe('proteção do runner: recusa bancos reais', () => {
  const refused = [
    '/root/novo-hiper/data/novo-hiper.db',
    '/root/novo-hiper/data/novo-hiper-testado-backup.db',
    '/root/novo-hiper-dev/data/novo-hiper.db',
    '/root/novo-hiper-dev/data-dev/novo-hiper-dev.db',
    '/root/novo-hiper-backups/qualquer.db',
    '/app/data/novo-hiper.db',
    './data/novo-hiper.db',
    './data-dev/x.db',
    '',
  ];
  it.each(refused)('recusa %s', (p) => {
    expect(() => assertSafeTestDbPath(p)).toThrow(UnsafeTestDatabaseError);
  });

  it('recusa um .db em /tmp fora de um diretório de teste (prefixo obrigatório)', () => {
    expect(() => assertSafeTestDbPath(path.join(os.tmpdir(), 'qualquer-coisa', 'x.db'))).toThrow(/deve começar com/);
    expect(() => assertSafeTestDbPath(path.join(os.tmpdir(), 'x.db'))).toThrow(UnsafeTestDatabaseError);
  });

  it('recusa arquivo que não termina em .db', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), TEST_DIR_PREFIX));
    try {
      expect(() => assertSafeTestDbPath(path.join(dir, 'x.sqlite'))).toThrow(/\.db/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recusa um symlink em /tmp que aponta para a produção', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), TEST_DIR_PREFIX));
    const link = path.join(dir, 'link');
    try {
      fs.symlinkSync('/root/novo-hiper/data', link);
      expect(() => assertSafeTestDbPath(path.join(link, 'novo-hiper.db'))).toThrow(UnsafeTestDatabaseError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('aceita um banco descartável em diretório temporário com o prefixo de teste', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), TEST_DIR_PREFIX));
    try {
      expect(assertSafeTestDbPath(path.join(dir, 'test.db'))).toContain(TEST_DIR_PREFIX);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('proteção do runner: ambiente herdado', () => {
  it('recusa DATABASE_PATH/DATA_DIR/UPLOADS_DIR apontando para produção ou dev persistente', () => {
    expect(() => assertEnvironmentIsSafeForTests({ DATABASE_PATH: '/root/novo-hiper/data/novo-hiper.db' } as any)).toThrow(UnsafeTestDatabaseError);
    expect(() => assertEnvironmentIsSafeForTests({ DATA_DIR: '/root/novo-hiper-dev/data-dev' } as any)).toThrow(UnsafeTestDatabaseError);
    expect(() => assertEnvironmentIsSafeForTests({ UPLOADS_DIR: '/root/novo-hiper/uploads' } as any)).toThrow(UnsafeTestDatabaseError);
    expect(() => assertEnvironmentIsSafeForTests({ DATA_DIR: '/var/lib/qualquer' } as any)).toThrow(UnsafeTestDatabaseError);
  });
  it('recusa NODE_ENV=production', () => {
    expect(() => assertEnvironmentIsSafeForTests({ NODE_ENV: 'production' } as any)).toThrow(/production/);
  });
  it('aceita ambiente limpo', () => {
    expect(() => assertEnvironmentIsSafeForTests({} as any)).not.toThrow();
  });
});

describe('servidor de teste', () => {
  it('abre um banco novo, vazio, no diretório temporário — e remove tudo ao fechar', async () => {
    const s = await startTestServer();
    try {
      expect(s.dir.startsWith(fs.realpathSync(os.tmpdir())) || s.dir.startsWith(os.tmpdir())).toBe(true);
      expect(path.basename(s.dir).startsWith(TEST_DIR_PREFIX)).toBe(true);
      expect(s.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
      for (const t of ['plants', 'orders', 'order_items', 'deliveries', 'cash_transactions', 'customers']) {
        expect((await s.db.get(`SELECT COUNT(*) AS n FROM ${t}`)).n).toBe(0);
      }
      const health = await s.get('/api/health');
      expect(health.status).toBe(200);
    } finally {
      await s.close();
    }
    expect(fs.existsSync(s.dir)).toBe(false);
  });

  it('dois servidores simultâneos usam bancos diferentes (isolamento)', async () => {
    const a = await startTestServer();
    const b = await startTestServer();
    try {
      expect(a.dbPath).not.toBe(b.dbPath);
    } finally {
      await a.close();
      await b.close();
    }
  });
});
