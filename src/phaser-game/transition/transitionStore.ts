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

// ───────────────────────── World ↔ Interior (interior da Novo Hiper) ─────────────────────────
// Canal independente do de cima (World ↔ Platform): as duas transições nunca acontecem ao mesmo tempo,
// mas cada uma só deve desarmar a própria zona de reentrada.

export interface StoreReturnPoint {
  x: number;
  y: number;
}

let pendingStoreReturnPoint: StoreReturnPoint | null = null;

export function setStoreReturnPoint(point: StoreReturnPoint) {
  pendingStoreReturnPoint = point;
}

export function consumeStoreReturnPoint(): StoreReturnPoint | null {
  const point = pendingStoreReturnPoint;
  pendingStoreReturnPoint = null;
  return point;
}
