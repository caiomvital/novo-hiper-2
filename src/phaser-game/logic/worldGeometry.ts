/** Geometria simples usada pelo jogo (retângulos e posições). Sem navegação/pathfinding. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rectRight = (r: Rect) => r.x + r.w;
export const rectBottom = (r: Rect) => r.y + r.h;
export const rectCenter = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < rectRight(b) && rectRight(a) > b.x && a.y < rectBottom(b) && rectBottom(a) > b.y;
}

export function rectContainsPoint(r: Rect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= rectRight(r) && p.y >= r.y && p.y <= rectBottom(r);
}

/** Retângulo encolhido de `margin` em cada lado (ex.: área jogável dentro da borda do mundo). */
export function insetRect(r: Rect, margin: number): Rect {
  return { x: r.x + margin, y: r.y + margin, w: r.w - margin * 2, h: r.h - margin * 2 };
}

/** Retângulo do corpo (collider) de Bernardo, centrado em `p`. */
export function bodyRectAt(p: { x: number; y: number }, width = 32, height = 44): Rect {
  return { x: p.x - width / 2, y: p.y - height / 2, w: width, h: height };
}
