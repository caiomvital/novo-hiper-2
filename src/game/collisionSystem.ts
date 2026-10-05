// Sistema de colisão física com suporte a deslizamento de paredes (wall-sliding)

import { CollisionBox } from './types';
import { MAP_STATIC_OBSTACLES, MAP_WIDTH, MAP_HEIGHT } from './mapData';

// Caixa de colisão dos pés de Bernardo (base física no solo)
const PLAYER_COLLIDER_HALF_W = 9;
const PLAYER_COLLIDER_H = 10;
const PLAYER_COLLIDER_OFFSET_Y = 2; // Centralizado no solo onde os pés tocam

/**
 * Verifica se uma caixa A intersecta com uma caixa B (AABB)
 */
export function checkAABBCollision(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Verifica se a posição proposta para o jogador colide com algum obstáculo estático ou limite do mapa.
 */
export function isPositionColliding(
  x: number,
  y: number,
  obstacles: CollisionBox[] = MAP_STATIC_OBSTACLES
): boolean {
  const pBoxX = x - PLAYER_COLLIDER_HALF_W;
  const pBoxY = y - PLAYER_COLLIDER_OFFSET_Y;
  const pBoxW = PLAYER_COLLIDER_HALF_W * 2;
  const pBoxH = PLAYER_COLLIDER_H;

  // 1. Limites externos do mapa
  if (
    pBoxX < 15 ||
    pBoxX + pBoxW > MAP_WIDTH - 15 ||
    pBoxY < 15 ||
    pBoxY + pBoxH > MAP_HEIGHT - 15
  ) {
    return true;
  }

  // 2. Obstáculos sólidos no cenário (edifícios, troncos de árvores, postes)
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (checkAABBCollision(pBoxX, pBoxY, pBoxW, pBoxH, obs.x, obs.y, obs.w, obs.h)) {
      return true;
    }
  }

  return false;
}

/**
 * Calcula a movimentação do jogador com deslizamento em paredes.
 * Permite que Bernardo continue se movendo suavemente ao longo de esquinas e paredes.
 */
export function moveWithCollisionSlide(
  currentX: number,
  currentY: number,
  dx: number,
  dy: number,
  obstacles: CollisionBox[] = MAP_STATIC_OBSTACLES
): { x: number; y: number } {
  if (dx === 0 && dy === 0) {
    return { x: currentX, y: currentY };
  }

  // Tentativa 1: Movimentação diagonal completa
  const targetX = currentX + dx;
  const targetY = currentY + dy;

  if (!isPositionColliding(targetX, targetY, obstacles)) {
    return { x: targetX, y: targetY };
  }

  // Tentativa 2: Deslizar apenas no eixo X
  if (dx !== 0 && !isPositionColliding(targetX, currentY, obstacles)) {
    return { x: targetX, y: currentY };
  }

  // Tentativa 3: Deslizar apenas no eixo Y
  if (dy !== 0 && !isPositionColliding(currentX, targetY, obstacles)) {
    return { x: currentX, y: targetY };
  }

  // Bloqueado em ambos os eixos
  return { x: currentX, y: currentY };
}
