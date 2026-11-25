import type { WorldMapData, RoadData } from '../config/worldMap';
import type { Rect } from '../logic/worldGeometry';

/** Separa as linhas do meio-fio nas interseções; nenhuma borda atravessa a rua transversal. */
export function roadRuns(road: RoadData, map: WorldMapData) {
  const cuts = map.roads.filter(other => other.orientation !== road.orientation
    && road.center >= other.from && road.center <= other.to
    && other.center > road.from && other.center < road.to)
    .map(other => ({ start: other.center - other.width / 2, end: other.center + other.width / 2 }))
    .sort((a, b) => a.start - b.start);
  const runs: Array<{ start: number; end: number }> = [];
  let start = road.from;
  for (const cut of cuts) {
    if (cut.start > start) runs.push({ start, end: cut.start });
    start = Math.max(start, cut.end);
  }
  if (start < road.to) runs.push({ start, end: road.to });
  return runs;
}

export function housePaths(map: WorldMapData): Rect[] {
  return map.houses.map(house => {
    const x = house.rect.x + house.rect.w / 2;
    const y = house.facing === 'n' ? house.rect.y : house.rect.y + house.rect.h;
    const road = map.roads.filter(r => r.orientation === 'h' && x >= r.from && x <= r.to && (house.facing === 'n' ? r.center < y : r.center > y))
      .sort((a, b) => Math.abs(a.center - y) - Math.abs(b.center - y))[0];
    if (!road) return null;
    const target = road.center + (house.facing === 'n' ? 1 : -1) * (road.width / 2 + map.sidewalk / 2);
    if (Math.abs(target - y) > 180) return null;
    return { x: x - 16, y: Math.min(y, target), w: 32, h: Math.abs(target - y) + 2 };
  }).filter((r): r is Rect => r !== null);
}

export function crossingStripes(map: WorldMapData): Rect[] {
  const stripes: Rect[] = [];
  for (const horizontal of map.roads.filter(r => r.orientation === 'h')) {
    for (const vertical of map.roads.filter(r => r.orientation === 'v' && r.id !== 'travessa')) {
      if (vertical.center <= horizontal.from || vertical.center >= horizontal.to || horizontal.center <= vertical.from || horizontal.center >= vertical.to) continue;
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
        stripes.push({ x: vertical.center + side * (vertical.width / 2 + 18 + i * 10) - 3, y: horizontal.center - horizontal.width / 2 + 9, w: 6, h: horizontal.width - 18 });
        stripes.push({ x: vertical.center - vertical.width / 2 + 9, y: horizontal.center + side * (horizontal.width / 2 + 18 + i * 10) - 3, w: vertical.width - 18, h: 6 });
      }
    }
  }
  return stripes;
}
