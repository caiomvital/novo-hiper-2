import Phaser from 'phaser';
import { drawNeighborhoodLife } from './neighborhoodLife';
import { drawDistrictGardens } from './districtGardens';
import { WorldMapData, roadRect } from '../config/worldMap';
import { Rect, rectCenter } from '../logic/worldGeometry';
import { drawGround, prepareWorldArt, HOUSE_ART, NORTH_HOUSE_ART, PILOT_HOUSE_ART, PILOT_BUILDING_ANCHORS, SHOP_ART, URBAN_ART } from './worldArt';
import { crossingStripes, housePaths, roadRuns } from './mapGroundPlan';
import { worldDepthAt } from '../logic/worldDepth';

const COLORS = {
  outside: 0x42633a,
  lawn: 0x4d7c0f,
  garden: 0x3f6212,
  lot: 0x7a8f3a,
  strip: 0x3b6b1b,
  plaza: 0xd9ccab,
  plazaLawn: 0x5b8f1d,
  sidewalk: 0xbdb7ac,
  asphalt: 0x3f3b38,
  avenue: 0x35322f,
  dash: 0xfacc15,
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

/** A sombra acompanha o alpha da silhueta, em vez de marcar um retângulo no chão. */
const buildingShadow = (scene: Phaser.Scene, image: Phaser.GameObjects.Image) => scene.add
  .image(image.x + 14, image.y + 10, image.texture.key, image.frame.name)
  .setOrigin(image.originX, image.originY).setScale(image.scaleX, image.scaleY)
  .setTintFill(0x39354f).setAlpha(0.24).setDepth(0.1);

/**
 * Desenha o bairro a partir dos dados do mapa e da arte em final-assets.
 * Chão e prédios usam texturas; detalhes e marcadores continuam em Graphics.
 */
export function drawWorld(scene: Phaser.Scene, map: WorldMapData) {
  prepareWorldArt(scene);
  const g = scene.add.graphics().setDepth(0);

  // Discos (árvores, fonte, vasos): Image de uma textura de círculo branca gerada uma vez e tingida. O Phaser triangula
  // CADA fillCircle de um Graphics a todo quadro (caro); imagens vão em lote no WebGL.
  if (!scene.textures.exists('disco')) {
    const dg = scene.make.graphics({ x: 0, y: 0 }, false);
    dg.fillStyle(0xffffff, 1);
    dg.fillCircle(40, 40, 40);
    dg.generateTexture('disco', 80, 80);
    dg.destroy();
  }
  const disc = (x: number, y: number, r: number, color: number) => scene.add.image(x, y, 'disco').setScale(r / 40).setTint(color).setDepth(0);

  // fundo fora da área jogável: só as 4 faixas da margem (o interior é coberto por quarteirões, calçadas e ruas;
  // evita sobrepor camadas inteiras, o que pesa em renderização por software)
  const m = map.margin;
  for (const band of [
    { x: 0, y: 0, w: map.width, h: m },
    { x: 0, y: map.height - m, w: map.width, h: m },
    { x: 0, y: m, w: m, h: map.height - 2 * m },
    { x: map.width - m, y: m, w: m, h: map.height - 2 * m },
  ]) fillRect(g, COLORS.outside, band);

  // quarteirões
  for (const b of map.blocks) {
    drawGround(scene, b.rect, b.kind === 'plaza' ? 'cobbles' : b.kind === 'lot' ? 'dirt' : 'grass');

  }

  // Caminhos das portas às calçadas: o destino fica legível em todas as casas.
  for (const path of housePaths(map)) drawGround(scene, path, 'cobbles', -0.7);
  const shopFront = { x: map.shop.rect.x - 10, y: map.shop.door.y + 4, w: map.shop.rect.w + 20, h: 94 };
  drawGround(scene, shopFront, 'paving', -0.7);
  drawGround(scene, { x: map.shop.door.x - 24, y: map.shop.door.y, w: 48, h: 124 }, 'cobbles', -0.65);
  // O lote de treino conserva as cercas e a entrada; só ganha uma trilha no chão.
  const entranceLot = map.blocks.find(b => b.id === 'q_3_0')!.rect;
  drawGround(scene, { x: map.entrance.x - 24, y: map.entrance.y, w: 48, h: entranceLot.y + entranceLot.h - map.entrance.y }, 'dirt', -0.75);

  drawDistrictGardens(scene, map);

  // Praça assimétrica: bosque a oeste, terraço aberto a nordeste e jardim baixo a sudeste.
  const pz = map.plaza.rect;
  const pc = rectCenter(pz);
  const path = 28;
  const lawn = (x0: number, y0: number, x1: number, y1: number) => {
    scene.add.rectangle((x0 + x1) / 2, (y0 + y1) / 2 + 2, x1 - x0 + 8, y1 - y0 + 8, 0x8f856d).setDepth(-0.85);
    drawGround(scene, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, 'grass', -0.8);
    for (const [x, y] of [[x0 + 28, y0 + 24], [x1 - 28, y1 - 24]]) {
      scene.add.image(x, y, URBAN_ART, 'flowers').setDisplaySize(38, 30).setDepth(0);
    }
  };
  lawn(pz.x + 16, pz.y + 16, pc.x - path - 20, pc.y - path);
  lawn(pc.x + path + 16, pz.y + 16, pz.x + pz.w - 16, pc.y - 110);
  lawn(pz.x + 16, pc.y + path + 10, pc.x - path - 36, pz.y + pz.h - 16);
  lawn(pc.x + path + 18, pc.y + path + 28, pz.x + pz.w - 16, pz.y + pz.h - 34);

  // calçadas e asfalto (calçadas de todas as vias primeiro; assim os cruzamentos ficam limpos)
  for (const r of map.roads) {
    // calçada = duas faixas finas ao lado do asfalto (não uma faixa larga por baixo dele)
    const outer = roadRect(r, map.sidewalk);
    const inner = roadRect(r);
    if (r.orientation === 'h') {
      drawGround(scene, { x: outer.x, y: outer.y, w: outer.w, h: map.sidewalk }, 'paving', -0.6);
      drawGround(scene, { x: outer.x, y: inner.y + inner.h, w: outer.w, h: map.sidewalk }, 'paving', -0.6);
    } else {
      drawGround(scene, { x: outer.x, y: outer.y, w: map.sidewalk, h: outer.h }, 'paving', -0.6);
      drawGround(scene, { x: inner.x + inner.w, y: outer.y, w: map.sidewalk, h: outer.h }, 'paving', -0.6);
    }
  }
  for (const r of map.roads) drawGround(scene, roadRect(r), 'asphalt', -0.5);
  // Meio-fio claro e sombra rente ao asfalto dão altura às calçadas.
  const roadDetails = scene.add.graphics().setDepth(-0.3);
  for (const road of map.roads) for (const run of roadRuns(road, map)) {
    const length = run.end - run.start;
    const edge = road.width / 2;
    if (road.orientation === 'h') {
      fillRect(roadDetails, 0xefe6cd, { x: run.start, y: road.center - edge - 3, w: length, h: 3 });
      fillRect(roadDetails, 0x3d3b44, { x: run.start, y: road.center - edge, w: length, h: 3 });
      fillRect(roadDetails, 0x716c68, { x: run.start, y: road.center + edge - 3, w: length, h: 3 });
      fillRect(roadDetails, 0xefe6cd, { x: run.start, y: road.center + edge, w: length, h: 3 });
    } else {
      fillRect(roadDetails, 0xefe6cd, { x: road.center - edge - 3, y: run.start, w: 3, h: length });
      fillRect(roadDetails, 0x3d3b44, { x: road.center - edge, y: run.start, w: 3, h: length });
      fillRect(roadDetails, 0x716c68, { x: road.center + edge - 3, y: run.start, w: 3, h: length });
      fillRect(roadDetails, 0xefe6cd, { x: road.center + edge, y: run.start, w: 3, h: length });
    }
  }
  for (const stripe of crossingStripes(map)) fillRect(roadDetails, 0xece4cb, stripe);
  if (!scene.textures.exists('tracejado-h')) {
    const dg = scene.make.graphics({ x: 0, y: 0 }, false);
    dg.fillStyle(COLORS.dash, 1);
    dg.fillRect(0, 0, 36, 4);
    dg.generateTexture('tracejado-h', 64, 4);
    dg.clear();
    dg.fillStyle(COLORS.dash, 1);
    dg.fillRect(0, 0, 4, 36);
    dg.generateTexture('tracejado-v', 4, 64);
    dg.destroy();
  }
  for (const r of map.roads.filter((x) => x.avenue)) for (const run of roadRuns(r, map)) {
    if (r.orientation === 'h') scene.add.tileSprite((run.start + run.end) / 2, r.center, run.end - run.start, 4, 'tracejado-h').setDepth(-0.28);
    else scene.add.tileSprite(r.center, (run.start + run.end) / 2, 4, run.end - run.start, 'tracejado-v').setDepth(-0.28);
  }


  // As duas orientações de fachada seguem o lado da porta definido pelo mapa.
  const houseVariants = ['cream', 'sage', 'blush', 'blue'];
  map.houses.forEach((h, index) => {
    const variant = houseVariants[(index * 7 + Math.floor(index / 3)) % houseVariants.length];
    const r = h.rect;
    if (h.id === map.customer.houseId) {
      const image = scene.add.image(map.customer.door.x, map.customer.door.y, PILOT_HOUSE_ART, 'house');
      const ratio = image.texture.getSourceImage().width / 1312;
      const anchor = { x: PILOT_BUILDING_ANCHORS.house.x * ratio, y: PILOT_BUILDING_ANCHORS.house.y * ratio };
      image.setOrigin((anchor.x - image.frame.cutX) / image.frame.width, (anchor.y - image.frame.cutY) / image.frame.height);
      // A altura da imagem inclui o telhado projetado acima da ocupação física.
      image.setScale(r.w / image.frame.width).setDepth(worldDepthAt(r.y + r.h));
      buildingShadow(scene, image);
      return;
    }
    scene.add.ellipse(r.x + r.w / 2 + 4, r.y + r.h - 3, r.w + 10, 16, 0x39354f, 0.22).setDepth(-0.1);
    const image = scene.add.image(r.x + r.w / 2, h.facing === 'n' ? r.y : r.y + r.h,
      h.facing === 'n' ? NORTH_HOUSE_ART : HOUSE_ART, variant).setOrigin(0.5, h.facing === 'n' ? 0 : 1);
    image.setScale(Math.min(r.w / image.frame.width, r.h / image.frame.height)).setDepth(0);
  });

  // casa do cliente: caminho até a calçada, caixa de correio e canteiro
  const c = map.customer;
  // O caminho texturizado já foi desenhado com as demais casas.
  fillRect(g, 0xdc2626, { x: c.door.x + 58, y: c.door.y + 2, w: 16, h: 12 }); // caixa de correio
  fillRect(g, 0x57534e, { x: c.door.x + 64, y: c.door.y + 14, w: 4, h: 14 });
  for (const dx of [-62, -48, 48]) disc(c.door.x + dx, c.door.y + 14, 6, 0xf472b6);

  // Fachada com porta central: coincide com o ponto de entrada existente.
  const s = map.shop.rect;
  const shopImage = scene.add.image(map.shop.door.x, map.shop.door.y, SHOP_ART, 'facade');
  const ratio = shopImage.texture.getSourceImage().width / 1430;
  const anchor = { x: PILOT_BUILDING_ANCHORS.shop.x * ratio, y: PILOT_BUILDING_ANCHORS.shop.y * ratio };
  shopImage.setOrigin((anchor.x - shopImage.frame.cutX) / shopImage.frame.width, (anchor.y - shopImage.frame.cutY) / shopImage.frame.height);
  shopImage.setScale(s.w / shopImage.frame.width).setDepth(worldDepthAt(s.y + s.h));
  buildingShadow(scene, shopImage);

  // Loja de Utilidades (quarteirão sul-central): telhado azul-petróleo, fachada clara voltada para a H3 (norte),
  // toldo azul e branco, porta de enrolar erguida, vitrines, caixotes e baldes na calçada
  const u = map.utilities.rect;
  const ud = map.utilities.door;
  fillRect(g, 0x155e75, u);
  frame(g, u, 4);
  g.lineStyle(3, 0x164e63, 1);
  for (let y = u.y + 96; y < u.y + u.h - 14; y += 30) g.lineBetween(u.x + 12, y, u.x + u.w - 12, y);
  const uFacade: Rect = { x: u.x, y: u.y, w: u.w, h: 62 };
  fillRect(g, 0xe0f2fe, uFacade);
  frame(g, uFacade, 3);
  for (let i = 0, x = u.x; x < u.x + u.w; i++, x += 28) {
    fillRect(g, i % 2 ? 0xffffff : 0x2563eb, { x, y: u.y, w: Math.min(28, u.x + u.w - x), h: 22 });
  }
  fillRect(g, 0x0f172a, { x: ud.x - 50, y: u.y + 26, w: 100, h: 34 }); // vão da porta de enrolar (aberta)
  const roll: Rect = { x: ud.x - 50, y: u.y + 26, w: 100, h: 9 };
  fillRect(g, 0x94a3b8, roll);
  g.lineStyle(2, 0x475569, 1);
  g.lineBetween(roll.x, roll.y + 4, roll.x + roll.w, roll.y + 4);
  fillRect(g, 0xfbbf24, { x: ud.x - 38, y: u.y + 44, w: 14, h: 14 }); // mercadorias à vista dentro da loja
  fillRect(g, 0x38bdf8, { x: ud.x - 12, y: u.y + 46, w: 14, h: 12 });
  fillRect(g, 0xf87171, { x: ud.x + 14, y: u.y + 44, w: 14, h: 14 });
  fillRect(g, 0xbae6fd, { x: u.x + 22, y: u.y + 28, w: 62, h: 28 }); // vitrines
  fillRect(g, 0xbae6fd, { x: u.x + u.w - 84, y: u.y + 28, w: 62, h: 28 });
  fillRect(g, 0x38bdf8, { x: u.x + 22, y: u.y + 28, w: 62, h: 6 });
  fillRect(g, 0x38bdf8, { x: u.x + u.w - 84, y: u.y + 28, w: 62, h: 6 });
  // caixotes e baldes na calçada, longe do ponto de interação (decoração, sem colisão)
  fillRect(g, 0xb45309, { x: ud.x - 118, y: u.y - 30, w: 30, h: 22 });
  fillRect(g, 0x92400e, { x: ud.x - 84, y: u.y - 26, w: 24, h: 18 });
  disc(ud.x + 96, u.y - 16, 10, 0xdc2626);
  disc(ud.x + 120, u.y - 16, 10, 0x2563eb);

  // praça: fonte, bancos e árvores (copas sob o jogador; só o tronco é sólido)
  drawNeighborhoodLife(scene, map);
  for (const b of map.plaza.benches) scene.add.image(b.x, b.y + 7, URBAN_ART, 'bench').setOrigin(0.5, 1).setDisplaySize(58, 36).setDepth(0);
  for (const t of map.plaza.trees) {
    scene.add.ellipse(t.x + 5, t.y + 9, 64, 17, 0x39354f, 0.22).setDepth(-0.1);
    scene.add.image(t.x, t.y + 18, URBAN_ART, 'tree-medium').setOrigin(0.5, 1).setDisplaySize(96, 128).setDepth(worldDepthAt(t.y + 18));
  }

  // cercas
  for (const r of map.fences) fillRect(g, 0x92400e, r);
  // portão do lote da entrada de teste (dois mourões, face sul aberta)
  const lot = map.blocks.find((b) => b.id === 'q_3_0')!.rect;
  g.fillStyle(0x78350f, 1);
  for (const dx of [-90, 90]) g.fillRect(map.entrance.x + dx - 6, lot.y + lot.h - 26, 12, 26);

  // barreiras "EM OBRAS" (listras amarelo/preto)
  for (const gate of map.gates) {
    const r = gate.rect;
    fillRect(g, 0x1c1917, r);
    g.fillStyle(0xfacc15, 1);
    const horizontal = r.w >= r.h;
    for (let i = 0; i < (horizontal ? r.w : r.h); i += 24) {
      if (horizontal) g.fillRect(r.x + i, r.y, 12, r.h);
      else g.fillRect(r.x, r.y + i, r.w, 12);
    }
    frame(g, r, 2);
  }

  // borda: árvores densas (decorativas; a margem não é caminhável)
  map.borderTrees.forEach((t, i) => scene.add.image(t.x, t.y + t.r, URBAN_ART, i % 3 ? 'tree-small' : 'tree-medium')
    .setOrigin(0.5, 1).setDisplaySize(t.r * 2.2, t.r * 3).setDepth(0));

  // poucos textos: placa da loja, entrada de teste e as barreiras
  const label = (x: number, y: number, text: string, color: string, bg: string, size = 14) =>
    scene.add
      .text(x, y, text, { fontSize: `${size}px`, fontStyle: 'bold', color, backgroundColor: bg, padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(2);
  label(map.utilities.door.x, map.utilities.rect.y + 92, 'UTILIDADES', '#f0f9ff', '#1d4ed8', 18);
  for (const gate of map.gates) {
    const c = rectCenter(gate.rect);
    const above = gate.id === 'obras_sul' ? 28 : gate.id === 'obras_leste' ? -0 : -28;
    label(c.x, c.y + (gate.id === 'obras_leste' ? -86 : above), 'EM OBRAS', '#1c1917', '#facc15', 13);
  }
}
