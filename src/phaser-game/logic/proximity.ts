export interface Point2D {
  x: number;
  y: number;
}

/** O jogador está a no máximo `radius` px do alvo? (limite inclusivo) */
export function isWithinRadius(a: Point2D, b: Point2D, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}
