import { PLATFORM_ROUTES } from './platformRoutes';
import { PLATFORM, getGaps } from './platformConfig';
import type { GeneratedPlatformRoute } from './proceduralPlatform';
import { seededRandom } from '../logic/seededRandom';

export const JUMP_PARK_WIDTH = 7200;
/** Via principal sempre transitável. Alturas e pontes são escolhas opcionais. */
export function generateJumpPark(seed: number): GeneratedPlatformRoute {
  const random = seededRandom(seed);
  const gaps = Array.from({ length: 8 }, () => 84 + Math.floor(random() * 29));
  const widths = Array.from({ length: 8 }, () => 650 + Math.floor(random() * 71));
  widths.push(JUMP_PARK_WIDTH - widths.reduce((a,b) => a+b,0) - gaps.reduce((a,b) => a+b,0));
  let x = 0;
  const segments = widths.map((width, i) => { const segment = { x, width }; x += width + (gaps[i] ?? 0); return segment; });
  return { ...PLATFORM_ROUTES[0], id: 'rua', name: 'Parque dos Saltos', description: 'Campinas, pontes altas e jardins suspensos.', segments, seed: seed >>> 0, generatorVersion: 1, levelWidth: JUMP_PARK_WIDTH, space: 'park' };
}
export function jumpParkAdventure(route: GeneratedPlatformRoute) {
  const ledges: Array<{x:number;y:number;width:number}> = [], flowers: Array<{x:number;y:number}> = [];
  for (const [i, segment] of route.segments.entries()) {
    if (i % 2 === 0 && i < route.segments.length - 1) {
      const start = segment.x + 170;
      for (let step = 0; step < 4; step++) ledges.push({ x: start + step * 116, y: PLATFORM.groundY - 62 * (Math.min(step, 2) + 1), width: 112 });
      flowers.push({ x: start + 3 * 116 + 56, y: PLATFORM.groundY - 232 });
    } else flowers.push({ x: Math.min(segment.x + segment.width / 2, route.levelWidth - 380), y: PLATFORM.groundY - 86 });
  }
  const gaps = getGaps(route.segments);
  gaps.filter((_,i) => i % 2 === 0).forEach(gap => {
    ledges.push({ x: gap.start - 80, y: PLATFORM.groundY - 62, width: gap.width + 160 });
    flowers.push({ x: (gap.start + gap.end) / 2, y: PLATFORM.groundY - 108 });
  });
  const middle = route.segments[1];
  return { ledges, flowers,
    checkpoints: [{ x: 150, y: PLATFORM.groundY }, ...gaps.map(g => ({ x: g.end + 90, y: PLATFORM.groundY }))],
    cart: { center: middle.x + middle.width / 2, range: 52, y: PLATFORM.groundY - 15, speed: 44 },
  };
}
export function jumpParkPads(route: GeneratedPlatformRoute) {
  return [2, 4, 6].map(i => ({ x: route.segments[i].x + 110, y: PLATFORM.groundY }));
}
