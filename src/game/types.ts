// Tipos do mini-jogo 2D de entregas do Novo Hiper (Bernardo em Olinda)

export type MissionState = 
  | 'AGUARDANDO_INICIO'   // Aguardando seleção de pedido
  | 'INDO_PARA_RETIRADA'  // Pedido aceito; deslocando-se até a Loja Novo Hiper
  | 'PLANTA_RETIRADA'     // Planta coletada na loja; em mãos de Bernardo
  | 'INDO_PARA_CLIENTE'   // Deslocando-se até a residência do cliente
  | 'PRONTO_PARA_ENTREGA' // Próximo ao cliente no destino; pronto para interagir
  | 'ENTREGA_CONCLUIDA'   // Entrega confirmada, estoque reduzido e venda registrada
  | 'FINALIZADA';         // Missão encerrada na tela de celebração

export type Direction = 'down' | 'up' | 'left' | 'right';

export interface GamePosition {
  x: number;
  y: number;
}

export interface CollisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  facing: Direction;
  isMoving: boolean;
  carryingPlant: boolean;
  walkCycle: number; // 0 a 1 para animação de passos
  stepTime: number;
}

export interface DeliveryMission {
  id: string;
  orderId: string;
  orderNumber: number;
  plant: {
    id: string;
    name: string;
    species?: string;
    price: number;
    photoUrl: string;
    careTag?: string;
  };
  customer: {
    id: string;
    name: string;
    avatarUrl: string;
    role: string;
    address: string;
    notes?: string;
  };
  destination: {
    id: string;
    name: string;
    address: string;
    mapX: number;
    mapY: number;
    doorX: number;
    doorY: number;
  };
  pickupPoint: {
    name: string;
    mapX: number;
    mapY: number;
  };
  state: MissionState;
  startedAt: number;
  completedAt?: number;
  rewardValue: number;
}

export interface MapBuilding {
  id: string;
  name: string;
  type: 'shop_novo_hiper' | 'house_dona_maria' | 'house_seu_joao' | 'house_ana' | 'coreto_carmo' | 'church_carmo';
  x: number;
  y: number;
  width: number;
  height: number;
  doorX: number;
  doorY: number;
  destinationId?: string;
  wallColor: string;
  roofColor: string;
  trimColor: string;
  collision: CollisionBox;
}

export interface MapDecor {
  id: string;
  type: 'palm' | 'ipe_yellow' | 'ipe_pink' | 'streetlamp' | 'bench' | 'flowerbed' | 'plant_pot' | 'fountain';
  x: number;
  y: number;
  scale?: number;
  collision?: CollisionBox;
}

export interface GameParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'leaf' | 'sparkle' | 'heart' | 'dust';
}

export interface InteractiveZonePrompt {
  canInteract: boolean;
  action: 'pickup' | 'deliver' | null;
  label: string;
  distance: number;
}
