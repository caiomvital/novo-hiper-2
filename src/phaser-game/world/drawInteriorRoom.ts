import Phaser from 'phaser';
import { COUNTER, INTERIOR_DOOR, INTERIOR_ROOM, INTERIOR_WALLS, PREP_BENCH, SHELVES, STOCK } from '../config/interiorMap';
import { Rect } from '../logic/worldGeometry';

const COLORS = {
  floor: 0xe7d7b8,
  plank: 0xd8c39d,
  wall: 0x8a6a46,
  door: 0xd9c49a,
  shelf: 0x7c4a1e,
  shelfTrim: 0x5a3414,
  stock: 0x92746a,
  stockTrim: 0x57403a,
  counter: 0xb45309,
  counterTop: 0xfde68a,
  prep: 0x16a34a,
  prepTop: 0xdcfce7,
  outline: 0x1c1917,
};

const fillRect = (g: Phaser.GameObjects.Graphics, color: number, r: Rect) => {
  g.fillStyle(color, 1);
  g.fillRect(r.x, r.y, r.w, r.h);
};
const frame = (g: Phaser.GameObjects.Graphics, r: Rect, width = 3) => {
  g.lineStyle(width, COLORS.outline, 1);
  g.strokeRect(r.x, r.y, r.w, r.h);
};

/**
 * Desenha o interior a partir dos dados de interiorMap.ts (gráficos simples/provisórios — como drawWorld.ts).
 * Objetivo deste marco: validar escala, disposição, circulação e colisões; não é o Art Pass definitivo.
 */
export function drawInteriorRoom(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(0);

  fillRect(g, COLORS.floor, { x: 0, y: 0, w: INTERIOR_ROOM.width, h: INTERIOR_ROOM.height });
  g.lineStyle(1, COLORS.plank, 1);
  for (let y = 40; y < INTERIOR_ROOM.height; y += 32) g.lineBetween(INTERIOR_ROOM.wall, y, INTERIOR_ROOM.width - INTERIOR_ROOM.wall, y);

  for (const w of INTERIOR_WALLS) fillRect(g, COLORS.wall, w);
  // vão da porta: tapete de boas-vindas
  fillRect(g, COLORS.door, { x: INTERIOR_DOOR.x - 44, y: INTERIOR_ROOM.height - INTERIOR_ROOM.wall, w: 88, h: 12 });

  for (const shelf of SHELVES) {
    fillRect(g, COLORS.shelf, shelf.rect);
    frame(g, shelf.rect, 3);
    g.lineStyle(2, COLORS.shelfTrim, 1);
    g.lineBetween(shelf.rect.x, shelf.rect.y + shelf.rect.h / 2, shelf.rect.x + shelf.rect.w, shelf.rect.y + shelf.rect.h / 2);
    // vasinhos decorativos (decoração vegetal — sem colisão própria, fazem parte do retângulo da prateleira)
    for (let i = 0; i < 4; i++) {
      const x = shelf.rect.x + 20 + (i * (shelf.rect.w - 40)) / 3;
      g.fillStyle(0x15803d, 1).fillCircle(x, shelf.rect.y + shelf.rect.h - 6, 9);
      g.fillStyle(0x92400e, 1).fillRect(x - 6, shelf.rect.y + shelf.rect.h - 2, 12, 8);
    }
  }

  fillRect(g, COLORS.stock, STOCK.rect);
  frame(g, STOCK.rect, 3);
  g.lineStyle(2, COLORS.stockTrim, 1);
  for (let y = STOCK.rect.y + 14; y < STOCK.rect.y + STOCK.rect.h - 6; y += 22) {
    g.lineBetween(STOCK.rect.x + 6, y, STOCK.rect.x + STOCK.rect.w - 6, y);
  }

  fillRect(g, COLORS.counter, COUNTER.rect);
  frame(g, COUNTER.rect, 3);
  fillRect(g, COLORS.counterTop, { x: COUNTER.rect.x, y: COUNTER.rect.y, w: COUNTER.rect.w, h: 14 });

  fillRect(g, COLORS.prep, PREP_BENCH.rect);
  frame(g, PREP_BENCH.rect, 3);
  fillRect(g, COLORS.prepTop, { x: PREP_BENCH.rect.x + 10, y: PREP_BENCH.rect.y + 8, w: PREP_BENCH.rect.w - 20, h: PREP_BENCH.rect.h - 20 });

  const label = (x: number, y: number, text: string) =>
    scene.add
      .text(x, y, text, { fontSize: '12px', fontStyle: 'bold', color: '#fff7ed', backgroundColor: '#1c1917cc', padding: { x: 6, y: 3 } })
      .setOrigin(0.5)
      .setDepth(2);
  for (const shelf of SHELVES) label(shelf.rect.x + shelf.rect.w / 2, shelf.rect.y + shelf.rect.h + 12, shelf.label);
  label(STOCK.rect.x + STOCK.rect.w / 2, STOCK.rect.y - 14, STOCK.label);
  label(COUNTER.rect.x + COUNTER.rect.w / 2, COUNTER.rect.y - 14, COUNTER.label);
  label(PREP_BENCH.rect.x + PREP_BENCH.rect.w / 2, PREP_BENCH.rect.y - 14, PREP_BENCH.label);
}
