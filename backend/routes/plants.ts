import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';

export const plantsRouter = Router();

// GET /api/plants/stock - Consultar estoque geral de todas as plantas
plantsRouter.get('/stock', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.all(`
      SELECT id, name, stock_quantity, price 
      FROM plants 
      ORDER BY name ASC
    `);
    const totalUnits = rows.reduce((sum, r) => sum + (r.stock_quantity || 0), 0);
    res.json({
      totalUnits,
      plants: rows,
    });
  } catch (error) {
    console.error('Erro ao consultar estoque:', error);
    res.status(500).json({ error: 'Erro ao consultar estoque.' });
  }
});

// GET /api/plants - Listar plantas
plantsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const plants = await db.all(`
      SELECT 
        id, 
        name, 
        price, 
        stock_quantity, 
        image_path, 
        species, 
        care_tag, 
        created_at, 
        updated_at 
      FROM plants 
      ORDER BY created_at DESC
    `);
    res.json(plants);
  } catch (error) {
    console.error('Erro ao listar plantas:', error);
    res.status(500).json({ error: 'Erro ao buscar catálogo de plantas.' });
  }
});

// GET /api/plants/:id/stock - Consultar estoque de planta específica
plantsRouter.get('/:id/stock', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const plant = await db.get(
      'SELECT id, name, stock_quantity FROM plants WHERE id = ?',
      req.params.id
    );
    if (!plant) {
      res.status(404).json({ error: 'Planta não encontrada.' });
      return;
    }
    res.json({ id: plant.id, name: plant.name, stock_quantity: plant.stock_quantity });
  } catch (error) {
    console.error('Erro ao consultar estoque da planta:', error);
    res.status(500).json({ error: 'Erro ao consultar estoque da planta.' });
  }
});

// GET /api/plants/:id - Obter planta específica
plantsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const plant = await db.get('SELECT * FROM plants WHERE id = ?', req.params.id);
    if (!plant) {
      res.status(404).json({ error: 'Planta não encontrada.' });
      return;
    }
    res.json(plant);
  } catch (error) {
    console.error('Erro ao buscar planta:', error);
    res.status(500).json({ error: 'Erro ao buscar planta.' });
  }
});

// POST /api/plants - Cadastrar nova planta
plantsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, price, stock_quantity, image_path, species, care_tag } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome da planta é obrigatório.' });
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ error: 'Preço deve ser um número maior ou igual a zero.' });
      return;
    }

    const parsedStock = parseInt(stock_quantity, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      res.status(400).json({ error: 'Quantidade em estoque deve ser um número inteiro maior ou igual a zero.' });
      return;
    }

    if (!image_path || typeof image_path !== 'string') {
      res.status(400).json({ error: 'Caminho da foto da planta é obrigatório.' });
      return;
    }

    const plantId = (id && typeof id === 'string' && id.trim()) ? id.trim() : `plant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = Date.now();
    const db = await getDb();

    await db.run(`
      INSERT INTO plants (id, name, price, stock_quantity, image_path, species, care_tag, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      plantId,
      name.trim(),
      parsedPrice,
      parsedStock,
      image_path.trim(),
      species ? species.trim() : null,
      care_tag ? care_tag.trim() : null,
      now,
      now,
    ]);

    const created = await db.get('SELECT * FROM plants WHERE id = ?', plantId);
    res.status(201).json(created);
  } catch (error) {
    console.error('Erro ao cadastrar planta:', error);
    res.status(500).json({ error: 'Erro ao cadastrar planta no banco de dados.' });
  }
});

// PUT /api/plants/:id - Editar planta
plantsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, price, stock_quantity, image_path, species, care_tag } = req.body;
    const { id } = req.params;

    const db = await getDb();
    const existing = await db.get('SELECT * FROM plants WHERE id = ?', id);
    if (!existing) {
      res.status(404).json({ error: 'Planta não encontrada.' });
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome da planta é obrigatório.' });
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      res.status(400).json({ error: 'Preço deve ser um número maior ou igual a zero.' });
      return;
    }

    const parsedStock = parseInt(stock_quantity, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      res.status(400).json({ error: 'Quantidade em estoque deve ser um número inteiro maior ou igual a zero.' });
      return;
    }

    const image = (image_path && typeof image_path === 'string') ? image_path.trim() : existing.image_path;
    const now = Date.now();

    await db.run(`
      UPDATE plants 
      SET name = ?, price = ?, stock_quantity = ?, image_path = ?, species = ?, care_tag = ?, updated_at = ?
      WHERE id = ?
    `, [
      name.trim(),
      parsedPrice,
      parsedStock,
      image,
      species ? species.trim() : null,
      care_tag ? care_tag.trim() : null,
      now,
      id,
    ]);

    const updated = await db.get('SELECT * FROM plants WHERE id = ?', id);
    res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar planta:', error);
    res.status(500).json({ error: 'Erro ao atualizar dados da planta.' });
  }
});

// DELETE /api/plants/:id - Excluir planta
plantsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Checar se planta existe
    const existing = await db.get('SELECT * FROM plants WHERE id = ?', id);
    if (!existing) {
      res.status(404).json({ error: 'Planta não encontrada.' });
      return;
    }

    // Checar se há pedidos não finalizados usando essa planta
    const activeOrderWithPlant = await db.get(`
      SELECT o.id, o.status 
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE oi.plant_id = ? AND o.status != 'entregue'
      LIMIT 1
    `, id);

    if (activeOrderWithPlant) {
      res.status(400).json({ 
        error: 'Esta planta não pode ser excluída pois possui pedidos em andamento.' 
      });
      return;
    }

    await db.run('DELETE FROM plants WHERE id = ?', id);
    res.json({ success: true, message: 'Planta excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir planta:', error);
    res.status(500).json({ error: 'Erro ao excluir planta.' });
  }
});
