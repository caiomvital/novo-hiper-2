export interface WorldReturnPoint {
  x: number;
  y: number;
}

let pendingWorldReturnPoint: WorldReturnPoint | null = null;

export function setWorldReturnPoint(point: WorldReturnPoint) {
  pendingWorldReturnPoint = point;
}

export function consumeWorldReturnPoint(): WorldReturnPoint | null {
  const point = pendingWorldReturnPoint;
  pendingWorldReturnPoint = null;
  return point;
}
