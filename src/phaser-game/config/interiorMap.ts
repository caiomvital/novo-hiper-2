import { Rect } from '../logic/worldGeometry';

/**
 * Interior da Novo Hiper (NovoHiperInteriorScene). Sala única, pequena e aconchegante — Bernardo atravessa em
 * poucos segundos. Tudo aqui é dado puro (sem Phaser), no mesmo espírito de worldMap.ts/platformConfig.ts.
 *
 * Planta baixa (640 x 480, parede de 24px, porta de 96px ao sul):
 *
 *   prateleira A        prateleira B      ← parede norte (catálogo de plantas)
 *
 *                 [circulação livre]
 *
 *   estoque                    balcão      ← balcão não toca nenhuma parede: dá pra contornar
 *   (estoque)                 (pedidos /
 *                           instalar melhoria)
 *                                 bancada de preparo
 *                                 (pegar planta do pedido)
 *                  porta
 */
export const INTERIOR_ROOM = { width: 640, height: 480, wall: 24 } as const;

/** Vão da porta na parede sul: x de (DOOR.x - DOOR.halfWidth) a (DOOR.x + DOOR.halfWidth). */
export const INTERIOR_DOOR = { x: 320, halfWidth: 48 } as const;

/** Onde Bernardo aparece ao entrar: logo dentro da porta, voltado para o interior. */
export const INTERIOR_SPAWN = { x: 320, y: 412 } as const;

/** Zona de saída (perto da porta): entrando aqui de volta, Bernardo sai para o bairro. */
export const INTERIOR_EXIT = { x: 320, y: 442, radius: 46 } as const;
/** Depois de sair, a porta só rearma quando Bernardo se afasta além disto (evita sair-entrar em loop). */
export const INTERIOR_EXIT_REARM_DISTANCE = INTERIOR_EXIT.radius + 30;

export interface FurnitureZone {
  id: string;
  rect: Rect;
  interact: { x: number; y: number };
  interactRadius: number;
  label: string;
}

export const SHELVES: FurnitureZone[] = [
  { id: 'prateleira_a', rect: { x: 70, y: 24, w: 180, h: 50 }, interact: { x: 160, y: 112 }, interactRadius: 58, label: 'PLANTAS' },
  { id: 'prateleira_b', rect: { x: 390, y: 24, w: 180, h: 50 }, interact: { x: 480, y: 112 }, interactRadius: 58, label: 'PLANTAS' },
];

export const STOCK: FurnitureZone = {
  id: 'estoque',
  rect: { x: 24, y: 160, w: 90, h: 130 },
  interact: { x: 156, y: 225 },
  interactRadius: 58,
  label: 'ESTOQUE',
};

/** Balcão: pedidos (sempre) e, se houver melhoria comprada aguardando, instalar melhoria (prioridade). */
export const COUNTER: FurnitureZone = {
  id: 'balcao',
  rect: { x: 270, y: 230, w: 160, h: 70 },
  interact: { x: 350, y: 336 },
  interactRadius: 58,
  label: 'BALCÃO',
};

/** Bancada de preparo: onde Bernardo pega o vaso do pedido ativo (quando entregável). */
export const PREP_BENCH: FurnitureZone = {
  id: 'preparo',
  rect: { x: 440, y: 360, w: 150, h: 60 },
  interact: { x: 515, y: 324 },
  interactRadius: 58,
  label: 'PREPARO',
};

const { width, height, wall } = INTERIOR_ROOM;
const WALLS: Rect[] = [
  { x: 0, y: 0, w: width, h: wall }, // norte
  { x: 0, y: height - wall, w: INTERIOR_DOOR.x - INTERIOR_DOOR.halfWidth, h: wall }, // sul (lado oeste da porta)
  {
    x: INTERIOR_DOOR.x + INTERIOR_DOOR.halfWidth,
    y: height - wall,
    w: width - (INTERIOR_DOOR.x + INTERIOR_DOOR.halfWidth),
    h: wall,
  }, // sul (lado leste da porta)
  { x: 0, y: 0, w: wall, h: height }, // oeste
  { x: width - wall, y: 0, w: wall, h: height }, // leste
];

/** Retângulos sólidos (colisão): paredes, prateleiras, estoque, balcão e bancada. Objetos decorativos não entram aqui. */
export const INTERIOR_SOLIDS: Rect[] = [...WALLS, ...SHELVES.map((s) => s.rect), STOCK.rect, COUNTER.rect, PREP_BENCH.rect];

export { WALLS as INTERIOR_WALLS };
