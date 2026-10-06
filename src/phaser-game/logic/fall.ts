import { PLATFORM, PLATFORM_FALL_LIMIT_Y, getGroundSegments } from '../config/platformConfig';

export function hasFallenOffLevel(y: number): boolean {
  return y > PLATFORM_FALL_LIMIT_Y;
}

/** Distância mínima da borda do chão para um ponto valer como checkpoint (evita reaparecer na beirada). */
export const CHECKPOINT_EDGE_MARGIN = 24;
const CHECKPOINT_GROUND_TOLERANCE = 3;

/**
 * Um ponto só é checkpoint seguro se Bernardo está DE PÉ sobre o chão (pés na linha do chão)
 * e com folga das bordas — nunca encostado na parede lateral de uma vala.
 * `y` é o centro do corpo.
 */
export function isSafeCheckpoint(x: number, y: number): boolean {
  const feetY = y + PLATFORM.playerHeight / 2;
  if (Math.abs(feetY - PLATFORM.groundY) > CHECKPOINT_GROUND_TOLERANCE) return false;
  return getGroundSegments().some(
    (seg) => x >= seg.x + CHECKPOINT_EDGE_MARGIN && x <= seg.x + seg.width - CHECKPOINT_EDGE_MARGIN
  );
}
