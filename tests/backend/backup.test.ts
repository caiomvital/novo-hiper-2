import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-ignore — módulo .mjs puro (também usado pela CLI em produção)
import { BackupError, CORE_TABLES, countTables, createBackup, readHeaderJournalVersion, verifyBackup } from '../../scripts/sqlite-backup.mjs';
import { createOrder, createPlant, startDelivery } from './helpers/builders';
import { assertSafeTestDbPath, TEST_DIR_PREFIX } from './helpers/safety';
import { startTestServer } from './helpers/testServer';

const SCRIPT = path.resolve('scripts/sqlite-backup.mjs');
const dirs: string[] = [];
const mkdir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), TEST_DIR_PREFIX));
  dirs.push(d);
  return d;
};
const open: DatabaseSync[] = [];
const track = (db: DatabaseSync) => (open.push(db), db);

afterEach(() => {
  for (const db of open.splice(0)) {
    try {
      db.close();
    } catch {
      /* já fechado */
    }
  }
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Banco em WAL com 1 linha já no arquivo principal e 2 linhas confirmadas SOMENTE no -wal. */
function makeWalDatabase() {
  const dir = mkdir();
  const dbPath = path.join(dir, 'origem.db');
  assertSafeTestDbPath(dbPath);
  const writer = track(new DatabaseSync(dbPath));
  writer.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA wal_autocheckpoint = 0;
    CREATE TABLE plants (id INTEGER PRIMARY KEY, name TEXT);
    INSERT INTO plants (name) VALUES ('no-arquivo-principal');
  `);
  writer.exec('PRAGMA wal_checkpoint(TRUNCATE)'); // 1ª linha vai para o .db
  writer.exec("INSERT INTO plants (name) VALUES ('so-no-wal-1'); INSERT INTO plants (name) VALUES ('so-no-wal-2');"); // confirmadas (autocommit)
  return { dir, dbPath, writer };
}

const countPlants = (file: string) => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return Number(db.prepare('SELECT COUNT(*) AS n FROM plants').get()!.n);
  } finally {
    db.close();
  }
};

describe('backup SQLite — prova de captura do WAL', () => {
  it('PRÉ-CONDIÇÃO: o banco está em WAL e há dados confirmados que só existem no -wal', () => {
    const { dbPath, writer } = makeWalDatabase();
    expect(writer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(fs.statSync(`${dbPath}-wal`).size).toBeGreaterThan(0);
    // o arquivo principal, sozinho, só tem a 1ª linha
    const lonely = path.join(mkdir(), 'sozinho.db');
    fs.copyFileSync(dbPath, lonely); // cópia ingênua (cp) — sem -wal
    expect(countPlants(lonely)).toBe(1);
    expect(countPlants(dbPath)).toBe(3); // enquanto o banco vivo (com WAL) tem 3
  });

  it('o backup contém TUDO (3 linhas), inclusive as que só estavam no WAL; integrity_check ok', () => {
    const { dbPath } = makeWalDatabase();
    const outDir = mkdir();
    const r = createBackup({ db: dbPath, outDir });

    expect(countPlants(r.path)).toBe(3);
    const db = new DatabaseSync(r.path, { readOnly: true });
    expect(db.prepare('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }]);
    const names = db.prepare('SELECT name FROM plants ORDER BY id').all().map((x: any) => x.name);
    expect(names).toEqual(['no-arquivo-principal', 'so-no-wal-1', 'so-no-wal-2']);
    db.close();

    expect(r.manifest.counts).toEqual({ plants: 3 });
    expect(r.manifest.integrityCheck).toBe('ok');
    expect(r.manifest.sourceWalBytesAtStart).toBeGreaterThan(0);
    expect(verifyBackup(r.path, { source: dbPath }).ok).toBe(true);
  });

  it('o backup é um arquivo INDEPENDENTE: copiado sozinho (sem -wal/-shm) para outra pasta, abre completo', () => {
    const { dbPath } = makeWalDatabase();
    const r = createBackup({ db: dbPath, outDir: mkdir() });
    expect(readHeaderJournalVersion(r.path)).toEqual({ write: 1, read: 1 }); // rollback journal, não WAL
    expect(fs.existsSync(`${r.path}-wal`)).toBe(false);
    expect(fs.existsSync(`${r.path}-shm`)).toBe(false);

    const isolated = path.join(mkdir(), 'restaurado.db');
    fs.copyFileSync(r.path, isolated); // SOMENTE o .db
    expect(fs.readdirSync(path.dirname(isolated))).toEqual(['restaurado.db']);
    expect(countPlants(isolated)).toBe(3);
  });

  it('CONTROLE NEGATIVO: uma cópia ingênua do .db é reprovada pelo verificador (e teria reprovado o teste)', () => {
    const { dbPath } = makeWalDatabase();
    const naiveDir = mkdir();
    const naive = path.join(naiveDir, 'ingenuo.db');
    fs.copyFileSync(dbPath, naive);
    const v = verifyBackup(naive, { source: dbPath, requireManifest: false });
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/modo WAL|Contagens divergem/);
    // contagem real do que uma cópia ingênua preservaria:
    expect(countPlants(naive)).toBeLessThan(3);
  });

  it('GUARDA ESTÁTICA: o script de backup não usa cópia de arquivo para o banco', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''); // sem comentários
    for (const forbidden of ['copyFileSync', 'copyFile(', 'cpSync', 'createReadStream', '.cp(']) {
      expect(src, `o script não pode usar ${forbidden}`).not.toContain(forbidden);
    }
    expect(src).toContain('VACUUM INTO');
  });
});

describe('backup SQLite — o schema real do Novo Hiper', () => {
  it('com o app rodando (WAL ativo), o backup tem as mesmas contagens do banco vivo em todas as tabelas', async () => {
    const s = await startTestServer();
    try {
      const plant = await createPlant(s, { stock_quantity: 5, price: 10 });
      const order = await createOrder(s, [{ plant_id: plant.id, quantity: 2 }]);
      const delivery = await startDelivery(s, order.id);
      expect((await s.post(`/api/deliveries/${delivery.id}/finish`)).status).toBe(200);
      await s.put('/api/game/progress', { player_x: 10, player_y: 20 });

      const wal = `${s.dbPath}-wal`;
      expect(fs.existsSync(wal) && fs.statSync(wal).size > 0).toBe(true); // dados recentes ainda no WAL

      const r = createBackup({ db: s.dbPath, outDir: mkdir() });
      const live: Record<string, number> = {};
      for (const t of CORE_TABLES) live[t] = (await s.db.get(`SELECT COUNT(*) AS n FROM ${t}`)).n;
      for (const t of CORE_TABLES) expect(r.manifest.counts[t], t).toBe(live[t]);
      expect(live).toMatchObject({ plants: 1, customers: 1, orders: 1, order_items: 1, deliveries: 1, cash_transactions: 1 });
      expect(r.manifest.missingCoreTables).toEqual([]);

      // Abre SOMENTE o backup e confere o estado de negócio
      const b = new DatabaseSync(r.path, { readOnly: true });
      expect(b.prepare('SELECT stock_quantity FROM plants').get()!.stock_quantity).toBe(3);
      expect(b.prepare('SELECT amount, type FROM cash_transactions').get()).toMatchObject({ amount: 20, type: 'credit' });
      expect(b.prepare("SELECT status FROM orders").get()!.status).toBe('entregue');
      b.close();
      expect(verifyBackup(r.path, { source: s.dbPath }).ok).toBe(true);

      // O banco vivo continua utilizável depois do backup (o backup não o altera)
      expect((await s.get('/api/plants')).body).toHaveLength(1);
    } finally {
      await s.close();
    }
  });

  it('tabela ausente (schema antigo) é tratada conscientemente: AVISO no manifesto/verificação, não erro', () => {
    const { dbPath } = makeWalDatabase(); // só tem "plants"
    const r = createBackup({ db: dbPath, outDir: mkdir() });
    expect(r.manifest.missingCoreTables).toEqual(CORE_TABLES.filter((t) => t !== 'plants'));
    const v = verifyBackup(r.path);
    expect(v.ok).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/ausentes/);
  });
});

describe('backup SQLite — segurança do procedimento', () => {
  it('não sobrescreve backup existente', () => {
    const { dbPath } = makeWalDatabase();
    const outDir = mkdir();
    const fixed = () => new Date('2026-01-02T03:04:05Z');
    createBackup({ db: dbPath, outDir, now: fixed });
    expect(() => createBackup({ db: dbPath, outDir, now: fixed })).toThrow(/Já existe/);
  });

  it('recusa out-dir igual à pasta do banco de origem', () => {
    const { dbPath, dir } = makeWalDatabase();
    expect(() => createBackup({ db: dbPath, outDir: dir })).toThrow(BackupError);
  });

  it('recusa origem inexistente e arquivo que não é SQLite', () => {
    const dir = mkdir();
    expect(() => createBackup({ db: path.join(dir, 'nao-existe.db'), outDir: mkdir() })).toThrow(/não encontrado/);
    const fake = path.join(dir, 'fake.db');
    fs.writeFileSync(fake, 'isto não é sqlite');
    expect(() => createBackup({ db: fake, outDir: mkdir() })).toThrow(/não parece um banco SQLite/);
  });

  it('se a origem muda durante o backup em todas as tentativas, FALHA (não grava backup suspeito)', () => {
    const { dbPath, writer } = makeWalDatabase();
    const outDir = mkdir();
    let n = 0;
    expect(() =>
      createBackup({
        db: dbPath,
        outDir,
        maxAttempts: 2,
        hooks: { afterVacuum: () => writer.exec(`INSERT INTO plants (name) VALUES ('concorrente-${++n}')`) },
      })
    ).toThrow(/modificada durante o backup/);
    expect(fs.readdirSync(outDir)).toEqual([]); // nada ficou (nem .partial)
  });

  it('se a origem muda só uma vez, repete e produz backup consistente', () => {
    const { dbPath, writer } = makeWalDatabase();
    let first = true;
    const r = createBackup({
      db: dbPath,
      outDir: mkdir(),
      hooks: {
        afterVacuum: () => {
          if (first) {
            first = false;
            writer.exec("INSERT INTO plants (name) VALUES ('concorrente')");
          }
        },
      },
    });
    expect(r.attempts).toBe(2);
    expect(countPlants(r.path)).toBe(4);
  });

  it('o arquivo de backup tem permissão restrita (0600) e o diretório é criado privado', () => {
    const { dbPath } = makeWalDatabase();
    const outDir = path.join(mkdir(), 'sub', 'backups');
    const r = createBackup({ db: dbPath, outDir });
    expect(fs.statSync(r.path).mode & 0o777).toBe(0o600);
  });
});

describe('verificação — como identificar um backup inválido', () => {
  const good = () => createBackup({ db: makeWalDatabase().dbPath, outDir: mkdir() });

  it('backup íntegro → ok', () => {
    expect(verifyBackup(good().path).ok).toBe(true);
  });

  it('arquivo adulterado/corrompido → SHA diverge', () => {
    const r = good();
    const fd = fs.openSync(r.path, 'r+');
    fs.writeSync(fd, Buffer.from([0xff, 0xff, 0xff, 0xff]), 0, 4, fs.statSync(r.path).size - 8);
    fs.closeSync(fd);
    const v = verifyBackup(r.path);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/SHA-256 diverge/);
  });

  it('arquivo truncado → inválido', () => {
    const r = good();
    fs.truncateSync(r.path, 2048);
    expect(verifyBackup(r.path).ok).toBe(false);
  });

  it('arquivo vazio e arquivo que não é SQLite → inválido', () => {
    const dir = mkdir();
    const empty = path.join(dir, 'vazio.db');
    fs.writeFileSync(empty, '');
    expect(verifyBackup(empty, { requireManifest: false }).problems.join(' ')).toMatch(/vazio|Cabeçalho/);
    const txt = path.join(dir, 'texto.db');
    fs.writeFileSync(txt, 'x'.repeat(5000));
    expect(verifyBackup(txt, { requireManifest: false }).ok).toBe(false);
  });

  it('manifesto ausente → inválido por padrão (aceitável só com --no-manifest)', () => {
    const r = good();
    fs.rmSync(r.manifestPath);
    expect(verifyBackup(r.path).ok).toBe(false);
    expect(verifyBackup(r.path, { requireManifest: false }).ok).toBe(true);
  });

  it('banco com schema mas TODAS as tabelas vazias gera aviso explícito', () => {
    const dir = mkdir();
    const p = path.join(dir, 'vazio-schema.db');
    const db = track(new DatabaseSync(p));
    db.exec('CREATE TABLE plants (id INTEGER PRIMARY KEY)');
    db.close();
    const r = createBackup({ db: p, outDir: mkdir() });
    expect(verifyBackup(r.path).warnings.join(' ')).toMatch(/vazias/);
  });

  it('contagens da origem atual diferentes do backup → inválido quando --source é informado', () => {
    const { dbPath, writer } = makeWalDatabase();
    const r = createBackup({ db: dbPath, outDir: mkdir() });
    writer.exec("INSERT INTO plants (name) VALUES ('depois do backup')");
    expect(verifyBackup(r.path).ok).toBe(true); // por si só continua íntegro
    expect(verifyBackup(r.path, { source: dbPath }).ok).toBe(false); // mas já não reflete a origem
  });
});

describe('CLI — fluxo de backup → verificação → restauração em banco descartável', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

  it('backup + verify + restore (cópia do arquivo verificado) reproduzem o estado; códigos de saída corretos', () => {
    const { dbPath } = makeWalDatabase();
    const outDir = mkdir();

    const b = run('backup', '--db', dbPath, '--out-dir', outDir, '--label', 'teste');
    expect(b.status, b.stderr).toBe(0);
    const info = JSON.parse(b.stdout);
    expect(info.ok).toBe(true);
    expect(info.counts).toEqual({ plants: 3 });
    expect(path.basename(info.backup)).toMatch(/^novo-hiper-\d{8}T\d{6}Z-teste\.db$/);

    const v = run('verify', info.backup, '--source', dbPath);
    expect(v.status, v.stderr).toBe(0);
    expect(JSON.parse(v.stdout).ok).toBe(true);

    // restauração (procedimento documentado): copiar o backup VERIFICADO para o destino
    const restored = path.join(mkdir(), 'restaurado.db');
    fs.copyFileSync(info.backup, restored);
    expect(countPlants(restored)).toBe(3);
    expect(verifyBackup(restored, { requireManifest: false }).ok).toBe(true);
  });

  it('verify de backup inválido sai com código 1; uso incorreto sai com 2; origem inexistente sai com 1', () => {
    const dir = mkdir();
    const bad = path.join(dir, 'ruim.db');
    fs.writeFileSync(bad, 'nada');
    expect(run('verify', bad, '--no-manifest').status).toBe(1);
    expect(run().status).toBe(2);
    expect(run('backup').status).toBe(2);
    expect(run('backup', '--db', path.join(dir, 'nao-existe.db'), '--out-dir', mkdir()).status).toBe(1);
  });
});

it('countTables lista só tabelas de usuário', () => {
  const dir = mkdir();
  const db = track(new DatabaseSync(path.join(dir, 'x.db')));
  db.exec('CREATE TABLE a (id INTEGER); CREATE TABLE "b c" (id INTEGER); INSERT INTO a VALUES (1),(2);');
  expect(countTables(db)).toEqual({ a: 2, 'b c': 0 });
});
