export const WORLD = {
  width: 1600,
  height: 1200,
  playerSpeed: 220,
  defaultSpawn: { x: 200, y: 200 },
} as const;

export const ENTRANCE_ZONE = { x: 1300, y: 900, radius: 42 } as const;

/**
 * Cliente PROVISÓRIO do vertical slice: um ponto fixo no mapa que representa o cliente do pedido ativo
 * (qualquer pedido é entregue aqui, por enquanto). `interactRadius` = distância máxima para entregar.
 */
export const CUSTOMER_SPOT = { x: 1000, y: 520, interactRadius: 80 } as const;
