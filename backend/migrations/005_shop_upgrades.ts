import { Migration } from './types';

/**
 * 005 — Melhorias da Novo Hiper compradas na Loja de Utilidades.
 * Uma linha por melhoria (upgrade_id é a PK: cada melhoria é comprada UMA vez). `installed_at` NULL = comprada,
 * aguardando instalação; preenchido = instalada. `cash_transaction_id` liga a compra ao débito no caixa
 * (cash_transactions.type = 'upgrade_purchase'). Sem coordenadas do mapa: posição/visual vivem no frontend. NÃO EDITE (checksum).
 */
export const migration005ShopUpgrades: Migration = {
  version: 5,
  name: 'shop_upgrades',
  sql: `
    CREATE TABLE IF NOT EXISTS shop_upgrades (
      upgrade_id TEXT PRIMARY KEY,
      price_paid REAL NOT NULL CHECK(price_paid >= 0),
      purchased_at INTEGER NOT NULL,
      installed_at INTEGER,
      cash_transaction_id TEXT NOT NULL UNIQUE,
      FOREIGN KEY (cash_transaction_id) REFERENCES cash_transactions(id)
    );
  `,
};
