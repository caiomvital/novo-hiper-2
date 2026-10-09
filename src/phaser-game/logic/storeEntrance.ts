import { WORLD_MAP } from '../config/worldMap';

/** Porta da Novo Hiper no bairro (mesma zona que antes abria "instalar melhoria"; agora leva ao interior). */
export const STORE_DOOR = WORLD_MAP.shop.interact;
/**
 * Raio PRÓPRIO do gatilho de entrada — deliberadamente menor que `shop.interactRadius` (64, só um fato do
 * mapa/instalação antiga). A porta fica bem perto da avenida principal (spawn a só 74px do centro): um raio
 * tão largo quanto 64 cobre o suficiente da rua para Bernardo entrar sozinho só de passar por perto, sem
 * intenção, ao andar/virar no cruzamento. Um raio pequeno exige se aproximar de fato da porta.
 */
export const STORE_RADIUS = 36;
/** Depois de sair do interior, a porta só rearma quando Bernardo se afasta além disto. */
export const STORE_REARM_DISTANCE = STORE_RADIUS + 40;

export interface Point {
  x: number;
  y: number;
}

export function distanceToStoreDoor(p: Point): number {
  return Math.hypot(p.x - STORE_DOOR.x, p.y - STORE_DOOR.y);
}

export function isNearStoreDoor(p: Point): boolean {
  return distanceToStoreDoor(p) <= STORE_RADIUS;
}

/**
 * Ponto onde Bernardo reaparece ao sair do interior: a calçada em frente à porta (o spawn padrão do bairro,
 * já validado — fora do retângulo sólido da loja e fora do raio de interação, então não reabre o interior sozinho).
 */
export const STORE_RETURN_POINT: Point = WORLD_MAP.spawn;
