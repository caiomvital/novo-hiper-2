// Renderizador 2D ilustrado dos personagens:
// - Bernardo (protagonista com animação de caminhada, cabelo estilizado, óculos e vaso com planta real)
// - Clientes fictícios de Olinda (Dona Maria, Seu João, Ana) com expressões e características próprias

import { PlayerState, DeliveryMission } from './types';

// Cache para imagens de plantas carregadas via URL (caso existam)
const plantImageCache = new Map<string, HTMLImageElement>();

function getPlantImage(url?: string): HTMLImageElement | null {
  if (!url) return null;
  let img = plantImageCache.get(url);
  if (!img) {
    img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    plantImageCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * Renderiza o protagonista Bernardo em perspectiva top-down 2.5D
 */
export function drawIllustratedBernardo(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  mission: DeliveryMission | null,
  time: number
): void {
  const { x, y, facing, isMoving, carryingPlant, walkCycle } = player;

  ctx.save();
  ctx.translate(x, y);

  // 1. Sombra suave elíptica no solo (para que o personagem nunca pareça flutuar)
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Cálculo do ciclo de passos (oscilação de pernas e tronco)
  const walkOffset = isMoving ? Math.sin(walkCycle * Math.PI * 2) : 0;
  const bobbing = isMoving ? Math.abs(Math.cos(walkCycle * Math.PI * 2)) * 2 : 0;

  ctx.translate(0, -bobbing);

  // 3. Pernas e Tênis
  drawBernardoLegs(ctx, facing, walkOffset);

  // 4. Tronco com Camisa/Avental Verde Esmeralda do Novo Hiper e Mochila
  drawBernardoTorso(ctx, facing, carryingPlant);

  // 5. Cabeça de Bernardo (Rosto expressivo, óculos redondos e topete loiro)
  drawBernardoHead(ctx, facing, time);

  // 6. Braços e Vaso da Planta em mãos (se estiver carregando)
  if (carryingPlant && mission) {
    drawCarriedPlantPot(ctx, facing, mission, bobbing);
  } else {
    drawBernardoArms(ctx, facing, walkOffset);
  }

  // 7. Mini Indicador de Bernardo no jogo (minimalista e charmoso)
  drawBernardoStatusBadge(ctx, carryingPlant, mission);

  ctx.restore();
}

/**
 * Pernas e calçados com animação de caminhada
 */
function drawBernardoLegs(
  ctx: CanvasRenderingContext2D,
  facing: 'down' | 'up' | 'left' | 'right',
  walkOffset: number
): void {
  ctx.save();

  const legColor = '#1e3a8a'; // Bermuda/calça jeans azul profundo
  const shoeColor = '#dc2626'; // Tênis esportivo vermelho
  const soleColor = '#ffffff'; // Solado branco

  if (facing === 'down' || facing === 'up') {
    // Perna Esquerda
    const leftLegY = -8 + walkOffset * 3;
    ctx.fillStyle = legColor;
    ctx.beginPath();
    ctx.roundRect(-7, leftLegY, 5, 10, 2);
    ctx.fill();

    // Tênis Esquerdo
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.roundRect(-8, leftLegY + 8, 7, 5, 2);
    ctx.fill();
    ctx.fillStyle = soleColor;
    ctx.fillRect(-8, leftLegY + 12, 7, 1.5);

    // Perna Direita
    const rightLegY = -8 - walkOffset * 3;
    ctx.fillStyle = legColor;
    ctx.beginPath();
    ctx.roundRect(2, rightLegY, 5, 10, 2);
    ctx.fill();

    // Tênis Direito
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.roundRect(1, rightLegY + 8, 7, 5, 2);
    ctx.fill();
    ctx.fillStyle = soleColor;
    ctx.fillRect(1, rightLegY + 12, 7, 1.5);
  } else {
    // Perfil lateral
    const dir = facing === 'right' ? 1 : -1;
    const legFrontY = -8 + walkOffset * 3.5;
    const legBackY = -8 - walkOffset * 3.5;

    // Perna de trás
    ctx.fillStyle = '#172554';
    ctx.beginPath();
    ctx.roundRect(-4 * dir, legBackY, 6, 9, 2);
    ctx.fill();
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.roundRect(-5 * dir, legBackY + 7, 8 * dir, 5, 2);
    ctx.fill();

    // Perna da frente
    ctx.fillStyle = legColor;
    ctx.beginPath();
    ctx.roundRect(-2 * dir, legFrontY, 6, 10, 2);
    ctx.fill();
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.roundRect(-3 * dir, legFrontY + 8, 8 * dir, 5, 2);
    ctx.fill();
    ctx.fillStyle = soleColor;
    ctx.fillRect(-3 * dir, legFrontY + 12, 8 * dir, 1.5);
  }

  ctx.restore();
}

/**
 * Tronco, camiseta e mochila de entregas
 */
function drawBernardoTorso(
  ctx: CanvasRenderingContext2D,
  facing: 'down' | 'up' | 'left' | 'right',
  carryingPlant: boolean
): void {
  ctx.save();

  // Mochila de entregas nas costas (visível se estiver de costas ou perfil)
  if (facing === 'up') {
    ctx.fillStyle = '#065f46'; // Mochila verde escuro do Novo Hiper
    ctx.beginPath();
    ctx.roundRect(-10, -26, 20, 16, 4);
    ctx.fill();
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Faixas refletivas amarelas da mochila
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-8, -20, 16, 2.5);
  } else if (facing === 'left' || facing === 'right') {
    const dir = facing === 'right' ? -1 : 1;
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.roundRect(dir * 5, -25, 7, 14, 3);
    ctx.fill();
  }

  // Camiseta / Avental do Novo Hiper (Verde Esmeralda vívido com logo)
  const shirtGrad = ctx.createLinearGradient(0, -28, 0, -10);
  shirtGrad.addColorStop(0, '#10b981');
  shirtGrad.addColorStop(1, '#047857');

  ctx.fillStyle = shirtGrad;
  ctx.beginPath();
  ctx.roundRect(-9, -26, 18, 17, 4);
  ctx.fill();

  // Gola branca
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -26);
  ctx.lineTo(0, -22);
  ctx.lineTo(4, -26);
  ctx.stroke();

  // Emblema do Novo Hiper no peito (broto de planta dourado)
  if (facing === 'down' && !carryingPlant) {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(4, -18, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Cabeça, feições, topete loiro e óculos redondos de Bernardo
 */
function drawBernardoHead(
  ctx: CanvasRenderingContext2D,
  facing: 'down' | 'up' | 'left' | 'right',
  time: number
): void {
  ctx.save();
  ctx.translate(0, -32);

  // 1. Base da cabeça (pele clara e saudável)
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // Orelhas
  if (facing === 'down' || facing === 'up') {
    ctx.fillStyle = '#fdba74';
    ctx.beginPath();
    ctx.arc(-9.5, 0, 2.5, 0, Math.PI * 2);
    ctx.arc(9.5, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (facing === 'down') {
    // Olhos e Óculos Redondos Pretos de Bernardo
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.6;

    // Aro esquerdo
    ctx.beginPath();
    ctx.arc(-4, -1, 3.2, 0, Math.PI * 2);
    ctx.stroke();

    // Aro direito
    ctx.beginPath();
    ctx.arc(4, -1, 3.2, 0, Math.PI * 2);
    ctx.stroke();

    // Ponte dos óculos
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(1, -1);
    ctx.stroke();

    // Pupilas brilhantes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-4, -1, 1.2, 0, Math.PI * 2);
    ctx.arc(4, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Bochechas rosadas
    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.beginPath();
    ctx.arc(-5.5, 3.5, 2, 0, Math.PI * 2);
    ctx.arc(5.5, 3.5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Sorriso simpático de Bernardo
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 3, 2.8, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Topete e cabelo loiro ondulado
    drawBlondeHair(ctx, 'down');
  } else if (facing === 'up') {
    // Cabelo loiro cobrindo a parte traseira da cabeça
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -1, 9.8, 0, Math.PI * 2);
    ctx.fill();
    // Mechas com luz solar
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(0, -3, 8.5, 0, Math.PI);
    ctx.fill();
  } else {
    // Perfil lateral (esquerda ou direita)
    const dir = facing === 'right' ? 1 : -1;

    // Óculos de perfil
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(dir * 3.5, -1, 3, 0, Math.PI * 2);
    ctx.stroke();
    // Haste do óculos até a orelha
    ctx.beginPath();
    ctx.moveTo(dir * 3.5, -1);
    ctx.lineTo(dir * -4, 0);
    ctx.stroke();

    // Cabelo loiro de perfil com topete para frente
    drawBlondeHair(ctx, facing);
  }

  ctx.restore();
}

/**
 * Desenha o cabelo loiro característico de Bernardo
 */
function drawBlondeHair(ctx: CanvasRenderingContext2D, facing: string): void {
  ctx.save();
  ctx.fillStyle = '#f59e0b'; // Base dourada

  if (facing === 'down') {
    // Topete frontal com mechas
    ctx.beginPath();
    ctx.moveTo(-10, -3);
    ctx.bezierCurveTo(-11, -12, -3, -15, 2, -14);
    ctx.bezierCurveTo(8, -14, 11, -10, 10, -3);
    ctx.bezierCurveTo(7, -6, 2, -7, -2, -4);
    ctx.bezierCurveTo(-4, -6, -8, -5, -10, -3);
    ctx.fill();

    // Brilho solar no topete
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(1, -11, 5, 2.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const dir = facing === 'right' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(dir * -8, 2);
    ctx.bezierCurveTo(dir * -10, -11, dir * -2, -14, dir * 5, -13);
    ctx.bezierCurveTo(dir * 11, -11, dir * 9, -5, dir * 6, -3);
    ctx.bezierCurveTo(dir * 2, -6, dir * -2, -6, dir * -4, 0);
    ctx.fill();

    // Brilho
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(dir * 1, -10, 4, 2, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Braços normais quando Bernardo está caminhando de mãos livres
 */
function drawBernardoArms(
  ctx: CanvasRenderingContext2D,
  facing: 'down' | 'up' | 'left' | 'right',
  walkOffset: number
): void {
  ctx.save();
  ctx.fillStyle = '#10b981'; // Manga da camisa verde
  const skinColor = '#fed7aa';

  if (facing === 'down' || facing === 'up') {
    const armSwing = walkOffset * 4;

    // Braço Esquerdo
    ctx.beginPath();
    ctx.roundRect(-12, -24 - armSwing, 4, 10, 2);
    ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(-10, -14 - armSwing, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Braço Direito
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(8, -24 + armSwing, 4, 10, 2);
    ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(10, -14 + armSwing, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Lateral
    const dir = facing === 'right' ? 1 : -1;
    const armSwing = walkOffset * 5;

    ctx.beginPath();
    ctx.roundRect(dir * 2 - 2, -23 + armSwing, 4, 11, 2);
    ctx.fill();
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(dir * 2, -12 + armSwing, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Vaso detalhado de cerâmica com a planta real do pedido sendo carregada com os dois braços
 */
function drawCarriedPlantPot(
  ctx: CanvasRenderingContext2D,
  facing: 'down' | 'up' | 'left' | 'right',
  mission: DeliveryMission,
  bobbing: number
): void {
  ctx.save();

  // Braços segurando o vaso à frente
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.roundRect(-11, -22, 5, 8, 2);
  ctx.roundRect(6, -22, 5, 8, 2);
  ctx.fill();

  // Posição do vaso
  const potY = -18 - bobbing;

  // Sombra suave do vaso no corpo
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, potY + 11, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vaso de cerâmica artesanal terracota
  const potGrad = ctx.createLinearGradient(-8, potY, 8, potY + 10);
  potGrad.addColorStop(0, '#f97316');
  potGrad.addColorStop(0.5, '#ea580c');
  potGrad.addColorStop(1, '#9a3412');

  ctx.fillStyle = potGrad;
  ctx.beginPath();
  ctx.moveTo(-7, potY + 2);
  ctx.lineTo(7, potY + 2);
  ctx.lineTo(5, potY + 10);
  ctx.lineTo(-5, potY + 10);
  ctx.closePath();
  ctx.fill();

  // Borda superior do vaso
  ctx.fillStyle = '#c2410c';
  ctx.beginPath();
  ctx.roundRect(-8, potY, 16, 3, 1.5);
  ctx.fill();

  // Tentar renderizar miniatura da foto cadastrada ou planta ilustrada viçosa
  const plantImg = getPlantImage(mission.plant.photoUrl);
  if (plantImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, potY - 5, 7.5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(plantImg, -7.5, potY - 12.5, 15, 15);
    ctx.restore();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    // Planta vetorial vibrante com folhas e flores
    drawLushVectorPlant(ctx, 0, potY, mission.plant.name);
  }

  // Mãos de Bernardo segurando as bordas do vaso
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(-7, potY + 3, 2.2, 0, Math.PI * 2);
  ctx.arc(7, potY + 3, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Desenha folhagens exuberantes na planta carregada
 */
function drawLushVectorPlant(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  plantName: string
): void {
  ctx.save();
  ctx.fillStyle = '#22c55e';

  // Folha central
  ctx.beginPath();
  ctx.ellipse(cx, cy - 6, 3.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Folha esquerda
  ctx.fillStyle = '#16a34a';
  ctx.beginPath();
  ctx.ellipse(cx - 5, cy - 3, 3, 6, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // Folha direita
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.ellipse(cx + 5, cy - 3, 3, 6, 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Flor se for orquídea ou suculenta
  if (plantName.toLowerCase().includes('orquídea') || plantName.toLowerCase().includes('flor')) {
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(cx, cy - 9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(cx, cy - 9, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Crachá indicador minimalista no topo de Bernardo
 */
function drawBernardoStatusBadge(
  ctx: CanvasRenderingContext2D,
  carryingPlant: boolean,
  mission: DeliveryMission | null
): void {
  ctx.save();
  const badgeY = -48;

  if (carryingPlant && mission) {
    // Indicador da planta sendo levada
    const text = `🌿 ${mission.plant.name.split(' ')[0]}`;
    ctx.font = 'bold 9.5px sans-serif';
    const textW = ctx.measureText(text).width + 12;

    ctx.fillStyle = 'rgba(6, 95, 70, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-textW / 2, badgeY, textW, 16, 8);
    ctx.fill();

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, badgeY + 8);
  } else {
    // Crachá de Bernardo
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, badgeY + 4, 48, 14, 7);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Bernardo', 0, badgeY + 11);
  }

  ctx.restore();
}

/**
 * Renderiza o Cliente NPC na porta da residência aguardando a entrega
 */
export function drawIllustratedCustomer(
  ctx: CanvasRenderingContext2D,
  mission: DeliveryMission,
  time: number
): void {
  const { mapX, mapY } = mission.destination;
  const { id, name } = mission.customer;

  ctx.save();
  ctx.translate(mapX, mapY);

  // 1. Sombra no solo
  ctx.fillStyle = 'rgba(15, 23, 42, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 13, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Animação de aceno suave com a mão
  const wave = Math.sin(time / 280) * 0.25;

  // 3. Renderização conforme a identidade do cliente
  if (id === 'cust_dona_maria' || id === 'dest_vovo') {
    drawCustomerDonaMaria(ctx, wave);
  } else if (id === 'cust_seu_joao' || id === 'dest_amigo') {
    drawCustomerSeuJoao(ctx, wave);
  } else {
    drawCustomerAna(ctx, wave);
  }

  // 4. Balão de diálogo acolhedor sobre a cabeça do cliente
  drawCustomerSpeechBubble(ctx, name, mission.state);

  ctx.restore();
}

/**
 * Dona Maria: Idosa de Olinda com coque prateado, vestido floral e xale
 */
function drawCustomerDonaMaria(ctx: CanvasRenderingContext2D, wave: number): void {
  // Vestido colonial azul piscina com renda
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.lineTo(9, -8);
  ctx.lineTo(12, 3);
  ctx.lineTo(-12, 3);
  ctx.closePath();
  ctx.fill();

  // Xale rosa coral
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  ctx.bezierCurveTo(-12, -14, -8, -6, 0, -6);
  ctx.bezierCurveTo(8, -6, 12, -14, 10, -22);
  ctx.closePath();
  ctx.fill();

  // Cabeça
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();

  // Cabelo prateado com coque clássico
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(0, -32, 5, 0, Math.PI * 2); // Coque
  ctx.arc(0, -28, 8.5, Math.PI, 0); // Franja
  ctx.fill();

  // Óculos de grau
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-3, -26, 2.3, 0, Math.PI * 2);
  ctx.arc(3, -26, 2.3, 0, Math.PI * 2);
  ctx.stroke();

  // Braço acenando alegremente
  ctx.save();
  ctx.translate(9, -18);
  ctx.rotate(-0.8 + wave);
  ctx.fillStyle = '#fb7185';
  ctx.fillRect(0, -2, 10, 4);
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(10, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Seu João: Jardineiro com chapéu de palha e camisa xadrez
 */
function drawCustomerSeuJoao(ctx: CanvasRenderingContext2D, wave: number): void {
  // Calça caqui
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-7, -4, 5, 7);
  ctx.fillRect(2, -4, 5, 7);

  // Camisa xadrez azul com suspensórios
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(-9, -22, 18, 18, 3);
  ctx.fill();

  // Cabeça e bigode simpático
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();

  // Bigode branco
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.ellipse(0, -23, 4, 1.8, 0, 0, Math.PI);
  ctx.fill();

  // Chapéu de palha de Olinda
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.ellipse(0, -31, 13, 4, 0, 0, Math.PI * 2); // Aba larga
  ctx.fill();
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.roundRect(-6, -37, 12, 7, 2); // Copa
  ctx.fill();

  // Fita vermelha do chapéu
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-6, -32, 12, 2);

  // Braço acenando
  ctx.save();
  ctx.translate(9, -18);
  ctx.rotate(-0.7 + wave);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, -2, 10, 4);
  ctx.fillStyle = '#fdba74';
  ctx.beginPath();
  ctx.arc(10, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Ana: Arquiteta jovem com rabo de cavalo e prancheta
 */
function drawCustomerAna(ctx: CanvasRenderingContext2D, wave: number): void {
  // Calça e sapatilha
  ctx.fillStyle = '#334155';
  ctx.fillRect(-6, -5, 4, 8);
  ctx.fillRect(2, -5, 4, 8);

  // Blusa elegante terracota
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.roundRect(-8, -22, 16, 17, 3);
  ctx.fill();

  // Cabeça
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, -26, 8, 0, Math.PI * 2);
  ctx.fill();

  // Cabelo castanho com rabo de cavalo
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(0, -28, 8.5, Math.PI * 0.9, 0);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-9, -24, 3, 7, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Óculos modernos
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-6, -28, 5, 4);
  ctx.strokeRect(1, -28, 5, 4);

  // Braço acenando
  ctx.save();
  ctx.translate(8, -18);
  ctx.rotate(-0.8 + wave);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(0, -2, 9, 3.5);
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(9, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Balão de fala alegre sobre o cliente
 */
function drawCustomerSpeechBubble(
  ctx: CanvasRenderingContext2D,
  customerName: string,
  state: string
): void {
  ctx.save();
  const text =
    state === 'PLANTA_RETIRADA' || state === 'PRONTO_PARA_ENTREGA'
      ? `Olá Bernardo! Minha planta? 🌿`
      : `${customerName.split(' ')[0]} aguardando`;

  ctx.font = 'bold 9.5px sans-serif';
  const textW = ctx.measureText(text).width + 14;
  const bubbleY = -48;

  // Caixa do balão
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-textW / 2, bubbleY, textW, 17, 6);
  ctx.fill();
  ctx.stroke();

  // Triângulo apontando para o cliente
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-3, bubbleY + 16.5);
  ctx.lineTo(0, bubbleY + 21);
  ctx.lineTo(3, bubbleY + 16.5);
  ctx.fill();

  // Texto
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, bubbleY + 8.5);

  ctx.restore();
}
