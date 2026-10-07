import { Router, Request, Response } from 'express';
import { getDb } from '../db';

export const gameRouter = Router();

// GET /api/game/current - Consultar pedido atual, planta, cliente, valor e estado da entrega para o jogo
gameRouter.get('/current', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();

    // Buscar progresso atual
    const progress = await db.get("SELECT * FROM game_progress WHERE id = 'current'");
    let activeDelivery = null;

    if (progress?.active_delivery_id) {
      activeDelivery = await db.get('SELECT * FROM deliveries WHERE id = ?', progress.active_delivery_id);
    }

    if (!activeDelivery) {
      // Buscar última entrega não concluída
      activeDelivery = await db.get(`
        SELECT * FROM deliveries 
        WHERE status != 'entregue' 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
    }

    if (!activeDelivery) {
      res.json({
        hasActiveMission: false,
        mission: null,
        player: progress ? { x: progress.player_x, y: progress.player_y } : null,
        upgrades: progress?.store_upgrades ? JSON.parse(progress.store_upgrades) : [],
      });
      return;
    }

    // Buscar detalhes do pedido, cliente e planta
    const order = await db.get(`
      SELECT 
        o.id, 
        o.order_number, 
        o.customer_id, 
        o.status, 
        o.total, 
        o.customer_message, 
        o.created_at,
        c.name AS customer_name,
        c.avatar_path AS customer_avatar_url,
        COALESCE(o.destination_id, c.destination) AS destination_id,
        c.address AS customer_address,
        c.role_description AS customer_role
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ?
    `, activeDelivery.order_id);

    const items = await db.all(`
      SELECT 
        oi.id, 
        oi.order_id, 
        oi.plant_id, 
        oi.quantity, 
        oi.unit_price,
        p.name AS plant_name,
        p.image_path AS plant_photo_url,
        p.species AS plant_species,
        p.care_tag AS plant_care_tag
      FROM order_items oi
      LEFT JOIN plants p ON p.id = oi.plant_id
      WHERE oi.order_id = ?
    `, activeDelivery.order_id);

    res.json({
      hasActiveMission: true,
      delivery: {
        id: activeDelivery.id,
        status: activeDelivery.status,
        gameState: activeDelivery.game_state ? JSON.parse(activeDelivery.game_state) : null,
        createdAt: activeDelivery.created_at,
        updatedAt: activeDelivery.updated_at,
      },
      order: {
        id: order?.id,
        orderNumber: order?.order_number,
        total: order?.total,
        status: order?.status,
        customerMessage: order?.customer_message,
      },
      customer: {
        id: order?.customer_id,
        name: order?.customer_name,
        avatarUrl: order?.customer_avatar_url,
        role: order?.customer_role,
        address: order?.customer_address,
        destinationId: order?.destination_id,
      },
      items,
      player: progress ? { x: progress.player_x, y: progress.player_y } : null,
      upgrades: progress?.store_upgrades ? JSON.parse(progress.store_upgrades) : [],
    });
  } catch (error) {
    console.error('Erro ao consultar missão atual do jogo:', error);
    res.status(500).json({ error: 'Erro ao consultar estado atual do jogo.' });
  }
});

// GET /api/game/progress - Obter progresso geral salvo
gameRouter.get('/progress', async (_req: Request, res: Response) => {
  try {
    const db = await getDb();
    const progress = await db.get("SELECT * FROM game_progress WHERE id = 'current'");
    if (!progress) {
      res.json({
        id: 'current',
        activeOrderId: null,
        activeDeliveryId: null,
        playerX: 0,
        playerY: 0,
        missionState: null,
        storeUpgrades: [],
        updatedAt: Date.now(),
      });
      return;
    }

    res.json({
      id: progress.id,
      activeOrderId: progress.active_order_id,
      activeDeliveryId: progress.active_delivery_id,
      playerX: progress.player_x,
      playerY: progress.player_y,
      missionState: progress.mission_state ? JSON.parse(progress.mission_state) : null,
      storeUpgrades: progress.store_upgrades ? JSON.parse(progress.store_upgrades) : [],
      updatedAt: progress.updated_at,
    });
  } catch (error) {
    console.error('Erro ao obter progresso do jogo:', error);
    res.status(500).json({ error: 'Erro ao carregar progresso do jogo.' });
  }
});

// PUT /api/game/progress - Salvar progresso da missão e do jogo
gameRouter.put('/progress', async (req: Request, res: Response) => {
  try {
    const { 
      active_order_id, 
      active_delivery_id, 
      player_x, 
      player_y, 
      mission_state, 
      store_upgrades 
    } = req.body;

    const db = await getDb();
    const now = Date.now();

    const missionStateJson = mission_state ? JSON.stringify(mission_state) : null;
    const storeUpgradesJson = store_upgrades ? JSON.stringify(store_upgrades) : null;

    await db.run(`
      INSERT INTO game_progress (id, active_order_id, active_delivery_id, player_x, player_y, mission_state, store_upgrades, updated_at)
      VALUES ('current', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        active_order_id = COALESCE(excluded.active_order_id, game_progress.active_order_id),
        active_delivery_id = COALESCE(excluded.active_delivery_id, game_progress.active_delivery_id),
        player_x = COALESCE(excluded.player_x, game_progress.player_x),
        player_y = COALESCE(excluded.player_y, game_progress.player_y),
        mission_state = COALESCE(excluded.mission_state, game_progress.mission_state),
        store_upgrades = COALESCE(excluded.store_upgrades, game_progress.store_upgrades),
        updated_at = excluded.updated_at
    `, [
      active_order_id || null,
      active_delivery_id || null,
      typeof player_x === 'number' ? player_x : null,
      typeof player_y === 'number' ? player_y : null,
      missionStateJson,
      storeUpgradesJson,
      now,
    ]);

    res.json({ success: true, updatedAt: now });
  } catch (error) {
    console.error('Erro ao salvar progresso do jogo:', error);
    res.status(500).json({ error: 'Erro ao persistir progresso do jogo.' });
  }
});
