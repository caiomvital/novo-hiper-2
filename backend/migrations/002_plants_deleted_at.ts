import { Migration } from './types';

/**
 * 002 — Exclusão lógica de plantas.
 * `deleted_at` (INTEGER, ms desde a época; NULL = ativa). Restaurar no futuro = voltar para NULL.
 * Não apaga nem altera nenhuma linha existente (todas as plantas atuais permanecem ativas).
 * NÃO EDITE (checksum).
 */
export const migration002PlantsDeletedAt: Migration = {
  version: 2,
  name: 'plants_deleted_at',
  sql: `
    ALTER TABLE plants ADD COLUMN deleted_at INTEGER;
    CREATE INDEX IF NOT EXISTS idx_plants_deleted_at ON plants(deleted_at);
  `,
};
