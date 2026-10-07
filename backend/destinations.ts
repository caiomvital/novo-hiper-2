import crypto from 'crypto';
import type { DbWrapper } from './db';
import { DESTINATION_IDS } from '../src/shared/destinations';

/**
 * Residência de um cliente NOVO: gravada uma única vez no cadastro (nunca recalculada).
 * Estratégia simples: entre as casas habilitadas, as MENOS ocupadas por clientes atuais (distribui sem concentrar);
 * empate decidido por hash do id do cliente (determinístico, sem aleatoriedade escondida).
 */
export async function assignDestination(db: DbWrapper, customerId: string): Promise<string> {
  const rows = await db.all('SELECT destination, COUNT(*) AS n FROM customers GROUP BY destination');
  const used = new Map<string, number>(rows.map((r: any) => [r.destination, r.n]));
  const load = (id: string) => used.get(id) ?? 0;
  const min = Math.min(...DESTINATION_IDS.map(load));
  const candidates = DESTINATION_IDS.filter((id) => load(id) === min);
  const h = crypto.createHash('sha256').update(customerId).digest().readUInt32BE(0);
  return candidates[h % candidates.length];
}
