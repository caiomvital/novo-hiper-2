// Parâmetros da PlatformScene em um módulo puro (sem Phaser), para poderem ser testados.
export const PLATFORM = {
  levelWidth: 2400,
  levelHeight: 720,
  groundY: 620,
  playerSpeed: 200, // px/s
  jumpVelocity: -560, // px/s (negativo = para cima)
  gravityY: 1400, // px/s²
  playerWidth: 28,
  playerHeight: 44,
  goalRadius: 90,
  gapWidth: 120,
  firstSegmentWidth: 760,
  middleSegmentWidth: 720,
  returnInputDelayMs: 600,
  /** Zoom da câmera na fase de plataforma — visual "chapado" estilo SNES (Bernardo ocupa mais tela). */
  cameraZoom: 2,
} as const;

export const PLATFORM_FALL_LIMIT_Y = PLATFORM.levelHeight + 200;
export const PLATFORM_SPAWN = { x: 120, y: PLATFORM.groundY - 100 };
export const PLATFORM_GOAL = { x: PLATFORM.levelWidth - 220, y: PLATFORM.groundY - 40 };

export interface GroundSegment {
  x: number;
  width: number;
}

export interface Gap {
  start: number;
  end: number;
  width: number;
}

/** Trechos de chão da fase: chão, vala, chão, vala, chão até o fim. */
export function getGroundSegments(): GroundSegment[] {
  const { firstSegmentWidth, middleSegmentWidth, gapWidth, levelWidth } = PLATFORM;
  const secondStart = firstSegmentWidth + gapWidth;
  const thirdStart = secondStart + middleSegmentWidth + gapWidth;
  return [
    { x: 0, width: firstSegmentWidth },
    { x: secondStart, width: middleSegmentWidth },
    { x: thirdStart, width: levelWidth - thirdStart },
  ];
}

/** Buracos derivados dos segmentos (o que de fato existe no nível). */
export function getGaps(segments: GroundSegment[] = getGroundSegments()): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const start = segments[i].x + segments[i].width;
    const end = segments[i + 1].x;
    gaps.push({ start, end, width: end - start });
  }
  return gaps;
}

/** Layout (visual) da confirmação de destino: no alto da tela, para não cobrir o Bernardo. */
export const GOAL_UI = {
  titleYRatio: 0.2,
  hintOffsetY: 54,
  buttonOffsetY: 104,
  /** Se a animação de comemoração não avisar que terminou, a confirmação aparece depois disto. */
  revealFallbackMs: 900,
} as const;
