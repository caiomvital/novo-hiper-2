import { PLATFORM, PLATFORM_GOAL, PLATFORM_SPAWN, getGaps } from './platformConfig';
import type { PlatformRoute } from './platformRoutes';
import { seededRandom } from '../logic/seededRandom';
import { isGapSafelyCrossable } from '../logic/jumpPhysics';

export const PLATFORM_GENERATOR_VERSION = 1;
export interface GeneratedPlatformRoute extends PlatformRoute { seed: number; generatorVersion: number; levelWidth: number; space: 'delivery' | 'park' }

/** Validação independente dos sorteios: só aceita percursos compatíveis com a física real. */
export function isPlayablePlatformRoute(route: PlatformRoute) {
  if (route.segments.length < 3 || route.segments[0].x !== 0) return false;
  const last = route.segments.at(-1)!;
  if (last.x + last.width !== PLATFORM.levelWidth) return false;
  if (route.segments.some(s => !Number.isFinite(s.x) || !Number.isFinite(s.width) || s.width < 320)) return false;
  if (getGaps(route.segments).some(gap => gap.width <= 0 || !isGapSafelyCrossable(gap.width))) return false;
  // Área inicial para aprender/pular; chegada nunca fica numa borda ou numa vala.
  return route.segments[0].width >= PLATFORM_SPAWN.x + 330
    && last.x <= PLATFORM_GOAL.x - 120;
}

/** Gera só uma vez ao entrar. Quedas, zoom e rotação reutilizam o mesmo objeto. */
export function generatePlatformRoute(template: PlatformRoute, seed: number): GeneratedPlatformRoute {
  const random = seededRandom(seed);
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const gapCount = template.id === 'rua' ? 2 : 3;
  const gaps = Array.from({ length: gapCount }, () => integer(84, template.id === 'rua' ? 112 : 120));
  const widths = [integer(template.id === 'rua' ? 640 : 520, template.id === 'rua' ? 820 : 650)];
  const available = PLATFORM.levelWidth - gaps.reduce((a, b) => a + b, 0) - widths[0];
  // Reserva pelo menos 360 px para cada ilha seguinte e distribui o excedente.
  let surplus = available - gapCount * 360;
  for (let i = 0; i < gapCount - 1; i++) {
    const share = integer(0, Math.min(180, surplus));
    widths.push(360 + share); surplus -= share;
  }
  widths.push(360 + surplus);
  let x = 0;
  const segments = widths.map((width, i) => {
    const segment = { x, width }; x += width + (gaps[i] ?? 0); return segment;
  });
  const generated = { ...template, segments, seed: seed >>> 0, generatorVersion: PLATFORM_GENERATOR_VERSION, levelWidth: PLATFORM.levelWidth, space: 'delivery' as const };
  // Fallback curado caso os parâmetros da física sejam alterados no futuro.
  return isPlayablePlatformRoute(generated) ? generated : { ...generated, segments: template.segments.map(s => ({ ...s })) };
}
