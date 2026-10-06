import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Proteções do runner de testes do backend: os testes só podem tocar bancos DESCARTÁVEIS,
 * criados em um diretório temporário do sistema com prefixo próprio. Qualquer outro caminho
 * (produção, data/, data-dev/, uploads, /app/...) é recusado — antes de abrir o banco.
 */
export const TEST_DIR_PREFIX = 'novo-hiper-test-';

/** Raízes que NUNCA podem ser usadas por testes (produção e desenvolvimento persistente). */
export function getForbiddenRoots(cwd = process.cwd()): string[] {
  return [
    '/root/novo-hiper', // produção
    '/root/novo-hiper-dev/data',
    '/root/novo-hiper-dev/data-dev',
    '/root/novo-hiper-dev/uploads',
    '/root/novo-hiper-dev/uploads-dev',
    '/root/novo-hiper-backups',
    '/app/data', // dentro dos containers
    '/app/uploads',
    path.resolve(cwd, 'data'),
    path.resolve(cwd, 'data-dev'),
    path.resolve(cwd, 'uploads'),
    path.resolve(cwd, 'uploads-dev'),
  ];
}

function isWithin(child: string, root: string): boolean {
  const rel = path.relative(root, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Resolve symlinks do diretório pai (o arquivo pode ainda não existir). */
function realResolve(p: string): string {
  const abs = path.resolve(p);
  const parent = path.dirname(abs);
  try {
    return path.join(fs.realpathSync(parent), path.basename(abs));
  } catch {
    return abs;
  }
}

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(`[SEGURANÇA DOS TESTES] ${message}`);
    this.name = 'UnsafeTestDatabaseError';
  }
}

/** Lança se `dbPath` não for um banco descartável e inequivocamente de teste. */
export function assertSafeTestDbPath(dbPath: string | undefined, opts: { cwd?: string; tmpdir?: string } = {}): string {
  if (!dbPath || !dbPath.trim()) throw new UnsafeTestDatabaseError('Caminho do banco vazio.');
  const resolved = realResolve(dbPath);
  const tmp = fs.realpathSync(opts.tmpdir ?? os.tmpdir());

  for (const forbidden of getForbiddenRoots(opts.cwd)) {
    const f = realResolve(forbidden);
    if (isWithin(resolved, f)) {
      throw new UnsafeTestDatabaseError(`Banco "${resolved}" está dentro de um local protegido (${f}). Recusado.`);
    }
  }
  if (!isWithin(resolved, tmp)) {
    throw new UnsafeTestDatabaseError(`Banco "${resolved}" não está no diretório temporário do sistema (${tmp}). Recusado.`);
  }
  const dirName = path.basename(path.dirname(resolved));
  if (!dirName.startsWith(TEST_DIR_PREFIX)) {
    throw new UnsafeTestDatabaseError(`O diretório do banco ("${dirName}") deve começar com "${TEST_DIR_PREFIX}". Recusado.`);
  }
  if (!resolved.endsWith('.db')) {
    throw new UnsafeTestDatabaseError(`O arquivo do banco deve terminar em .db (${resolved}).`);
  }
  return resolved;
}

/**
 * Chamado ANTES de qualquer teste: se o ambiente já aponta para um banco/uploads/dados reais
 * (variáveis herdadas do shell, de um .env, ou NODE_ENV=production), o runner se recusa a rodar.
 */
export function assertEnvironmentIsSafeForTests(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production') {
    throw new UnsafeTestDatabaseError('NODE_ENV=production. Os testes de backend nunca rodam em modo produção.');
  }
  for (const key of ['DATABASE_PATH', 'DATA_DIR', 'UPLOADS_DIR'] as const) {
    const value = env[key];
    if (!value) continue;
    const resolved = realResolve(value);
    for (const forbidden of getForbiddenRoots()) {
      if (isWithin(resolved, realResolve(forbidden))) {
        throw new UnsafeTestDatabaseError(`${key}="${value}" aponta para um local protegido (${forbidden}). Remova a variável e rode de novo.`);
      }
    }
    const tmp = fs.realpathSync(os.tmpdir());
    if (!isWithin(resolved, tmp) || !resolved.includes(TEST_DIR_PREFIX)) {
      throw new UnsafeTestDatabaseError(`${key}="${value}" não é um local de teste descartável. Remova a variável e rode de novo.`);
    }
  }
}
