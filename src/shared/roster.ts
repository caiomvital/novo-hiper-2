import { destinationId, REGION_BAIRRO1 } from './destinations';

/**
 * Moradores do bairro1 (primeiro arco) — FONTE ÚNICA de identidade, casa e frase (dados puros, backend e frontend).
 *  - `id`: estável (os cinco primeiros mantêm os ids que o app já usava);
 *  - `destinationId`: residência planejada no catálogo de casas (nada de coordenadas aqui);
 *  - `group`: grupo interno de desbloqueio (1 = início, 2 = crescimento, 3 = bairro mais amplo). O jogador NÃO vê grupos;
 *  - `thanks`: frase curta mostrada depois da entrega (vale para qualquer planta: não cita espécie).
 * "Floricultura" é cliente por COMPATIBILIDADE provisória; futuramente deve ser repensada como estabelecimento do mundo.
 */
export interface RosterEntry {
  id: string;
  name: string;
  destinationId: string;
  group: 1 | 2 | 3;
  thanks: string;
}

const house = (n: string) => destinationId(REGION_BAIRRO1, n);

export const ROSTER: readonly RosterEntry[] = [
  // INÍCIO — perto da Novo Hiper
  { id: 'cust_dona_maria', name: 'Dona Maria', destinationId: house('house_021'), group: 1, thanks: 'Obrigada, Bernardo! Vai ficar linda aqui.' },
  { id: 'cust_seu_joao', name: 'Seu João', destinationId: house('house_019'), group: 1, thanks: 'Valeu, Bernardo! Chegou direitinho.' },
  { id: 'cust_ana', name: 'Ana', destinationId: house('house_017'), group: 1, thanks: 'Que bonita! Obrigada, Bernardo.' },
  // CRESCIMENTO
  { id: 'cust_carlos', name: 'Carlos', destinationId: house('house_029'), group: 2, thanks: 'Obrigado! Já sei onde vou colocar.' },
  { id: 'cust_dona_lucia', name: 'Dona Lúcia', destinationId: house('house_007'), group: 2, thanks: 'Que capricho! Muito obrigada.' },
  // BAIRRO MAIS AMPLO
  { id: 'cust_floricultura', name: 'Floricultura', destinationId: house('house_026'), group: 3, thanks: 'Chegou em boa hora. Obrigado!' },
  { id: 'cust_seu_antonio', name: 'Seu Antônio', destinationId: house('house_034'), group: 3, thanks: 'Obrigado, Bernardo. Gostei da escolha.' },
  { id: 'cust_bia', name: 'Bia', destinationId: house('house_039'), group: 3, thanks: 'Adorei! Vai ficar muito bonita aqui.' },
];

export const rosterById = (id: string | null | undefined): RosterEntry | undefined => ROSTER.find((r) => r.id === id);

/** Frase de agradecimento do cliente (genérica para quem não é do roster). */
export const thanksFor = (customerId: string | null | undefined): string => rosterById(customerId)?.thanks ?? 'Obrigado, Bernardo!';
