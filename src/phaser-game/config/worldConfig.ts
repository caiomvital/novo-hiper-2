import { WORLD_MAP } from './worldMap';

/** Dimensões, spawn, entrada e cliente vêm de WORLD_MAP (única fonte). Aqui só a velocidade do jogador. */
export const WORLD = {
  width: WORLD_MAP.width,
  height: WORLD_MAP.height,
  playerSpeed: 220,
  defaultSpawn: WORLD_MAP.spawn,
} as const;

export const ENTRANCE_ZONE = WORLD_MAP.entrance;

/**
 * Cliente PROVISÓRIO do vertical slice: um ponto fixo no mapa que representa o cliente do pedido ativo
 * (qualquer pedido é entregue aqui, por enquanto). `interactRadius` = distância máxima para entregar.
 */
export const CUSTOMER_SPOT = WORLD_MAP.customer;
