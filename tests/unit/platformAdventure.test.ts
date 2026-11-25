import { describe, expect, it } from 'vitest';
import { PLATFORM_ROUTES } from '../../src/phaser-game/config/platformRoutes';
import { PLATFORM } from '../../src/phaser-game/config/platformConfig';
import { cartPosition, platformAdventure, PLATFORM_ZOOM_LEVELS } from '../../src/phaser-game/config/platformAdventure';
import { jumpHeight, jumpRange } from '../../src/phaser-game/logic/jumpPhysics';
import { isSafeCheckpoint } from '../../src/phaser-game/logic/fall';

describe('plataforma com caminho opcional e obstáculo', () => {
  for (const route of PLATFORM_ROUTES) it(`${route.id}: degraus alcançáveis e resgates fora do carrinho`, () => {
    const layout = platformAdventure(route);
    let previousY: number = PLATFORM.groundY;
    for (const ledge of layout.ledges) {
      expect(previousY - ledge.y).toBeLessThan(jumpHeight() - 20);
      expect(ledge.x + ledge.width).toBeLessThan(route.segments[0].width);
      previousY = ledge.y;
    }
    expect(layout.ledges[1].x - (layout.ledges[0].x + layout.ledges[0].width)).toBeLessThan(jumpRange() / 2);
    expect(layout.flowers).toHaveLength(3);
    for (const cp of layout.checkpoints) {
      expect(isSafeCheckpoint(cp.x, cp.y - PLATFORM.playerHeight / 2, route.segments)).toBe(true);
      expect(Math.abs(cp.x - layout.cart.center)).toBeGreaterThan(layout.cart.range + 50);
    }
    const middle = route.segments[1];
    expect(layout.cart.center - layout.cart.range - 17).toBeGreaterThan(middle.x + 40);
    expect(layout.cart.center + layout.cart.range + 17).toBeLessThan(middle.x + middle.width - 40);
  });
  it('carrinho vai e volta continuamente e zoom sempre permanece positivo', () => {
    let previous = cartPosition(500, 52, 44, 0);
    for (let time = 16; time < 20000; time += 16) {
      const x = cartPosition(500, 52, 44, time);
      expect(x).toBeGreaterThanOrEqual(448); expect(x).toBeLessThanOrEqual(552);
      expect(Math.abs(x - previous)).toBeLessThan(1); previous = x;
    }
    expect(PLATFORM_ZOOM_LEVELS).toEqual([0.75, 1, 1.5]);
  });
});
