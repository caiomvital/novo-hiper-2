import { PIXELS_PER_METER } from '../../src/phaser-game/config/worldMap';

/** Ângulo (rad) e distância em metros de `from` até `to` — mesma matemática do indicador, escrita de forma independente. */
export function destinationInfoFor(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return { angle: Math.atan2(dy, dx), meters: Math.hypot(dx, dy) / PIXELS_PER_METER };
}
