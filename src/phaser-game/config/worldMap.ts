import { Rect, insetRect } from '../logic/worldGeometry';

/**
 * Primeiro bairro do WorldScene (fictício, desenhado à mão). A cena LÊ tudo daqui: limites, ruas, quarteirões,
 * prédios, praça, cercas, barreiras, entrada da plataforma, ponto de entrega e colisões. Trocar/ampliar o mapa é
 * trocar estes dados. O viewport (janela, tela cheia, celular) é independente do mundo.
 *
 * Grade de 160 px (20 x 15 células). Ruas de 96 px (avenidas 128 px) com calçada de 28 px de cada lado.
 *   x: V1=720  V2=1360 (avenida)  V3=2160  V4=2800        y: H1=560  H2=1200 (avenida)  H3=1840
 * Margem externa de 160 px: decoração/limite, NÃO caminhável.
 */
export const PIXELS_PER_METER = 6; // conversão visual de distância (pixels de jogo → metros)

export interface RoadData {
  id: string;
  orientation: 'h' | 'v';
  /** Coordenada do eixo central (y para horizontais, x para verticais). */
  center: number;
  from: number;
  to: number;
  width: number;
  avenue?: boolean;
}

export interface BlockData {
  id: string;
  rect: Rect;
  kind: 'lawn' | 'garden' | 'lot' | 'plaza' | 'strip';
}

export interface HouseData {
  id: string;
  rect: Rect;
  wall: number;
  roof: number;
  /** Lado da porta: 'n' (norte) ou 's' (sul). */
  facing: 'n' | 's';
  kind: 'house' | 'customer';
}

export interface GateData {
  id: string;
  rect: Rect;
}

export interface WorldMapData {
  width: number;
  height: number;
  /** Margem não caminhável (decoração) em volta do mundo. */
  margin: number;
  spawn: { x: number; y: number };
  roads: RoadData[];
  sidewalk: number;
  blocks: BlockData[];
  houses: HouseData[];
  shop: { rect: Rect; door: { x: number; y: number } };
  closedBuilding: { rect: Rect };
  plaza: { rect: Rect; fountain: { x: number; y: number; r: number }; trees: Array<{ x: number; y: number }>; benches: Array<{ x: number; y: number }> };
  fences: Rect[];
  gates: GateData[];
  borderTrees: Array<{ x: number; y: number; r: number }>;
  /** Zona que leva à PlatformScene (lote com portão no nordeste). */
  entrance: { x: number; y: number; radius: number };
  /** Ponto de entrega PROVISÓRIO: calçada em frente à porta da casa do cliente. */
  customer: { x: number; y: number; interactRadius: number; houseId: string; door: { x: number; y: number } };
  /** Retângulos sólidos (colisão do jogador): casas, Novo Hiper, fonte, árvores da praça, cercas, barreiras. */
  solids: Rect[];
}

const WIDTH = 3200;
const HEIGHT = 2400;
const MARGIN = 160;
const SIDEWALK = 28;
const STREET = 96;
const AVENUE = 128;

export const ROADS: RoadData[] = [
  { id: 'h1', orientation: 'h', center: 560, from: MARGIN, to: WIDTH - MARGIN, width: STREET },
  { id: 'h2', orientation: 'h', center: 1200, from: MARGIN, to: WIDTH - MARGIN, width: AVENUE, avenue: true },
  { id: 'h3', orientation: 'h', center: 1840, from: MARGIN, to: WIDTH - MARGIN, width: STREET },
  { id: 'v1', orientation: 'v', center: 720, from: MARGIN, to: HEIGHT - MARGIN, width: STREET },
  { id: 'v2', orientation: 'v', center: 1360, from: MARGIN, to: HEIGHT - MARGIN, width: AVENUE, avenue: true },
  { id: 'v3', orientation: 'v', center: 2160, from: MARGIN, to: HEIGHT - MARGIN, width: STREET },
  { id: 'v4', orientation: 'v', center: 2800, from: MARGIN, to: HEIGHT - MARGIN, width: STREET },
  { id: 'travessa', orientation: 'v', center: 1840, from: 1200, to: 1840, width: 48 },
];

// Quarteirões: cortes entre as ruas (centro ± meia rua ± calçada)
const BX = [
  [160, 644],
  [796, 1268],
  [1452, 2084],
  [2236, 2724],
  [2876, 3040],
];
const BY = [
  [160, 484],
  [636, 1108],
  [1292, 1764],
  [1916, 2240],
];
const block = (ix: number, iy: number): Rect => ({ x: BX[ix][0], y: BY[iy][0], w: BX[ix][1] - BX[ix][0], h: BY[iy][1] - BY[iy][0] });

const WALLS = [0xf5e6c8, 0xe7c9a9, 0xd9d4c7, 0xcfe0c3, 0xf2d7d5, 0xc9d8e6];
const ROOFS = [0xb45309, 0x9a3412, 0x7c2d12, 0x92400e, 0xa16207, 0x78350f];
const HOUSE_W = 120;
const HOUSE_H = 104;
const EDGE = 14;

let houseSeq = 0;
/** Fileira de `n` casas igualmente espaçadas ao longo do topo ('n') ou da base ('s') de um retângulo. */
function houseRow(area: Rect, side: 'n' | 's', n: number): HouseData[] {
  const gap = (area.w - n * HOUSE_W) / (n + 1);
  const y = side === 'n' ? area.y + EDGE : area.y + area.h - EDGE - HOUSE_H;
  const out: HouseData[] = [];
  for (let i = 0; i < n; i++) {
    const k = houseSeq++;
    out.push({
      id: `casa_${k}`,
      rect: { x: Math.round(area.x + gap * (i + 1) + HOUSE_W * i), y, w: HOUSE_W, h: HOUSE_H },
      wall: WALLS[k % WALLS.length],
      roof: ROOFS[(k * 5) % ROOFS.length],
      facing: side,
      kind: 'house',
    });
  }
  return out;
}
const twoRows = (area: Rect, nTop: number, nBottom = nTop) => [...houseRow(area, 'n', nTop), ...houseRow(area, 's', nBottom)];

// ── Peças especiais ───────────────────────────────────────────────────────────
const SHOP_RECT: Rect = { x: 836, y: 700, w: 392, h: 300 };
const PLAZA_RECT = block(2, 1);
const FOUNTAIN = { x: 1768, y: 872, r: 44 };
const PLAZA_TREES = [
  { x: 1560, y: 720 },
  { x: 1976, y: 720 },
  { x: 1560, y: 1024 },
  { x: 1976, y: 1024 },
  { x: 1640, y: 960 },
  { x: 1900, y: 784 },
];
const CUSTOMER_HOUSE: HouseData = {
  id: 'casa_cliente',
  rect: { x: 2440, y: 1620, w: 240, h: 130 },
  wall: 0xfde68a,
  roof: 0xb91c1c,
  facing: 's',
  kind: 'customer',
};
const CUSTOMER_DOOR = { x: 2560, y: 1750 };

const ENTRANCE_LOT = block(3, 0);
const CLOSED_BUILDING: Rect = { x: 1500, y: 1960, w: 280, h: 200 };
const RESERVED_LOT = block(0, 3);

const houses: HouseData[] = [
  // oeste
  // quarteirões da fileira norte: só a fileira voltada para a H1 (a fileira de cima daria para a margem)
  ...houseRow(block(0, 0), 's', 3),
  ...twoRows(block(0, 1), 3),
  ...twoRows(block(0, 2), 3),
  // x = 796–1268
  ...houseRow(block(1, 0), 's', 3),
  ...twoRows(block(1, 2), 3),
  // centro (a travessa em x=1840 divide o quarteirão do meio-sul)
  ...houseRow(block(2, 0), 's', 4),
  ...twoRows({ x: 1452, y: 1292, w: 328, h: 472 }, 2),
  ...twoRows({ x: 1900, y: 1292, w: 184, h: 472 }, 1),
  // leste
  ...twoRows(block(3, 1), 3),
  ...houseRow(block(3, 2), 'n', 3),
  { ...houseRow({ x: 2236, y: 1292, w: 200, h: 472 }, 's', 1)[0], id: 'casa_vizinha' },
  CUSTOMER_HOUSE,
  ...houseRow(block(3, 3), 'n', 3), // fileira sul: só a voltada para a H3
];

const fence = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const FENCE_T = 10;
const fences: Rect[] = [
  // lote da entrada de teste: cerca no oeste, norte e leste (a face sul fica aberta, com portão)
  fence(ENTRANCE_LOT.x, ENTRANCE_LOT.y, FENCE_T, ENTRANCE_LOT.h),
  fence(ENTRANCE_LOT.x + ENTRANCE_LOT.w - FENCE_T, ENTRANCE_LOT.y, FENCE_T, ENTRANCE_LOT.h),
  fence(ENTRANCE_LOT.x, ENTRANCE_LOT.y, ENTRANCE_LOT.w, FENCE_T),
  // terreno cercado (fechado) no sudoeste
  fence(RESERVED_LOT.x + 12, RESERVED_LOT.y + 12, RESERVED_LOT.w - 24, FENCE_T),
  fence(RESERVED_LOT.x + 12, RESERVED_LOT.y + RESERVED_LOT.h - 12 - FENCE_T, RESERVED_LOT.w - 24, FENCE_T),
  fence(RESERVED_LOT.x + 12, RESERVED_LOT.y + 12, FENCE_T, RESERVED_LOT.h - 24),
  fence(RESERVED_LOT.x + RESERVED_LOT.w - 12 - FENCE_T, RESERVED_LOT.y + 12, FENCE_T, RESERVED_LOT.h - 24),
];

// Barreiras "EM OBRAS" nas extremidades de ruas que ainda vão continuar
const gates: GateData[] = [
  { id: 'obras_leste', rect: { x: 2990, y: 1136, w: 30, h: 128 } },
  { id: 'obras_norte', rect: { x: 1296, y: 190, w: 128, h: 30 } },
  { id: 'obras_sul', rect: { x: 672, y: 2190, w: 96, h: 30 } },
];

// Árvores decorativas da borda (não caminhável): duas fileiras ao longo das quatro margens
function makeBorderTrees(): Array<{ x: number; y: number; r: number }> {
  const out: Array<{ x: number; y: number; r: number }> = [];
  const radii = [30, 36, 32, 38];
  const step = 84;
  let k = 0;
  for (let x = 40; x < WIDTH; x += step) {
    out.push({ x, y: 36 + (k % 2) * 54, r: radii[k % 4] }, { x: x + 20, y: HEIGHT - 36 - (k % 2) * 54, r: radii[(k + 1) % 4] });
    k++;
  }
  for (let y = 120; y < HEIGHT - 80; y += step) {
    out.push({ x: 36 + (k % 2) * 54, y, r: radii[k % 4] }, { x: WIDTH - 36 - (k % 2) * 54, y: y + 22, r: radii[(k + 2) % 4] });
    k++;
  }
  return out;
}

const solids: Rect[] = [
  ...houses.map((h) => h.rect),
  SHOP_RECT,
  CLOSED_BUILDING,
  { x: FOUNTAIN.x - FOUNTAIN.r, y: FOUNTAIN.y - FOUNTAIN.r, w: FOUNTAIN.r * 2, h: FOUNTAIN.r * 2 },
  ...PLAZA_TREES.map((t) => ({ x: t.x - 18, y: t.y - 18, w: 36, h: 36 })),
  ...fences,
  ...gates.map((g) => g.rect),
];

const blocks: BlockData[] = [];
BX.slice(0, 4).forEach((_, ix) =>
  BY.forEach((_, iy) => {
    let kind: BlockData['kind'] = 'lawn';
    if (ix === 2 && iy === 1) kind = 'plaza';
    else if (ix === 3 && iy === 0) kind = 'lot';
    else if (ix === 0 && iy === 3) kind = 'lot';
    else if (ix === 1 && iy === 3) kind = 'garden';
    blocks.push({ id: `q_${ix}_${iy}`, rect: block(ix, iy), kind });
  })
);
BY.forEach((_, iy) => blocks.push({ id: `faixa_${iy}`, rect: { x: BX[4][0], y: BY[iy][0], w: BX[4][1] - BX[4][0], h: BY[iy][1] - BY[iy][0] }, kind: 'strip' }));

export const WORLD_MAP: WorldMapData = {
  width: WIDTH,
  height: HEIGHT,
  margin: MARGIN,
  spawn: { x: 1032, y: 1130 }, // calçada da avenida, em frente à porta da Novo Hiper
  roads: ROADS,
  sidewalk: SIDEWALK,
  blocks,
  houses,
  shop: { rect: SHOP_RECT, door: { x: 1032, y: 1000 } },
  closedBuilding: { rect: CLOSED_BUILDING },
  plaza: {
    rect: PLAZA_RECT,
    fountain: FOUNTAIN,
    trees: PLAZA_TREES,
    benches: [
      { x: 1700, y: 930 },
      { x: 1836, y: 930 },
      { x: 1700, y: 814 },
      { x: 1836, y: 814 },
    ],
  },
  fences,
  gates,
  borderTrees: makeBorderTrees(),
  entrance: { x: 2480, y: 380, radius: 42 },
  customer: { x: 2560, y: 1780, interactRadius: 80, houseId: CUSTOMER_HOUSE.id, door: CUSTOMER_DOOR },
  solids,
};

/** Área caminhável do jogador (a margem externa é decoração). */
export const PLAYABLE_RECT: Rect = insetRect({ x: 0, y: 0, w: WIDTH, h: HEIGHT }, MARGIN);

/** Retângulos de uma via (asfalto) e da calçada que a acompanha. */
export function roadRect(r: RoadData, extra = 0): Rect {
  return r.orientation === 'h'
    ? { x: r.from, y: r.center - r.width / 2 - extra, w: r.to - r.from, h: r.width + extra * 2 }
    : { x: r.center - r.width / 2 - extra, y: r.from, w: r.width + extra * 2, h: r.to - r.from };
}
