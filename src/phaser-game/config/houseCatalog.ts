import {
  BAIRRO1_HOUSE_IDS,
  LEGACY_DESTINATION_TARGET,
  REGION_BAIRRO1,
  destinationId,
  isLegacyDestination,
  isModernDestination,
} from '../../shared/destinations';
import { WORLD_MAP, type HouseData } from './worldMap';
import type { Rect } from '../logic/worldGeometry';

/**
 * Catálogo de residências-destino do bairro1: `houseId` (estável, técnico) → construção do mapa, porta e ponto de entrega.
 * O backend só guarda o id "bairro1/house_NNN"; tudo aqui (posição, porta, visual) vive no frontend.
 * `area` é só metadado legível (onde a casa fica hoje); nunca faz parte do id.
 */
const ENTRIES: Record<(typeof BAIRRO1_HOUSE_IDS)[number], { mapHouse: string; area: string }> = {
  house_002: { mapHouse: 'casa_1', area: 'noroeste' },
  house_007: { mapHouse: 'casa_6', area: 'oeste, perto da Novo Hiper' },
  house_011: { mapHouse: 'casa_10', area: 'oeste, avenida' },
  house_014: { mapHouse: 'casa_13', area: 'sudoeste' },
  house_017: { mapHouse: 'casa_16', area: 'norte, acima da Novo Hiper' },
  house_019: { mapHouse: 'casa_18', area: 'sul da Novo Hiper (oeste)' },
  house_021: { mapHouse: 'casa_20', area: 'sul da Novo Hiper (leste)' },
  house_023: { mapHouse: 'casa_22', area: 'sul, rua de baixo' },
  house_026: { mapHouse: 'casa_25', area: 'norte da praça' },
  house_028: { mapHouse: 'casa_27', area: 'norte da praça (leste)' },
  house_029: { mapHouse: 'casa_28', area: 'sul da praça' },
  house_032: { mapHouse: 'casa_31', area: 'centro-sul' },
  house_034: { mapHouse: 'casa_33', area: 'centro-sul (leste)' },
  house_036: { mapHouse: 'casa_35', area: 'nordeste' },
  house_039: { mapHouse: 'casa_38', area: 'leste' },
  house_043: { mapHouse: 'casa_42', area: 'leste, avenida' },
  house_045: { mapHouse: 'casa_cliente', area: 'sudeste (casa amarela)' },
  house_046: { mapHouse: 'casa_44', area: 'sudeste, rua de baixo' },
};

const DOOR_FRONT_OFFSET = 30;
const INTERACT_RADIUS = 80;

export interface DestinationHouse {
  destinationId: string;
  regionId: string;
  houseId: string;
  mapHouseId: string;
  area: string;
  rect: Rect;
  facing: HouseData['facing'];
  door: { x: number; y: number };
  /** Calçada em frente à porta: onde o cliente espera e onde se entrega. */
  deliveryPoint: { x: number; y: number };
  interactRadius: number;
}

function build(houseId: string, mapHouse: string, area: string): DestinationHouse {
  const h = WORLD_MAP.houses.find((x) => x.id === mapHouse);
  if (!h) throw new Error(`houseCatalog: casa do mapa "${mapHouse}" não existe (${houseId})`);
  const x = Math.round(h.rect.x + h.rect.w / 2);
  const doorY = h.facing === 's' ? h.rect.y + h.rect.h : h.rect.y;
  const pointY = h.facing === 's' ? doorY + DOOR_FRONT_OFFSET : doorY - DOOR_FRONT_OFFSET;
  return {
    destinationId: destinationId(REGION_BAIRRO1, houseId),
    regionId: REGION_BAIRRO1,
    houseId,
    mapHouseId: mapHouse,
    area,
    rect: h.rect,
    facing: h.facing,
    door: { x, y: doorY },
    deliveryPoint: { x, y: pointY },
    interactRadius: INTERACT_RADIUS,
  };
}

export const HOUSE_CATALOG: DestinationHouse[] = Object.entries(ENTRIES).map(([id, e]) => build(id, e.mapHouse, e.area));
const BY_DESTINATION = new Map(HOUSE_CATALOG.map((h) => [h.destinationId, h]));

export type ResolvedDestination =
  | { status: 'house'; destinationId: string; house: DestinationHouse; legacy: boolean }
  | { status: 'unknown'; destinationId: string };

/**
 * `destinationId` do pedido → residência.
 *  - id moderno do catálogo → a casa;
 *  - id LEGADO conhecido (dest_default, dest_manual, …) → a casa amarela (compatibilidade explícita);
 *  - qualquer outra coisa (inclusive "bairro1/house_999") → 'unknown': NUNCA cai silenciosamente numa casa.
 */
export function resolveDestination(id: string | null | undefined): ResolvedDestination {
  const key = id ?? '';
  if (isModernDestination(key)) {
    const house = BY_DESTINATION.get(key);
    if (house) return { status: 'house', destinationId: key, house, legacy: false };
  } else if (isLegacyDestination(key)) {
    const house = BY_DESTINATION.get(LEGACY_DESTINATION_TARGET);
    if (house) return { status: 'house', destinationId: key, house, legacy: true };
  }
  return { status: 'unknown', destinationId: key };
}
