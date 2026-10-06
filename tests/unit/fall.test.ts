import { describe, expect, it } from 'vitest';
import {
  PLATFORM,
  PLATFORM_FALL_LIMIT_Y,
  PLATFORM_SPAWN,
  getGaps,
  getGroundSegments,
} from '../../src/phaser-game/config/platformConfig';
import { hasFallenOffLevel } from '../../src/phaser-game/logic/fall';

describe('queda na PlatformScene', () => {
  it('o limite de queda fica abaixo do chão e do fundo da fase', () => {
    expect(PLATFORM_FALL_LIMIT_Y).toBeGreaterThan(PLATFORM.groundY);
    expect(PLATFORM_FALL_LIMIT_Y).toBeGreaterThan(PLATFORM.levelHeight);
  });

  it('só dispara abaixo do limite', () => {
    expect(hasFallenOffLevel(PLATFORM.groundY)).toBe(false);
    expect(hasFallenOffLevel(PLATFORM_FALL_LIMIT_Y)).toBe(false);
    expect(hasFallenOffLevel(PLATFORM_FALL_LIMIT_Y + 1)).toBe(true);
  });

  it('o ponto de nascimento é sobre chão sólido (checkpoint inicial seguro)', () => {
    const over = getGroundSegments().some((s) => PLATFORM_SPAWN.x >= s.x && PLATFORM_SPAWN.x <= s.x + s.width);
    expect(over).toBe(true);
    expect(PLATFORM_SPAWN.y).toBeLessThan(PLATFORM.groundY);
  });

  it('o jogador cai de verdade dentro de um buraco (a vala não é decorativa)', () => {
    for (const gap of getGaps()) {
      expect(getGroundSegments().some((s) => gap.start + gap.width / 2 > s.x && gap.start + gap.width / 2 < s.x + s.width)).toBe(false);
    }
  });
});

import { CHECKPOINT_EDGE_MARGIN, isSafeCheckpoint } from '../../src/phaser-game/logic/fall';

describe('checkpoint de queda', () => {
  const standingY = PLATFORM.groundY - PLATFORM.playerHeight / 2;

  it('aceita ficar de pé no meio do chão', () => {
    expect(isSafeCheckpoint(300, standingY)).toBe(true);
  });

  it('rejeita encostar na parede da vala (bug: respawn caía de novo na vala)', () => {
    const gap = getGaps()[0];
    // colado na parede esquerda/direita da vala, já abaixo da linha do chão
    expect(isSafeCheckpoint(gap.start - 5, standingY + 80)).toBe(false);
    expect(isSafeCheckpoint(gap.end + 5, standingY + 80)).toBe(false);
  });

  it('rejeita estar no ar ou embaixo do chão', () => {
    expect(isSafeCheckpoint(300, standingY - 60)).toBe(false);
    expect(isSafeCheckpoint(300, standingY + 60)).toBe(false);
  });

  it('rejeita a beirada do chão e o meio do buraco', () => {
    const gap = getGaps()[0];
    expect(isSafeCheckpoint(gap.start - CHECKPOINT_EDGE_MARGIN + 4, standingY)).toBe(false);
    expect(isSafeCheckpoint(gap.start + gap.width / 2, standingY)).toBe(false);
    expect(isSafeCheckpoint(gap.start - CHECKPOINT_EDGE_MARGIN - 1, standingY)).toBe(true);
  });
});
