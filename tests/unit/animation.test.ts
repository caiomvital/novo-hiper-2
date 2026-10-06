import { describe, expect, it } from 'vitest';
import { PLATFORM } from '../../src/phaser-game/config/platformConfig';
import {
  BERNARDO_BODY_OFFSET,
  BERNARDO_BODY_SOURCE,
  BERNARDO_ORIGIN,
  BERNARDO_SPRITE,
  JUMP_FRAMES,
} from '../../src/phaser-game/config/spriteConfig';
import { nextFacing, selectAnimation, selectJumpFrame } from '../../src/phaser-game/logic/animation';

describe('seleção de animação do Bernardo', () => {
  const base = { grounded: true, moveX: 0 as const, facing: 'right' as const, goalReached: false };

  it('no chão, parado, olhando para a direita → idle-right', () => {
    expect(selectAnimation(base)).toBe('idle-right');
  });
  it('no chão, parado, olhando para a esquerda → idle-left', () => {
    expect(selectAnimation({ ...base, facing: 'left' })).toBe('idle-left');
  });
  it('no chão, indo para a direita → walk-right', () => {
    expect(selectAnimation({ ...base, moveX: 1 })).toBe('walk-right');
  });
  it('no chão, indo para a esquerda → walk-left', () => {
    expect(selectAnimation({ ...base, moveX: -1, facing: 'left' })).toBe('walk-left');
  });
  it('no ar → jump, mesmo andando para os lados (andar não sobrescreve o pulo)', () => {
    expect(selectAnimation({ ...base, grounded: false })).toBe('jump');
    expect(selectAnimation({ ...base, grounded: false, moveX: 1 })).toBe('jump');
    expect(selectAnimation({ ...base, grounded: false, moveX: -1, facing: 'left' })).toBe('jump');
  });
  it('destino alcançado → thumbs-up (vence qualquer outro estado)', () => {
    expect(selectAnimation({ ...base, goalReached: true })).toBe('thumbs-up');
    expect(selectAnimation({ ...base, goalReached: true, grounded: false, moveX: 1 })).toBe('thumbs-up');
  });
  it('ao tocar o chão de novo volta a idle/walk', () => {
    expect(selectAnimation({ ...base, grounded: false })).toBe('jump');
    expect(selectAnimation({ ...base, grounded: true })).toBe('idle-right');
    expect(selectAnimation({ ...base, grounded: true, moveX: 1 })).toBe('walk-right');
  });
  it('a direção lembrada é a última em que andou', () => {
    expect(nextFacing('right', -1)).toBe('left');
    expect(nextFacing('left', 0)).toBe('left');
    expect(nextFacing('left', 1)).toBe('right');
  });
  it('frame do pulo acompanha a velocidade vertical (sobe → topo → cai)', () => {
    expect(selectJumpFrame(-560)).toBe(JUMP_FRAMES.rising);
    expect(selectJumpFrame(-100)).toBe(JUMP_FRAMES.risingSlow);
    expect(selectJumpFrame(0)).toBe(JUMP_FRAMES.apex);
    expect(selectJumpFrame(300)).toBe(JUMP_FRAMES.falling);
  });
});

describe('collider do sprite (a arte não altera a física validada)', () => {
  const { scale, frameHeight } = BERNARDO_SPRITE;

  it('o body no mundo continua sendo 28x44', () => {
    expect(BERNARDO_BODY_SOURCE.width * scale).toBe(PLATFORM.playerWidth);
    expect(BERNARDO_BODY_SOURCE.height * scale).toBe(PLATFORM.playerHeight);
  });
  it('o centro do body coincide com a posição do sprite (origin)', () => {
    const centerYInFrame = BERNARDO_BODY_OFFSET.y + BERNARDO_BODY_SOURCE.height / 2;
    expect(BERNARDO_ORIGIN.y * frameHeight).toBeCloseTo(centerYInFrame, 6);
    const centerXInFrame = BERNARDO_BODY_OFFSET.x + BERNARDO_BODY_SOURCE.width / 2;
    expect(BERNARDO_ORIGIN.x * BERNARDO_SPRITE.frameWidth).toBeCloseTo(centerXInFrame, 6);
  });
  it('a base do body é a linha dos pés do sprite e o body cabe no frame', () => {
    expect(BERNARDO_BODY_OFFSET.y + BERNARDO_BODY_SOURCE.height).toBe(BERNARDO_SPRITE.feetY);
    expect(BERNARDO_BODY_OFFSET.x).toBeGreaterThanOrEqual(0);
    expect(BERNARDO_BODY_SOURCE.height).toBeLessThan(frameHeight);
  });
  it('o body é bem menor que o frame inteiro 160x180', () => {
    expect(BERNARDO_BODY_SOURCE.width).toBeLessThan(BERNARDO_SPRITE.frameWidth / 2);
  });
});
