import { Migration } from './types';

/**
 * 003 — Sessões de login (Fase 1E).
 * `id` = SHA-256 (hex) do token do cookie: o token em si NUNCA é gravado (um vazamento de banco/backup não
 * entrega sessões utilizáveis). Expiração absoluta em `expires_at` (ms), renovada deslizando. NÃO EDITE (checksum).
 */
export const migration003Sessions: Migration = {
  version: 3,
  name: 'sessions',
  sql: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `,
};
