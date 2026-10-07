import { WORLD_MAP } from './worldMap';
import type { Rect } from '../logic/worldGeometry';

/**
 * Posições (só dados) das melhorias decorativas da Novo Hiper, derivadas de WORLD_MAP.shop.
 * Nada disso vai para o banco e nada aqui tem colisão. Visual PROVISÓRIO (o Art Pass vem depois).
 */
const s = WORLD_MAP.shop.rect;
const doorX = WORLD_MAP.shop.door.x;
const frontY = s.y + s.h; // base da fachada

/** Duas jardineiras coladas à fachada, uma de cada lado da porta (fora dos vasinhos existentes). */
export const JARDINEIRAS_LAYOUT: Rect[] = [-1, 1].map((side) => ({ x: doorX + side * 168 - 34, y: frontY + 4, w: 68, h: 26 }));

/** Banco no gramado em frente, à direita da porta: não invade o corredor de entrada nem o ponto de instalação. */
export const BANCO_LAYOUT: Rect = { x: doorX + 76, y: frontY + 54, w: 72, h: 30 };

/** Corredor livre da porta até a calçada (nenhuma melhoria pode ocupá-lo). */
export const ENTRANCE_LANE: Rect = { x: doorX - 44, y: frontY, w: 88, h: 110 };
