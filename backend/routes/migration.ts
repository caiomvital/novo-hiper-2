import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const migrationRouter = Router();

const uploadsBaseDir = path.resolve(process.env.UPLOADS_DIR || './uploads');
const plantsUploadDir = path.join(uploadsBaseDir, 'plants');

if (!fs.existsSync(plantsUploadDir)) {
  fs.mkdirSync(plantsUploadDir, { recursive: true });
}

// Salvar imagens em base64 vindas do localStorage diretamente no disco
function saveBase64Image(dataUrl: string, fallbackName: string): string {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return dataUrl; // Se for URL externa, mantém
    }

    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9-+.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return dataUrl;
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `plant_migrated_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(plantsUploadDir, filename);

    fs.writeFileSync(filePath, buffer);
    return `/uploads/plants/${filename}`;
  } catch (err) {
    console.error('Erro ao converter base64 para arquivo durante migração:', err);
    return dataUrl;
  }
}

// GET /api/migration/status - Verificar estado atual do banco
migrationRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    // Conta TODAS as linhas (inclui plantas removidas logicamente): mede a população do banco, não o catálogo ativo.
    const plantsCount = await db.get('SELECT COUNT(*) as count FROM plants');
    const customersCount = await db.get('SELECT COUNT(*) as count FROM customers');
    const ordersCount = await db.get('SELECT COUNT(*) as count FROM orders');
    const deliveriesCount = await db.get('SELECT COUNT(*) as count FROM deliveries');
    const cashCount = await db.get('SELECT COUNT(*) as count FROM cash_transactions');

    res.json({
      initialized: true,
      counts: {
        plants: plantsCount?.count || 0,
        customers: customersCount?.count || 0,
        orders: ordersCount?.count || 0,
        deliveries: deliveriesCount?.count || 0,
        cashTransactions: cashCount?.count || 0,
      },
    });
  } catch (error) {
    console.error('Erro ao verificar status da migração:', error);
    res.status(500).json({ error: 'Erro ao verificar banco de dados.' });
  }
});

// POST /api/migrate - Recebe dados do localStorage e migra para o SQLite
migrationRouter.post('/', async (req: Request, res: Response) => {
  const { 
    plants = [], 
    customers = [], 
    destinations = [], 
    orders = [], 
    deliveries = [], 
    cashRegister = null,
    upgrades = [] 
  } = req.body;

  const db = await getDb();
  let migratedPlants = 0;
  let migratedCustomers = 0;
  let migratedOrders = 0;
  let migratedDeliveries = 0;
  let migratedTransactions = 0;

  await db.run('BEGIN TRANSACTION;');
  try {
    // 1. Migrar Clientes / Destinos
    for (const cust of customers) {
      if (!cust.id) continue;
      const existing = await db.get('SELECT id FROM customers WHERE id = ?', cust.id);
      if (!existing) {
        await db.run(`
          INSERT INTO customers (id, name, avatar_path, destination, role_description, address, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          cust.id,
          cust.name || 'Cliente',
          cust.avatarUrl || cust.avatar_path || null,
          cust.destinationId || cust.destination || 'dest_default',
          cust.roleDescription || cust.role_description || null,
          cust.address || null,
          cust.notes || null,
          Date.now(),
        ]);
        migratedCustomers++;
      }
    }

    for (const dest of destinations) {
      if (!dest.id) continue;
      const existing = await db.get('SELECT id FROM customers WHERE id = ?', dest.id);
      if (!existing) {
        await db.run(`
          INSERT INTO customers (id, name, avatar_path, destination, role_description, address, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          dest.id,
          dest.name || 'Destino Olinda',
          null,
          dest.id,
          dest.type || 'Ponto de Entrega',
          dest.address || null,
          dest.description || null,
          dest.createdAt || Date.now(),
        ]);
        migratedCustomers++;
      }
    }

    // 2. Migrar Plantas (convertendo fotos para arquivo se forem base64)
    for (const plant of plants) {
      if (!plant.id) continue;
      const existing = await db.get('SELECT id FROM plants WHERE id = ?', plant.id);
      if (!existing) {
        const photoUrl = plant.photoUrl || plant.image_path || '';
        const savedImagePath = saveBase64Image(photoUrl, plant.id);

        await db.run(`
          INSERT INTO plants (id, name, price, stock_quantity, image_path, species, care_tag, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          plant.id,
          plant.name || 'Planta',
          Number(plant.price) || 0,
          typeof plant.stock === 'number' ? plant.stock : (typeof plant.stock_quantity === 'number' ? plant.stock_quantity : 5),
          savedImagePath,
          plant.species || null,
          plant.careTag || plant.care_tag || null,
          plant.createdAt || Date.now(),
          plant.updatedAt || Date.now(),
        ]);
        migratedPlants++;
      }
    }

    // 3. Migrar Pedidos e Itens
    for (const order of orders) {
      if (!order.id) continue;
      const existing = await db.get('SELECT id FROM orders WHERE id = ?', order.id);
      if (!existing) {
        // Garantir que cliente do pedido exista
        let custId = order.customerId || order.customer_id;
        if (!custId) {
          custId = 'cust_migrated_' + order.id;
          await db.run(`
            INSERT OR IGNORE INTO customers (id, name, avatar_path, destination, role_description, address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            custId,
            order.customerName || 'Cliente',
            order.customerAvatarUrl || null,
            order.destinationId || 'dest_default',
            order.customerRole || null,
            order.customerAddress || null,
            Date.now(),
          ]);
        }

        const validStatuses = ['recebido', 'preparando', 'pronto', 'entregue'];
        const orderStatus = validStatuses.includes(order.status) ? order.status : 'recebido';
        const total = Number(order.totalPrice || order.total || order.plantPrice || 0);

        await db.run(`
          INSERT INTO orders (id, customer_id, status, total, order_number, customer_message, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          order.id,
          custId,
          orderStatus,
          total,
          order.orderNumber || order.order_number || 101,
          order.customerMessage || null,
          order.createdAt || Date.now(),
          order.completedAt || order.updatedAt || Date.now(),
        ]);

        // Criar item do pedido com preço fixo
        const itemId = `item_${order.id}_1`;
        const plantId = order.plantId || order.plant_id || (plants[0]?.id || 'unknown');
        const unitPrice = Number(order.plantPrice || order.totalPrice || total || 0);

        await db.run(`
          INSERT OR IGNORE INTO order_items (id, order_id, plant_id, quantity, unit_price)
          VALUES (?, ?, ?, ?, ?)
        `, [
          itemId,
          order.id,
          plantId,
          order.quantity || 1,
          unitPrice,
        ]);

        migratedOrders++;
      }
    }

    // 4. Migrar Entregas
    for (const del of deliveries) {
      if (!del.id) continue;
      // Verificar se a entrega já existe
      const existing = await db.get('SELECT id FROM deliveries WHERE id = ?', del.id);
      if (!existing) {
        // Obter order_id correspondente
        const orderId = del.orderId || del.order_id || (orders.find((o: any) => o.id === del.orderId || o.plantId === del.plantId)?.id);
        if (orderId) {
          await db.run(`
            INSERT OR IGNORE INTO deliveries (id, order_id, status, game_state, created_at, updated_at, finished_at)
            VALUES (?, ?, 'entregue', ?, ?, ?, ?)
          `, [
            del.id,
            orderId,
            null,
            del.timestamp || Date.now(),
            del.timestamp || Date.now(),
            del.timestamp || Date.now(),
          ]);
          migratedDeliveries++;
        }
      }
    }

    // 5. Migrar Caixa / Vendas
    if (cashRegister?.salesHistory && Array.isArray(cashRegister.salesHistory)) {
      for (const sale of cashRegister.salesHistory) {
        const orderId = sale.orderId || null;
        const txId = sale.id || `tx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        
        // Evitar duplicidade
        const existingTx = await db.get('SELECT id FROM cash_transactions WHERE id = ? OR (order_id IS NOT NULL AND order_id = ?)', txId, orderId);
        if (!existingTx) {
          await db.run(`
            INSERT INTO cash_transactions (id, order_id, delivery_id, amount, type, description, created_at)
            VALUES (?, ?, ?, ?, 'credit', ?, ?)
          `, [
            txId,
            orderId,
            sale.deliveryId || null,
            Number(sale.value) || 0,
            `Venda Migrada - ${sale.plantName || 'Planta'}`,
            sale.timestamp || Date.now(),
          ]);
          migratedTransactions++;
        }
      }
    }

    // 6. Migrar Melhorias do Jogo para game_progress
    if (upgrades && Array.isArray(upgrades) && upgrades.length > 0) {
      await db.run(`
        INSERT INTO game_progress (id, store_upgrades, updated_at)
        VALUES ('current', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          store_upgrades = excluded.store_upgrades,
          updated_at = excluded.updated_at
      `, [
        JSON.stringify(upgrades),
        Date.now(),
      ]);
    }

    await db.run('COMMIT;');

    res.json({
      success: true,
      migrated: {
        plants: migratedPlants,
        customers: migratedCustomers,
        orders: migratedOrders,
        deliveries: migratedDeliveries,
        cashTransactions: migratedTransactions,
      },
      message: 'Migração do localStorage para SQLite concluída com sucesso no servidor.',
    });
  } catch (error) {
    await db.run('ROLLBACK;');
    console.error('Erro durante migração do localStorage:', error);
    res.status(500).json({ error: 'Falha ao migrar dados para o banco de dados.' });
  }
});
