// Dados do mapa expandido e acolhedor de Olinda para o mini-jogo do Novo Hiper

import { MapBuilding, MapDecor, CollisionBox } from './types';

// Dimensões do mapa ampliado para locomoção fluida e espaçosa (1360 x 960)
export const MAP_WIDTH = 1360;
export const MAP_HEIGHT = 960;

// Ponto de Retirada e Balcão da Loja Novo Hiper
export const NOVO_HIPER_SHOP = {
  name: 'Loja Novo Hiper (Viveiro Central)',
  x: 80,
  y: 70,
  width: 320,
  height: 210,
  pickupX: 240,
  pickupY: 285,
  deckX: 110,
  deckY: 235,
  deckW: 260,
  deckH: 45,
};

// Posição inicial de Bernardo ao abrir o jogo (na calçada ampla em frente à loja)
export const PLAYER_SPAWN_POSITION = {
  x: 260,
  y: 310,
};

// Edifícios coloniais do mapa espaçoso de Olinda
export const MAP_BUILDINGS: MapBuilding[] = [
  // 1. Loja Novo Hiper (Viveiro de Plantas & Atendimento) - Quarteirão Noroeste
  {
    id: 'bld_novo_hiper',
    name: 'Loja Novo Hiper',
    type: 'shop_novo_hiper',
    x: 80,
    y: 70,
    width: 320,
    height: 210,
    doorX: 240,
    doorY: 280,
    wallColor: '#065f46', // Verde esmeralda colonial
    roofColor: '#9a3412', // Terracota queimado
    trimColor: '#fef08a', // Amarelo sol
    collision: { x: 80, y: 95, w: 320, h: 155 },
  },

  // 2. Casa da Dona Maria (dest_vovo) - Quarteirão Nordeste
  {
    id: 'bld_dona_maria',
    name: 'Casa de Dona Maria',
    type: 'house_dona_maria',
    destinationId: 'dest_vovo',
    x: 960,
    y: 70,
    width: 290,
    height: 210,
    doorX: 1105,
    doorY: 285,
    wallColor: '#f59e0b', // Amarelo ocre colonial
    roofColor: '#c2410c', // Terracota telhas
    trimColor: '#0284c7', // Azul cerúleo
    collision: { x: 960, y: 95, w: 290, h: 155 },
  },

  // 3. Sobrado de Ana (dest_cliente) - Quarteirão Sudoeste
  {
    id: 'bld_ana',
    name: 'Residência de Ana',
    type: 'house_ana',
    destinationId: 'dest_cliente',
    x: 80,
    y: 650,
    width: 310,
    height: 220,
    doorX: 235,
    doorY: 625,
    wallColor: '#ea580c', // Terracota vivo colonial
    roofColor: '#78350f', // Telhado clássico
    trimColor: '#ffffff', // Branco
    collision: { x: 80, y: 685, w: 310, h: 175 },
  },

  // 4. Casa de Seu João (dest_amigo) - Quarteirão Sudeste
  {
    id: 'bld_seu_joao',
    name: 'Casa de Seu João',
    type: 'house_seu_joao',
    destinationId: 'dest_amigo',
    x: 960,
    y: 650,
    width: 290,
    height: 220,
    doorX: 1105,
    doorY: 625,
    wallColor: '#0284c7', // Azul colonial de Olinda
    roofColor: '#b45309', // Telhas de barro
    trimColor: '#fef08a', // Amarelo claro
    collision: { x: 960, y: 685, w: 290, h: 175 },
  },

  // 5. Coreto Colonial da Praça do Carmo (Centro)
  {
    id: 'bld_coreto',
    name: 'Coreto da Praça do Carmo',
    type: 'coreto_carmo',
    destinationId: 'dest_escola',
    x: 615,
    y: 390,
    width: 130,
    height: 125,
    doorX: 680,
    doorY: 535,
    wallColor: '#ffffff',
    roofColor: '#047857', // Cúpula verde esmeralda
    trimColor: '#d97706',
    collision: { x: 625, y: 415, w: 110, h: 85 },
  },
];

// Elementos Naturais e Mobiliário Urbano espaçados
export const MAP_DECORATIONS: MapDecor[] = [
  // Coqueiros Tropicais de Olinda
  { id: 'palm_1', type: 'palm', x: 440, y: 150, scale: 1.05, collision: { x: 434, y: 144, w: 12, h: 12 } },
  { id: 'palm_2', type: 'palm', x: 910, y: 150, scale: 1.05, collision: { x: 904, y: 144, w: 12, h: 12 } },
  { id: 'palm_3', type: 'palm', x: 440, y: 780, scale: 1.05, collision: { x: 434, y: 774, w: 12, h: 12 } },
  { id: 'palm_4', type: 'palm', x: 910, y: 780, scale: 1.05, collision: { x: 904, y: 774, w: 12, h: 12 } },
  { id: 'palm_coast_1', type: 'palm', x: 1270, y: 80, scale: 1.0, collision: { x: 1264, y: 74, w: 12, h: 12 } },
  { id: 'palm_coast_2', type: 'palm', x: 1320, y: 180, scale: 0.95, collision: { x: 1314, y: 174, w: 12, h: 12 } },

  // Ipês Floridos (Amarelos e Rosas na Praça do Carmo)
  { id: 'ipe_1', type: 'ipe_yellow', x: 530, y: 280, scale: 1.0, collision: { x: 524, y: 274, w: 12, h: 12 } },
  { id: 'ipe_2', type: 'ipe_pink', x: 830, y: 280, scale: 1.0, collision: { x: 824, y: 274, w: 12, h: 12 } },
  { id: 'ipe_3', type: 'ipe_yellow', x: 680, y: 720, scale: 1.05, collision: { x: 674, y: 714, w: 12, h: 12 } },

  // Postes de Iluminação Colonial com Lampiões a Gás
  { id: 'lamp_1', type: 'streetlamp', x: 405, y: 310, collision: { x: 401, y: 306, w: 8, h: 8 } },
  { id: 'lamp_2', type: 'streetlamp', x: 955, y: 310, collision: { x: 951, y: 306, w: 8, h: 8 } },
  { id: 'lamp_3', type: 'streetlamp', x: 405, y: 630, collision: { x: 401, y: 626, w: 8, h: 8 } },
  { id: 'lamp_4', type: 'streetlamp', x: 955, y: 630, collision: { x: 951, y: 626, w: 8, h: 8 } },

  // Bancos de Madeira e Ferro da Praça
  { id: 'bench_1', type: 'bench', x: 580, y: 550, collision: { x: 565, y: 544, w: 30, h: 14 } },
  { id: 'bench_2', type: 'bench', x: 770, y: 550, collision: { x: 755, y: 544, w: 30, h: 14 } },

  // Canteiros e Floreiras Tropicais
  { id: 'flower_1', type: 'flowerbed', x: 490, y: 390, scale: 1.0 },
  { id: 'flower_2', type: 'flowerbed', x: 870, y: 390, scale: 1.0 },
  { id: 'flower_3', type: 'flowerbed', x: 490, y: 580, scale: 1.0 },
  { id: 'flower_4', type: 'flowerbed', x: 870, y: 580, scale: 1.0 },

  // Vasos de plantas ornamentais decorativos
  { id: 'pot_shop_1', type: 'plant_pot', x: 105, y: 285 },
  { id: 'pot_shop_2', type: 'plant_pot', x: 375, y: 285 },
];

// Obstáculos do mapa para o sistema de colisão (paredes e limites externos)
export const MAP_STATIC_OBSTACLES: CollisionBox[] = [
  // Paredes dos edifícios
  ...MAP_BUILDINGS.map((b) => b.collision),

  // Troncos de árvores e postes
  ...MAP_DECORATIONS.filter((d) => d.collision).map((d) => d.collision!),

  // Limites do mundo (bordas do mapa ampliado)
  { x: 0, y: 0, w: MAP_WIDTH, h: 25 },               // Borda Superior
  { x: 0, y: MAP_HEIGHT - 25, w: MAP_WIDTH, h: 25 }, // Borda Inferior
  { x: 0, y: 0, w: 25, h: MAP_HEIGHT },              // Borda Esquerda
  { x: MAP_WIDTH - 25, y: 0, w: 25, h: MAP_HEIGHT }, // Borda Direita
];

// Função auxiliar para mapear qualquer ID de destino aos dados do mapa
export function getMapDestinationInfo(destId?: string): {
  id: string;
  name: string;
  doorX: number;
  doorY: number;
  buildingId: string;
} {
  // Caso 1: Destino exato associado a um edifício
  const matched = MAP_BUILDINGS.find((b) => b.destinationId === destId);
  if (matched) {
    return {
      id: matched.destinationId || matched.id,
      name: matched.name,
      doorX: matched.doorX,
      doorY: matched.doorY,
      buildingId: matched.id,
    };
  }

  // Caso 2: Mapeamento de fallback para destinos extras
  if (destId === 'dest_tio_rodolfo') {
    return {
      id: 'dest_tio_rodolfo',
      name: 'Residência de Carlos',
      doorX: 235,
      doorY: 625,
      buildingId: 'bld_ana',
    };
  }

  if (destId === 'dest_alto_se') {
    return {
      id: 'dest_alto_se',
      name: 'Mirante do Carmo (Dona Maria)',
      doorX: 1105,
      doorY: 285,
      buildingId: 'bld_dona_maria',
    };
  }

  // Fallback padrão: Casa de Dona Maria
  return {
    id: 'dest_vovo',
    name: 'Casa de Dona Maria',
    doorX: 1105,
    doorY: 285,
    buildingId: 'bld_dona_maria',
  };
}
