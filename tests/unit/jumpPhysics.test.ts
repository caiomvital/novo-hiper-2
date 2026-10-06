import { describe, expect, it } from 'vitest';
import { PLATFORM, getGaps, getGroundSegments } from '../../src/phaser-game/config/platformConfig';
import {
  DEFAULT_JUMP_PARAMS,
  SAFE_RANGE_FACTOR,
  isGapSafelyCrossable,
  jumpAirTime,
  jumpHeight,
  jumpRange,
  requiredRangeForGap,
  simulateJumpRange,
} from '../../src/phaser-game/logic/jumpPhysics';

describe('física do salto (PlatformScene)', () => {
  it('a simulação quadro a quadro concorda com a fórmula analítica (±5%)', () => {
    const analytic = jumpRange();
    const simulated = simulateJumpRange();
    expect(Math.abs(simulated - analytic) / analytic).toBeLessThan(0.05);
  });

  it('o salto é físico: fica mais de 0,4s no ar e sobe mais que 1,5x a altura do corpo', () => {
    expect(jumpAirTime()).toBeGreaterThan(0.4);
    expect(jumpHeight()).toBeGreaterThan(PLATFORM.playerHeight * 1.5);
  });

  it('TODO buraco existente na fase é atravessável com margem de segurança', () => {
    const gaps = getGaps();
    expect(gaps.length).toBeGreaterThan(0);
    const range = Math.min(jumpRange(), simulateJumpRange());
    for (const gap of gaps) {
      expect(range, `buraco de ${gap.width}px vs alcance ${range.toFixed(0)}px`).toBeGreaterThanOrEqual(
        requiredRangeForGap(gap.width)
      );
      expect(isGapSafelyCrossable(gap.width)).toBe(true);
    }
  });

  it('a margem exigida é de pelo menos 25% (criança não precisa acertar no pixel)', () => {
    const gaps = getGaps();
    const range = Math.min(jumpRange(), simulateJumpRange());
    for (const gap of gaps) {
      expect(range / gap.width).toBeGreaterThanOrEqual(SAFE_RANGE_FACTOR);
    }
  });

  it('o teste é sensível: um buraco de 200px (o bug original) seria reprovado', () => {
    expect(isGapSafelyCrossable(200)).toBe(false);
    expect(isGapSafelyCrossable(160)).toBe(false);
    expect(isGapSafelyCrossable(PLATFORM.gapWidth)).toBe(true);
  });

  it('o teste é sensível: um salto mais fraco/lento reprova o buraco atual', () => {
    const weak = { ...DEFAULT_JUMP_PARAMS, jumpVelocity: -400 };
    expect(isGapSafelyCrossable(PLATFORM.gapWidth, weak)).toBe(false);
  });

  it('os trechos de chão são largos o bastante para pousar e não se sobrepõem', () => {
    const segments = getGroundSegments();
    for (let i = 0; i < segments.length; i++) {
      expect(segments[i].width).toBeGreaterThanOrEqual(200);
      if (i > 0) expect(segments[i].x).toBeGreaterThan(segments[i - 1].x + segments[i - 1].width);
    }
    const last = segments[segments.length - 1];
    expect(last.x + last.width).toBe(PLATFORM.levelWidth);
  });
});
