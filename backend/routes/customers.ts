import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';
import { assignDestination } from '../destinations';
import { isKnownDestination, isModernDestination } from '../../src/shared/destinations';

export const customersRouter = Router();

// GET /api/customers - Listar clientes
customersRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const customers = await db.all('SELECT * FROM customers ORDER BY created_at ASC');
    res.json(customers);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// GET /api/customers/:id - Obter cliente
customersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const customer = await db.get('SELECT * FROM customers WHERE id = ?', req.params.id);
    if (!customer) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }
    res.json(customer);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro ao buscar cliente.' });
  }
});

// POST /api/customers - Cadastrar cliente
customersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, avatar_path, destination, role_description, address, notes } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
      return;
    }

    // Destino opcional: sem ele, o servidor atribui a residência (uma vez, gravada). Informado → precisa ser conhecido.
    if (destination !== undefined && destination !== null && (typeof destination !== 'string' || !isKnownDestination(destination.trim()))) {
      res.status(400).json({ code: 'INVALID_DESTINATION', error: 'Destino do cliente desconhecido.' });
      return;
    }

    const customerId = (id && typeof id === 'string') ? id : `cust_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();
    const db = await getDb();
    const resolvedDestination = destination ? destination.trim() : await assignDestination(db, customerId);

    await db.run(`
      INSERT INTO customers (id, name, avatar_path, destination, role_description, address, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      customerId,
      name.trim(),
      avatar_path || null,
      resolvedDestination,
      role_description || null,
      address || null,
      notes || null,
      now,
    ]);

    const created = await db.get('SELECT * FROM customers WHERE id = ?', customerId);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error);
    res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// PUT /api/customers/:id/destination - Mudar a residência do cliente (operação explícita).
// Só vale para pedidos FUTUROS: cada pedido já criado guarda o destino congelado em orders.destination_id.
customersRouter.put('/:id/destination', async (req: Request, res: Response) => {
  try {
    const { destination } = req.body ?? {};
    if (!isModernDestination(destination)) {
      res.status(400).json({ code: 'INVALID_DESTINATION', error: 'Destino inválido: use uma residência existente (<região>/<casa>).' });
      return;
    }
    const db = await getDb();
    const existing = await db.get('SELECT id FROM customers WHERE id = ?', req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }
    await db.run('UPDATE customers SET destination = ? WHERE id = ?', [destination, req.params.id]);
    res.json(await db.get('SELECT * FROM customers WHERE id = ?', req.params.id));
  } catch (error) {
    console.error('Erro ao atualizar destino do cliente:', error);
    res.status(500).json({ error: 'Erro ao atualizar destino do cliente.' });
  }
});
