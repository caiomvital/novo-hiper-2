import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';

export const deliveriesRouter = Router();

// GET /api/deliveries - Listar histórico de entregas
deliveriesRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const deliveries = await db.all(`
      SELECT 
        d.id, 
        d.order_id, 
        d.status, 
        d.game_state, 
        d.created_at, 
        d.updated_at, 
        d.finished_at,
        o.order_number,
        o.total AS order_total,
        c.name AS customer_name,
        c.destination AS destination_id,
        c.address AS customer_address
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY d.created_at DESC
    `);
    res.json(deliveries);
  } catch (error) {
    console.error('Erro ao listar entregas:', error);
    res.status(500).json({ error: 'Erro ao listar entregas.' });
  }
});

// GET /api/deliveries/:id - Obter entrega por ID
deliveriesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const delivery = await db.get(`
      SELECT 
        d.id, 
        d.order_id, 
        d.status, 
        d.game_state, 
        d.created_at, 
        d.updated_at, 
        d.finished_at,
        o.order_number,
        o.total AS order_total,
        c.name AS customer_name,
        c.destination AS destination_id,
        c.address AS customer_address
      FROM deliveries d
      JOIN orders o ON o.id = d.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE d.id = ?
    `, req.params.id);

    if (!delivery) {
      res.status(404).json({ error: 'Entrega não encontrada.' });
      return;
    }
    res.json(delivery);
  } catch (error) {
    console.error('Erro ao obter entrega:', error);
    res.status(500).json({ error: 'Erro ao consultar entrega.' });
  }
});

// POST /api/deliveries/start - Iniciar entrega para um pedido
deliveriesRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { order_id, game_state } = req.body;

    if (!order_id || typeof order_id !== 'string') {
      res.status(400).json({ error: 'order_id é obrigatório.' });
      return;
    }

    const db = await getDb();

    // 1. Verificar pedido no banco
    const order = await db.get('SELECT * FROM orders WHERE id = ?', order_id);
    if (!order) {
      res.status(404).json({ error: 'Pedido informado não existe no sistema.' });
      return;
    }

    if (order.status === 'entregue') {
      res.status(400).json({ error: 'Este pedido já foi entregue e finalizado.' });
      return;
    }

    // 2. Verificar se já existe entrega para este pedido
    const existingDelivery = await db.get('SELECT * FROM deliveries WHERE order_id = ?', order_id);
    if (existingDelivery) {
      if (existingDelivery.status === 'entregue') {
        res.status(400).json({ error: 'A entrega deste pedido já foi finalizada anteriormente.' });
        return;
      }
      // Retornar a entrega existente em andamento
      res.json(existingDelivery);
      return;
    }

    // 3. Validar se plantas do pedido existem e possuem estoque
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order_id);
    if (items.length === 0) {
      res.status(400).json({ error: 'O pedido não possui itens cadastrados.' });
      return;
    }

    for (const item of items) {
      const plant = await db.get('SELECT id, name, stock_quantity FROM plants WHERE id = ?', item.plant_id);
      if (!plant) {
        res.status(400).json({ error: `Planta ID ${item.plant_id} não encontrada no viveiro.` });
        return;
      }
      if (plant.stock_quantity < item.quantity) {
        res.status(400).json({ 
          error: `Estoque insuficiente para a planta "${plant.name}". Disponível: ${plant.stock_quantity}, Necessário: ${item.quantity}. Reabasteça no catálogo!` 
        });
        return;
      }
    }

    // 4. Criar registro de entrega
    const deliveryId = `del_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();
    const gameStateJson = game_state ? JSON.stringify(game_state) : null;

    await db.run('BEGIN TRANSACTION;');
    try {
      await db.run(`
        INSERT INTO deliveries (id, order_id, status, game_state, created_at, updated_at)
        VALUES (?, ?, 'iniciada', ?, ?, ?)
      `, [
        deliveryId,
        order_id,
        gameStateJson,
        now,
        now,
      ]);

      await db.run(`
        UPDATE orders 
        SET status = 'pronto', updated_at = ?
        WHERE id = ?
      `, [now, order_id]);

      await db.run('COMMIT;');
    } catch (err) {
      await db.run('ROLLBACK;');
      throw err;
    }

    const created = await db.get('SELECT * FROM deliveries WHERE id = ?', deliveryId);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao iniciar entrega:', error);
    res.status(500).json({ error: 'Erro ao iniciar entrega.' });
  }
});

// PATCH /api/deliveries/:id/state - Atualizar estado do jogo na entrega
deliveriesRouter.patch('/:id/state', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { game_state, status } = req.body;

    const db = await getDb();
    const delivery = await db.get('SELECT * FROM deliveries WHERE id = ?', id);
    if (!delivery) {
      res.status(404).json({ error: 'Entrega não encontrada.' });
      return;
    }

    if (delivery.status === 'entregue') {
      res.status(400).json({ error: 'Esta entrega já foi finalizada e não pode mais ser alterada.' });
      return;
    }

    const now = Date.now();
    const newStatus = status || delivery.status;
    const gameStateJson = game_state !== undefined 
      ? (typeof game_state === 'string' ? game_state : JSON.stringify(game_state))
      : delivery.game_state;

    await db.run(`
      UPDATE deliveries 
      SET status = ?, game_state = ?, updated_at = ?
      WHERE id = ?
    `, [newStatus, gameStateJson, now, id]);

    const updated = await db.get('SELECT * FROM deliveries WHERE id = ?', id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar estado da entrega:', error);
    res.status(500).json({ error: 'Erro ao atualizar estado da entrega.' });
  }
});

// POST /api/deliveries/:id/finish - Finalizar entrega com validação crítica no backend
// 1. Impede dupla finalização
// 2. Valida pedido, itens e abate estoque no banco
// 3. Registra pagamento no caixa atomicamente apenas uma vez
deliveriesRouter.post('/:id/finish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // 1. Buscar e verificar entrega
    const delivery = await db.get('SELECT * FROM deliveries WHERE id = ?', id);
    if (!delivery) {
      res.status(404).json({ error: 'Entrega não encontrada.' });
      return;
    }

    // REGRA CRÍTICA: Impedir que uma mesma entrega seja finalizada duas vezes
    if (delivery.status === 'entregue') {
      res.status(400).json({ error: 'Esta entrega já foi finalizada anteriormente e seu pagamento já foi processado.' });
      return;
    }

    // 2. Buscar pedido real no banco de dados (não confiar em dados do cliente)
    const order = await db.get('SELECT * FROM orders WHERE id = ?', delivery.order_id);
    if (!order) {
      res.status(404).json({ error: 'Pedido associado à entrega não foi encontrado.' });
      return;
    }

    // 3. Buscar itens do pedido e verificar estoque
    const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
    if (items.length === 0) {
      res.status(400).json({ error: 'Pedido não possui itens para entrega.' });
      return;
    }

    // 4. Iniciar transação atômica
    await db.run('BEGIN TRANSACTION;');
    try {
      // Abater estoque de cada item com validação
      for (const item of items) {
        const plant = await db.get('SELECT id, name, stock_quantity FROM plants WHERE id = ?', item.plant_id);
        if (!plant) {
          throw new Error(`Planta ID ${item.plant_id} não encontrada.`);
        }
        if (plant.stock_quantity < item.quantity) {
          throw new Error(`Estoque insuficiente da planta "${plant.name}". Estoque atual: ${plant.stock_quantity}.`);
        }

        const newStock = plant.stock_quantity - item.quantity;
        await db.run('UPDATE plants SET stock_quantity = ?, updated_at = ? WHERE id = ?', [
          newStock,
          Date.now(),
          plant.id,
        ]);
      }

      const now = Date.now();

      // Atualizar status da entrega para 'entregue'
      await db.run(`
        UPDATE deliveries 
        SET status = 'entregue', finished_at = ?, updated_at = ?
        WHERE id = ?
      `, [now, now, delivery.id]);

      // Atualizar status do pedido para 'entregue'
      await db.run(`
        UPDATE orders 
        SET status = 'entregue', updated_at = ?
        WHERE id = ?
      `, [now, order.id]);

      // REGRA CRÍTICA: Registrar pagamento no caixa apenas uma vez
      const existingTx = await db.get('SELECT id FROM cash_transactions WHERE order_id = ?', order.id);
      if (!existingTx) {
        const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await db.run(`
          INSERT INTO cash_transactions (id, order_id, delivery_id, amount, type, description, created_at)
          VALUES (?, ?, ?, ?, 'credit', ?, ?)
        `, [
          txId,
          order.id,
          delivery.id,
          order.total,
          `Pagamento da Entrega Pedido #${order.order_number || order.id}`,
          now,
        ]);
      }

      await db.run('COMMIT;');
    } catch (err: any) {
      await db.run('ROLLBACK;');
      res.status(400).json({ error: err.message || 'Falha na validação crítica da entrega.' });
      return;
    }

    // Retornar resultado consolidado
    const finishedDelivery = await db.get('SELECT * FROM deliveries WHERE id = ?', id);
    const updatedOrder = await db.get('SELECT * FROM orders WHERE id = ?', order.id);
    const cashTotal = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_sales
      FROM cash_transactions
    `);

    res.json({
      success: true,
      delivery: finishedDelivery,
      order: updatedOrder,
      cashBalance: cashTotal.balance,
      totalSales: cashTotal.total_sales,
    });
  } catch (error) {
    console.error('Erro ao finalizar entrega:', error);
    res.status(500).json({ error: 'Erro interno ao processar finalização da entrega.' });
  }
});
