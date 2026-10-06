#!/usr/bin/env node
/**
 * Backup e verificação do SQLite do Novo Hiper (WAL-safe).
 *
 * MECANISMO: `VACUUM INTO '<arquivo>'`.
 *  - Roda dentro de uma transação de leitura do SQLite, então enxerga um instantâneo CONSISTENTE
 *    do banco, incluindo páginas que ainda estão só no arquivo -wal, sem bloquear quem escreve.
 *  - Gera um arquivo NOVO, completo e independente (sem -wal/-shm). Não depende de cópia de arquivo.
 *  - Funciona em qualquer Node >= 22.5 com node:sqlite (não depende da API `backup()` do Node 22.16+).
 *
 * NUNCA copie só o arquivo .db com `cp` quando o WAL estiver ativo: o que ainda não sofreu
 * checkpoint fica no -wal e a cópia sai desatualizada (ou vazia).
 *
 * Uso:
 *   node scripts/sqlite-backup.mjs backup --db <origem.db> --out-dir <pasta> [--label texto]
 *   node scripts/sqlite-backup.mjs verify <backup.db> [--source <origem.db>] [--no-manifest]
 *
 * Códigos de saída: 0 ok · 1 backup inválido/falhou · 2 uso incorreto · 3 origem mudou durante o backup
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/** Tabelas esperadas do Novo Hiper. Ausência é AVISO (versões antigas do schema), não erro. */
export const CORE_TABLES = ['plants', 'customers', 'orders', 'order_items', 'deliveries', 'cash_transactions', 'game_progress'];

export class BackupError extends Error {
  constructor(message, code = 'BACKUP_FAILED', exitCode = 1) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;
const quoteLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(1024 * 1024);
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

/** Contagem de linhas de TODAS as tabelas de usuário. */
export function countTables(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
  const counts = {};
  for (const t of tables) counts[t] = Number(db.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdent(t)}`).get().n);
  return counts;
}

/** Lê o byte 18/19 do cabeçalho: 1 = rollback journal (independente), 2 = WAL. */
export function readHeaderJournalVersion(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(100);
    const n = fs.readSync(fd, header, 0, 100, 0);
    if (n < 100 || header.subarray(0, 15).toString('latin1') !== 'SQLite format 3') return null;
    return { write: header[18], read: header[19] };
  } finally {
    fs.closeSync(fd);
  }
}

const sameCounts = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());

function diffCounts(expected, actual) {
  const names = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  const out = [];
  for (const n of [...names].sort()) {
    if (expected[n] !== actual[n]) out.push(`${n}: esperado ${expected[n] ?? '(ausente)'}, obtido ${actual[n] ?? '(ausente)'}`);
  }
  return out;
}

/**
 * Cria um backup consistente de `db` dentro de `outDir`.
 * @param {{db: string, outDir: string, label?: string, prefix?: string, maxAttempts?: number,
 *          hooks?: {afterVacuum?: () => void}, now?: () => Date}} opts
 */
export function createBackup(opts) {
  const { db: dbPath, outDir, label, prefix = 'novo-hiper', maxAttempts = 3, hooks = {}, now = () => new Date() } = opts;
  if (!dbPath || !outDir) throw new BackupError('Informe --db e --out-dir.', 'USAGE', 2);

  const src = path.resolve(dbPath);
  const out = path.resolve(outDir);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) throw new BackupError(`Banco de origem não encontrado: ${src}`, 'SOURCE_MISSING');
  const hdr = readHeaderJournalVersion(src);
  if (!hdr) throw new BackupError(`"${src}" não parece um banco SQLite.`, 'NOT_SQLITE');
  // Backups não podem ficar junto do banco vivo (poluem o diretório de dados e se confundem com ele)
  if (path.dirname(src) === out) throw new BackupError('--out-dir não pode ser a mesma pasta do banco de origem.', 'OUT_IN_SOURCE_DIR', 2);

  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const stamp = now().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const baseName = `${prefix}-${stamp}${label ? `-${String(label).replace(/[^A-Za-z0-9_-]/g, '_')}` : ''}`;
  const finalPath = path.join(out, `${baseName}.db`);
  const manifestPath = `${finalPath}.manifest.json`;
  if (fs.existsSync(finalPath) || fs.existsSync(manifestPath)) throw new BackupError(`Já existe um backup com este nome: ${finalPath}`, 'EXISTS');
  const partial = path.join(out, `.${baseName}.partial`);

  // Conexão normal (NÃO somente-leitura): um leitor WAL precisa acessar -wal/-shm. O VACUUM INTO só LÊ a origem.
  const source = new DatabaseSync(src);
  let result;
  try {
    source.exec('PRAGMA busy_timeout = 10000');
    const sourceJournalMode = source.prepare('PRAGMA journal_mode').get().journal_mode;
    const sqliteVersion = source.prepare('SELECT sqlite_version() AS v').get().v;
    const walFile = `${src}-wal`;
    const sourceWalBytes = fs.existsSync(walFile) ? fs.statSync(walFile).size : 0;

    let attempt = 0;
    let counts;
    for (;;) {
      attempt++;
      fs.rmSync(partial, { force: true });
      const before = countTables(source);
      source.exec(`VACUUM INTO ${quoteLiteral(partial)}`);
      if (hooks.afterVacuum) hooks.afterVacuum();
      const after = countTables(source);
      if (sameCounts(before, after)) {
        counts = after;
        break;
      }
      fs.rmSync(partial, { force: true });
      if (attempt >= maxAttempts) {
        throw new BackupError(
          `A origem foi modificada durante o backup em ${attempt} tentativas seguidas. Repita em um momento de baixa atividade.`,
          'SOURCE_CHANGED',
          3
        );
      }
    }

    // Torna o backup independente: modo rollback-journal (sem -wal/-shm), integrity_check obrigatório
    const copy = new DatabaseSync(partial);
    try {
      copy.exec('PRAGMA journal_mode = DELETE');
      const integrity = copy.prepare('PRAGMA integrity_check').all().map((r) => r.integrity_check);
      if (integrity.length !== 1 || integrity[0] !== 'ok') {
        throw new BackupError(`integrity_check do backup falhou: ${integrity.join('; ')}`, 'INTEGRITY');
      }
      const copyCounts = countTables(copy);
      if (!sameCounts(copyCounts, counts)) {
        throw new BackupError(`Contagens do backup diferem da origem: ${diffCounts(counts, copyCounts).join(' | ')}`, 'COUNT_MISMATCH');
      }
    } finally {
      copy.close();
    }
    fs.rmSync(`${partial}-wal`, { force: true });
    fs.rmSync(`${partial}-shm`, { force: true });
    fs.chmodSync(partial, 0o600);

    const sha256 = sha256File(partial);
    const sizeBytes = fs.statSync(partial).size;
    fs.renameSync(partial, finalPath); // atômico: o arquivo final só aparece completo

    const missingTables = CORE_TABLES.filter((t) => !(t in counts));
    const manifest = {
      manifestVersion: 1,
      createdAt: now().toISOString(),
      mechanism: 'VACUUM INTO',
      source: src,
      sourceJournalMode,
      sourceWalBytesAtStart: sourceWalBytes,
      sqliteVersion,
      nodeVersion: process.versions.node,
      backupFile: path.basename(finalPath),
      sizeBytes,
      sha256,
      integrityCheck: 'ok',
      counts,
      missingCoreTables: missingTables,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
    result = { path: finalPath, manifestPath, manifest, attempts: attempt };
  } finally {
    source.close();
    fs.rmSync(partial, { force: true });
    fs.rmSync(`${partial}-wal`, { force: true });
    fs.rmSync(`${partial}-shm`, { force: true });
  }
  return result;
}

/**
 * Verifica um arquivo de backup. NÃO altera nada.
 * @param {string} file
 * @param {{source?: string, requireManifest?: boolean}} [opts]
 * @returns {{ok: boolean, problems: string[], warnings: string[], counts: Record<string, number>|null, sha256: string|null}}
 */
export function verifyBackup(file, opts = {}) {
  const { source, requireManifest = true } = opts;
  const problems = [];
  const warnings = [];
  const f = path.resolve(file);
  let counts = null;
  let sha = null;

  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) {
    return { ok: false, problems: [`Arquivo de backup não encontrado: ${f}`], warnings, counts, sha256: sha };
  }
  const size = fs.statSync(f).size;
  if (size === 0) problems.push('Arquivo vazio (0 bytes).');
  const hdr = readHeaderJournalVersion(f);
  if (!hdr) {
    problems.push('Cabeçalho inválido: não é um banco SQLite.');
    return { ok: false, problems, warnings, counts, sha256: sha };
  }
  if (hdr.write === 2 || hdr.read === 2) {
    problems.push('O arquivo está em modo WAL: NÃO é independente (parte dos dados pode estar em um -wal que não acompanha). Provável cópia ingênua do .db.');
  }
  for (const side of ['-wal', '-shm']) {
    if (fs.existsSync(f + side)) warnings.push(`Existe ${path.basename(f)}${side} ao lado do backup (um backup válido não deve ter).`);
  }

  sha = sha256File(f);
  const manifestFile = `${f}.manifest.json`;
  let manifest = null;
  if (fs.existsSync(manifestFile)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch {
      problems.push('Manifesto ilegível (JSON inválido).');
    }
  } else if (requireManifest) {
    problems.push('Manifesto (.manifest.json) ausente — não dá para comprovar o conteúdo esperado.');
  }
  if (manifest) {
    if (manifest.sha256 !== sha) problems.push(`SHA-256 diverge do manifesto (arquivo alterado/corrompido). Esperado ${manifest.sha256}, obtido ${sha}.`);
    if (manifest.sizeBytes !== size) problems.push(`Tamanho diverge do manifesto (esperado ${manifest.sizeBytes}, obtido ${size}).`);
  }

  let db;
  try {
    db = new DatabaseSync(f, { readOnly: true });
    const integrity = db.prepare('PRAGMA integrity_check').all().map((r) => r.integrity_check);
    if (integrity.length !== 1 || integrity[0] !== 'ok') problems.push(`integrity_check falhou: ${integrity.slice(0, 5).join('; ')}`);
    counts = countTables(db);
  } catch (err) {
    problems.push(`Não foi possível abrir o backup isoladamente (somente o arquivo .db): ${err.message}`);
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }

  if (counts) {
    if (Object.keys(counts).length === 0) problems.push('Nenhuma tabela encontrada no backup (arquivo sem schema).');
    const missing = CORE_TABLES.filter((t) => !(t in counts));
    if (missing.length) warnings.push(`Tabelas do Novo Hiper ausentes (versão antiga do schema?): ${missing.join(', ')}.`);
    if (Object.keys(counts).length > 0 && Object.values(counts).every((n) => n === 0)) {
      warnings.push('Todas as tabelas estão vazias. Se a origem tinha dados, este backup é INVÁLIDO (ex.: dados só no WAL ignorados).');
    }
    if (manifest?.counts) {
      const d = diffCounts(manifest.counts, counts);
      if (d.length) problems.push(`Contagens divergem do manifesto: ${d.join(' | ')}`);
    }
    if (source) {
      let s;
      try {
        s = new DatabaseSync(path.resolve(source));
        const sc = countTables(s);
        const d = diffCounts(sc, counts);
        if (d.length) problems.push(`Contagens divergem da origem atual (${source}): ${d.join(' | ')}`);
      } catch (err) {
        problems.push(`Não foi possível ler a origem para comparar: ${err.message}`);
      } finally {
        try {
          s?.close();
        } catch {
          /* ignore */
        }
      }
    }
  }
  return { ok: problems.length === 0, problems, warnings, counts, sha256: sha };
}

// ───────────────────────────── CLI ─────────────────────────────
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else positional.push(a);
  }
  return { positional, flags };
}

function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const cmd = positional[0];
  try {
    if (cmd === 'backup') {
      const r = createBackup({ db: flags.db, outDir: flags['out-dir'], label: typeof flags.label === 'string' ? flags.label : undefined });
      const v = verifyBackup(r.path, { source: undefined });
      if (!v.ok) throw new BackupError(`Backup criado mas NÃO passou na verificação: ${v.problems.join(' | ')}`, 'VERIFY_FAILED');
      console.log(JSON.stringify({ ok: true, backup: r.path, manifest: r.manifestPath, counts: r.manifest.counts, sha256: r.manifest.sha256, warnings: v.warnings }, null, 2));
      return 0;
    }
    if (cmd === 'verify') {
      const file = positional[1];
      if (!file) throw new BackupError('Uso: verify <backup.db> [--source <origem.db>]', 'USAGE', 2);
      const v = verifyBackup(file, { source: typeof flags.source === 'string' ? flags.source : undefined, requireManifest: !flags['no-manifest'] });
      console.log(JSON.stringify({ ok: v.ok, file: path.resolve(file), counts: v.counts, sha256: v.sha256, problems: v.problems, warnings: v.warnings }, null, 2));
      return v.ok ? 0 : 1;
    }
    console.error('Uso:\n  node scripts/sqlite-backup.mjs backup --db <origem.db> --out-dir <pasta> [--label texto]\n  node scripts/sqlite-backup.mjs verify <backup.db> [--source <origem.db>] [--no-manifest]');
    return 2;
  } catch (err) {
    console.error(JSON.stringify({ ok: false, code: err.code ?? 'ERROR', error: err.message }, null, 2));
    return err.exitCode ?? 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
