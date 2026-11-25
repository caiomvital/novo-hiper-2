import Phaser from 'phaser';
import type { WorldMapData } from '../config/worldMap';
import { worldDepthAt } from '../logic/worldDepth';
import { URBAN_ART } from './worldArt';

/** Decoração sem corpos físicos: os corredores de entrada continuam livres. */
export function drawNeighborhoodLife(scene: Phaser.Scene, map: WorldMapData) {
  const pot = (x: number, y: number, width = 32) => {
    const g = scene.add.graphics().setDepth(worldDepthAt(y));
    g.fillStyle(0x343344, .18).fillEllipse(x + 5, y + 1, width + 10, 9);
    g.fillStyle(0x8b4634).fillRoundedRect(x - width / 2 + 4, y - 19, width - 8, 18, 3);
    g.fillStyle(0xce8153).fillRoundedRect(x - width / 2, y - 23, width, 7, 2);
    g.fillStyle(0xe6a574).fillRect(x - width / 2 + 3, y - 22, 3, 4);
    scene.add.image(x, y - 18, URBAN_ART, 'flowers').setOrigin(.5, 1).setDisplaySize(width + 12, width * .82).setDepth(worldDepthAt(y) + .00001);
  };
  const bed = (x: number, y: number, width: number, colors: number[]) => {
    const g = scene.add.graphics().setDepth(-.15);
    g.fillStyle(0x4c6041, .25).fillRoundedRect(x - width / 2 + 4, y - 10, width + 5, 26, 12);
    g.fillStyle(0x9c8462).fillRoundedRect(x - width / 2 - 3, y - 19, width + 6, 30, 12);
    g.fillStyle(0x65533d).fillRoundedRect(x - width / 2, y - 17, width, 25, 10);
    for (let i = 0; i < Math.floor(width / 13); i++) {
      const px = x - width / 2 + 8 + i * 13, py = y - 6 + Math.sin(i * 2.3) * 4;
      g.fillStyle(0x355b35).fillEllipse(px, py, 17, 12);
      g.fillStyle(0x668d44).fillEllipse(px - 2, py - 3, 12, 8);
      g.fillStyle(colors[i % colors.length]).fillCircle(px + 2, py - 6, 3);
      g.fillStyle(0xf9dea2).fillCircle(px + 2, py - 6, 1);
    }
  };
  // Uma vitrine de mudas em dois níveis e vasos em grupos, deixando a porta livre.
  const sx = map.shop.door.x, sy = map.shop.door.y;
  const display = scene.add.graphics().setDepth(worldDepthAt(sy + 58));
  for (const offset of [-145, 142]) {
    display.fillStyle(0x3b3540, .16).fillEllipse(sx + offset + 7, sy + 61, 86, 12);
    display.fillStyle(0x72553c).fillRect(sx + offset - 37, sy + 33, 5, 25).fillRect(sx + offset + 31, sy + 33, 5, 25);
    display.fillStyle(0x9c7549).fillRoundedRect(sx + offset - 43, sy + 24, 86, 13, 3);
    display.fillStyle(0xd4ad74).fillRect(sx + offset - 42, sy + 24, 84, 3);
    for (const dx of [-25, 0, 25]) pot(sx + offset + dx, sy + 25, 20);
  }
  pot(sx - 66, sy + 23, 30); pot(sx + 69, sy + 20, 36);
  bed(sx - 145, sy + 85, 96, [0xe6ae60, 0xe6d49a, 0xdc8779]);
  bed(sx + 145, sy + 85, 86, [0xbca3d6, 0xe5b3c9, 0xf3d77e]);
  // Os quintais têm agrupamentos diferentes, sem cobrir as soleiras.
  map.houses.forEach((house, i) => {
    const { x, y, w, h } = house.rect;
    const edgeY = house.facing === 'n' ? y - 16 : y + h + 26;
    if (i % 3 === 0) bed(x + 40, edgeY, 58, [0xe5a781, 0xe9cf84]);
    else if (i % 3 === 1) { pot(x + w - 25, edgeY, 25); pot(x + w - 53, edgeY - 4, 20); }
    else bed(x + w - 42, edgeY, 62, [0xb3a6d5, 0xe7bdcf]);
  });

  const { x, y, r } = map.plaza.fountain;
  const fountain = scene.add.graphics().setDepth(worldDepthAt(y + r));
  fountain.fillStyle(0x383848, .2).fillEllipse(x + 8, y + 29, 112, 51);
  fountain.fillStyle(0x766f68).fillEllipse(x, y + 12, 106, 62);
  fountain.fillStyle(0xc4baa1).fillEllipse(x, y + 3, 110, 60);
  fountain.fillStyle(0xe5d9bb).fillEllipse(x, y, 104, 54);
  fountain.fillStyle(0x706f67).fillEllipse(x, y - 1, 88, 42);
  fountain.fillStyle(0x388d9e).fillEllipse(x, y, 82, 36);
  fountain.fillStyle(0x65b8bf).fillEllipse(x - 3, y - 3, 74, 29);
  fountain.fillStyle(0x999c90).fillRect(x - 7, y - 35, 14, 33);
  fountain.fillStyle(0xd9d5bd).fillEllipse(x, y - 34, 38, 16);
  fountain.fillStyle(0x469cae).fillEllipse(x, y - 36, 29, 9);
  const water = scene.add.graphics().setDepth(worldDepthAt(y + r) + .0001);
  // Um único desenho animado, com duração limitada à cena e sem timers globais.
  let elapsed = 0;
  const animate = (_time: number, delta: number) => {
    elapsed += Math.min(delta, 80);
    water.clear();
    water.lineStyle(2, 0xb9edf0, .8);
    for (const side of [-1, 1]) {
      water.beginPath(); water.moveTo(x + side * 10, y - 35);
      for (let i = 1; i <= 8; i++) water.lineTo(x + side * (10 + i * 2.5) + Math.sin(elapsed / 180 + i) * .8, y - 35 + i * i * .48);
      water.strokePath();
    }
    const phase = (elapsed % 1500) / 1500;
    water.lineStyle(1.5, 0xd6f6ec, (1 - phase) * .7);
    water.strokeEllipse(x - 28, y - 1, 4 + phase * 21, 2 + phase * 9);
    water.strokeEllipse(x + 28, y - 1, 4 + phase * 21, 2 + phase * 9);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, animate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, animate));
  bed(x - 145, y + 142, 106, [0xe5af91, 0xefcf76, 0xc9aad6]);
  bed(x + 145, y - 116, 90, [0xebc7cf, 0xd1dba0]);
  // Borboletas percorrem pequenos circuitos sobre os jardins; só seis tweens leves.
  for (let i = 0; i < 6; i++) {
    const bx = x + (i % 2 ? 155 : -155), by = y + (i - 2.5) * 43;
    const butterfly = scene.add.container(bx, by).setDepth(worldDepthAt(by + 30));
    butterfly.add([scene.add.ellipse(-3, 0, 6, 7, i % 2 ? 0xf1cf76 : 0xeab8cd), scene.add.ellipse(3, 0, 6, 7, i % 2 ? 0xf1cf76 : 0xeab8cd), scene.add.rectangle(0, 1, 1, 5, 0x625746)]);
    scene.tweens.add({ targets: butterfly, x: bx + 25, y: by - 14, duration: 2300 + i * 370, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: butterfly, scaleX: .3, duration: 130 + i * 9, yoyo: true, repeat: -1 });
  }
}
