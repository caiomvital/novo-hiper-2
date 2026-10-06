import { WORLD } from './worldConfig';

/**
 * Bernardo top-down (spritesheet derivado por scripts/sprites/build-topdown.py).
 * Layout: 5 colunas (0 = idle, 1..4 = caminhada) x 4 linhas (0 = baixo, 1 = esquerda, 2 = direita, 3 = cima),
 * frames de 72x80 com o pé ancorado em (36, 72). Exibido a 1:1 (sem escala em tempo de execução).
 */
export const TOPDOWN_SPRITE = {
  textureKey: 'bernardo-topdown',
  path: '/assets/bernardo-sprites/topdown/bernardo-topdown.png',
  frameWidth: 72,
  frameHeight: 80,
  columns: 5,
  /** Base do pé dentro do frame (px). */
  feet: { x: 36, y: 72 },
} as const;

export type Facing = 'down' | 'left' | 'right' | 'up';
export const FACING_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };

/** Frame da folha: idle = coluna 0; caminhada = colunas 1..4. */
export const frameIndex = (facing: Facing, column: number) => FACING_ROW[facing] * TOPDOWN_SPRITE.columns + column;

export const TOPDOWN_WALK_FPS = 8;

/**
 * Collider: continua o corpo 32x44 (mundo) CENTRADO na posição do jogador — o mesmo comportamento validado antes
 * (entrada da plataforma, raio do cliente e limites do mundo usam o centro). O sprite é maior que o body.
 */
export const TOPDOWN_BODY = { width: 32, height: 44 } as const;

/** Origin: a posição (x, y) do jogador é o centro do body; a base do pé do desenho fica na base do body. */
export const TOPDOWN_ORIGIN = {
  x: TOPDOWN_SPRITE.feet.x / TOPDOWN_SPRITE.frameWidth,
  y: (TOPDOWN_SPRITE.feet.y - TOPDOWN_BODY.height / 2) / TOPDOWN_SPRITE.frameHeight,
};

/** Offset do body dentro do frame para o centro do body coincidir com a posição do sprite. */
export const TOPDOWN_BODY_OFFSET = {
  x: TOPDOWN_ORIGIN.x * TOPDOWN_SPRITE.frameWidth - TOPDOWN_BODY.width / 2,
  y: TOPDOWN_ORIGIN.y * TOPDOWN_SPRITE.frameHeight - TOPDOWN_BODY.height / 2,
};

/** Sombra simples desenhada pelo Phaser sob os pés (a sombra embutida do desenho original foi removida). */
export const TOPDOWN_SHADOW = { width: 34, height: 11, alpha: 0.28 } as const;

export const PLAYER_SPEED = WORLD.playerSpeed;
