import { PLATFORM } from '../config/platformConfig';

export interface JumpParams {
  speed: number;
  jumpVelocity: number;
  gravityY: number;
}

export const DEFAULT_JUMP_PARAMS: JumpParams = {
  speed: PLATFORM.playerSpeed,
  jumpVelocity: PLATFORM.jumpVelocity,
  gravityY: PLATFORM.gravityY,
};

/**
 * Margem de segurança: o salto precisa alcançar pelo menos este fator da largura do buraco
 * E sobrar esta folga em pixels — para uma criança não precisar acertar o pixel exato.
 */
export const SAFE_RANGE_FACTOR = 1.25;
export const SAFE_RANGE_MARGIN_PX = 30;

/** Tempo no ar até voltar à altura de saída (s). */
export function jumpAirTime({ jumpVelocity, gravityY }: JumpParams = DEFAULT_JUMP_PARAMS): number {
  return (2 * Math.abs(jumpVelocity)) / gravityY;
}

/** Alcance horizontal analítico, correndo a velocidade máxima o salto inteiro. */
export function jumpRange(params: JumpParams = DEFAULT_JUMP_PARAMS): number {
  return params.speed * jumpAirTime(params);
}

export function jumpHeight({ jumpVelocity, gravityY }: JumpParams = DEFAULT_JUMP_PARAMS): number {
  return (jumpVelocity * jumpVelocity) / (2 * gravityY);
}

/**
 * Simulação quadro a quadro (integração semi-implícita, como o Arcade Physics a 60 fps).
 * Retorna o deslocamento horizontal até voltar à altura de saída.
 */
export function simulateJumpRange(params: JumpParams = DEFAULT_JUMP_PARAMS, fps = 60): number {
  const dt = 1 / fps;
  let vy = params.jumpVelocity;
  let y = 0;
  let x = 0;
  for (let frame = 0; frame < 10 * fps; frame++) {
    vy += params.gravityY * dt;
    y += vy * dt;
    x += params.speed * dt;
    if (y >= 0) break; // voltou ao nível do chão
  }
  return x;
}

export function requiredRangeForGap(gapWidth: number): number {
  return Math.max(gapWidth * SAFE_RANGE_FACTOR, gapWidth + SAFE_RANGE_MARGIN_PX);
}

export function isGapSafelyCrossable(gapWidth: number, params: JumpParams = DEFAULT_JUMP_PARAMS): boolean {
  // Usa o menor entre analítico e simulado (conservador); ignora a largura do corpo, que só ajuda.
  const range = Math.min(jumpRange(params), simulateJumpRange(params));
  return range >= requiredRangeForGap(gapWidth);
}
