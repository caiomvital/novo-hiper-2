import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MIGRATIONS } from '../../backend/migrations';
import { migration001Baseline } from '../../backend/migrations/001_baseline';
import { checksumOf, MigrationError, runMigrations } from '../../backend/migrations/runner';
import type { Migration } from '../../backend/migrations/types';
import { assertSafeTestDbPath, TEST_DIR_PREFIX } from './helpers/safety';
import { openRawDb } from './helpers/rawDb';
import { startTestServer } from './helpers/testServer';

const dirs: string[] = [];
const opened: Array<{ raw: { close: () => void } }> = [];
function freshDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), TEST_DIR_PREFIX));
  dirs.push(dir);
  const p = path.join(dir, 'm.db');
  assertSafeTestDbPath(p);
  return p;
}
const open = (p: string) => {
  const d = openRawDb(p);
  opened.push(d);
  return d;
};
afterEach(() => {
  for (const d of opened.splice(0)) {
    try {
      d.raw.close();
    } catch {
      /* ok */
    }
  }
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Banco "de produção antigo": criado pelo antigo initSchema (= baseline), SEM tabela schema_migrations, com dados. */
function seedLegacy(p: string) {
  const d = openRawDb(p);
  d.raw.exec(migration001Baseline.sql);
  d.raw.exec(`
    INSERT INTO plants (id,name,price,stock_quantity,image_path,species,care_tag,created_at,updated_at)
      VALUES ('p1','Relogio',10,1,'/uploads/plants/a.jpg','Massa','Sol',1000,1000),
             ('p2','Samambaia',25.5,7,'/uploads/plants/b.jpg',NULL,NULL,2000,2000);
    INSERT INTO customers (id,name,destination,created_at) VALUES ('c1','Dona Maria','dest_vovo',1000);
    INSERT INTO orders (id,customer_id,status,total,order_number,created_at,updated_at) VALUES ('o1','c1','entregue',10,101,1000,1500),('o2','c1','recebido',25.5,102,2000,2000);
    INSERT INTO order_items (id,order_id,plant_id,quantity,unit_price) VALUES ('i1','o1','p1',1,10),('i2','o2','p2',1,25.5);
    INSERT INTO deliveries (id,order_id,status,created_at,updated_at,finished_at) VALUES ('d1','o1','entregue',1000,1500,1500);
    INSERT INTO cash_transactions (id,order_id,delivery_id,amount,type,created_at) VALUES ('t1','o1','d1',10,'credit',1500);
    INSERT INTO game_progress (id,updated_at) VALUES ('current',1000);
  `);
  d.raw.close();
}

const tables = (d: ReturnType<typeof openRawDb>) =>
  (d.raw.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as any[]).map((r) => r.name);
const cols = (d: ReturnType<typeof openRawDb>, t: string) => (d.raw.prepare(`PRAGMA table_info(${t})`).all() as any[]).map((c) => c.name);

describe('migrations — lista oficial', () => {
  it('versões 1..N sem lacunas, nomes e SQL presentes, checksums estáveis', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
    expect(MIGRATIONS.map((m) => m.name)).toEqual(['baseline', 'plants_deleted_at', 'sessions', 'orders_destination']);
    // checksum insensível a espaços, sensível a conteúdo
    expect(checksumOf({ ...MIGRATIONS[1], sql: MIGRATIONS[1].sql.replace(/\s+/g, '   ') })).toBe(checksumOf(MIGRATIONS[1]));
    expect(checksumOf({ ...MIGRATIONS[1], sql: MIGRATIONS[1].sql + ' -- x ALTER' })).not.toBe(checksumOf(MIGRATIONS[1]));
  });
});

describe('migrations — banco NOVO', () => {
  it('cria o schema completo, registra as versões e adiciona plants.deleted_at (+ índice)', async () => {
    const d = open(freshDbPath());
    const r = await runMigrations(d);
    expect(r).toEqual({ applied: [1, 2, 3, 4], currentVersion: 4 });
    expect(tables(d)).toEqual(
      ['cash_transactions', 'customers', 'deliveries', 'game_progress', 'order_items', 'orders', 'plants', 'schema_migrations', 'sessions'].sort()
    );
    expect(cols(d, 'plants')).toContain('deleted_at');
    const idx = (d.raw.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='plants'").all() as any[]).map((i) => i.name);
    expect(idx).toContain('idx_plants_deleted_at');
    const rows = d.raw.prepare('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version').all() as any[];
    expect(rows.map((x) => [x.version, x.name])).toEqual([[1, 'baseline'], [2, 'plants_deleted_at'], [3, 'sessions'], [4, 'orders_destination']]);
    expect(rows.map((x) => x.checksum)).toEqual(MIGRATIONS.map(checksumOf));
    expect(rows.every((x) => x.applied_at > 0)).toBe(true);
  });
});

describe('migrations — banco EXISTENTE (produção antiga, sem schema_migrations)', () => {
  it('aplica sem apagar nada: dados idênticos, deleted_at NULL em todas as plantas, FKs e UNIQUEs intactos', async () => {
    const p = freshDbPath();
    seedLegacy(p);
    const d = open(p);
    expect(tables(d)).not.toContain('schema_migrations');
    expect(cols(d, 'plants')).not.toContain('deleted_at');
    const snapshot = (name: string) => d.raw.prepare(`SELECT * FROM ${name} ORDER BY id`).all();
    const beforeTables = ['plants', 'customers', 'orders', 'order_items', 'deliveries', 'cash_transactions', 'game_progress'];
    const before = Object.fromEntries(beforeTables.map((t) => [t, snapshot(t)]));

    const r = await runMigrations(d);
    expect(r).toEqual({ applied: [1, 2, 3, 4], currentVersion: 4 });

    for (const t of beforeTables) {
      const after = snapshot(t) as any[];
      if (t === 'plants') {
        expect(after.every((row) => row.deleted_at === null)).toBe(true);
        expect(after.map(({ deleted_at, ...rest }) => rest)).toEqual(before[t]);
      } else if (t === 'orders') {
        // 004: pedidos antigos ganham o destino ATUAL do cliente copiado; nada mais muda
        expect(after.map((row) => row.destination_id)).toEqual(['dest_vovo', 'dest_vovo']);
        expect(after.map(({ destination_id, ...rest }) => rest)).toEqual(before[t]);
      } else {
        expect(after).toEqual(before[t]);
      }
    }
    expect(d.raw.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(() => d.raw.exec("INSERT INTO deliveries (id,order_id,status,created_at,updated_at) VALUES ('dx','o1','iniciada',1,1)")).toThrow(); // UNIQUE(order_id)
  });

  it('o backend sobe sobre o banco antigo, migra sozinho e serve os dados antigos', async () => {
    const s = await startTestServer({ seed: seedLegacy });
    try {
      const plants = await s.get('/api/plants');
      expect(plants.body.map((x: any) => x.id).sort()).toEqual(['p1', 'p2']);
      expect((await s.get('/api/cash/summary')).body).toMatchObject({ balance: 10, transactionCount: 1 });
      expect((await s.get('/api/orders/o1')).body.status).toBe('entregue');
      const versions = await s.db.all('SELECT version FROM schema_migrations ORDER BY version');
      expect(versions.map((v: any) => v.version)).toEqual([1, 2, 3, 4]);
    } finally {
      await s.close();
    }
  });
});

describe('migrations — reexecução e segurança', () => {
  it('reexecutar é seguro: nada pendente, registros intocados (applied_at idêntico)', async () => {
    const d = open(freshDbPath());
    await runMigrations(d, MIGRATIONS, () => 111);
    const before = d.raw.prepare('SELECT * FROM schema_migrations ORDER BY version').all();
    for (let i = 0; i < 3; i++) {
      const again = await runMigrations(d, MIGRATIONS, () => 999);
      expect(again).toEqual({ applied: [], currentVersion: 4 });
    }
    expect(d.raw.prepare('SELECT * FROM schema_migrations ORDER BY version').all()).toEqual(before);
  });

  it('uma 2ª conexão/instância sobre o mesmo arquivo já migrado não reaplica nada (estado relido dentro da transação)', async () => {
    const p = freshDbPath();
    await runMigrations(open(p));
    const second = await runMigrations(open(p));
    expect(second.applied).toEqual([]);
    expect((open(p).raw.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as any).n).toBe(4);
  });

  it('migration nova é aplicada UMA vez em banco já na versão anterior (evolução futura)', async () => {
    const d = open(freshDbPath());
    await runMigrations(d);
    const v4: Migration = { version: 5, name: 'exemplo_futuro', sql: 'CREATE TABLE exemplo (id INTEGER PRIMARY KEY);' };
    const list = [...MIGRATIONS, v4];
    expect(await runMigrations(d, list)).toEqual({ applied: [5], currentVersion: 5 });
    expect(await runMigrations(d, list)).toEqual({ applied: [], currentVersion: 5 });
  });

  it('migration que falha é atômica: nada dela persiste (nem o registro) e o erro é explícito', async () => {
    const d = open(freshDbPath());
    await runMigrations(d);
    const bad: Migration = {
      version: 5,
      name: 'quebrada',
      sql: 'CREATE TABLE sera_desfeita (id INTEGER); INSERT INTO tabela_que_nao_existe VALUES (1);',
    };
    await expect(runMigrations(d, [...MIGRATIONS, bad])).rejects.toMatchObject({ code: 'MIGRATION_FAILED' });
    expect(tables(d)).not.toContain('sera_desfeita');
    expect((d.raw.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as any[]).map((r) => r.version)).toEqual([1, 2, 3, 4]);
    // e a conexão continua utilizável (a transação foi encerrada)
    expect(await runMigrations(d)).toEqual({ applied: [], currentVersion: 4 });
  });

  it('RECUSA migration já aplicada que foi editada (checksum)', async () => {
    const d = open(freshDbPath());
    await runMigrations(d);
    const tampered = MIGRATIONS.map((m) => (m.version === 2 ? { ...m, sql: m.sql + ' ALTER TABLE plants ADD COLUMN extra TEXT;' } : m));
    await expect(runMigrations(d, tampered)).rejects.toMatchObject({ code: 'CHECKSUM_MISMATCH' });
  });

  it('RECUSA banco com schema MAIS NOVO que o código (versão desconhecida)', async () => {
    const d = open(freshDbPath());
    await runMigrations(d);
    d.raw.exec("INSERT INTO schema_migrations (version,name,checksum,applied_at) VALUES (99,'do_futuro','x',1)");
    await expect(runMigrations(d)).rejects.toMatchObject({ code: 'SCHEMA_TOO_NEW' });
  });

  it('RECUSA histórico com lacuna e lista de migrations inválida', async () => {
    const d = open(freshDbPath());
    await runMigrations(d);
    d.raw.exec('DELETE FROM schema_migrations WHERE version = 1');
    await expect(runMigrations(d)).rejects.toMatchObject({ code: 'GAP' });
    const d2 = open(freshDbPath());
    await expect(runMigrations(d2, [MIGRATIONS[0], { ...MIGRATIONS[1], version: 3 }])).rejects.toMatchObject({ code: 'INVALID_LIST' });
    expect(MigrationError).toBeDefined();
  });
});
