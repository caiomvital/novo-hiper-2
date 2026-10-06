import { Router, Request, Response } from 'express';
import { getDb } from '../db';

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

// POST /api/cash/transactions — DESATIVADA (Fase 1E).
// Antes, qualquer cliente criava crédito/ajuste arbitrário ("dinheiro do nada"). Auditoria dos consumidores:
//   • único uso no frontend: crédito de ENTREGA AVULSA (sem pedido) em App.tsx → essa ação de crédito foi removida;
//   • upgrades da loja (câmera/ventilador) mexem só no localStorage — não chamavam esta rota;
//   • créditos de pedidos nascem SOMENTE dentro de POST /api/deliveries/:id/finish (transacional/idempotente).
// Decisão de negócio: o crédito de venda nasce SOMENTE do fluxo de pedido/entrega (finish). Não existe venda avulsa.
// Débitos/compras futuros terão endpoint próprio, atômico e idempotente (Fase 6). Não há operação manual legítima aqui.
cashRouter.post('/transactions', (_req: Request, res: Response) => {
  res.status(403).json({
    code: 'CASH_TRANSACTIONS_DISABLED',
    error: 'Lançamentos manuais no caixa foram desativados. Vendas são creditadas ao finalizar a entrega (POST /api/deliveries/:id/finish).',
  });
});
