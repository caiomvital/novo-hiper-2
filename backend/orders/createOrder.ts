import crypto from 'crypto';
import type { DbWrapper } from '../db';

/** Erro de regra de pedido com status HTTP e código legível por máquina. */
export class OrderError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export interface OrderItemInput {
  plant_id: string;
  quantity?: unknown;
}
export interface ResolvedItem {
  plant_id: string;
  quantity: number;
  unit_price: number;
}

/**
 * Resolve os itens de um pedido contra o catálogo PERSISTIDO. O preço oficial é SEMPRE o da planta no momento da
 * criação (o cliente nunca define valor econômico): é congelado no order_item e não muda se a planta for reprecificada.
 */
export async function resolveItems(db: DbWrapper, items: OrderItemInput[]): Promise<{ items: ResolvedItem[]; total: number }> {
  const resolved: ResolvedItem[] = [];
  let total = 0;
  for (const item of items) {
    const plant = await db.get('SELECT id, name, price, stock_quantity, deleted_at FROM plants WHERE id = ?', item.plant_id);
    if (!plant) throw new OrderError(400, `Planta com ID "${item.plant_id}" não encontrada no catálogo.`);
    // Operação NOVA: planta removida do catálogo não pode entrar em pedido (os pedidos antigos seguem íntegros)
    if (plant.deleted_at !== null && plant.deleted_at !== undefined) {
      throw new OrderError(400, `A planta "${plant.name}" foi removida do catálogo e não pode ser pedida.`, 'PLANT_DELETED');
    }
    const qty = parseInt(String(item.quantity), 10) || 1;
    if (qty <= 0) throw new OrderError(400, `Quantidade inválida para a planta "${plant.name}".`);
    resolved.push({ plant_id: plant.id, quantity: qty, unit_price: plant.price });
    total += qty * plant.price;
  }
  return { items: resolved, total: Math.round(total * 100) / 100 };
}

/**
 * Próximo número de pedido, atribuído PELO BACKEND dentro da transação de escrita (sequencial a partir de 101).
 * Não precisa de UNIQUE: BEGIN IMMEDIATE serializa quem escreve, e o cliente não escolhe mais o número.
 */
export async function nextOrderNumber(db: DbWrapper): Promise<number> {
  const row = await db.get('SELECT MAX(order_number) AS max_num FROM orders');
  return Math.max(100, Number(row?.max_num) || 0) + 1;
}

export interface NewOrderInput {
  id?: string;
  customerId: string;
  items: ResolvedItem[];
  total: number;
  message?: string | null;
}

/**
 * Grava pedido + itens (SEM abrir transação: o chamador já está em BEGIN IMMEDIATE). O destino do pedido é
 * congelado agora, copiado do endereço atual do cliente.
 */
export async function insertOrderRows(db: DbWrapper, input: NewOrderInput, now: number = Date.now()): Promise<string> {
  const orderId = input.id && typeof input.id === 'string' ? input.id : `ord_${now}_${crypto.randomBytes(4).toString('hex')}`;
  const orderNumber = await nextOrderNumber(db);
  await db.run(
    `INSERT INTO orders (id, customer_id, status, total, order_number, customer_message, created_at, updated_at, destination_id)
     VALUES (?, ?, 'recebido', ?, ?, ?, ?, ?, (SELECT destination FROM customers WHERE id = ?))`,
    [orderId, input.customerId, input.total, orderNumber, input.message ?? null, now, now, input.customerId]
  );
  for (const it of input.items) {
    await db.run(`INSERT INTO order_items (id, order_id, plant_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)`, [
      `item_${now}_${crypto.randomBytes(4).toString('hex')}`,
      orderId,
      it.plant_id,
      it.quantity,
      it.unit_price,
    ]);
  }
  return orderId;
}

/** Pedido no formato da API (com cliente, destino congelado e itens). */
export async function fetchOrderView(db: DbWrapper, orderId: string) {
  const order = await db.get(
    `SELECT o.id, o.customer_id, o.status, o.total, o.order_number, o.customer_message, o.created_at, o.updated_at,
            c.name AS customer_name, c.avatar_path AS customer_avatar_url,
            COALESCE(o.destination_id, c.destination) AS destination_id,
            c.address AS customer_address, c.role_description AS customer_role
       FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?`,
    orderId
  );
  if (!order) return undefined;
  const items = await db.all(
    `SELECT oi.id, oi.order_id, oi.plant_id, oi.quantity, oi.unit_price,
            p.name AS plant_name, p.image_path AS plant_photo_url
       FROM order_items oi LEFT JOIN plants p ON p.id = oi.plant_id
      WHERE oi.order_id = ?`,
    orderId
  );
  return { ...order, items };
}
