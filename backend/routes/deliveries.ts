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
        COALESCE(o.destination_id, c.destination) AS destination_id,
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
        COALESCE(o.destination_id, c.destination) AS destination_id,
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
      // POLÍTICA (1D): pedido criado ANTES da exclusão lógica continua podendo ser iniciado/concluído — NÃO filtra deleted_at.
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

    // Validação estrita de status intermediário:
    // Uma entrega NUNCA pode transicionar para 'entregue' via PATCH /state.
    // A transição para 'entregue' é exclusiva do endpoint atômico POST /deliveries/:id/finish.
    let newStatus = delivery.status;
    if (status !== undefined) {
      if (status === 'entregue') {
        res.status(400).json({ 
          error: 'O status "entregue" só pode ser definido através do endpoint transacional POST /api/deliveries/:id/finish.' 
        });
        return;
      }
      const validIntermediateStatuses = ['iniciada', 'a_caminho'];
      if (!validIntermediateStatuses.includes(status)) {
        res.status(400).json({ 
          error: `Status intermediário inválido (${status}). Valores permitidos para este endpoint: ${validIntermediateStatuses.join(', ')}.` 
        });
        return;
      }
      newStatus = status;
    }

    const now = Date.now();
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

// POST /api/deliveries/:id/finish - Finalizar entrega (IDEMPOTENTE) com validação crítica no backend
//
// CONTRATO (Fase 1C):
//  - 1ª finalização válida → 200 { success: true, alreadyApplied: false, delivery, order, cashBalance, totalSales }
//      * baixa o estoque exatamente uma vez; credita o caixa exatamente uma vez;
//      * marca a entrega e o pedido como 'entregue'.
//  - Repetições (a entrega já está 'entregue') → 200 { …, alreadyApplied: true } SEM nenhum efeito:
//      * não baixa estoque, não cria transação de caixa, não altera pedido/entrega (updated_at inclusive).
//    `cashBalance`/`totalSales` refletem o caixa ATUAL (podem diferir da 1ª resposta se houve outras operações).
//  - Falhas reais (estoque insuficiente, planta removida, falha ao gravar o caixa) → 400 e ROLLBACK total;
//    nunca viram alreadyApplied=true e a entrega continua finalizável depois de corrigida a causa.
//  - Entrega inexistente → 404.
//
// COMO É IDEMPOTENTE: a decisão "já aplicado?" lê o estado PERSISTIDO (deliveries.status) DENTRO de uma
// transação de escrita (BEGIN IMMEDIATE) — não há flag em memória. Como rede de segurança adicional o banco
// mantém UNIQUE(deliveries.order_id) e UNIQUE(cash_transactions.order_id).
class FinishError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

deliveriesRouter.post('/:id/finish', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // 1. Verificar existência (404 antes de abrir qualquer transação)
    const exists = await db.get('SELECT id FROM deliveries WHERE id = ?', id);
    if (!exists) {
      res.status(404).json({ error: 'Entrega não encontrada.' });
      return;
    }

    let alreadyApplied = false;
    let orderId = '';
    let inTransaction = false;

    try {
      // 2. Transação de escrita: o estado da entrega é (re)lido AQUI DENTRO — fonte de verdade persistente
      await db.run('BEGIN IMMEDIATE;');
      inTransaction = true;

      const delivery = await db.get('SELECT * FROM deliveries WHERE id = ?', id);
      if (!delivery) throw new FinishError('Entrega não encontrada.', 404);
      orderId = delivery.order_id;

      if (delivery.status === 'entregue') {
        // Já finalizada: nenhum efeito colateral (nenhuma escrita), só devolve o estado final.
        alreadyApplied = true;
        await db.run('COMMIT;');
        inTransaction = false;
      } else {
        // 3. Buscar pedido real no banco de dados (não confiar em dados do cliente)
        const order = await db.get('SELECT * FROM orders WHERE id = ?', delivery.order_id);
        if (!order) throw new FinishError('Pedido associado à entrega não foi encontrado.', 404);

        // 4. Itens do pedido
        const items = await db.all('SELECT * FROM order_items WHERE order_id = ?', order.id);
        if (items.length === 0) throw new FinishError('Pedido não possui itens para entrega.', 400);

        // 5. Abater estoque de cada item com validação (qualquer falha desfaz TUDO)
        for (const item of items) {
          // POLÍTICA (1D): planta excluída logicamente ainda é baixada/creditada aqui se o pedido já existia (histórico consistente).
          const plant = await db.get('SELECT id, name, stock_quantity FROM plants WHERE id = ?', item.plant_id);
          if (!plant) throw new FinishError(`Planta ID ${item.plant_id} não encontrada.`, 400);
          if (plant.stock_quantity < item.quantity) {
            throw new FinishError(`Estoque insuficiente da planta "${plant.name}". Estoque atual: ${plant.stock_quantity}.`, 400);
          }
          await db.run('UPDATE plants SET stock_quantity = ?, updated_at = ? WHERE id = ?', [
            plant.stock_quantity - item.quantity,
            Date.now(),
            plant.id,
          ]);
        }

        const now = Date.now();
        await db.run(
          `UPDATE deliveries SET status = 'entregue', finished_at = ?, updated_at = ? WHERE id = ?`,
          [now, now, delivery.id]
        );
        await db.run(`UPDATE orders SET status = 'entregue', updated_at = ? WHERE id = ?`, [now, order.id]);

        // REGRA CRÍTICA: pagamento no caixa apenas uma vez (também garantido por UNIQUE(order_id))
        const existingTx = await db.get('SELECT id FROM cash_transactions WHERE order_id = ?', order.id);
        if (!existingTx) {
          const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          await db.run(
            `INSERT INTO cash_transactions (id, order_id, delivery_id, amount, type, description, created_at)
             VALUES (?, ?, ?, ?, 'credit', ?, ?)`,
            [txId, order.id, delivery.id, order.total, `Pagamento da Entrega Pedido #${order.order_number || order.id}`, now]
          );
        }

        await db.run('COMMIT;');
        inTransaction = false;
      }
    } catch (err: any) {
      if (inTransaction) {
        // só desfaz a transação que ESTE pedido abriu
        try {
          await db.run('ROLLBACK;');
        } catch {
          /* transação já encerrada */
        }
      }
      const status = err instanceof FinishError ? err.status : 400;
      res.status(status).json({ error: err.message || 'Falha na validação crítica da entrega.' });
      return;
    }

    // 6. Estado final (lido do banco)
    const finishedDelivery = await db.get('SELECT * FROM deliveries WHERE id = ?', id);
    const updatedOrder = await db.get('SELECT * FROM orders WHERE id = ?', orderId);
    const cashTotal = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_sales
      FROM cash_transactions
    `);

    res.json({
      success: true,
      alreadyApplied,
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
