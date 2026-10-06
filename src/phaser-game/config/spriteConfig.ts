import { PLATFORM } from './platformConfig';

/**
 * Sprites do Bernardo (platform). A arte é 160x180 por frame, mas o collider continua sendo a caixa
 * já validada (PLATFORM.playerWidth x playerHeight, em pixels do MUNDO). Tudo aqui é visual.
 */
export const BERNARDO_SPRITE = {
  basePath: '/assets/bernardo-sprites/platform',
  frameWidth: 160,
  frameHeight: 180,
  /** Escala visual: o Bernardo de ~130px nos frames vira ~65px no cenário. */
  scale: 0.5,
  /** Linha (em px do frame) onde ficam as solas dos tênis — alinhada à base do collider. */
  feetY: 160,
} as const;

const { scale, feetY, frameWidth } = BERNARDO_SPRITE;

/** Tamanho do body em pixels da TEXTURA (o Arcade multiplica pela escala do sprite). */
export const BERNARDO_BODY_SOURCE = {
  width: PLATFORM.playerWidth / scale,
  height: PLATFORM.playerHeight / scale,
};

/** Offset do body em px da textura: centrado horizontalmente, base do body = solas dos tênis. */
export const BERNARDO_BODY_OFFSET = {
  x: frameWidth / 2 - BERNARDO_BODY_SOURCE.width / 2,
  y: feetY - BERNARDO_BODY_SOURCE.height,
};

/**
 * Origin (0..1) escolhida para que a posição (x, y) do sprite seja o CENTRO do body, exatamente como
 * no placeholder — assim checkpoints, queda, goal e testes continuam usando as mesmas coordenadas.
 */
export const BERNARDO_ORIGIN = {
  x: 0.5,
  y: (BERNARDO_BODY_OFFSET.y + BERNARDO_BODY_SOURCE.height / 2) / BERNARDO_SPRITE.frameHeight,
};

export const BERNARDO_TEXTURES = {
  idleRight: 'bernardo-idle-right',
  idleLeft: 'bernardo-idle-left',
  walkRight: 'bernardo-walk-right',
  walkLeft: 'bernardo-walk-left',
  jump: 'bernardo-jump',
  thumbsUp: 'bernardo-thumbs-up-front',
} as const;

export const BERNARDO_ANIMS = {
  idleRight: { key: 'bernardo-anim-idle-right', texture: BERNARDO_TEXTURES.idleRight, frames: [0, 1, 2, 3], frameRate: 4, repeat: -1 },
  idleLeft: { key: 'bernardo-anim-idle-left', texture: BERNARDO_TEXTURES.idleLeft, frames: [0, 1, 2, 3], frameRate: 4, repeat: -1 },
  walkRight: { key: 'bernardo-anim-walk-right', texture: BERNARDO_TEXTURES.walkRight, frames: [0, 1, 2, 3, 4, 5, 6, 7], frameRate: 12, repeat: -1 },
  walkLeft: { key: 'bernardo-anim-walk-left', texture: BERNARDO_TEXTURES.walkLeft, frames: [0, 1, 2, 3, 4, 5, 6, 7], frameRate: 12, repeat: -1 },
  // 6 frames: de frente, sorri, levanta o braço, joinha, pisca e brilho. Toca uma vez e fica no último.
  thumbsUp: { key: 'bernardo-anim-thumbs-up', texture: BERNARDO_TEXTURES.thumbsUp, frames: [0, 1, 2, 3, 4, 5], frameRate: 6, repeat: 0 },
} as const;

/** O pulo usa um frame estático escolhido pela velocidade vertical (ver logic/animation.ts). */
export const JUMP_FRAMES = { rising: 1, risingSlow: 2, apex: 3, falling: 4 } as const;
