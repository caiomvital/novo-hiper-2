import crypto from 'crypto';
import type { DbWrapper } from '../db';
import { MIGRATIONS } from './index';
import type { Migration } from './types';

export class MigrationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export const checksumOf = (m: Migration) => crypto.createHash('sha256').update(m.sql.trim().replace(/\s+/g, ' ')).digest('hex');

export interface MigrationResult {
  /** Versões aplicadas NESTA execução (vazio = banco já estava atualizado). */
  applied: number[];
  /** Versão atual do schema depois da execução. */
  currentVersion: number;
}

function validateList(list: Migration[]) {
  list.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new MigrationError(`Lista de migrations inválida: esperado versão ${i + 1} na posição ${i}, encontrado ${m.version}.`, 'INVALID_LIST');
    }
    if (!m.name || !m.sql || !m.sql.trim()) throw new MigrationError(`Migration ${m.version} sem nome ou SQL.`, 'INVALID_LIST');
  });
}

/**
 * Aplica, em ordem e uma única vez cada, as migrations pendentes.
 *  - Controle em `schema_migrations(version, name, checksum, applied_at)`.
 *  - Cada migration roda numa transação própria (BEGIN IMMEDIATE) junto com o seu registro: atômica.
 *  - Reexecução é segura (nada pendente → nada acontece). Duas instâncias simultâneas: a 2ª relê o estado
 *    dentro da transação e pula o que a 1ª já aplicou.
 *  - Falha de segurança (lança, o app NÃO sobe): checksum diferente de migration já aplicada (arquivo editado),
 *    banco com versão desconhecida/mais nova que o código, ou lacuna no histórico.
 */
export async function runMigrations(db: DbWrapper, migrations: Migration[] = MIGRATIONS, now: () => number = Date.now): Promise<MigrationResult> {
  validateList(migrations);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const verify = async () => {
    const rows = await db.all('SELECT version, name, checksum FROM schema_migrations ORDER BY version');
    const known = new Map(migrations.map((m) => [m.version, m]));
    for (const r of rows) {
      const m = known.get(r.version);
      if (!m) {
        throw new MigrationError(
          `O banco está na versão de schema ${r.version} ("${r.name}"), desconhecida por este código (última conhecida: ${migrations.length}). ` +
            'Código mais antigo que o banco — atualize o código; não rode contra este banco.',
          'SCHEMA_TOO_NEW'
        );
      }
      if (r.checksum !== checksumOf(m)) {
        throw new MigrationError(
          `A migration ${r.version} ("${r.name}") foi ALTERADA depois de aplicada (checksum diferente). Não edite migrations aplicadas: crie uma nova.`,
          'CHECKSUM_MISMATCH'
        );
      }
    }
    const versions = rows.map((r: any) => r.version as number);
    versions.forEach((v: number, i: number) => {
      if (v !== i + 1) throw new MigrationError(`Histórico de migrations com lacuna (esperado ${i + 1}, encontrado ${v}).`, 'GAP');
    });
    return versions;
  };

  await verify();

  const applied: number[] = [];
  for (const m of migrations) {
    let inTransaction = false;
    try {
      await db.run('BEGIN IMMEDIATE;');
      inTransaction = true;
      // relê DENTRO da transação de escrita (outra instância pode ter aplicado enquanto esperávamos)
      const already = await db.get('SELECT version FROM schema_migrations WHERE version = ?', m.version);
      if (already) {
        await db.run('COMMIT;');
        inTransaction = false;
        continue;
      }
      await db.exec(m.sql);
      await db.run('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)', [
        m.version,
        m.name,
        checksumOf(m),
        now(),
      ]);
      await db.run('COMMIT;');
      inTransaction = false;
      applied.push(m.version);
    } catch (err: any) {
      if (inTransaction) {
        try {
          await db.run('ROLLBACK;');
        } catch {
          /* já encerrada */
        }
      }
      throw new MigrationError(`Falha ao aplicar a migration ${m.version} ("${m.name}"): ${err.message}. Nada foi aplicado desta migration.`, 'MIGRATION_FAILED');
    }
  }

  const versions = await verify();
  return { applied, currentVersion: versions.length ? versions[versions.length - 1] : 0 };
}
