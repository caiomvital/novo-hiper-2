import { describe, expect, it } from 'vitest';
import { createNeighborWalk, NEIGHBOR_ROUTES, updateNeighborWalk } from '../../src/phaser-game/logic/neighborWalk';
import { WORLD_MAP, PLAYABLE_RECT } from '../../src/phaser-game/config/worldMap';
import { bodyRectAt, rectContainsPoint, rectsOverlap } from '../../src/phaser-game/logic/worldGeometry';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';
const far = { x: 2500, y: 2000 };

describe('passeios dos moradores', () => {
  it('todas as rotas deixam corpos, calçadas, portas e entregas livres', () => {
    for (const route of NEIGHBOR_ROUTES) {
      const [a, b] = route.points;
      for (let t = 0; t <= 1; t += .01) {
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        expect(rectContainsPoint(PLAYABLE_RECT, p)).toBe(true);
        expect(WORLD_MAP.solids.some(r => rectsOverlap(r, bodyRectAt(p)))).toBe(false);
        const feet = { x: p.x, y: p.y + 22 };
        expect(WORLD_MAP.roads.some(r => r.orientation === 'h'
          ? feet.x >= r.from && feet.x <= r.to && Math.abs(feet.y - r.center) >= r.width / 2 && Math.abs(feet.y - r.center) <= r.width / 2 + WORLD_MAP.sidewalk
          : feet.y >= r.from && feet.y <= r.to && Math.abs(feet.x - r.center) >= r.width / 2 && Math.abs(feet.x - r.center) <= r.width / 2 + WORLD_MAP.sidewalk)).toBe(true);
        for (const door of [WORLD_MAP.shop.door, WORLD_MAP.shop.interact, WORLD_MAP.utilities.door, ...HOUSE_CATALOG.map(h => h.deliveryPoint)]) {
          expect(Math.hypot(p.x - door.x, p.y - door.y)).toBeGreaterThan(80);
        }
      }
    }
  });
  it('para, olha, usa histerese e retoma sem saltar', () => {
    const route = NEIGHBOR_ROUTES[0], s = createNeighborWalk(route.points[0]);
    updateNeighborWalk(s, route.points, far, 80, false, route.wait);
    expect(s.moving).toBe(true);
    const x = s.x;
    updateNeighborWalk(s, route.points, { x: x + 1, y: s.y - 50 }, 80, false, route.wait);
    expect(s.x).toBe(x); expect(s.moving).toBe(false); expect(s.facing).toBe('up');
    updateNeighborWalk(s, route.points, { x: x + 120, y: s.y }, 80, false, route.wait);
    expect(s.attentive).toBe(true); expect(s.x).toBe(x);
    updateNeighborWalk(s, route.points, far, 90000, false, route.wait);
    expect(s.attentive).toBe(false); expect(s.x - x).toBeLessThanOrEqual(2.25);
  });
  it('pausa nos painéis e nas pontas; nunca sai da rota após muitas voltas', () => {
    for (const route of NEIGHBOR_ROUTES) {
      const s = createNeighborWalk(route.points[0]);
      updateNeighborWalk(s, route.points, far, 80, true, route.wait);
      expect(s.x).toBe(route.points[0].x); expect(s.y).toBe(route.points[0].y);
      let waited = false, reversed = false;
      for (let i = 0; i < 1200; i++) {
        updateNeighborWalk(s, route.points, far, 80, false, route.wait);
        waited ||= s.wait > 0; reversed ||= s.target === 0;
        expect(s.x).toBeGreaterThanOrEqual(Math.min(...route.points.map(p => p.x)));
        expect(s.x).toBeLessThanOrEqual(Math.max(...route.points.map(p => p.x)));
        expect(s.y).toBeGreaterThanOrEqual(Math.min(...route.points.map(p => p.y)));
        expect(s.y).toBeLessThanOrEqual(Math.max(...route.points.map(p => p.y)));
      }
      expect(waited).toBe(true); expect(reversed).toBe(true);
    }
  });
});
