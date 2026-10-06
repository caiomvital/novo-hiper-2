/**
 * Infraestrutura EXCLUSIVA de teste: prova que pontos do mapa são alcançáveis a pé (BFS em grade grossa).
 * Não existe pathfinding no produto — o jogador escolhe o próprio caminho.
 */
import { WORLD_MAP, PLAYABLE_RECT } from '../../src/phaser-game/config/worldMap';
import { Rect, bodyRectAt, rectContainsPoint, rectsOverlap } from '../../src/phaser-game/logic/worldGeometry';

export const CELL = 16;

export function isBodyFree(p: { x: number; y: number }, extraSolids: Rect[] = []): boolean {
  const body = bodyRectAt(p);
  const inside =
    body.x >= PLAYABLE_RECT.x && body.y >= PLAYABLE_RECT.y && body.x + body.w <= PLAYABLE_RECT.x + PLAYABLE_RECT.w && body.y + body.h <= PLAYABLE_RECT.y + PLAYABLE_RECT.h;
  if (!inside) return false;
  return ![...WORLD_MAP.solids, ...extraSolids].some((s) => rectsOverlap(body, s));
}

/** Conjunto de células (centros) alcançáveis a partir de `start`, andando com o corpo 32x44. */
export function reachableFrom(start: { x: number; y: number }, extraSolids: Rect[] = []): (p: { x: number; y: number }) => boolean {
  const cols = Math.ceil(WORLD_MAP.width / CELL);
  const rows = Math.ceil(WORLD_MAP.height / CELL);
  const key = (cx: number, cy: number) => cy * cols + cx;
  const center = (cx: number, cy: number) => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });
  const seen = new Uint8Array(cols * rows);
  const sx = Math.floor(start.x / CELL);
  const sy = Math.floor(start.y / CELL);
  const queue: Array<[number, number]> = [[sx, sy]];
  seen[key(sx, sy)] = 1;
  while (queue.length) {
    const [cx, cy] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[key(nx, ny)]) continue;
      if (!isBodyFree(center(nx, ny), extraSolids)) continue;
      seen[key(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }
  return (p) => seen[key(Math.floor(p.x / CELL), Math.floor(p.y / CELL))] === 1;
}

export { rectContainsPoint };
