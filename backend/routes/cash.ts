import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';

export const cashRouter = Router();

// GET /api/cash/summary - Resumo do saldo e total de vendas
cashRouter.get('/summary', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const summary = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_sales,
        COUNT(*) AS transaction_count
      FROM cash_transactions
    `);

    res.json({
      balance: Math.round((summary?.balance || 0) * 100) / 100,
      totalSales: Math.round((summary?.total_sales || 0) * 100) / 100,
      transactionCount: summary?.transaction_count || 0,
    });
  } catch (error) {
    console.error('Erro ao consultar resumo do caixa:', error);
    res.status(500).json({ error: 'Erro ao consultar saldo do caixa.' });
  }
});

// GET /api/cash - Listar transações do caixa
cashRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const transactions = await db.all(`
      SELECT 
        ct.id, 
        ct.order_id, 
        ct.delivery_id, 
        ct.amount, 
        ct.type, 
        ct.description, 
        ct.created_at,
        o.order_number,
        c.name AS customer_name,
        c.destination AS destination_name
      FROM cash_transactions ct
      LEFT JOIN orders o ON o.id = ct.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY ct.created_at DESC
    `);

    const summary = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_sales
      FROM cash_transactions
    `);

    res.json({
      balance: Math.round((summary?.balance || 0) * 100) / 100,
      totalSales: Math.round((summary?.total_sales || 0) * 100) / 100,
      transactions,
    });
  } catch (error) {
    console.error('Erro ao listar transações:', error);
    res.status(500).json({ error: 'Erro ao consultar extrato do caixa.' });
  }
});

// POST /api/cash/transactions - Registrar transação no caixa (ex: compra de melhoria ou ajuste)
cashRouter.post('/transactions', async (req: Request, res: Response) => {
  try {
    const { order_id, delivery_id, amount, type, description } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Valor da transação deve ser positivo maior que zero.' });
      return;
    }

    const validTypes = ['credit', 'debit', 'upgrade_purchase', 'adjustment'];
    if (!type || !validTypes.includes(type)) {
      res.status(400).json({ error: `Tipo inválido. Aceitos: ${validTypes.join(', ')}` });
      return;
    }

    const db = await getDb();

    // Se a transação estiver vinculada a um pedido, garantir que não seja registrada duas vezes
    if (order_id) {
      const existing = await db.get('SELECT id FROM cash_transactions WHERE order_id = ?', order_id);
      if (existing) {
        res.status(409).json({ error: 'Pagamento já registrado para este pedido.' });
        return;
      }
    }

    // Se for débito ou compra de melhoria, validar se há saldo suficiente no caixa
    if (type === 'debit' || type === 'upgrade_purchase') {
      const current = await db.get(`
        SELECT COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance
        FROM cash_transactions
      `);
      const currentBalance = current?.balance || 0;
      if (currentBalance < parsedAmount) {
        res.status(400).json({ 
          error: `Saldo insuficiente no caixa (${currentBalance.toFixed(2)}) para efetuar a operação (${parsedAmount.toFixed(2)}).` 
        });
        return;
      }
    }

    const txId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();

    await db.run(`
      INSERT INTO cash_transactions (id, order_id, delivery_id, amount, type, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      txId,
      order_id || null,
      delivery_id || null,
      parsedAmount,
      type,
      description || null,
      now,
    ]);

    const created = await db.get('SELECT * FROM cash_transactions WHERE id = ?', txId);
    const summary = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS balance,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_sales
      FROM cash_transactions
    `);

    res.status(201).json({
      transaction: created,
      balance: Math.round((summary?.balance || 0) * 100) / 100,
      totalSales: Math.round((summary?.total_sales || 0) * 100) / 100,
    });
  } catch (error) {
    console.error('Erro ao registrar transação no caixa:', error);
    res.status(500).json({ error: 'Erro ao registrar transação financeira.' });
  }
});
