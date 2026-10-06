import Phaser from 'phaser';
import { WorldMapData, roadRect } from '../config/worldMap';
import { Rect, rectCenter } from '../logic/worldGeometry';

const COLORS = {
  outside: 0x1c3d12,
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

/**
 * Desenha o bairro a partir dos DADOS do mapa (gráficos simples/provisórios). Tudo estático, num único Graphics
 * sob o jogador. Os poucos textos (placa da loja, "EM OBRAS", entrada de teste) são objetos de texto à parte.
 */
export function drawWorld(scene: Phaser.Scene, map: WorldMapData) {
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
    const color = { lawn: COLORS.lawn, garden: COLORS.garden, lot: COLORS.lot, strip: COLORS.strip, plaza: COLORS.plaza }[b.kind];
    fillRect(g, color, b.rect);
    if (b.kind === 'garden') {
      g.lineStyle(4, 0x2f5010, 1);
      for (let y = b.rect.y + 30; y < b.rect.y + b.rect.h - 20; y += 24) g.lineBetween(b.rect.x + 30, y, b.rect.x + b.rect.w - 30, y);
    }
  }

  // praça: piso claro com caminhos em cruz e quatro canteiros gramados
  const pz = map.plaza.rect;
  const pc = rectCenter(pz);
  const path = 28;
  const lawn = (x0: number, y0: number, x1: number, y1: number) => fillRect(g, COLORS.plazaLawn, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  lawn(pz.x + 16, pz.y + 16, pc.x - path, pc.y - path);
  lawn(pc.x + path, pz.y + 16, pz.x + pz.w - 16, pc.y - path);
  lawn(pz.x + 16, pc.y + path, pc.x - path, pz.y + pz.h - 16);
  lawn(pc.x + path, pc.y + path, pz.x + pz.w - 16, pz.y + pz.h - 16);

  // calçadas e asfalto (calçadas de todas as vias primeiro; assim os cruzamentos ficam limpos)
  for (const r of map.roads) {
    // calçada = duas faixas finas ao lado do asfalto (não uma faixa larga por baixo dele)
    const outer = roadRect(r, map.sidewalk);
    const inner = roadRect(r);
    if (r.orientation === 'h') {
      fillRect(g, COLORS.sidewalk, { x: outer.x, y: outer.y, w: outer.w, h: map.sidewalk });
      fillRect(g, COLORS.sidewalk, { x: outer.x, y: inner.y + inner.h, w: outer.w, h: map.sidewalk });
    } else {
      fillRect(g, COLORS.sidewalk, { x: outer.x, y: outer.y, w: map.sidewalk, h: outer.h });
      fillRect(g, COLORS.sidewalk, { x: inner.x + inner.w, y: outer.y, w: map.sidewalk, h: outer.h });
    }
  }
  for (const r of map.roads) fillRect(g, r.avenue ? COLORS.avenue : COLORS.asphalt, roadRect(r));
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
  for (const r of map.roads.filter((x) => x.avenue)) {
    if (r.orientation === 'h') scene.add.tileSprite((r.from + r.to) / 2, r.center, r.to - r.from, 4, 'tracejado-h').setDepth(0);
    else scene.add.tileSprite(r.center, (r.from + r.to) / 2, 4, r.to - r.from, 'tracejado-v').setDepth(0);
  }

  // casas: telhado (bloco grande) + faixa de fachada com porta e janelas. Cada combinação de cores/lado vira uma textura
  // pequena gerada uma vez; cada casa é uma Image (barato por quadro, ao contrário de dezenas de comandos de Graphics).
  for (const h of map.houses) {
    const key = `casa-${h.kind}-${h.wall.toString(16)}-${h.roof.toString(16)}-${h.facing}-${h.rect.w}x${h.rect.h}`;
    if (!scene.textures.exists(key)) {
      const hg = scene.make.graphics({ x: 0, y: 0 }, false);
      const r: Rect = { x: 0, y: 0, w: h.rect.w, h: h.rect.h };
      fillRect(hg, h.roof, r);
      frame(hg, { x: 1, y: 1, w: r.w - 2, h: r.h - 2 });
      const facadeH = h.kind === 'customer' ? 40 : 30;
      const facade: Rect = h.facing === 's' ? { x: 1, y: r.h - facadeH, w: r.w - 2, h: facadeH - 1 } : { x: 1, y: 1, w: r.w - 2, h: facadeH };
      fillRect(hg, h.wall, facade);
      frame(hg, facade, 2);
      const doorW = h.kind === 'customer' ? 30 : 20;
      const doorH = h.kind === 'customer' ? 38 : 28;
      const doorX = r.w / 2 - doorW / 2;
      const doorY = h.facing === 's' ? r.h - doorH - 1 : 1;
      fillRect(hg, h.kind === 'customer' ? 0x1d4ed8 : 0x78350f, { x: doorX, y: doorY, w: doorW, h: doorH });
      for (const dx of [16, r.w - 32]) fillRect(hg, 0x93c5fd, { x: dx, y: facade.y + facade.h / 2 - 6, w: 16, h: 12 });
      hg.lineStyle(3, 0x000000, 0.25);
      const ridge = h.facing === 's' ? 24 : r.h - 24;
      hg.lineBetween(10, ridge, r.w - 10, ridge);
      hg.generateTexture(key, r.w, r.h);
      hg.destroy();
    }
    scene.add.image(h.rect.x + h.rect.w / 2, h.rect.y + h.rect.h / 2, key).setDepth(0);
  }

  // casa do cliente: caminho até a calçada, caixa de correio e canteiro
  const c = map.customer;
  fillRect(g, 0xe7e5e4, { x: c.door.x - 18, y: c.door.y, w: 36, h: c.y - c.door.y + 10 });
  fillRect(g, 0xdc2626, { x: c.door.x + 58, y: c.door.y + 2, w: 16, h: 12 }); // caixa de correio
  fillRect(g, 0x57534e, { x: c.door.x + 64, y: c.door.y + 14, w: 4, h: 14 });
  for (const dx of [-62, -48, 48]) disc(c.door.x + dx, c.door.y + 14, 6, 0xf472b6);

  // Novo Hiper: telhado verde, fachada com toldo listrado, porta, vasos e placa
  const s = map.shop.rect;
  fillRect(g, 0x047857, s);
  frame(g, s, 4);
  g.lineStyle(4, 0x065f46, 1);
  for (let y = s.y + 30; y < s.y + s.h - 90; y += 34) g.lineBetween(s.x + 12, y, s.x + s.w - 12, y);
  const facade: Rect = { x: s.x, y: s.y + s.h - 62, w: s.w, h: 62 };
  fillRect(g, 0xfef3c7, facade);
  frame(g, facade, 3);
  const stripe = 28;
  for (let i = 0, x = s.x; x < s.x + s.w; i++, x += stripe) {
    fillRect(g, i % 2 ? 0xffffff : 0xdc2626, { x, y: s.y + s.h - 62, w: Math.min(stripe, s.x + s.w - x), h: 22 });
  }
  fillRect(g, 0x064e3b, { x: map.shop.door.x - 26, y: s.y + s.h - 40, w: 52, h: 40 });
  fillRect(g, 0xbbf7d0, { x: s.x + 40, y: s.y + s.h - 36, w: 70, h: 28 });
  fillRect(g, 0xbbf7d0, { x: s.x + s.w - 110, y: s.y + s.h - 36, w: 70, h: 28 });
  for (const dx of [-120, -86, 86, 120]) disc(map.shop.door.x + dx, s.y + s.h + 14, 11, 0x16a34a);
  g.fillStyle(0x92400e, 1);
  for (const dx of [-120, -86, 86, 120]) g.fillRect(map.shop.door.x + dx - 7, s.y + s.h + 22, 14, 10);

  // prédio fechado (futuro estabelecimento): telhado cinza e porta de enrolar
  const cb = map.closedBuilding.rect;
  fillRect(g, 0x64748b, cb);
  frame(g, cb, 3);
  const shutter: Rect = { x: cb.x + cb.w / 2 - 50, y: cb.y, w: 100, h: 40 };
  fillRect(g, 0x94a3b8, shutter);
  g.lineStyle(2, 0x475569, 1);
  for (let y = shutter.y + 8; y < shutter.y + shutter.h; y += 8) g.lineBetween(shutter.x, y, shutter.x + shutter.w, y);

  // praça: fonte, bancos e árvores (copas sob o jogador; só o tronco é sólido)
  const f = map.plaza.fountain;
  disc(f.x, f.y, f.r, 0x78716c);
  disc(f.x, f.y, f.r - 10, 0x38bdf8);
  disc(f.x, f.y, 12, 0x7dd3fc);
  for (const b of map.plaza.benches) fillRect(g, 0x78350f, { x: b.x - 22, y: b.y - 7, w: 44, h: 14 });
  for (const t of map.plaza.trees) {
    fillRect(g, 0x713f12, { x: t.x - 7, y: t.y - 10, w: 14, h: 28 });
    disc(t.x, t.y - 22, 36, 0x166534);
    disc(t.x - 10, t.y - 30, 18, 0x22c55e);
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
  const borderColors = [0x14532d, 0x166534, 0x15803d];
  map.borderTrees.forEach((t, i) => disc(t.x, t.y, t.r, borderColors[i % 3]));

  // poucos textos: placa da loja, entrada de teste e as barreiras
  const label = (x: number, y: number, text: string, color: string, bg: string, size = 14) =>
    scene.add
      .text(x, y, text, { fontSize: `${size}px`, fontStyle: 'bold', color, backgroundColor: bg, padding: { x: 8, y: 4 } })
      .setOrigin(0.5)
      .setDepth(2);
  label(map.shop.door.x, map.shop.rect.y + map.shop.rect.h - 84, 'NOVO HIPER', '#fff7ed', '#065f46', 20);
  for (const gate of map.gates) {
    const c = rectCenter(gate.rect);
    const above = gate.id === 'obras_sul' ? 28 : gate.id === 'obras_leste' ? -0 : -28;
    label(c.x, c.y + (gate.id === 'obras_leste' ? -86 : above), 'EM OBRAS', '#1c1917', '#facc15', 13);
  }
}
