/**
 * Cor estável por morador (hash do id) — usada tanto na aba Pedidos (avatar de fallback) quanto no NPC do
 * mundo (Aventura), para que o mesmo cliente seja reconhecível nos dois lugares sem precisar de arte nova.
 */
const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626'] as const;
const DEFAULT_COLOR = '#78716c'; // stone-500: cliente sem id (legado/desconhecido)

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Cor CSS (`#rrggbb`) determinística pelo id do cliente. */
export function colorForResident(customerId: string | null | undefined): string {
  if (!customerId) return DEFAULT_COLOR;
  return PALETTE[hash(customerId) % PALETTE.length];
}

/** Mesma cor, como número hex (0xrrggbb) — formato que o Phaser usa para tint. */
export function colorForResidentHex(customerId: string | null | undefined): number {
  return parseInt(colorForResident(customerId).slice(1), 16);
}
