import { Migration } from './types';

/**
 * 006 — Marcos de progressão (milestones) PERMANENTES.
 * Uma linha por marco, gravada UMA vez quando a condição se torna verdadeira; nunca é apagada nem reavaliada para
 * baixo (gastar dinheiro ou remover planta não "desconquista" nada). Os números (entregas, casas, plantas…) NÃO são
 * duplicados aqui: são derivados do histórico (deliveries, orders, plants, shop_upgrades). NÃO EDITE (checksum).
 */
export const migration006Milestones: Migration = {
  version: 6,
  name: 'milestones',
  sql: `
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      achieved_at INTEGER NOT NULL
    );
  `,
};
