// Renderizador 2D ilustrado de arquitetura colonial de Olinda:
// Fachadas ricas em detalhes (beirais de telhas coloniais, portas em arco,
// venezianas entalhadas, toldos listrados, vitrines e alvenaria texturizada).

import { MapBuilding } from './types';
import { Plant } from '../types';

/**
 * Renderiza qualquer edifício do mapa de acordo com o seu tipo arquitetônico
 */
export function drawIllustratedBuilding(
  ctx: CanvasRenderingContext2D,
  bld: MapBuilding,
  time: number,
  plants?: Plant[],
  upgrades?: { hasCamera: boolean; hasFan: boolean }
): void {
  ctx.save();

  // 1. Sombra de projeção no solo
  drawBuildingGroundShadow(ctx, bld.x, bld.y, bld.width, bld.height);

  // 2. Despacho conforme a tipologia
  switch (bld.type) {
    case 'shop_novo_hiper':
      drawNovoHiperShop(ctx, bld, time, plants, upgrades);
      break;
    case 'house_dona_maria':
      drawDonaMariaHouse(ctx, bld);
      break;
    case 'house_seu_joao':
      drawSeuJoaoHouse(ctx, bld);
      break;
    case 'house_ana':
      drawAnaSobrado(ctx, bld);
      break;
    case 'coreto_carmo':
      drawCarmoCoreto(ctx, bld, time);
      break;
    default:
      drawStandardColonialHouse(ctx, bld);
      break;
  }

  ctx.restore();
}

/**
 * Sombra de contato e projeção no solo
 */
function drawBuildingGroundShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
  ctx.beginPath();
  ctx.roundRect(x - 6, y + h - 8, w + 12, 18, 6);
  ctx.fill();
  ctx.restore();
}

/**
 * 1. Loja Novo Hiper: Viveiro Botânico de Olinda com interior visível,
 * mesa e cadeira de atendimento, balcão de mudas reativo e miniaturas de itens comprados
 */
function drawNovoHiperShop(
  ctx: CanvasRenderingContext2D, 
  bld: MapBuilding, 
  time: number,
  plants?: Plant[],
  upgrades?: { hasCamera: boolean; hasFan: boolean }
): void {
  const { x, y, width: w, height: h } = bld;
  const hasCamera = !!upgrades?.hasCamera;
  const hasFan = !!upgrades?.hasFan;
  const plantList = plants || [];

  // 1. Deck e Calçada de madeira frontal acolhedora
  const deckX = x + 25;
  const deckY = y + h - 22;
  const deckW = w - 50;
  const deckH = 38;

  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.roundRect(deckX, deckY, deckW, deckH, 6);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Ripas de madeira do deck
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1;
  for (let dx = deckX + 16; dx < deckX + deckW; dx += 18) {
    ctx.beginPath();
    ctx.moveTo(dx, deckY);
    ctx.lineTo(dx, deckY + deckH);
    ctx.stroke();
  }

  // 2. Alvenaria da Loja (Verde esmeralda colonial)
  const wallGrad = ctx.createLinearGradient(x, y + 42, x, y + h);
  wallGrad.addColorStop(0, '#065f46');
  wallGrad.addColorStop(1, '#064e3b');

  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.roundRect(x, y + 42, w, h - 42, [0, 0, 6, 6]);
  ctx.fill();

  // Rodapé de granito colonial
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x, y + h - 8, w, 8);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y + h - 8, w, 8);

  // Pilastras coloniais amarelas com friso
  drawColonialPilaster(ctx, x + 4, y + 42, 14, h - 42, '#fef08a');
  drawColonialPilaster(ctx, x + w - 18, y + 42, 14, h - 42, '#fef08a');

  // 3. Área interna / Salão de Atendimento Visível (Open-front Viveiro)
  const shopInnerX = x + 24;
  const shopInnerY = y + 74;
  const shopInnerW = w - 48;
  const shopInnerH = h - 94;

  // Parede de fundo do salão (verde sálvia suave)
  ctx.fillStyle = '#042f2e';
  ctx.beginPath();
  ctx.roundRect(shopInnerX, shopInnerY, shopInnerW, shopInnerH, 4);
  ctx.fill();

  // Piso interno aconchegante de tábuas de madeira corrida polida
  const floorY = shopInnerY + shopInnerH - 46;
  const floorH = 46;
  ctx.fillStyle = '#d97706';
  ctx.fillRect(shopInnerX, floorY, shopInnerW, floorH);
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1;
  for (let px = shopInnerX + 22; px < shopInnerX + shopInnerW; px += 22) {
    ctx.beginPath();
    ctx.moveTo(px, floorY);
    ctx.lineTo(px, floorY + floorH);
    ctx.stroke();
  }

  // Tapetinho colonial de boas-vindas na entrada
  ctx.fillStyle = '#065f46';
  ctx.beginPath();
  ctx.roundRect(x + w / 2 - 28, floorY + floorH - 14, 56, 12, 3);
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ==========================================
  // 4. MESA E CADEIRA DE ATENDIMENTO (Inicial)
  // ==========================================
  // Posição da mesa no salão esquerdo
  const deskX = shopInnerX + 22;
  const deskY = floorY + 10;
  const deskW = 68;
  const deskH = 26;

  // CADEIRA DE ATENDIMENTO (Atrás da mesa)
  const chairX = deskX + deskW / 2 - 12;
  const chairY = deskY - 14;
  // Encosto da cadeira de madeira
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.roundRect(chairX, chairY, 24, 18, [5, 5, 1, 1]);
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Almofada do assento
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(chairX + 2, chairY + 12, 20, 6, 2);
  ctx.fill();
  // Fitas verticais entalhadas do encosto
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(chairX + 8, chairY + 3);
  ctx.lineTo(chairX + 8, chairY + 11);
  ctx.moveTo(chairX + 16, chairY + 3);
  ctx.lineTo(chairX + 16, chairY + 11);
  ctx.stroke();

  // MESA DE MADEIRA MACIÇA (Atendimento)
  // Sombra da mesa
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(deskX + deskW / 2, deskY + deskH + 2, deskW / 2 + 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pés torneados da mesa
  ctx.fillStyle = '#451a03';
  ctx.fillRect(deskX + 4, deskY + 10, 5, deskH - 8);
  ctx.fillRect(deskX + deskW - 9, deskY + 10, 5, deskH - 8);

  // Corpo / Gaveteiro da mesa
  ctx.fillStyle = '#78350f';
  ctx.beginPath();
  ctx.roundRect(deskX, deskY, deskW, 14, 3);
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Puxador da gaveta de latão
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(deskX + deskW / 2, deskY + 7, 2, 0, Math.PI * 2);
  ctx.fill();

  // Itens sobre a mesa (Prancheta de Pedidos & Carimbo)
  // Prancheta de papel
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(deskX + 8, deskY - 3, 14, 11);
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1;
  ctx.strokeRect(deskX + 8, deskY - 3, 14, 11);
  // Clipe dourado
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(deskX + 12, deskY - 5, 6, 3);
  // Carimbo do viveiro
  ctx.fillStyle = '#059669';
  ctx.fillRect(deskX + deskW - 16, deskY - 2, 7, 8);
  ctx.fillStyle = '#451a03';
  ctx.beginPath();
  ctx.arc(deskX + deskW - 12.5, deskY - 4, 3, 0, Math.PI * 2);
  ctx.fill();

  // ==========================================
  // 5. BALCÃO DE PLANTAS (Vazio inicialmente, ganha plantas ao adicionar)
  // ==========================================
  const counterX = shopInnerX + 110;
  const counterY = floorY + 4;
  const counterW = shopInnerW - 130;
  const counterH = 32;

  // Sombra do balcão
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(counterX + counterW / 2, counterY + counterH + 2, counterW / 2 + 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Estrutura do balcão de madeira nobre
  ctx.fillStyle = '#92400e';
  ctx.beginPath();
  ctx.roundRect(counterX, counterY, counterW, counterH, 4);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tampo superior do balcão de exposição
  ctx.fillStyle = '#b45309';
  ctx.fillRect(counterX - 2, counterY, counterW + 4, 8);
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1;
  ctx.strokeRect(counterX - 2, counterY, counterW + 4, 8);

  // Se NÃO houver plantas adicionadas: o balcão permanece vazio e limpo!
  if (plantList.length === 0) {
    ctx.fillStyle = 'rgba(254, 243, 199, 0.4)';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Balcão de Mudas (Aguardando Plantas)', counterX + counterW / 2, counterY + 20);
  } else {
    // Se o usuário adicionou plantas: renderiza os vasos e as plantas no balcão!
    const slots = Math.min(6, plantList.length);
    const spacing = counterW / (slots + 1);

    for (let i = 0; i < slots; i++) {
      const plant = plantList[i];
      const potX = counterX + spacing * (i + 1);
      const potY = counterY + 2;
      drawCounterPlantPot(ctx, potX, potY, plant, i, time);
    }
  }

  // ==========================================
  // 6. MINIATURA: VENTILADOR (Se comprado)
  // ==========================================
  if (hasFan) {
    const fanX = deskX + deskW + 16;
    const fanY = floorY + 12;

    // Sombra do ventilador no chão
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(fanX, fanY + 16, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Haste e base do ventilador
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(fanX, fanY + 15, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(fanX - 1.5, fanY - 4, 3, 20);

    // Carcaça circular do ventilador
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(fanX, fanY - 6, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Hélice girando em alta rotação (animada pelo time)
    ctx.translate(fanX, fanY - 6);
    ctx.rotate(time * 0.022);
    for (let b = 0; b < 3; b++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.ellipse(0, -5.5, 3.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Miolo do ventilador
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Ondinhas de brisa suave soprando
    const windWave = Math.sin(time / 150) * 3;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(fanX + 16 + windWave, fanY - 7, 7, -0.6, 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(fanX + 22 + windWave, fanY - 5, 9, -0.5, 0.5);
    ctx.stroke();
  }

  // ==========================================
  // 7. MINIATURA: CÂMERA DE MONITORAMENTO (Se comprada)
  // ==========================================
  if (hasCamera) {
    const camX = shopInnerX + shopInnerW - 18;
    const camY = shopInnerY + 16;

    // Suporte articulado fixado na parede
    ctx.fillStyle = '#334155';
    ctx.fillRect(camX + 6, camY - 4, 6, 12);

    // Braço angular
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(camX + 6, camY + 2);
    ctx.lineTo(camX - 2, camY + 6);
    ctx.stroke();

    // Corpo da câmera de vigilância
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(camX - 10, camY + 3, 14, 9, 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Lente escura direcionada ao balcão
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(camX - 10, camY + 7.5, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // LED de gravação piscando em vermelho ritmado
    const ledOn = Math.sin(time / 200) > 0;
    ctx.fillStyle = ledOn ? '#ef4444' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(camX + 1, camY + 5, 2, 0, Math.PI * 2);
    ctx.fill();

    // Pequeno cone de visão translúcido
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.beginPath();
    ctx.moveTo(camX - 12, camY + 7.5);
    ctx.lineTo(camX - 60, camY + 65);
    ctx.lineTo(camX - 25, camY + 75);
    ctx.closePath();
    ctx.fill();
  }

  // ==========================================
  // 8. Toldo Listrado e Letreiro Iluminado
  // ==========================================
  // Toldo Listrado Verde e Branco sobre a entrada
  drawStripedAwning(ctx, x + 15, y + 48, w - 30, 26, '#047857', '#ffffff');

  // Letreiro iluminado do "NOVO HIPER"
  drawShopSignboard(ctx, x + w / 2, y + 36, '🌿 NOVO HIPER • VIVEIRO', '#065f46', '#fef08a');

  // Telhado Colonial de Telhas de Barro
  drawColonialTileRoof(ctx, x - 8, y, w + 16, 48, '#9a3412');
}

/**
 * Desenha um vaso com muda de planta no balcão da loja
 */
function drawCounterPlantPot(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  plant: Plant,
  index: number,
  time: number
): void {
  ctx.save();

  // Vaso de cerâmica artesanal
  const potWidth = 16;
  const potHeight = 13;
  const colors = ['#ea580c', '#c2410c', '#d97706', '#0284c7', '#059669'];
  const potColor = colors[index % colors.length];

  ctx.fillStyle = potColor;
  ctx.beginPath();
  ctx.moveTo(px - potWidth / 2, py);
  ctx.lineTo(px + potWidth / 2, py);
  ctx.lineTo(px + potWidth / 2 - 2, py + potHeight);
  ctx.lineTo(px - potWidth / 2 + 2, py + potHeight);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Borda superior do vaso
  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(px - potWidth / 2 - 1, py - 2, potWidth + 2, 3);

  // Folhagem viva da muda (animada suavemente)
  const sway = Math.sin(time / 400 + index) * 1.5;
  const leafGreen = (index % 2 === 0) ? '#10b981' : '#22c55e';
  const darkGreen = '#047857';

  // Dependendo do índice ou espécie, folhagens diferentes
  if (index % 3 === 0) {
    // Folhas largas tipo Costela de Adão / Filodendro
    ctx.fillStyle = leafGreen;
    ctx.beginPath();
    ctx.ellipse(px + sway, py - 9, 7, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.ellipse(px - 5 + sway, py - 6, 6, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (index % 3 === 1) {
    // Folhas pontiagudas tipo Espada de São Jorge
    ctx.fillStyle = darkGreen;
    ctx.beginPath();
    ctx.moveTo(px - 4, py);
    ctx.lineTo(px - 2 + sway, py - 15);
    ctx.lineTo(px, py);
    ctx.fill();
    ctx.fillStyle = leafGreen;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 2 + sway, py - 18);
    ctx.lineTo(px + 4, py);
    ctx.fill();
    // Borda amarela da espada
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    // Planta florida / Orquídea colonial
    ctx.fillStyle = leafGreen;
    ctx.beginPath();
    ctx.ellipse(px - 4 + sway, py - 5, 5, 7, -0.3, 0, Math.PI * 2);
    ctx.ellipse(px + 4 + sway, py - 5, 5, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Flor delicada no topo
    const flowerColors = ['#f43f5e', '#a855f7', '#fbbf24', '#f472b6'];
    ctx.fillStyle = flowerColors[index % flowerColors.length];
    ctx.beginPath();
    ctx.arc(px + sway, py - 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(px + sway, py - 11, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 2. Casa de Dona Maria: Ocre colonial com janelas azuis e floreiras
 */
function drawDonaMariaHouse(ctx: CanvasRenderingContext2D, bld: MapBuilding): void {
  const { x, y, width: w, height: h } = bld;

  // Alvenaria amarela ocre colonial
  const wallGrad = ctx.createLinearGradient(x, y + 42, x, y + h);
  wallGrad.addColorStop(0, '#f59e0b');
  wallGrad.addColorStop(1, '#d97706');

  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.roundRect(x, y + 42, w, h - 42, [0, 0, 4, 4]);
  ctx.fill();

  // Moldura e friso decorativo colonial no topo
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(x, y + 42, w, 5);

  // Pilastras brancas
  drawColonialPilaster(ctx, x + 2, y + 42, 10, h - 42, '#ffffff');
  drawColonialPilaster(ctx, x + w - 12, y + 42, 10, h - 42, '#ffffff');

  // Janelas coloniais com venezianas azuis e floreiras de begônias
  drawColonialWindowWithFlowers(ctx, x + 24, y + 70, 36, 52, '#0284c7', true);
  drawColonialWindowWithFlowers(ctx, x + w - 60, y + 70, 36, 52, '#0284c7', true);

  // Porta Central com bandeira de vidro em arco
  const doorX = x + w / 2 - 20;
  const doorY = y + 68;
  drawColonialArchedDoor(ctx, doorX, doorY, 40, h - 76, '#0369a1', '#ffffff');

  // Placa com o nome "Dona Maria"
  drawHouseNameplate(ctx, doorX + 20, doorY - 10, 'Casa de Dona Maria');

  // Telhado Colonial
  drawColonialTileRoof(ctx, x - 6, y, w + 12, 48, '#c2410c');
}

/**
 * 3. Casa de Seu João: Azul colonial de Olinda com molduras brancas
 */
function drawSeuJoaoHouse(ctx: CanvasRenderingContext2D, bld: MapBuilding): void {
  const { x, y, width: w, height: h } = bld;

  // Alvenaria Azul Colonial
  const wallGrad = ctx.createLinearGradient(x, y + 44, x, y + h);
  wallGrad.addColorStop(0, '#0284c7');
  wallGrad.addColorStop(1, '#0369a1');

  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.roundRect(x, y + 44, w, h - 44, [0, 0, 4, 4]);
  ctx.fill();

  // Moldura decorativa branca
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y + 44, w, 5);

  drawColonialPilaster(ctx, x + 2, y + 44, 10, h - 44, '#f8fafc');
  drawColonialPilaster(ctx, x + w - 12, y + 44, 10, h - 44, '#f8fafc');

  // Janelas com vidros quadriculados
  drawColonialWindowWithFlowers(ctx, x + 24, y + 72, 36, 54, '#ffffff', false);
  drawColonialWindowWithFlowers(ctx, x + w - 60, y + 72, 36, 54, '#ffffff', false);

  // Porta em arco
  const doorX = x + w / 2 - 20;
  const doorY = y + 70;
  drawColonialArchedDoor(ctx, doorX, doorY, 40, h - 78, '#78350f', '#fef08a');

  // Placa com o nome "Seu João"
  drawHouseNameplate(ctx, doorX + 20, doorY - 10, 'Casa de Seu João');

  // Telhado Colonial de barro
  drawColonialTileRoof(ctx, x - 6, y, w + 12, 48, '#b45309');
}

/**
 * 4. Sobrado de Ana: Dois pavimentos com sacada de ferro trabalhado
 */
function drawAnaSobrado(ctx: CanvasRenderingContext2D, bld: MapBuilding): void {
  const { x, y, width: w, height: h } = bld;

  // Alvenaria Terracota Colonial
  const wallGrad = ctx.createLinearGradient(x, y + 46, x, y + h);
  wallGrad.addColorStop(0, '#ea580c');
  wallGrad.addColorStop(1, '#c2410c');

  ctx.fillStyle = wallGrad;
  ctx.beginPath();
  ctx.roundRect(x, y + 46, w, h - 46, [0, 0, 4, 4]);
  ctx.fill();

  // Friso branco dividindo os dois andares
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y + 105, w, 6);

  // Janelas do pavimento superior
  drawSmallColonialWindow(ctx, x + 26, y + 60, 28, 38);
  drawSmallColonialWindow(ctx, x + w - 54, y + 60, 28, 38);

  // Porta-balcão central no pavimento superior com sacada de ferro
  const balcX = x + w / 2 - 24;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(balcX + 4, y + 56, 40, 44);

  // Gradil de ferro trabalhado da sacada
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(balcX, y + 84, 48, 20);
  for (let gx = balcX + 4; gx < balcX + 48; gx += 6) {
    ctx.beginPath();
    ctx.moveTo(gx, y + 84);
    ctx.lineTo(gx, y + 104);
    ctx.stroke();
  }

  // Pavimento inferior: Janela e Porta
  drawColonialWindowWithFlowers(ctx, x + 24, y + 118, 34, 46, '#ffffff', true);
  const doorX = x + w / 2 - 18;
  const doorY = y + 116;
  drawColonialArchedDoor(ctx, doorX, doorY, 36, h - 124, '#451a03', '#ffffff');

  // Placa "Residência de Ana"
  drawHouseNameplate(ctx, doorX + 18, doorY - 8, 'Residência de Ana');

  // Telhado Colonial de terracota escuro
  drawColonialTileRoof(ctx, x - 6, y, w + 12, 50, '#78350f');
}

/**
 * 5. Coreto Colonial de Olinda (Praça do Carmo)
 */
function drawCarmoCoreto(ctx: CanvasRenderingContext2D, bld: MapBuilding, time: number): void {
  const { x, y, width: w, height: h } = bld;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Base octogonal de pedra de cantaria
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.ellipse(cx, y + h - 12, w * 0.46, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Piso do coreto (Mosaico de pedras portuguesas)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(cx, y + h - 20, w * 0.42, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Colunas de ferro fundido verde esmeralda sustentando a cúpula
  const colPositions = [
    { x: cx - 34, y: y + h - 35 },
    { x: cx - 18, y: y + h - 45 },
    { x: cx + 18, y: y + h - 45 },
    { x: cx + 34, y: y + h - 35 },
  ];

  ctx.strokeStyle = '#065f46';
  ctx.lineWidth = 3.5;
  colPositions.forEach((col) => {
    ctx.beginPath();
    ctx.moveTo(col.x, col.y);
    ctx.lineTo(col.x, y + 28);
    ctx.stroke();
  });

  // Gradil rendilhado de ferro entre as colunas
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(cx - 36, y + h - 38, 72, 16);

  // Cúpula colonial do Coreto (verde com pináculo dourado)
  const cupolaGrad = ctx.createLinearGradient(cx - 42, y, cx + 42, y + 30);
  cupolaGrad.addColorStop(0, '#059669');
  cupolaGrad.addColorStop(0.5, '#047857');
  cupolaGrad.addColorStop(1, '#064e3b');

  ctx.fillStyle = cupolaGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 48, y + 30);
  ctx.quadraticCurveTo(cx, y - 8, cx + 48, y + 30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#022c22';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pináculo e sino dourado no topo
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(cx, y - 9, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 1, y - 18, 2, 9);
}

/**
 * Modelo padrão de casa colonial de Olinda
 */
function drawStandardColonialHouse(ctx: CanvasRenderingContext2D, bld: MapBuilding): void {
  const { x, y, width: w, height: h, wallColor, roofColor } = bld;

  ctx.fillStyle = wallColor;
  ctx.beginPath();
  ctx.roundRect(x, y + 40, w, h - 40, [0, 0, 4, 4]);
  ctx.fill();

  drawColonialTileRoof(ctx, x - 6, y, w + 12, 46, roofColor);
}

// ----------------------------------------------------
// SUB-COMPONENTES E DETALHES ARQUITETÔNICOS
// ----------------------------------------------------

/**
 * Telhado de telhas coloniais de barro (formato trapezoidal com sulcos de telha canal)
 */
function drawColonialTileRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.save();

  // Forma básica do telhado chanfrado
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 16, y);
  ctx.lineTo(x + w - 16, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();

  // Beiral de telhas com sombra
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(x, y + h - 4, w, 4);

  // Linhas das telhas coloniais (calhas e bicas)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  const tileCount = Math.floor(w / 14);
  for (let i = 1; i < tileCount; i++) {
    const topX = x + 16 + (i * (w - 32)) / tileCount;
    const botX = x + (i * w) / tileCount;
    ctx.beginPath();
    ctx.moveTo(topX, y + 2);
    ctx.lineTo(botX, y + h - 3);
    ctx.stroke();
  }

  // Cumeeira superior iluminada
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + 1);
  ctx.lineTo(x + w - 16, y + 1);
  ctx.stroke();

  ctx.restore();
}

/**
 * Porta colonial em arco com guarnição e almofadas
 */
function drawColonialArchedDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  woodColor: string,
  trimColor: string
): void {
  ctx.save();

  // Guarnição em arco de pedra
  ctx.fillStyle = trimColor;
  ctx.beginPath();
  ctx.roundRect(x - 3, y - 3, w + 6, h + 3, [w / 2 + 3, w / 2 + 3, 0, 0]);
  ctx.fill();

  // Folha da porta de madeira
  ctx.fillStyle = woodColor;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [w / 2, w / 2, 0, 0]);
  ctx.fill();

  // Almofadas da porta entalhada
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 4, y + 26, w - 8, h - 32);

  // Bandeira superior com gradil colonial
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + w / 2 - 2, w / 2 - 4, Math.PI, 0);
  ctx.fill();

  // Maçaneta e aldrava dourada
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(x + w - 8, y + h / 2 + 6, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Janela colonial com venezianas e floreira de begônias
 */
function drawColonialWindowWithFlowers(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frameColor: string,
  hasFlowers: boolean
): void {
  ctx.save();

  // Moldura de cantaria
  ctx.fillStyle = frameColor;
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 3);
  ctx.fill();

  // Vidro escuro interno
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);

  // Venezianas de madeira
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();

  // Floreira na soleira
  if (hasFlowers) {
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.roundRect(x - 3, y + h - 6, w + 6, 10, 2);
    ctx.fill();

    // Flores tropicais coloridas
    const colors = ['#f43f5e', '#fbbf24', '#a855f7', '#38bdf8'];
    for (let fx = x; fx <= x + w; fx += 7) {
      ctx.fillStyle = colors[(fx % 4)];
      ctx.beginPath();
      ctx.arc(fx, y + h - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Janela colonial simples
 */
function drawSmallColonialWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  ctx.restore();
}

/**
 * Vitrine de vidro da Loja com vasos de plantas no expositor interno
 */
function drawShopShowcase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  ctx.save();

  // Moldura dourada da vitrine
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 3);
  ctx.fill();

  // Vidro iluminado da vitrine
  const glassGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  glassGrad.addColorStop(0, '#064e3b');
  glassGrad.addColorStop(1, '#022c22');

  ctx.fillStyle = glassGrad;
  ctx.fillRect(x, y, w, h);

  // Prateleira interna com mini-vasinhos
  ctx.fillStyle = '#d97706';
  ctx.fillRect(x + 3, y + h - 14, w - 6, 3);

  // 3 Vasinhos decorativos na vitrine
  for (let i = 0; i < 3; i++) {
    const vx = x + 10 + i * 16;
    const vy = y + h - 14;

    // Vaso
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(vx - 4, vy);
    ctx.lineTo(vx + 4, vy);
    ctx.lineTo(vx + 3, vy - 6);
    ctx.lineTo(vx - 3, vy - 6);
    ctx.closePath();
    ctx.fill();

    // Folhinha verde
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(vx, vy - 9, 2.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Reflexo de luz diagonal no vidro
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h - 6);
  ctx.lineTo(x + w - 6, y + 6);
  ctx.stroke();

  ctx.restore();
}

/**
 * Toldo listrado colonial (Verde & Branco)
 */
function drawStripedAwning(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color1: string,
  color2: string
): void {
  ctx.save();
  const stripes = 12;
  const stripeW = w / stripes;

  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? color1 : color2;
    const sx = x + i * stripeW;

    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + stripeW, y);
    ctx.lineTo(sx + stripeW - 2, y + h);
    ctx.lineTo(sx - 2, y + h);
    ctx.closePath();
    ctx.fill();

    // Franja arredondada na ponta
    ctx.beginPath();
    ctx.arc(sx + stripeW / 2 - 1, y + h, stripeW / 2, 0, Math.PI);
    ctx.fill();
  }

  // Sombra suave sob o toldo
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(x - 2, y + h + 2, w, 4);

  ctx.restore();
}

/**
 * Letreiro da Loja Novo Hiper
 */
function drawShopSignboard(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  bgColor: string,
  textColor: string
): void {
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  const textW = ctx.measureText(text).width + 20;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(cx - textW / 2, cy - 10, textW, 20, 6);
  ctx.fill();

  ctx.strokeStyle = textColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);

  ctx.restore();
}

/**
 * Placa com o nome da casa
 */
function drawHouseNameplate(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string
): void {
  ctx.save();
  ctx.font = 'bold 8.5px sans-serif';
  const textW = ctx.measureText(text).width + 12;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(cx - textW / 2, cy - 7, textW, 14, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);

  ctx.restore();
}

/**
 * Pilastra de sustentação colonial
 */
function drawColonialPilaster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);

  // Linhas verticais esculpidas
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
