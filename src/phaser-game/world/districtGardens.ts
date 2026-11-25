import Phaser from 'phaser';
import type { WorldMapData } from '../config/worldMap';
import { URBAN_ART, drawGround } from './worldArt';
import { worldDepthAt } from '../logic/worldDepth';

/** Espaços centrais dos quarteirões: sem ocupar ruas, casas ou corredores das portas. */
export function drawDistrictGardens(scene: Phaser.Scene, map: WorldMapData) {
  const bush = (x: number, y: number, size = 34) => scene.add.image(x, y, URBAN_ART, 'flowers')
    .setOrigin(.5, 1).setDisplaySize(size, size * .75).setDepth(worldDepthAt(y));
  const bench = (x: number, y: number) => scene.add.image(x, y, URBAN_ART, 'bench')
    .setOrigin(.5, 1).setDisplaySize(60, 36).setDepth(worldDepthAt(y));
  const soilBed = (x: number, y: number, width: number, color: number, flowers: boolean) => {
    const g = scene.add.graphics().setDepth(-.4);
    g.fillStyle(0x4d463b, .2).fillRoundedRect(x + 4, y + 5, width, 34, 4);
    g.fillStyle(0xa38556).fillRoundedRect(x, y, width, 32, 4);
    g.fillStyle(0x645039).fillRoundedRect(x + 4, y + 4, width - 8, 23, 3);
    for (let dx = 12; dx < width - 8; dx += 19) {
      g.fillStyle(0x315636).fillEllipse(x + dx, y + 14, 14, 10);
      g.fillStyle(color).fillEllipse(x + dx - 2, y + 11, 10, 7);
      if (flowers) g.fillStyle(0xe5bb86).fillCircle(x + dx, y + 8, 2);
    }
  };
  for (const block of map.blocks) {
    if (block.kind !== 'lawn' && block.kind !== 'garden') continue;
    const { x, y, w, h } = block.rect;
    // Blocos com duas fileiras têm um miolo amplo, protegido dos acessos externos.
    if ((h < 400 && block.kind !== 'garden') || block.id === 'q_1_1' || block.id === 'q_2_2') continue;
    const cx = x + w / 2, cy = y + h / 2;
    const district = Number(block.id.split('_')[1]);
    if (district === 0) {
      // Pátios do oeste: área de descanso e uma trilha de pedras soltas.
      drawGround(scene, { x: cx - 66, y: cy - 34, w: 132, h: 74 }, 'dirt', -.85);
      bench(cx - 18, cy - 3);
      bush(cx + 58, cy + 18, 44); bush(cx - 72, cy - 14, 28);
      const stones = scene.add.graphics().setDepth(-.3).fillStyle(0xc0b798);
      for (let i = 0; i < 5; i++) stones.fillEllipse(cx - 110 + i * 24, cy + 36 + Math.sin(i) * 9, 16, 10);
    } else if (district === 1 || block.kind === 'garden') {
      // Horta comunitária: canteiros em grupos, com corredor aberto no meio.
      soilBed(cx - 150, cy - 52, 115, 0x8ca969, false);
      soilBed(cx - 150, cy + 3, 115, 0x7d9c53, false);
      soilBed(cx + 30, cy - 35, 100, 0xb6a3b9, true);
      soilBed(cx + 30, cy + 20, 100, 0xa8bc70, false);
      bush(cx - 10, cy - 62, 35);
    } else if (district === 3) {
      // Jardins do leste: ilha de flores deslocada e outro espaço livre para estar.
      drawGround(scene, { x: cx + 25, y: cy - 34, w: 100, h: 84 }, 'paving', -.85);
      bench(cx + 72, cy + 4);
      soilBed(cx - 122, cy - 47, 83, 0xd5acbe, true);
      soilBed(cx - 105, cy + 7, 96, 0xdbcb85, true);
      bush(cx + 118, cy + 48, 31);
    }
  }
}
