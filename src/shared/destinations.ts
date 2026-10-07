/**
 * Identificadores de destino (residência) — FONTE ÚNICA, só dados puros (sem Phaser, sem Node).
 * O backend guarda apenas estes ids como texto; coordenadas e visual vivem no catálogo do mapa (frontend).
 *
 *   formato:  <regionId>/<houseId>   ex.: "bairro1/house_007"
 *   houseId é técnico e estável (nunca descreve posição); onde a casa fica é metadado do catálogo do frontend.
 */
export const REGION_BAIRRO1 = 'bairro1';

/** Residências habilitadas como destino na região bairro1 (catálogo do mapa precisa ter exatamente estes ids). */
export const BAIRRO1_HOUSE_IDS = [
  'house_002',
  'house_007',
  'house_011',
  'house_014',
  'house_017',
  'house_019',
  'house_021',
  'house_023',
  'house_026',
  'house_028',
  'house_029',
  'house_032',
  'house_034',
  'house_036',
  'house_039',
  'house_043',
  'house_045',
  'house_046',
] as const;

export const destinationId = (regionId: string, houseId: string) => `${regionId}/${houseId}`;

/** Todos os destinos modernos válidos (distribuição de novos clientes e validação de endereço). */
export const DESTINATION_IDS: readonly string[] = BAIRRO1_HOUSE_IDS.map((h) => destinationId(REGION_BAIRRO1, h));

/** A residência amarela original (hoje o único destino visual): para onde vão os destinos LEGADOS. */
export const LEGACY_DESTINATION_TARGET = destinationId(REGION_BAIRRO1, 'house_045');

/**
 * Valores históricos gravados em `customers.destination` antes dos destinos por casa.
 * Lista EXPLÍCITA (nada de "qualquer id desconhecido cai na casa padrão"): cada um mapeia para a casa amarela.
 */
export const LEGACY_DESTINATIONS: readonly string[] = [
  'dest_default',
  'dest_manual',
  'dest_e2e',
  // destinos do jogo legado (2D antigo) que o app gravava nos clientes
  'dest_vovo',
  'dest_amigo',
  'dest_cliente',
  'dest_escola',
  'dest_praca',
  'dest_alto_se',
  'dest_tio_rodolfo',
  'dest-olinda',
];

export const isModernDestination = (id: unknown): id is string => typeof id === 'string' && DESTINATION_IDS.includes(id);
export const isLegacyDestination = (id: unknown): id is string => typeof id === 'string' && LEGACY_DESTINATIONS.includes(id);
export const isKnownDestination = (id: unknown): boolean => isModernDestination(id) || isLegacyDestination(id);
