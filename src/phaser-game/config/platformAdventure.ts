import { PLATFORM, PLATFORM_GOAL, getGaps } from './platformConfig';
import type { PlatformRoute } from './platformRoutes';
import { seededRandom } from '../logic/seededRandom';

export const PLATFORM_ZOOM_LEVELS = [0.75, 1, 1.5] as const;
export const DEFAULT_PLATFORM_ZOOM = PLATFORM.cameraZoom;

/** Conteúdo opcional: o chão original e os saltos obrigatórios continuam transitáveis. */
export function platformAdventure(route: PlatformRoute, seed = 0) {
  const random = seededRandom(seed ^ 0x76412a);
  const first = route.segments[0], middle = route.segments[1];
  const start = Math.min(220 + Math.floor(random() * 100), first.width - 250);
  const rise = 54 + Math.floor(random() * 17);
  const last = route.segments.at(-1)!;
  return {
    ledges: [
      { x: start, y: PLATFORM.groundY - rise, width: 104 },
      { x: start + 110, y: PLATFORM.groundY - rise * 2, width: 104 },
    ],
    flowers: [
      { x: start + 160, y: PLATFORM.groundY - rise * 2 - 46 },
      { x: middle.x + middle.width / 2, y: PLATFORM.groundY - 86 },
      { x: Math.min(last.x + last.width * .45, PLATFORM_GOAL.x - 110), y: PLATFORM.groundY - 80 },
    ],
    checkpoints: [{ x: 150, y: PLATFORM.groundY }, ...getGaps(route.segments).map(gap => ({ x: gap.end + 56, y: PLATFORM.groundY }))],
    cart: { center: middle.x + middle.width * (.45 + random() * .1), range: 52, y: PLATFORM.groundY - 15, speed: 44 },
  };
}

export function cartPosition(center: number, range: number, speed: number, elapsed: number) {
  const phase = (elapsed / 1000 * speed) % (range * 4);
  return center + (phase <= range * 2 ? phase - range : range * 3 - phase);
}
