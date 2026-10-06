import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import crypto from 'crypto';

export const plantsRouter = Router();

// ── Exclusão lógica (Fase 1D) ─────────────────────────────────────────────────────────────────────
// `plants.deleted_at` (INTEGER ms; NULL = ativa). DELETE /api/plants/:id = REMOVER DO CATÁLOGO (soft-delete):
// a linha nunca é apagada (preserva order_items/caixa/histórico); restaurar no futuro = voltar deleted_at a NULL.
// Classificação das consultas desta rota:
//   A) catálogo/estado atual → ignoram plantas excluídas: GET /, GET /stock, GET /:id, GET /:id/stock
//   C) operação nova → recusam planta excluída: PUT /:id (409 PLANT_DELETED)
//   DELETE → soft-delete idempotente; continua bloqueado se há pedido NÃO entregue usando a planta.

// GET /api/plants/stock - Consultar estoque geral de todas as plantas
plantsRouter.get('/stock', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = await db.all(`
      SELECT id, name, stock_quantity, price 
      FROM plants 
      WHERE deleted_at IS NULL
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
      WHERE deleted_at IS NULL
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
      'SELECT id, name, stock_quantity FROM plants WHERE id = ? AND deleted_at IS NULL',
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
    const plant = await db.get('SELECT * FROM plants WHERE id = ? AND deleted_at IS NULL', req.params.id);
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
    // Planta removida do catálogo: nenhuma edição (preço/estoque/foto) pelos fluxos normais
    if (existing.deleted_at !== null && existing.deleted_at !== undefined) {
      res.status(409).json({
        code: 'PLANT_DELETED',
        error: 'Esta planta foi removida do catálogo e não pode ser editada.',
      });
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

// DELETE /api/plants/:id - REMOVER planta do catálogo (exclusão LÓGICA, sempre — mesmo sem histórico)
//  - 1ª remoção → 200 { success: true, deleted: true, alreadyDeleted: false, deletedAt, message }
//  - repetição  → 200 { success: true, deleted: true, alreadyDeleted: true,  deletedAt }  (idempotente, sem efeito)
//  - planta usada por pedido NÃO entregue → 400 (regra de segurança mantida); inexistente → 404
//  - a linha, o estoque e todo o histórico (order_items, caixa) permanecem intactos; restaurar = deleted_at = NULL
plantsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    let inTransaction = false;
    try {
      // Verificação + marcação na MESMA transação de escrita (sem janela entre checar pedidos e excluir)
      await db.run('BEGIN IMMEDIATE;');
      inTransaction = true;

      const existing = await db.get('SELECT id, deleted_at FROM plants WHERE id = ?', id);
      if (!existing) {
        await db.run('ROLLBACK;');
        inTransaction = false;
        res.status(404).json({ error: 'Planta não encontrada.' });
        return;
      }

      // Já removida: sucesso idempotente, nenhuma escrita
      if (existing.deleted_at !== null && existing.deleted_at !== undefined) {
        await db.run('COMMIT;');
        inTransaction = false;
        res.json({ success: true, deleted: true, alreadyDeleted: true, deletedAt: existing.deleted_at });
        return;
      }

      // Pedidos não finalizados dependem desta planta → não remover (evita entrega aberta apontando para produto removido)
      const activeOrderWithPlant = await db.get(`
        SELECT o.id, o.status 
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE oi.plant_id = ? AND o.status != 'entregue'
        LIMIT 1
      `, id);
      if (activeOrderWithPlant) {
        await db.run('ROLLBACK;');
        inTransaction = false;
        res.status(400).json({
          error: 'Esta planta não pode ser excluída pois possui pedidos em andamento.'
        });
        return;
      }

      const now = Date.now();
      await db.run('UPDATE plants SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [now, now, id]);
      await db.run('COMMIT;');
      inTransaction = false;
      res.json({
        success: true,
        deleted: true,
        alreadyDeleted: false,
        deletedAt: now,
        message: 'Planta removida do catálogo. O histórico de pedidos e vendas foi preservado.',
      });
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
  } catch (error) {
    console.error('Erro ao excluir planta:', error);
    res.status(500).json({ error: 'Erro ao excluir planta.' });
  }
});
