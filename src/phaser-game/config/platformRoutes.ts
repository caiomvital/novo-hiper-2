import { getGroundSegments, type GroundSegment } from './platformConfig';

export interface PlatformRoute {
  id: 'rua' | 'jardim' | 'praca';
  name: string;
  description: string;
  segments: GroundSegment[];
  sky: number;
  ground: number;
  foliage: number;
}

export const PLATFORM_ROUTES: PlatformRoute[] = [
  { id: 'rua', name: 'Rua das primeiras entregas', description: 'Dois saltos para começar.', segments: getGroundSegments(), sky: 0x0c4a6e, ground: 0x44403c, foliage: 0x39734b },
  { id: 'jardim', name: 'Caminho do jardim', description: 'Três saltos entre os jardins.', segments: [{ x: 0, width: 550 }, { x: 650, width: 480 }, { x: 1250, width: 480 }, { x: 1840, width: 560 }], sky: 0x285943, ground: 0x52643b, foliage: 0x74a84d },
  { id: 'praca', name: 'Passeio da praça', description: 'Três saltos pelo bairro que cresceu.', segments: [{ x: 0, width: 650 }, { x: 770, width: 490 }, { x: 1380, width: 430 }, { x: 1930, width: 470 }], sky: 0x554967, ground: 0x76634e, foliage: 0x688f63 },
];

/** Marcos oficiais liberam os percursos; treino livre e primeira clientela usam a rua inicial. */
export function selectPlatformRoute(neighbors: number, carrying: boolean): PlatformRoute {
  if (!carrying || neighbors < 2) return PLATFORM_ROUTES[0];
  return PLATFORM_ROUTES[neighbors >= 3 ? 2 : 1];
}
