import { Migration } from './types';

/**
 * 004 — Destino congelado no pedido (marco "clientes em casas diferentes").
 * `orders.destination_id` = cópia imutável de `customers.destination` no momento da criação do pedido
 * (formato "<regionId>/<houseId>" ou um id legado). Pedidos já existentes recebem a cópia do endereço ATUAL
 * do cliente (o melhor dado histórico disponível); coluna NULL continua válida (leitura cai no endereço do cliente).
 * O banco não conhece coordenadas do mapa. NÃO EDITE (checksum).
 */
export const migration004OrdersDestination: Migration = {
  version: 4,
  name: 'orders_destination',
  sql: `
    ALTER TABLE orders ADD COLUMN destination_id TEXT;
    UPDATE orders SET destination_id = (SELECT c.destination FROM customers c WHERE c.id = orders.customer_id) WHERE destination_id IS NULL;
  `,
};
