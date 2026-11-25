import type { Facing } from '../config/topdownSpriteConfig';
import { facingFromMovement } from './topdownAnimation';

export const NEIGHBOR_ROUTES = [
  { id: 'cust_ana', points: [{ x: 820, y: 1100 }, { x: 944, y: 1100 }], wait: 1100 },
  { id: 'cust_carlos', points: [{ x: 1124, y: 1100 }, { x: 1240, y: 1100 }], wait: 1600 },
  { id: 'cust_bia', points: [{ x: 782, y: 850 }, { x: 782, y: 990 }], wait: 1300 },
] as const;
export type WalkPoint = { x: number; y: number };
export interface NeighborWalkState extends WalkPoint {
  target: number; facing: Facing; moving: boolean; attentive: boolean; wait: number; stride: number;
}
export function createNeighborWalk(point: WalkPoint): NeighborWalkState {
  return { ...point, target: 1, facing: 'down', moving: false, attentive: false, wait: 0, stride: 0 };
}
/** Rotas de ida e volta: passo limitado, espera nas pontas e histerese na aproximação. */
export function updateNeighborWalk(s: NeighborWalkState, points: readonly WalkPoint[], player: WalkPoint, delta: number, paused: boolean, endpointWait: number) {
  s.moving = false;
  if (paused) return;
  const px = player.x - s.x, py = player.y - s.y;
  const distance = Math.hypot(px, py);
  s.attentive = distance < (s.attentive ? 132 : 100);
  if (s.attentive) {
    if (distance > 1) s.facing = Math.abs(px) > Math.abs(py) ? (px < 0 ? 'left' : 'right') : (py < 0 ? 'up' : 'down');
    return;
  }
  const elapsed = Math.max(0, Math.min(delta, 80)); // retomar aba não causa saltos
  if (s.wait > 0) { s.wait = Math.max(0, s.wait - elapsed); return; }
  const target = points[s.target];
  const dx = target.x - s.x, dy = target.y - s.y;
  const remaining = Math.hypot(dx, dy);
  if (remaining < 0.01) {
    s.target = (s.target + 1) % points.length;
    s.wait = endpointWait;
    return;
  }
  const step = Math.min(remaining, 28 * elapsed / 1000);
  s.x += dx / remaining * step; s.y += dy / remaining * step;
  s.facing = facingFromMovement(s.facing, dx, dy);
  s.moving = step > 0;
  if (s.moving) s.stride += elapsed;
}
