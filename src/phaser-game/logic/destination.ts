import { PIXELS_PER_METER } from '../config/worldMap';

/** Abaixo desta distância (px) o indicador mostra "Destino próximo" em vez da seta. */
export const NEAR_DESTINATION_PX = 240;

export interface DestinationIndicator {
  pixels: number;
  meters: number;
  /** Ângulo em radianos no sistema da tela (0 = leste, π/2 = sul). */
  angle: number;
  near: boolean;
}

/** Direção e distância reais de `from` até `to` (nenhuma rota: só a reta). */
export function destinationIndicator(from: { x: number; y: number }, to: { x: number; y: number }): DestinationIndicator {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const pixels = Math.hypot(dx, dy);
  return { pixels, meters: pixels / PIXELS_PER_METER, angle: Math.atan2(dy, dx), near: pixels <= NEAR_DESTINATION_PX };
}

export const formatMeters = (meters: number) => `${Math.round(meters)} m`;
