import { JUMP_FRAMES } from '../config/spriteConfig';

export type Facing = 'left' | 'right';
export type AnimationName = 'idle-right' | 'idle-left' | 'walk-right' | 'walk-left' | 'jump' | 'thumbs-up';

export interface AnimationInput {
  grounded: boolean;
  /** Intenção horizontal: -1 esquerda, 0 parado, 1 direita. */
  moveX: -1 | 0 | 1;
  /** Última direção em que Bernardo olhou. */
  facing: Facing;
  goalReached: boolean;
}

export function nextFacing(previous: Facing, moveX: -1 | 0 | 1): Facing {
  if (moveX < 0) return 'left';
  if (moveX > 0) return 'right';
  return previous;
}

/** Escolhe qual animação mostrar. Chegar ao destino sempre vence; no ar, o pulo vence o andar. */
export function selectAnimation({ grounded, moveX, facing, goalReached }: AnimationInput): AnimationName {
  if (goalReached) return 'thumbs-up';
  if (!grounded) return 'jump';
  if (moveX < 0) return 'walk-left';
  if (moveX > 0) return 'walk-right';
  return facing === 'left' ? 'idle-left' : 'idle-right';
}

/** Frame do pulo conforme a velocidade vertical (px/s, negativo = subindo). */
export function selectJumpFrame(vy: number): number {
  if (vy < -250) return JUMP_FRAMES.rising;
  if (vy < -40) return JUMP_FRAMES.risingSlow;
  if (vy <= 120) return JUMP_FRAMES.apex;
  return JUMP_FRAMES.falling;
}
