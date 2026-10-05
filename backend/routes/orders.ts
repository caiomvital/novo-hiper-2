import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';

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
        c.destination AS destination_id,
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

    const result = orders.map((o) => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));

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
        c.destination AS destination_id,
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

// POST /api/orders - Criar novo pedido
// Valida cliente, plantas, preços e salva itens com unit_price fixado no momento
ordersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      id, 
      customer_id, 
      items, 
      customer_message, 
      order_number, 
      customer_name, 
      customer_avatar_url, 
      destination_id, 
      customer_address, 
      customer_role 
    } = req.body;

    const db = await getDb();

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'O pedido deve conter pelo menos um item.' });
      return;
    }

    let resolvedCustomerId = customer_id;

    // Se o cliente não existir no banco, registrar cliente automaticamente se dados forem fornecidos
    if (!resolvedCustomerId && customer_name) {
      resolvedCustomerId = `cust_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await db.run(`
        INSERT INTO customers (id, name, avatar_path, destination, role_description, address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        resolvedCustomerId,
        customer_name,
        customer_avatar_url || null,
        destination_id || 'dest_default',
        customer_role || null,
        customer_address || null,
        Date.now(),
      ]);
    } else if (resolvedCustomerId) {
      const existingCust = await db.get('SELECT id FROM customers WHERE id = ?', resolvedCustomerId);
      if (!existingCust && customer_name) {
        await db.run(`
          INSERT INTO customers (id, name, avatar_path, destination, role_description, address, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          resolvedCustomerId,
          customer_name,
          customer_avatar_url || null,
          destination_id || 'dest_default',
          customer_role || null,
          customer_address || null,
          Date.now(),
        ]);
      } else if (!existingCust) {
        res.status(400).json({ error: 'Cliente especificado não foi encontrado.' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Identificação ou dados do cliente são obrigatórios.' });
      return;
    }

    // Validar itens e plantas
    const validatedItems: Array<{
      plant_id: string;
      quantity: number;
      unit_price: number;
    }> = [];

    let calculatedTotal = 0;

    for (const item of items) {
      const plant = await db.get('SELECT id, name, price, stock_quantity FROM plants WHERE id = ?', item.plant_id);
      if (!plant) {
        res.status(400).json({ error: `Planta com ID "${item.plant_id}" não encontrada no catálogo.` });
        return;
      }

      const qty = parseInt(item.quantity, 10) || 1;
      if (qty <= 0) {
        res.status(400).json({ error: `Quantidade inválida para a planta "${plant.name}".` });
        return;
      }

      // Preço fixado no momento da criação da venda
      const unitPrice = typeof item.unit_price === 'number' && item.unit_price >= 0 
        ? item.unit_price 
        : plant.price;

      validatedItems.push({
        plant_id: plant.id,
        quantity: qty,
        unit_price: unitPrice,
      });

      calculatedTotal += qty * unitPrice;
    }

    calculatedTotal = Math.round(calculatedTotal * 100) / 100;

    const orderId = (id && typeof id === 'string') ? id : `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();

    // Determinar próximo order_number caso não venha informado
    let finalOrderNum = order_number;
    if (!finalOrderNum) {
      const maxRow = await db.get('SELECT MAX(order_number) as max_num FROM orders');
      finalOrderNum = (maxRow?.max_num || 100) + 1;
    }

    // Inserção atômica
    await db.run('BEGIN TRANSACTION;');
    try {
      await db.run(`
        INSERT INTO orders (id, customer_id, status, total, order_number, customer_message, created_at, updated_at)
        VALUES (?, ?, 'recebido', ?, ?, ?, ?, ?)
      `, [
        orderId,
        resolvedCustomerId,
        calculatedTotal,
        finalOrderNum,
        customer_message || null,
        now,
        now,
      ]);

      for (const vItem of validatedItems) {
        const itemId = `item_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await db.run(`
          INSERT INTO order_items (id, order_id, plant_id, quantity, unit_price)
          VALUES (?, ?, ?, ?, ?)
        `, [
          itemId,
          orderId,
          vItem.plant_id,
          vItem.quantity,
          vItem.unit_price,
        ]);
      }

      await db.run('COMMIT;');
    } catch (err) {
      await db.run('ROLLBACK;');
      throw err;
    }

    // Retornar pedido criado completo
    const createdOrder = await db.get(`
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
        c.destination AS destination_id,
        c.address AS customer_address,
        c.role_description AS customer_role
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `, orderId);

    const createdItems = await db.all(`
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
    `, orderId);

    res.status(201).json({
      ...createdOrder,
      items: createdItems,
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido.' });
  }
});

// PUT /api/orders/:id - Atualizar pedido (status)
ordersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['recebido', 'preparando', 'pronto', 'entregue'];
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
