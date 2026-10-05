// Renderizador ilustrado da natureza e do espaço urbano de Olinda:
// - Coqueiros tropicais com tronco segmentado e folhas arqueadas
// - Ipês em floração exuberante (amarelos e rosas) com pétalas caídas
// - Postes coloniais com lampiões a gás de ferro forjado
// - Bancos de praça com ripas de madeira e pés de ferro
// - Canteiros de bromélias e flores tropicais
// - Pavimentação de paralelepípedos e mosaico português

/**
 * Coqueiro Tropical de Olinda
 */
export function drawIllustratedPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 1. Sombra suave no solo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Tronco sinuoso e texturizado com anéis de fibra
  const sway = Math.sin(time / 800) * 3;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.quadraticCurveTo(-12 + sway * 0.4, -35, -2 + sway, -68);
  ctx.lineTo(4 + sway, -68);
  ctx.quadraticCurveTo(-4 + sway * 0.4, -35, 5, 0);
  ctx.closePath();

  const trunkGrad = ctx.createLinearGradient(-10, 0, 10, -70);
  trunkGrad.addColorStop(0, '#78350f');
  trunkGrad.addColorStop(0.5, '#92400e');
  trunkGrad.addColorStop(1, '#a16207');
  ctx.fillStyle = trunkGrad;
  ctx.fill();

  // Anéis de fibra no tronco
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.2;
  for (let i = 8; i < 65; i += 7) {
    const py = -i;
    const px = -7 + (i / 65) * (7 + sway);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 9, py + 1);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Copa do Coqueiro com folhas pinadas arqueadas
  const crownX = sway;
  const crownY = -70;

  // Cacho de cocos verdes
  ctx.fillStyle = '#65a30d';
  ctx.beginPath();
  ctx.arc(crownX - 3, crownY + 2, 3.5, 0, Math.PI * 2);
  ctx.arc(crownX + 3, crownY + 3, 3.5, 0, Math.PI * 2);
  ctx.arc(crownX, crownY + 6, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // 6 Folhas arqueadas em leque
  const leafAngles = [-2.6, -1.8, -1.0, -0.4, 0.3, 1.1, 2.0];
  leafAngles.forEach((angle, idx) => {
    const leafSway = Math.sin(time / 600 + idx) * 0.08;
    drawPalmFrond(ctx, crownX, crownY, angle + leafSway, 42);
  });

  ctx.restore();
}

function drawPalmFrond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Nervura central da folha
  ctx.strokeStyle = '#84cc16';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.5, -6, length, 8);
  ctx.stroke();

  // Folíolos verdes pinados
  ctx.fillStyle = '#15803d';
  const steps = 8;
  for (let i = 2; i < steps; i++) {
    const t = i / steps;
    const fx = t * length;
    const fy = -t * 6 + (t * t) * 14;
    const fLen = Math.sin(t * Math.PI) * 12;

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - 2, fy - fLen);
    ctx.lineTo(fx + 3, fy);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx - 2, fy + fLen * 0.9);
    ctx.lineTo(fx + 3, fy);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Ipê Florido (Amarelo ou Rosa) de Olinda
 */
export function drawIllustratedIpe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: 'ipe_yellow' | 'ipe_pink',
  scale = 1.0,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const isYellow = type === 'ipe_yellow';
  const mainColor = isYellow ? '#facc15' : '#f472b6';
  const shadowColor = isYellow ? '#ca8a04' : '#db2777';
  const lightColor = isYellow ? '#fef08a' : '#fbcfe8';

  // 1. Sombra no solo e tapete de pétalas caídas
  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 26, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pétalas caídas ao chão sob a árvore
  ctx.fillStyle = mainColor;
  for (let i = 0; i < 14; i++) {
    const px = Math.sin(i * 1.7) * 22;
    const py = Math.cos(i * 2.3) * 9 + 4;
    ctx.beginPath();
    ctx.ellipse(px, py, 2.5, 1.5, i, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Tronco forte, rugoso e bifurcado
  ctx.fillStyle = '#573318';
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-4, -22);
  ctx.lineTo(-14, -40);
  ctx.lineTo(-9, -42);
  ctx.lineTo(-2, -26);
  ctx.lineTo(6, -42);
  ctx.lineTo(11, -40);
  ctx.lineTo(4, -22);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();

  // 3. Copa floral com tufos volumosos
  const sway = Math.sin(time / 700) * 1.5;
  const crownY = -48 + sway * 0.5;

  // Tufos de flores em camadas
  const clusters = [
    { x: -18, y: crownY + 6, r: 16 },
    { x: 18, y: crownY + 6, r: 16 },
    { x: -10, y: crownY - 12, r: 18 },
    { x: 10, y: crownY - 12, r: 18 },
    { x: 0, y: crownY - 18, r: 20 },
    { x: 0, y: crownY - 2, r: 21 },
  ];

  // Sombra dos tufos
  clusters.forEach((c) => {
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.arc(c.x + sway, c.y + 3, c.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Tufos principais
  clusters.forEach((c) => {
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.arc(c.x + sway, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Luzes no topo dos tufos
  clusters.forEach((c) => {
    ctx.fillStyle = lightColor;
    ctx.beginPath();
    ctx.arc(c.x - 2 + sway, c.y - 3, c.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

/**
 * Poste Colonial de Ferro com Lampião a Gás e Luz Âmbar
 */
export function drawIllustratedStreetlamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // 1. Sombra do poste no chão
  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Base de ferro fundido
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.roundRect(-4, -6, 8, 8, 2);
  ctx.fill();

  // 3. Coluna do poste
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, -42);
  ctx.stroke();

  // Braços ornamentais curvos
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-6, -36);
  ctx.quadraticCurveTo(0, -40, 6, -36);
  ctx.stroke();

  // 4. Lanterna do lampião colonial
  const lampY = -48;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-5, lampY - 4, 10, 2); // Tampa
  ctx.fillRect(-4, lampY + 8, 8, 2); // Base

  // Vidro fosco iluminado com pulsação suave da chama
  const glow = Math.sin(time / 200) * 0.15;
  ctx.fillStyle = `rgba(253, 224, 71, ${0.85 + glow})`;
  ctx.fillRect(-4, lampY - 2, 8, 10);

  // Halo suave ao redor da lâmpada
  ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
  ctx.beginPath();
  ctx.arc(0, lampY + 3, 14, 0, Math.PI * 2);
  ctx.fill();

  // Cúpula do lampião
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(-6, lampY - 4);
  ctx.lineTo(0, lampY - 10);
  ctx.lineTo(6, lampY - 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Banco Colonial de Madeira Envernizada e Ferro
 */
export function drawIllustratedBench(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // Sombra no chão
  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pés e braços de ferro verde escuro
  ctx.strokeStyle = '#064e3b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-16, -10, 32, 12);

  // Ripas de madeira do assento e encosto
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.roundRect(-15, -12, 30, 4, 1.5);
  ctx.roundRect(-15, -6, 30, 4, 1.5);
  ctx.roundRect(-15, 0, 30, 4, 1.5);
  ctx.fill();

  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

/**
 * Canteiro de Bromélias e Flores Tropicais
 */
export function drawIllustratedFlowerbed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1.0
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Moldura de pedras claras
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(-22, -9, 44, 18, 9);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Terra escura fértil
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.roundRect(-18, -6, 36, 12, 6);
  ctx.fill();

  // Folhagens tropicais verdes
  ctx.fillStyle = '#16a34a';
  for (let i = -14; i <= 14; i += 7) {
    ctx.beginPath();
    ctx.ellipse(i, -1, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Flores coloridas de Olinda
  const flowerColors = ['#f43f5e', '#fbbf24', '#a855f7', '#38bdf8'];
  for (let i = -12; i <= 12; i += 8) {
    ctx.fillStyle = flowerColors[(Math.abs(i) % 4)];
    ctx.beginPath();
    ctx.arc(i, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Vaso Ornamental na Calçada da Loja
 */
export function drawIllustratedPlantPot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
): void {
  ctx.save();
  ctx.translate(x, y);

  // Sombra
  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vaso de cerâmica terracota
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(6, -8);
  ctx.lineTo(4, 2);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#9a3412';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Planta exuberante no vaso
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.ellipse(0, -13, 5, 8, 0, 0, Math.PI * 2);
  ctx.ellipse(-4, -10, 4, 6, -0.6, 0, Math.PI * 2);
  ctx.ellipse(4, -10, 4, 6, 0.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Pavimento de Paralelepípedos Coloniais (textura harmonizada de pedras chanfradas)
 */
export function drawIllustratedCobblestoneRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isVertical = false
): void {
  ctx.save();

  // Fundo base de terra e rejunte de areia
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x, y, w, h);

  // Meio-fio de granito nas bordas da rua
  ctx.fillStyle = '#94a3b8';
  if (isVertical) {
    ctx.fillRect(x, y, 4, h);
    ctx.fillRect(x + w - 4, y, 4, h);
  } else {
    ctx.fillRect(x, y, w, 4);
    ctx.fillRect(x, y + h - 4, w, 4);
  }

  // Pedras de paralelepípedo com variação tonal acolhedora
  const stoneW = 16;
  const stoneH = 11;
  const stoneColors = ['#e2e8f0', '#cbd5e1', '#d1d5db', '#e5e7eb', '#f1f5f9'];

  const startX = isVertical ? x + 4 : x;
  const endX = isVertical ? x + w - 4 : x + w;
  const startY = isVertical ? y : y + 4;
  const endY = isVertical ? y + h : y + h - 4;

  let row = 0;
  for (let py = startY; py < endY; py += stoneH + 2) {
    const shift = (row % 2) * (stoneW / 2);
    for (let px = startX - stoneW; px < endX; px += stoneW + 2) {
      const stoneX = px + shift;
      if (stoneX + stoneW > startX && stoneX < endX) {
        const colorIdx = Math.abs(Math.floor(stoneX * 13 + py * 7)) % stoneColors.length;
        ctx.fillStyle = stoneColors[colorIdx];

        const realW = Math.min(stoneW, endX - stoneX);
        const realH = Math.min(stoneH, endY - py);
        ctx.fillRect(stoneX, py, realW, realH);

        // Chanfro sutil de luz na pedra
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(stoneX, py, realW, 1.5);
      }
    }
    row++;
  }

  ctx.restore();
}

/**
 * Calçadas de Pedras Portuguesas (Mosaico de ondas estilizadas de Olinda)
 */
export function drawIllustratedPortuguesePavement(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y, w, h);

  // Desenho geométrico suave de ondas em pedras pretas e brancas
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  for (let py = y + 10; py < y + h; py += 16) {
    ctx.beginPath();
    for (let px = x; px < x + w; px += 20) {
      ctx.quadraticCurveTo(px + 5, py - 4, px + 10, py);
      ctx.quadraticCurveTo(px + 15, py + 4, px + 20, py);
    }
    ctx.stroke();
  }

  // Meio-fio
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.restore();
}
