import type { Facing } from '../config/topdownSpriteConfig';

export type TopdownAnimName = `idle-${Facing}` | `walk-${Facing}`;

/**
 * Direção para onde Bernardo olha. Um eixo só → aquela direção; diagonal → horizontal (esquerda/direita);
 * parado → mantém a última direção.
 */
export function facingFromMovement(previous: Facing, dx: number, dy: number): Facing {
  if (dx < 0) return 'left';
  if (dx > 0) return 'right';
  if (dy < 0) return 'up';
  if (dy > 0) return 'down';
  return previous;
}

/** Caminhada enquanto há movimento; senão idle da última direção. */
export function selectTopdownAnimation(facing: Facing, moving: boolean): TopdownAnimName {
  return `${moving ? 'walk' : 'idle'}-${facing}` as TopdownAnimName;
}
