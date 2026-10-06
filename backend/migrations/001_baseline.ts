import { Migration } from './types';

/**
 * 001 — Baseline: o schema que existia ANTES de haver migrations (antigo `initSchema`).
 * Usa CREATE ... IF NOT EXISTS de propósito: em um banco de produção já existente é um no-op (só registra a versão);
 * em um banco novo cria tudo. NÃO EDITE (checksum).
 */
export const migration001Baseline: Migration = {
  version: 1,
  name: 'baseline',
  sql: `
    CREATE TABLE IF NOT EXISTS plants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
      image_path TEXT NOT NULL,
      species TEXT,
      care_tag TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plants_name ON plants(name);

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_path TEXT,
      destination TEXT NOT NULL,
      role_description TEXT,
      address TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('recebido', 'preparando', 'pronto', 'entregue')),
      total REAL NOT NULL CHECK(total >= 0),
      order_number INTEGER,
      customer_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (plant_id) REFERENCES plants(id)
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_plant ON order_items(plant_id);

    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('iniciada', 'a_caminho', 'entregue')),
      game_state TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      finished_at INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE,
      delivery_id TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('credit', 'debit', 'upgrade_purchase', 'adjustment')),
      description TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_cash_order ON cash_transactions(order_id);
    CREATE INDEX IF NOT EXISTS idx_cash_created ON cash_transactions(created_at);

    CREATE TABLE IF NOT EXISTS game_progress (
      id TEXT PRIMARY KEY,
      active_order_id TEXT,
      active_delivery_id TEXT,
      player_x REAL,
      player_y REAL,
      mission_state TEXT,
      store_upgrades TEXT,
      updated_at INTEGER NOT NULL
    );
  `,
};
