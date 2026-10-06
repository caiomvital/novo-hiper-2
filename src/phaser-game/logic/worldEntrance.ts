import { ENTRANCE_ZONE, WORLD } from '../config/worldConfig';

export interface Point {
  x: number;
  y: number;
}

/** Distância do centro da entrada em que Bernardo reaparece ao voltar da plataforma. */
export const RETURN_DISTANCE = ENTRANCE_ZONE.radius + 70;
/** Depois de voltar, a entrada só rearma quando Bernardo se afasta além disto. */
export const REARM_DISTANCE = ENTRANCE_ZONE.radius + 30;

const WORLD_EDGE_MARGIN = 40;

export function distanceToEntrance(p: Point): number {
  return Math.hypot(p.x - ENTRANCE_ZONE.x, p.y - ENTRANCE_ZONE.y);
}

export function isInsideEntrance(p: Point): boolean {
  return distanceToEntrance(p) < ENTRANCE_ZONE.radius;
}

/** Ponto de retorno no lado de onde Bernardo veio, fora da zona de entrada. */
export function computeReturnPoint(enteredAt: Point): Point {
  let dx = enteredAt.x - ENTRANCE_ZONE.x;
  let dy = enteredAt.y - ENTRANCE_ZONE.y;
  if (Math.hypot(dx, dy) < 1) {
    dx = 0;
    dy = 1;
  }
  const len = Math.hypot(dx, dy);
  const clamp = (v: number, max: number) => Math.min(Math.max(v, WORLD_EDGE_MARGIN), max - WORLD_EDGE_MARGIN);
  return {
    x: clamp(ENTRANCE_ZONE.x + (dx / len) * RETURN_DISTANCE, WORLD.width),
    y: clamp(ENTRANCE_ZONE.y + (dy / len) * RETURN_DISTANCE, WORLD.height),
  };
}
