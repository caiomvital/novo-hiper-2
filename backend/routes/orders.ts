import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';
import { assignDestination } from '../destinations';
import { ensureOrder } from '../orders/ensureOrder';
import { fetchOrderView, insertOrderRows, OrderError, resolveItems } from '../orders/createOrder';

export const ordersRouter = Router();

// GET /api/orders - Listar pedidos com itens e cliente
ordersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const orders = await db.all(`
      SELECT 
        o.id, 
        o.customer_id, 
        o.status, 
        o.total, 
        o.order_number, 
        o.customer_message, 
        o.created_at, 
        o.updated_at,
        c.name AS customer_name,
        c.avatar_path AS customer_avatar_url,
        COALESCE(o.destination_id, c.destination) AS destination_id,
        c.address AS customer_address,
        c.role_description AS customer_role
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
    `);

    // Carregar itens para cada pedido
    const orderItems = await db.all(`
      SELECT 
        oi.id, 
        oi.order_id, 
        oi.plant_id, 
        oi.quantity, 
        oi.unit_price,
        p.name AS plant_name,
        p.image_path AS plant_photo_url
      FROM order_items oi
      LEFT JOIN plants p ON p.id = oi.plant_id
    `);

    // Agrupar itens por order_id
    const itemsByOrder: Record<string, any[]> = {};
    for (const item of orderItems) {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push(item);
    }

    // `deliverable`: o estoque ATUAL cobre os itens do pedido aberto (o dono pode ter baixado o estoque depois)
    const stock = new Map<string, number>((await db.all('SELECT id, stock_quantity FROM plants')).map((p: any) => [p.id, Number(p.stock_quantity)]));
    const result = orders.map((o) => {
      const its = itemsByOrder[o.id] || [];
      return {
        ...o,
        items: its,
        deliverable: o.status !== 'entregue' && its.length > 0 && its.every((it: any) => (stock.get(it.plant_id) ?? 0) >= Number(it.quantity)),
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Erro ao listar pedidos:', error);
    res.status(500).json({ error: 'Erro ao buscar pedidos.' });
  }
});

// GET /api/orders/:id - Obter pedido com itens
ordersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const order = await db.get(`
      SELECT 
        o.id, 
        o.customer_id, 
        o.status, 
        o.total, 
        o.order_number, 
        o.customer_message, 
        o.created_at, 
        o.updated_at,
        c.name AS customer_name,
        c.avatar_path AS customer_avatar_url,
        COALESCE(o.destination_id, c.destination) AS destination_id,
        c.address AS customer_address,
        c.role_description AS customer_role
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `, req.params.id);

    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    const items = await db.all(`
      SELECT 
        oi.id, 
        oi.order_id, 
        oi.plant_id, 
        oi.quantity, 
        oi.unit_price,
        p.name AS plant_name,
        p.image_path AS plant_photo_url
      FROM order_items oi
      LEFT JOIN plants p ON p.id = oi.plant_id
      WHERE oi.order_id = ?
    `, order.id);

    res.json({
      ...order,
      items,
    });
  } catch (error) {
    console.error('Erro ao buscar pedido:', error);
    res.status(500).json({ error: 'Erro ao buscar pedido.' });
  }
});

// POST /api/orders/ensure — PEDE uma verificação de novo pedido automático. O backend decide (ensureOrder):
// capacidade, recuo técnico, plantas, estoque livre e clientes desbloqueados. O cliente nunca decide quem, o quê nem quanto.
//   { created: true, order }  ou  { created: false, reason: 'active_order'|'cooldown'|'no_plants'|'no_stock'|'no_customers'|'disabled' }
ordersRouter.post('/ensure', async (_req: Request, res: Response) => {
  try {
    res.json(await ensureOrder(await getDb()));
  } catch (error) {
    console.error('Erro ao verificar novo pedido:', error);
    res.status(500).json({ error: 'Erro ao verificar novo pedido.' });
  }
});

// POST /api/orders - Criar novo pedido (compatibilidade; o jogo cria pedidos por /ensure)
// O backend é a autoridade econômica: IGNORA unit_price, order_number e destination_id enviados pelo cliente.
// Preço = o da planta persistida no momento; número = próximo sequencial; destino = o do cliente, congelado agora.
// Dívida técnica: remover este endpoint quando nada mais depender dele.
ordersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, customer_id, items, customer_message, customer_name, customer_avatar_url, customer_role, customer_address } = req.body;
    const db = await getDb();

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'O pedido deve conter pelo menos um item.' });
      return;
    }

    let resolvedCustomerId = customer_id;

    // Cliente novo (sem id): registra com residência atribuída pelo servidor (o corpo não escolhe)
    if (!resolvedCustomerId && customer_name) {
      resolvedCustomerId = `cust_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const assigned = await assignDestination(db, resolvedCustomerId);
      await db.run(
        `INSERT INTO customers (id, name, avatar_path, destination, role_description, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [resolvedCustomerId, customer_name, customer_avatar_url || null, assigned, customer_role || null, customer_address || null, Date.now()]
      );
    } else if (resolvedCustomerId) {
      const existingCust = await db.get('SELECT id FROM customers WHERE id = ?', resolvedCustomerId);
      if (!existingCust && customer_name) {
        const assigned = await assignDestination(db, resolvedCustomerId);
        await db.run(
          `INSERT INTO customers (id, name, avatar_path, destination, role_description, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [resolvedCustomerId, customer_name, customer_avatar_url || null, assigned, customer_role || null, customer_address || null, Date.now()]
        );
      } else if (!existingCust) {
        res.status(400).json({ error: 'Cliente especificado não foi encontrado.' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Identificação ou dados do cliente são obrigatórios.' });
      return;
    }

    let orderId: string;
    let inTransaction = false;
    try {
      await db.run('BEGIN IMMEDIATE;');
      inTransaction = true;
      const resolved = await resolveItems(db, items);
      orderId = await insertOrderRows(db, { id, customerId: resolvedCustomerId, items: resolved.items, total: resolved.total, message: customer_message || null });
      await db.run('COMMIT;');
      inTransaction = false;
    } catch (err) {
      if (inTransaction) {
        try {
          await db.run('ROLLBACK;');
        } catch {
          /* já encerrada */
        }
      }
      throw err;
    }

    res.status(201).json(await fetchOrderView(db, orderId));
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.status).json({ ...(error.code ? { code: error.code } : {}), error: error.message });
      return;
    }
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido.' });
  }
});

// PUT /api/orders/:id - Atualizar pedido (status)
ordersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    // 'entregue' NUNCA pode ser definido por aqui: a finalização (baixa de estoque + crédito no caixa +
    // marcação de pedido/entrega) é atômica e exclusiva de POST /api/deliveries/:id/finish.
    // 400 (mesmo critério de PATCH /deliveries/:id/state) com `code` legível por máquina.
    if (status === 'entregue') {
      res.status(400).json({
        code: 'USE_FINISH_ENDPOINT',
        error: 'O status "entregue" só pode ser definido finalizando a entrega: POST /api/deliveries/:id/finish.',
      });
      return;
    }

    const validStatuses = ['recebido', 'preparando', 'pronto'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ 
        error: `Status inválido. Valores aceitos: ${validStatuses.join(', ')}` 
      });
      return;
    }

    const db = await getDb();
    const existing = await db.get('SELECT * FROM orders WHERE id = ?', id);
    if (!existing) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    // 'entregue' é TERMINAL: depois de finalizado por POST /deliveries/:id/finish (estoque baixado e caixa
    // creditado) o pedido não pode ser reaberto. 409 (conflito com o estado atual) + código explícito.
    if (existing.status === 'entregue') {
      res.status(409).json({
        code: 'ORDER_ALREADY_DELIVERED',
        error: 'Este pedido já foi entregue; "entregue" é um estado final e o pedido não pode ser reaberto.',
      });
      return;
    }

    const now = Date.now();
    await db.run(`
      UPDATE orders 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `, [status, now, id]);

    const updated = await db.get('SELECT * FROM orders WHERE id = ?', id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error);
    res.status(500).json({ error: 'Erro ao atualizar pedido.' });
  }
});
