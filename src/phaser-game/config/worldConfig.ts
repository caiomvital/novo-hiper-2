import { WORLD_MAP } from './worldMap';

/** Dimensões, spawn, entrada e ponto de entrega vêm de WORLD_MAP (única fonte). Aqui só a velocidade do jogador. */
export const WORLD = {
  width: WORLD_MAP.width,
  height: WORLD_MAP.height,
  playerSpeed: 220,
  defaultSpawn: WORLD_MAP.spawn,
} as const;

export const ENTRANCE_ZONE = WORLD_MAP.entrance;

/**
 * Ponto de entrega PROVISÓRIO (um só para todos os pedidos): a calçada em frente à porta da casa do cliente.
 * `interactRadius` = distância máxima para entregar.
 */
export const CUSTOMER_SPOT = WORLD_MAP.customer;
