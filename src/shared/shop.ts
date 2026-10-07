/** Ids e estados da Loja de Utilidades compartilhados entre backend e frontend (só dados puros). */
export const PLACA_MADEIRA = 'placa_madeira';
export const JARDINEIRAS = 'jardineiras';
export const BANCO = 'banco';

/** Estado de uma melhoria: à venda → comprada (aguardando instalação) → instalada. */
export type ShopUpgradeState = 'available' | 'pending' | 'installed';
