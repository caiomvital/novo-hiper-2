import type { DbWrapper } from '../db';
import { LEGACY_DESTINATION_TARGET, isLegacyDestination, isModernDestination } from '../../src/shared/destinations';

/**
 * Estatísticas HISTÓRICAS de progressão, sempre DERIVADAS do histórico existente (nada de contadores duplicados).
 * Todas são monotônicas: entregas e créditos nunca são apagados, plantas usam exclusão lógica (a linha fica) e o
 * dinheiro gasto não entra nas contas. São números internos — o jogador não os vê como checklist.
 */
export interface ProgressStats {
  /** Entregas concluídas (status 'entregue'). */
  deliveriesCompleted: number;
  /** Clientes diferentes que já receberam alguma entrega. */
  distinctCustomersServed: number;
  /** Casas diferentes atendidas (destino congelado do pedido; ids legados contam como a casa amarela; desconhecidos não contam). */
  distinctHousesServed: number;
  /** Plantas já cadastradas alguma vez (inclui as removidas do catálogo). */
  plantsRegisteredHistorical: number;
  /** Plantas diferentes que já foram efetivamente vendidas (entregues). */
  distinctPlantsSold: number;
  upgradesPurchased: number;
  upgradesInstalled: number;
}

const count = async (db: DbWrapper, sql: string): Promise<number> => Number((await db.get(sql))?.n ?? 0);

export async function computeStats(db: DbWrapper): Promise<ProgressStats> {
  const deliveriesCompleted = await count(db, `SELECT COUNT(*) AS n FROM deliveries WHERE status = 'entregue'`);
  const distinctCustomersServed = await count(
    db,
    `SELECT COUNT(DISTINCT o.customer_id) AS n FROM orders o JOIN deliveries d ON d.order_id = o.id WHERE d.status = 'entregue'`
  );
  const destinations = await db.all(
    `SELECT DISTINCT COALESCE(o.destination_id, c.destination) AS dest
       FROM orders o
       JOIN deliveries d ON d.order_id = o.id
       LEFT JOIN customers c ON c.id = o.customer_id
      WHERE d.status = 'entregue'`
  );
  const houses = new Set<string>();
  for (const { dest } of destinations) {
    if (isLegacyDestination(dest)) houses.add(LEGACY_DESTINATION_TARGET);
    else if (isModernDestination(dest)) houses.add(dest);
  }
  const plantsRegisteredHistorical = await count(db, `SELECT COUNT(*) AS n FROM plants`); // soft delete: a linha permanece
  const distinctPlantsSold = await count(
    db,
    `SELECT COUNT(DISTINCT oi.plant_id) AS n
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN deliveries d ON d.order_id = o.id
      WHERE d.status = 'entregue'`
  );
  const upgradesPurchased = await count(db, `SELECT COUNT(*) AS n FROM shop_upgrades`);
  const upgradesInstalled = await count(db, `SELECT COUNT(*) AS n FROM shop_upgrades WHERE installed_at IS NOT NULL`);

  return {
    deliveriesCompleted,
    distinctCustomersServed,
    distinctHousesServed: houses.size,
    plantsRegisteredHistorical,
    distinctPlantsSold,
    upgradesPurchased,
    upgradesInstalled,
  };
}
