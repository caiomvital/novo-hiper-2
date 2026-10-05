// Orquestrador da cena 2D ilustrada de Olinda:
// Renderização em camadas rigorosas com ordenação Y-Sort,
// visão panorâmica mais distante (zoom out), relevo costeiro, ruas coloniais ampliadas e efeitos visuais.

import { PlayerState, DeliveryMission, GameParticle } from './types';
import { Plant } from '../types';
import { 
  MAP_WIDTH, 
  MAP_HEIGHT, 
  MAP_BUILDINGS, 
  MAP_DECORATIONS, 
  NOVO_HIPER_SHOP 
} from './mapData';
import { 
  drawIllustratedCobblestoneRoad, 
  drawIllustratedPortuguesePavement, 
  drawIllustratedPalm, 
  drawIllustratedIpe, 
  drawIllustratedStreetlamp, 
  drawIllustratedBench, 
  drawIllustratedFlowerbed,
  drawIllustratedPlantPot
} from './natureRenderer';
import { drawIllustratedBuilding } from './architectureRenderer';
import { drawIllustratedBernardo, drawIllustratedCustomer } from './spriteRenderer';

export function renderGame(
  ctx: CanvasRenderingContext2D,
  viewWidth: number,
  viewHeight: number,
  player: PlayerState,
  mission: DeliveryMission | null,
  particles: GameParticle[],
  time: number,
  plants?: Plant[],
  upgrades?: { hasCamera: boolean; hasFan: boolean }
): void {
  // 1. Limpar tela
  ctx.clearRect(0, 0, viewWidth, viewHeight);

  // 2. Câmera com Visão Mais Distante (Zoom Panorâmico de 0.78x para enxergar mais do cenário)
  const CAMERA_ZOOM = 0.78;
  const effectiveViewWidth = viewWidth / CAMERA_ZOOM;
  const effectiveViewHeight = viewHeight / CAMERA_ZOOM;

  const cameraX = Math.max(0, Math.min(MAP_WIDTH - effectiveViewWidth, player.x - effectiveViewWidth / 2));
  const cameraY = Math.max(0, Math.min(MAP_HEIGHT - effectiveViewHeight, player.y - effectiveViewHeight / 2));

  ctx.save();
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-cameraX, -cameraY);

  // 3. Camada 1: Relevo e Costa de Olinda (Oceano, Praia, Gramados Amplos)
  drawOlindaTerrain(ctx, time);

  // 4. Camada 2: Ruas e Calçadas Urbanas com mais espaço de locomoção
  drawOlindaRoadsAndPavements(ctx);

  // 5. Camada 3: Guia Luminoso e Zonas de Interação
  if (mission) {
    drawMissionRouteGuide(ctx, player, mission, time);
  }
  drawInteractionMarkers(ctx, mission, time);

  // 6. Camada 4: Entidades com Ordenação de Profundidade Tridimensional (Y-Sort)
  drawYSortedWorld(ctx, player, mission, time, plants, upgrades);

  // 7. Camada 5: Partículas Ilustradas (folhas, brilhos, poeira de passos)
  drawGameParticles(ctx, particles);

  ctx.restore();
}

/**
 * Relevo costeiro de Olinda no mapa ampliado (1360 x 960)
 */
function drawOlindaTerrain(ctx: CanvasRenderingContext2D, time: number): void {
  // Fundo geral do terreno de Olinda (verde grama acolhedor)
  ctx.fillStyle = '#f0fdf4';
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // Gramado central espaçoso da Praça do Carmo
  ctx.fillStyle = '#dcfce7';
  ctx.beginPath();
  ctx.roundRect(470, 160, 420, 640, 32);
  ctx.fill();

  // Oceano Atlântico no canto superior direito (orla marítima de Olinda)
  ctx.save();
  const seaGrad = ctx.createLinearGradient(1120, 0, MAP_WIDTH, 180);
  seaGrad.addColorStop(0, '#38bdf8'); // Turquesa
  seaGrad.addColorStop(0.5, '#0284c7'); // Azul cobalto
  seaGrad.addColorStop(1, '#0369a1'); // Azul mar

  ctx.beginPath();
  ctx.moveTo(1120, 0);
  ctx.bezierCurveTo(1190, 50, 1270, 100, MAP_WIDTH, 140);
  ctx.lineTo(MAP_WIDTH, 0);
  ctx.closePath();
  ctx.fillStyle = seaGrad;
  ctx.fill();

  // Faixa de areia dourada da praia
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(1115, 0);
  ctx.bezierCurveTo(1185, 50, 1265, 100, MAP_WIDTH, 138);
  ctx.stroke();

  // Arrebentação das ondas animadas
  const waveAnim = Math.sin(time / 500) * 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1120 + waveAnim, 0);
  ctx.bezierCurveTo(1190 + waveAnim, 52, 1270 + waveAnim, 102, MAP_WIDTH, 142);
  ctx.stroke();

  ctx.restore();
}

/**
 * Ruas de paralelepípedos e calçadas coloniais ampliadas
 */
function drawOlindaRoadsAndPavements(ctx: CanvasRenderingContext2D): void {
  // 1. Rua Principal Horizontal Ampla (Leste a Oeste)
  drawIllustratedCobblestoneRoad(ctx, 40, 480, MAP_WIDTH - 80, 120, false);

  // 2. Ruas Verticais de ligação largas
  // Rua Oeste (em frente à Loja Novo Hiper e Sobrado de Ana)
  drawIllustratedCobblestoneRoad(ctx, 395, 40, 115, 880, true);

  // Rua Leste (em frente à Casa de Dona Maria e Casa de Seu João)
  drawIllustratedCobblestoneRoad(ctx, 845, 40, 115, 880, true);

  // 3. Calçadas de Cantaria em frente aos edifícios
  // Calçada da Loja Novo Hiper
  drawColonialSidewalk(ctx, 75, 275, 330, 36);
  // Calçada de Dona Maria
  drawColonialSidewalk(ctx, 955, 275, 300, 36);
  // Calçada de Ana
  drawColonialSidewalk(ctx, 75, 615, 320, 36);
  // Calçada de Seu João
  drawColonialSidewalk(ctx, 955, 615, 300, 36);

  // 4. Mosaico de Pedras Portuguesas no pátio central da Praça do Carmo
  drawIllustratedPortuguesePavement(ctx, 520, 320, 320, 270);

  // Calçada de contorno da praça
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(505, 250, 350, 410);
}

function drawColonialSidewalk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x, y, w, h);

  // Placas de cantaria de pedra
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  for (let px = x + 26; px < x + w; px += 26) {
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px, y + h);
    ctx.stroke();
  }

  // Meio-fio de granito
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(x, y + h - 3, w, 3);
  ctx.restore();
}

/**
 * Guia de rota botânica animada indicando o caminho para o objetivo atual
 */
function drawMissionRouteGuide(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  mission: DeliveryMission,
  time: number
): void {
  let targetX = NOVO_HIPER_SHOP.pickupX;
  let targetY = NOVO_HIPER_SHOP.pickupY;

  if (
    mission.state === 'PLANTA_RETIRADA' ||
    mission.state === 'INDO_PARA_CLIENTE' ||
    mission.state === 'PRONTO_PARA_ENTREGA'
  ) {
    targetX = mission.destination.mapX;
    targetY = mission.destination.mapY;
  }

  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 50) {
    ctx.save();
    const steps = Math.min(12, Math.floor(dist / 55));
    const isPickup = mission.state === 'INDO_PARA_RETIRADA' || mission.state === 'AGUARDANDO_INICIO';

    for (let i = 1; i <= steps; i++) {
      const prog = i / (steps + 1);
      const px = player.x + dx * prog;
      const py = player.y + dy * prog;
      const pulse = Math.sin(time / 200 + i) * 2;

      ctx.beginPath();
      ctx.arc(px, py, 5 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = isPickup ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.4)';
      ctx.fill();

      // Broto central
      ctx.beginPath();
      ctx.arc(px, py, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = isPickup ? '#10b981' : '#f59e0b';
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * Marcadores no solo para zonas ativas de interação
 */
function drawInteractionMarkers(
  ctx: CanvasRenderingContext2D,
  mission: DeliveryMission | null,
  time: number
): void {
  ctx.save();

  // 1. Balcão de Retirada da Loja Novo Hiper
  const isPickupActive =
    !mission ||
    mission.state === 'AGUARDANDO_INICIO' ||
    mission.state === 'INDO_PARA_RETIRADA';

  const pulseShop = Math.sin(time / 200) * 4;
  ctx.beginPath();
  ctx.arc(NOVO_HIPER_SHOP.pickupX, NOVO_HIPER_SHOP.pickupY, 32 + pulseShop, 0, Math.PI * 2);
  ctx.fillStyle = isPickupActive ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.08)';
  ctx.fill();
  ctx.strokeStyle = isPickupActive ? '#059669' : '#a7f3d0';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 2. Destino do Cliente
  if (
    mission &&
    (mission.state === 'PLANTA_RETIRADA' ||
      mission.state === 'INDO_PARA_CLIENTE' ||
      mission.state === 'PRONTO_PARA_ENTREGA')
  ) {
    const destX = mission.destination.mapX;
    const destY = mission.destination.mapY;
    const pulseDest = Math.sin(time / 180) * 5;

    ctx.beginPath();
    ctx.arc(destX, destY, 34 + pulseDest, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Ordenação por profundidade Y-Sort para todas as entidades
 */
function drawYSortedWorld(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  mission: DeliveryMission | null,
  time: number,
  plants?: Plant[],
  upgrades?: { hasCamera: boolean; hasFan: boolean }
): void {
  interface RenderItem {
    y: number;
    render: () => void;
  }

  const items: RenderItem[] = [];

  // 1. Edifícios (com interior da loja, balcão de plantas e itens de melhoria)
  MAP_BUILDINGS.forEach((bld) => {
    items.push({
      y: bld.y + bld.height,
      render: () => drawIllustratedBuilding(ctx, bld, time, plants, upgrades),
    });
  });

  // 2. Vegetação e Mobiliário Urbano (com transparência se Bernardo estiver atrás)
  MAP_DECORATIONS.forEach((decor) => {
    const isPlayerBehind =
      (decor.type === 'palm' || decor.type === 'ipe_yellow' || decor.type === 'ipe_pink') &&
      Math.abs(player.x - decor.x) < 40 &&
      player.y < decor.y &&
      player.y > decor.y - 75;

    items.push({
      y: decor.y,
      render: () => {
        if (isPlayerBehind) {
          ctx.save();
          ctx.globalAlpha = 0.55;
          renderDecor(ctx, decor, time);
          ctx.restore();
        } else {
          renderDecor(ctx, decor, time);
        }
      },
    });
  });

  // 3. Cliente NPC no destino
  if (mission) {
    items.push({
      y: mission.destination.mapY,
      render: () => drawIllustratedCustomer(ctx, mission, time),
    });
  }

  // 4. Protagonista Bernardo
  items.push({
    y: player.y,
    render: () => drawIllustratedBernardo(ctx, player, mission, time),
  });

  // Ordenação ascendente por Y (quem está mais ao sul desenha na frente)
  items.sort((a, b) => a.y - b.y);

  // Executar renderização
  items.forEach((item) => item.render());
}

function renderDecor(ctx: CanvasRenderingContext2D, decor: any, time: number): void {
  const { x, y, type, scale = 1 } = decor;

  if (type === 'palm') {
    drawIllustratedPalm(ctx, x, y, scale, time);
  } else if (type === 'ipe_yellow' || type === 'ipe_pink') {
    drawIllustratedIpe(ctx, x, y, type, scale, time);
  } else if (type === 'streetlamp') {
    drawIllustratedStreetlamp(ctx, x, y, time);
  } else if (type === 'bench') {
    drawIllustratedBench(ctx, x, y);
  } else if (type === 'flowerbed') {
    drawIllustratedFlowerbed(ctx, x, y, scale);
  } else if (type === 'plant_pot') {
    drawIllustratedPlantPot(ctx, x, y);
  }
}

/**
 * Desenha partículas no ar (folhas, estrelas e poeira)
 */
function drawGameParticles(ctx: CanvasRenderingContext2D, particles: GameParticle[]): void {
  ctx.save();
  particles.forEach((p) => {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;

    if (p.type === 'leaf') {
      ctx.fillStyle = '#22c55e';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.8, p.size * 1.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'heart') {
      ctx.fillStyle = '#ef4444';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      const s = p.size * 0.7;
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.2, s * 0.5, 0, s * 1.4);
      ctx.bezierCurveTo(s * 1.2, s * 0.5, s, -s * 0.5, 0, s * 0.3);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'sparkle') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.restore();
}
