import { describe, expect, it } from 'vitest';
import { generatePlatformRoute, isPlayablePlatformRoute } from '../../src/phaser-game/config/proceduralPlatform';
import { PLATFORM_ROUTES } from '../../src/phaser-game/config/platformRoutes';
import { PLATFORM, getGaps } from '../../src/phaser-game/config/platformConfig';
import { platformAdventure } from '../../src/phaser-game/config/platformAdventure';
import { isSafeCheckpoint } from '../../src/phaser-game/logic/fall';
import { jumpHeight, isGapSafelyCrossable } from '../../src/phaser-game/logic/jumpPhysics';

describe('geração procedural reproduzível e transitável', () => {
  for (const template of PLATFORM_ROUTES) {
    it(`${template.id}: 400 sementes mantêm saltos, objetivos, degraus e resgates alcançáveis`, () => {
      const signatures = new Set<string>();
      for (let seed = 0; seed < 400; seed++) {
        const route = generatePlatformRoute(template, seed * 104729);
        signatures.add(JSON.stringify(route.segments));
        expect(isPlayablePlatformRoute(route)).toBe(true);
        expect(route.id).toBe(template.id);
        expect(getGaps(route.segments)).toHaveLength(template.id === 'rua' ? 2 : 3);
        for (const gap of getGaps(route.segments)) expect(isGapSafelyCrossable(gap.width)).toBe(true);
        const layout = platformAdventure(route, route.seed);
        let previousY: number = PLATFORM.groundY;
        for (const ledge of layout.ledges) {
          expect(previousY - ledge.y).toBeLessThan(jumpHeight() - 20);
          expect(ledge.x + ledge.width).toBeLessThan(route.segments[0].width - 20);
          previousY = ledge.y;
        }
        for (const cp of layout.checkpoints) {
          expect(isSafeCheckpoint(cp.x, cp.y - 22, route.segments)).toBe(true);
          expect(Math.abs(cp.x - layout.cart.center)).toBeGreaterThan(layout.cart.range + 50);
        }
        expect(layout.cart.center - layout.cart.range - 17).toBeGreaterThan(route.segments[1].x + 40);
        expect(layout.cart.center + layout.cart.range + 17).toBeLessThan(route.segments[1].x + route.segments[1].width - 40);
        // Flor final sempre fica sobre a última ilha, não no buraco anterior.
        expect(isSafeCheckpoint(layout.flowers[2].x, PLATFORM.groundY - 22, route.segments)).toBe(true);
      }
      expect(signatures.size).toBe(400);
    });
  }
  it('mesma semente reproduz o percurso sem modificar o modelo nem consultar Math.random', () => {
    const original = JSON.stringify(PLATFORM_ROUTES);
    expect(generatePlatformRoute(PLATFORM_ROUTES[0], 0xffffffff)).toEqual(generatePlatformRoute(PLATFORM_ROUTES[0], 0xffffffff));
    expect(generatePlatformRoute(PLATFORM_ROUTES[0], 0).segments).not.toEqual(generatePlatformRoute(PLATFORM_ROUTES[0], 1).segments);
    expect(JSON.stringify(PLATFORM_ROUTES)).toBe(original);
  });
  it('validador rejeita trechos impossíveis em vez de confiar na quantidade de ilhas', () => {
    const route = generatePlatformRoute(PLATFORM_ROUTES[0], 0);
    expect(isPlayablePlatformRoute({ ...route, segments: [{ x: 0, width: 500 }, { x: 900, width: 500 }, { x: 1500, width: 900 }] })).toBe(false);
    expect(isPlayablePlatformRoute({ ...route, segments: [{ x: 0, width: 500 }, { x: 480, width: 500 }, { x: 1100, width: 1300 }] })).toBe(false);
  });
});
