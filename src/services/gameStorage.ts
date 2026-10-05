// Serviço de persistência e gerenciamento de missões do mini-jogo 2D de entregas do Novo Hiper

import { DeliveryMission, GamePosition } from '../game/types';
import { CustomerOrder, Plant, DeliveryDestination } from '../types';
import { getStoredOrders, getStoredPlants, getStoredDestinations } from './storage';
import { NOVO_HIPER_SHOP, getMapDestinationInfo } from '../game/mapData';

export const GAME_STORAGE_MISSION_KEY = 'novo_hiper_delivery_game_v1';
export const GAME_STORAGE_PLAYER_POS_KEY = 'novo_hiper_delivery_player_pos_v1';

/**
 * Retorna a missão atualmente ativa salva em cache, validando com a base de dados real
 */
export function getStoredActiveMission(): DeliveryMission | null {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_MISSION_KEY);
    if (!raw) return null;
    const mission = JSON.parse(raw) as DeliveryMission;

    // Checagem de integridade contra pedidos reais do Novo Hiper
    const orders = getStoredOrders();
    const targetOrder = orders.find((o) => o.id === mission.orderId);

    if (!targetOrder) {
      clearActiveMission();
      return null;
    }

    if (targetOrder.status === 'entregue' && mission.state !== 'ENTREGA_CONCLUIDA' && mission.state !== 'FINALIZADA') {
      clearActiveMission();
      return null;
    }

    return mission;
  } catch (err) {
    console.error('Erro ao ler missão ativa do jogo:', err);
    return null;
  }
}

/**
 * Salva o estado atual da missão no LocalStorage
 */
export function saveActiveMission(mission: DeliveryMission): void {
  try {
    localStorage.setItem(GAME_STORAGE_MISSION_KEY, JSON.stringify(mission));
  } catch (err) {
    console.error('Erro ao salvar missão ativa do jogo:', err);
  }
}

/**
 * Remove a missão ativa
 */
export function clearActiveMission(): void {
  try {
    localStorage.removeItem(GAME_STORAGE_MISSION_KEY);
  } catch (err) {
    console.error('Erro ao limpar missão ativa do jogo:', err);
  }
}

/**
 * Recupera a posição do jogador
 */
export function getStoredPlayerPosition(): GamePosition | null {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_PLAYER_POS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GamePosition;
  } catch {
    return null;
  }
}

/**
 * Salva a posição de Bernardo no mapa
 */
export function savePlayerPosition(pos: GamePosition): void {
  try {
    localStorage.setItem(GAME_STORAGE_PLAYER_POS_KEY, JSON.stringify(pos));
  } catch {
    // Silencioso em caso de quota
  }
}

/**
 * Constrói uma nova DeliveryMission a partir de um pedido real cadastrado no Novo Hiper
 */
export function createMissionFromOrder(
  order: CustomerOrder,
  plants?: Plant[],
  destinations?: DeliveryDestination[]
): { success: boolean; mission?: DeliveryMission; error?: string } {
  // 1. Validar status do pedido
  if (order.status === 'entregue') {
    return { success: false, error: 'Este pedido já foi entregue anteriormente!' };
  }

  // 2. Localizar planta real cadastrada no catálogo
  const allPlants = plants || getStoredPlants();
  const plant = allPlants.find((p) => p.id === order.plantId);
  if (!plant) {
    return { success: false, error: `A planta "${order.plantName}" não foi localizada no catálogo.` };
  }

  // 3. Validar estoque da planta
  if ((plant.stock ?? 0) <= 0) {
    return { success: false, error: `A planta "${plant.name}" está sem estoque no viveiro. Reabasteça no catálogo para entregar.` };
  }

  // 4. Mapear destino no cenário 2D compacto de Olinda
  const allDestinations = destinations || getStoredDestinations();
  const destination = allDestinations.find((d) => d.id === order.destinationId);
  const destInfo = getMapDestinationInfo(order.destinationId);

  const mission: DeliveryMission = {
    id: `mission_${order.id}_${Date.now()}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    plant: {
      id: plant.id,
      name: plant.name,
      species: plant.species,
      price: order.plantPrice || plant.price,
      photoUrl: plant.photoUrl,
      careTag: plant.careTag,
    },
    customer: {
      id: order.customerId,
      name: order.customerName,
      avatarUrl: order.customerAvatarUrl,
      role: order.customerRole,
      address: order.customerAddress,
      notes: order.customerMessage,
    },
    destination: {
      id: order.destinationId,
      name: destination?.name || destInfo.name,
      address: order.customerAddress,
      mapX: destInfo.doorX,
      mapY: destInfo.doorY,
      doorX: destInfo.doorX,
      doorY: destInfo.doorY,
    },
    pickupPoint: {
      name: NOVO_HIPER_SHOP.name,
      mapX: NOVO_HIPER_SHOP.pickupX,
      mapY: NOVO_HIPER_SHOP.pickupY,
    },
    state: 'INDO_PARA_RETIRADA',
    startedAt: Date.now(),
    rewardValue: order.plantPrice || plant.price,
  };

  saveActiveMission(mission);
  return { success: true, mission };
}
