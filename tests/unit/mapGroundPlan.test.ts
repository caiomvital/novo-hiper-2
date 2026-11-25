import { describe, expect, it } from 'vitest';
import { crossingStripes, housePaths, roadRuns } from '../../src/phaser-game/world/mapGroundPlan';
import { WORLD_MAP, roadRect } from '../../src/phaser-game/config/worldMap';
import { rectContainsPoint } from '../../src/phaser-game/logic/worldGeometry';
import { GROUND_PATTERNS, TERRAIN_FRAMES } from '../../src/phaser-game/config/terrainArt';

describe('composição do chão do bairro', () => {
  it('recortes ficam dentro do tileset e os mosaicos usam peças existentes', () => {
    for (const [x, y, w, h] of Object.values(TERRAIN_FRAMES)) {
      expect(x).toBeGreaterThan(0); expect(y).toBeGreaterThan(0);
      expect(x + w).toBeLessThanOrEqual(2048); expect(y + h).toBeLessThanOrEqual(1117);
    }
    for (const variants of Object.values(GROUND_PATTERNS)) for (const name of variants) expect(TERRAIN_FRAMES[name]).toBeTruthy();
  });
  it('todo caminho de casa parte de uma soleira e termina na calçada, sem atravessar asfalto', () => {
    const paths = housePaths(WORLD_MAP);
    expect(paths).toHaveLength(WORLD_MAP.houses.length);
    for (const path of paths) {
      expect(path.w).toBe(32); expect(path.h).toBeLessThan(182);
      const center = { x: path.x + path.w / 2, y: path.y + path.h / 2 };
      expect(WORLD_MAP.roads.some(r => rectContainsPoint(roadRect(r), center))).toBe(false);
    }
  });
  it('meios-fios não atravessam cruzamentos e faixas ficam sobre as ruas', () => {
    for (const road of WORLD_MAP.roads) for (const run of roadRuns(road, WORLD_MAP)) {
      expect(run.start).toBeGreaterThanOrEqual(road.from); expect(run.end).toBeLessThanOrEqual(road.to);
      expect(run.end).toBeGreaterThan(run.start);
      for (const other of WORLD_MAP.roads.filter(r => r.orientation !== road.orientation && road.center >= r.from && road.center <= r.to)) {
        expect((run.start + run.end) / 2 < other.center - other.width / 2 || (run.start + run.end) / 2 > other.center + other.width / 2).toBe(true);
      }
    }
    const stripes = crossingStripes(WORLD_MAP);
    expect(stripes.length).toBeGreaterThan(100);
    for (const r of stripes) expect(WORLD_MAP.roads.some(road => rectContainsPoint(roadRect(road), { x: r.x + r.w / 2, y: r.y + r.h / 2 }))).toBe(true);
  });
});
