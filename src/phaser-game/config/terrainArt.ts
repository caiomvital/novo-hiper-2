/** Recortes dentro das peças do terrain-kit: sem molduras nem fundo quadriculado. */
export const TERRAIN_FRAMES = {
  grass: [164, 10, 124, 128],
  'grass-tufts': [310, 10, 124, 128],
  'grass-meadow': [900, 10, 116, 128],
  flowers: [610, 10, 108, 128],
  dirt: [164, 192, 124, 108],
  'dirt-stones': [460, 192, 120, 108],
  paving: [168, 366, 116, 92],
  'paving-crack': [610, 366, 108, 92],
  asphalt: [170, 526, 112, 96],
  'asphalt-worn': [1040, 528, 116, 94],
  cobbles: [608, 824, 116, 124],
} as const;
export const GROUND_PATTERNS = {
  grass: ['grass', 'grass', 'grass', 'grass-tufts', 'grass-meadow', 'grass', 'flowers', 'grass'],
  flowers: ['grass-tufts', 'flowers', 'grass', 'grass-meadow'],
  dirt: ['dirt', 'dirt', 'dirt-stones', 'dirt'],
  paving: ['paving', 'paving-crack'],
  asphalt: ['asphalt', 'asphalt-worn'],
  cobbles: ['cobbles'],
} as const;
export type GroundTile = keyof typeof GROUND_PATTERNS;
export const GROUND_CELL = 64;
export const GROUND_PATTERN_CELLS = 4;
