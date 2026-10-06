import { CUSTOMER_SPOT, ENTRANCE_ZONE } from '../../src/phaser-game/config/worldConfig';
import { ROADS, WORLD_MAP } from '../../src/phaser-game/config/worldMap';

/**
 * Trajetos conhecidos do bairro para os testes (waypoints sobre os eixos das ruas, sem pathfinding):
 * da calçada da Novo Hiper → avenida H2 → V3 → ... até o destino.
 */
const road = (id: string) => ROADS.find((r) => r.id === id)!.center;
const AVENIDA_Y = road('h2');
const V3_X = road('v3');
const H1_Y = road('h1');
const H3_Y = road('h3');

export const ROUTE_TO_CUSTOMER = [
  { x: WORLD_MAP.spawn.x, y: AVENIDA_Y },
  { x: V3_X, y: AVENIDA_Y },
  { x: V3_X, y: H3_Y },
  { x: CUSTOMER_SPOT.x, y: H3_Y },
  { x: CUSTOMER_SPOT.x, y: CUSTOMER_SPOT.y + 20 },
];

/** Até o lote da entrada de teste (entra pela face sul, que é aberta) e até o centro da zona. */
export const ROUTE_TO_ENTRANCE = [
  { x: WORLD_MAP.spawn.x, y: AVENIDA_Y },
  { x: V3_X, y: AVENIDA_Y },
  { x: V3_X, y: H1_Y },
  { x: ENTRANCE_ZONE.x, y: H1_Y },
  { x: ENTRANCE_ZONE.x, y: ENTRANCE_ZONE.y },
];

/**
 * Dentro do lote, ao norte da zona de entrada (para entrar nela "por cima"). Contorna a zona pela direita para não
 * disparar a plataforma no caminho: sobe pelo lado (x+140) e só então volta ao eixo da zona, acima dela.
 */
export const ROUTE_TO_ENTRANCE_NORTH_SIDE = [
  ...ROUTE_TO_ENTRANCE.slice(0, 3),
  { x: ENTRANCE_ZONE.x + 140, y: H1_Y },
  { x: ENTRANCE_ZONE.x + 140, y: ENTRANCE_ZONE.y - ENTRANCE_ZONE.radius - 30 },
  { x: ENTRANCE_ZONE.x, y: ENTRANCE_ZONE.y - ENTRANCE_ZONE.radius - 30 },
];
