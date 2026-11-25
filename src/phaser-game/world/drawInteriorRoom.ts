import Phaser from 'phaser';
import { COUNTER, INTERIOR_DOOR, INTERIOR_ROOM, INTERIOR_WALLS, PREP_BENCH, SHELVES, STOCK } from '../config/interiorMap';
import type { Rect } from '../logic/worldGeometry';
import { worldDepthAt } from '../logic/worldDepth';

const ink = 0x443427;
const box = (g: Phaser.GameObjects.Graphics, color: number, x: number, y: number, w: number, h: number) => g.fillStyle(color).fillRect(x, y, w, h);

/** Volumes desenhados sobre as mesmas bases do mapa: topo, frente e lateral com luz à esquerda. */
function furniture(scene: Phaser.Scene, r: Rect, top: number, front: number, side: number, rise: number, lip: number) {
  const shadow = scene.add.graphics().setDepth(0.4);
  shadow.fillStyle(0x34271b, 0.2).fillRoundedRect(r.x + 5, r.y + 9, r.w + 6, r.h + 3, 5);
  const g = scene.add.graphics().setDepth(worldDepthAt(r.y + r.h));
  const topY = r.y - rise;
  const frontY = r.y + r.h - lip;
  box(g, front, r.x, frontY, r.w, lip);
  box(g, top, r.x, topY, r.w, frontY - topY);
  box(g, side, r.x + r.w - 12, topY + 4, 12, r.y + r.h - topY - 4);
  g.lineStyle(2, ink).strokeRect(r.x, topY, r.w, r.y + r.h - topY);
  g.lineBetween(r.x, frontY, r.x + r.w - 12, frontY);
  g.lineStyle(2, 0xffedc5, 0.6).lineBetween(r.x + 3, topY + 3, r.x + r.w - 16, topY + 3);
  return { g, topY, frontY };
}

function pot(g: Phaser.GameObjects.Graphics, x: number, baseY: number, foliage: number, flower = false) {
  box(g, 0x693d2b, x - 6, baseY - 9, 12, 9);
  box(g, 0xc77c4b, x - 8, baseY - 12, 16, 5);
  box(g, 0xe3a575, x - 5, baseY - 7, 3, 5);
  box(g, 0x285d38, x - 2, baseY - 26, 4, 15);
  g.fillStyle(foliage).fillEllipse(x - 5, baseY - 22, 13, 8).fillEllipse(x + 5, baseY - 29, 13, 9);
  g.fillStyle(0x83b965).fillEllipse(x - 3, baseY - 31, 9, 8);
  if (flower) g.fillStyle(0xf4c569).fillCircle(x + 6, baseY - 31, 4);
}

export function drawInteriorRoom(scene: Phaser.Scene) {
  const { width, height, wall } = INTERIOR_ROOM;
  const floor = scene.add.graphics().setDepth(-1);
  box(floor, 0xcbb08c, 0, 0, width, height);
  // Tábuas alternadas, com juntas desencontradas e veios discretos.
  for (let row = 0, y = wall; y < height - wall; row++, y += 28) {
    for (let col = 0, x = wall - (row % 2 ? 56 : 0); x < width - wall; col++, x += 112) {
      const left = Math.max(wall, x);
      const right = Math.min(width - wall, x + 112);
      box(floor, [0xddc39a, 0xd5b88f, 0xe4cda7][(row + col) % 3], left, y, right - left, Math.min(27, height - wall - y));
      floor.lineStyle(1, 0xb99b73, 0.6).lineBetween(right, y, right, y + 27);
      floor.lineStyle(1, 0xc5a77b, 0.4).lineBetween(left + 8, y + 10, right - 8, y + 10);
    }
  }
  const walls = scene.add.graphics().setDepth(0);
  for (const r of INTERIOR_WALLS) {
    box(walls, 0x425a44, r.x, r.y, r.w, r.h);
    box(walls, 0x294332, r.x, r.y + r.h - 6, r.w, 6);
    walls.lineStyle(2, 0x88a875, 0.8).strokeRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  }
  // Rodapé e sombra ambiente permanecem no plano do chão.
  floor.fillStyle(0x56412c, 0.16).fillRect(wall, wall, width - wall * 2, 9);
  floor.fillRect(wall, wall, 7, height - wall * 2);
  const matX = INTERIOR_DOOR.x - 40;
  box(floor, 0x52764c, matX, height - wall - 38, 80, 34);
  floor.lineStyle(2, 0xc1ca8e).strokeRect(matX + 4, height - wall - 34, 72, 26);
  box(walls, 0xbe975f, INTERIOR_DOOR.x - 48, height - wall, 96, 9);

  for (const shelf of SHELVES) {
    const { g, topY } = furniture(scene, shelf.rect, 0xb88954, 0x845731, 0x593d2a, 12, 29);
    box(g, 0x533d2d, shelf.rect.x + 9, topY + 10, shelf.rect.w - 30, 30);
    box(g, 0xd6ac6a, shelf.rect.x + 6, shelf.rect.y + 24, shelf.rect.w - 23, 5);
    for (let i = 0; i < 4; i++) pot(g, shelf.rect.x + 25 + i * 40, shelf.rect.y + 23, [0x3f8653, 0x507d40, 0x619654, 0x3b7557][i], i === 2);
    box(g, 0x5e402b, shelf.rect.x + 10, shelf.rect.y + shelf.rect.h - 14, shelf.rect.w - 34, 7);
  }
  const stock = furniture(scene, STOCK.rect, 0xc8a678, 0xa67e51, 0x725337, 12, 106);
  for (let row = 0; row < 3; row++) {
    const y = STOCK.rect.y + 24 + row * 30;
    box(stock.g, 0x785635, STOCK.rect.x + 8, y, STOCK.rect.w - 28, 24);
    box(stock.g, 0xd2ad75, STOCK.rect.x + 11, y + 2, STOCK.rect.w - 34, 19);
    box(stock.g, 0x685238, STOCK.rect.x + 35, y + 9, 14, 4);
  }
  const counter = furniture(scene, COUNTER.rect, 0xe4c794, 0x91633d, 0x64462f, 18, 32);
  for (let x = COUNTER.rect.x + 12; x < COUNTER.rect.x + COUNTER.rect.w - 14; x += 34) {
    counter.g.lineStyle(2, 0x744b2c).lineBetween(x, counter.frontY + 6, x, COUNTER.rect.y + COUNTER.rect.h - 5);
  }
  // Livro de pedidos e caixa identificam o balcão.
  box(counter.g, 0x477553, 291, 228, 30, 22);
  box(counter.g, 0xf5e9c9, 294, 230, 24, 17);
  counter.g.lineStyle(1, 0xa89974).lineBetween(305, 231, 305, 246);
  box(counter.g, 0x536b62, 369, 228, 31, 24);
  box(counter.g, 0xb8d6b1, 374, 231, 20, 9);
  box(counter.g, 0x344c43, 373, 243, 23, 6);
  const prep = furniture(scene, PREP_BENCH.rect, 0x8ba179, 0x486f51, 0x32523e, 16, 22);
  box(prep.g, 0xe4ddbc, 455, 350, 114, 25);
  pot(prep.g, 477, 373, 0x448b50);
  box(prep.g, 0xa76c42, 537, 358, 19, 13);
  box(prep.g, 0x6a4630, 535, 356, 23, 4);
  box(prep.g, 0xbeb59a, 506, 358, 15, 5);
  box(prep.g, 0x765438, 518, 360, 11, 3);
  const label = (x: number, y: number, text: string, footY: number) => scene.add.text(x, y, text, {
    fontSize: '12px', fontStyle: 'bold', color: '#fff7ed', backgroundColor: '#354c36', padding: { x: 7, y: 4 },
  }).setOrigin(0.5).setDepth(worldDepthAt(footY) + 0.00001);
  for (const shelf of SHELVES) label(shelf.rect.x + shelf.rect.w / 2, shelf.rect.y + shelf.rect.h - 13, shelf.label, shelf.rect.y + shelf.rect.h);
  label(STOCK.rect.x + STOCK.rect.w / 2, STOCK.rect.y + 11, STOCK.label, STOCK.rect.y + STOCK.rect.h);
  label(COUNTER.rect.x + COUNTER.rect.w / 2, COUNTER.rect.y + COUNTER.rect.h - 16, COUNTER.label, COUNTER.rect.y + COUNTER.rect.h);
  label(PREP_BENCH.rect.x + PREP_BENCH.rect.w / 2, PREP_BENCH.rect.y + PREP_BENCH.rect.h - 11, PREP_BENCH.label, PREP_BENCH.rect.y + PREP_BENCH.rect.h);
}
