import { describe, expect, it } from 'vitest';
import { PLATFORM_ROUTES, selectPlatformRoute } from '../../src/phaser-game/config/platformRoutes';
import { PLATFORM, PLATFORM_GOAL, PLATFORM_SPAWN, getGaps } from '../../src/phaser-game/config/platformConfig';
import { isGapSafelyCrossable } from '../../src/phaser-game/logic/jumpPhysics';
import { isSafeCheckpoint } from '../../src/phaser-game/logic/fall';

describe('percursos conforme a clientela', () => {
  it('mantém a primeira entrega e o treino acessíveis; marcos liberam jardim e praça', () => {
    for (const stage of [0, 1, 2, 3]) expect(selectPlatformRoute(stage, false).id).toBe('rua');
    expect(selectPlatformRoute(0, true).id).toBe('rua');
    expect(selectPlatformRoute(1, true).id).toBe('rua');
    expect(selectPlatformRoute(2, true).id).toBe('jardim');
    expect(selectPlatformRoute(3, true).id).toBe('praca');
    expect(selectPlatformRoute(4, true).id).toBe('praca');
  });
  for (const route of PLATFORM_ROUTES) {
    it(`${route.id}: todos os saltos são seguros e há chão para nascer, pousar e chegar`, () => {
      const y = PLATFORM.groundY - PLATFORM.playerHeight / 2;
      expect(route.segments[0].x).toBe(0);
      const last = route.segments.at(-1)!;
      expect(last.x + last.width).toBe(PLATFORM.levelWidth);
      expect(isSafeCheckpoint(PLATFORM_SPAWN.x, y, route.segments)).toBe(true);
      expect(isSafeCheckpoint(PLATFORM_GOAL.x, y, route.segments)).toBe(true);
      for (const segment of route.segments) expect(segment.width).toBeGreaterThanOrEqual(200);
      for (const gap of getGaps(route.segments)) {
        expect(gap.width).toBeGreaterThan(0);
        expect(isGapSafelyCrossable(gap.width)).toBe(true);
        expect(isSafeCheckpoint((gap.start + gap.end) / 2, y, route.segments)).toBe(false);
        expect(isSafeCheckpoint(gap.start - 10, y, route.segments)).toBe(false);
        expect(isSafeCheckpoint(gap.end + 30, y, route.segments)).toBe(true);
        expect(isSafeCheckpoint(gap.end + 30, y + 50, route.segments)).toBe(false);
      }
    });
  }
});
