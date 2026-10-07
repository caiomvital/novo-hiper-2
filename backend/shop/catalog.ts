import { BANCO, JARDINEIRAS, PLACA_MADEIRA } from '../../src/shared/shop';

/**
 * Catálogo da Loja de Utilidades — AUTORIDADE de ids e preços (o cliente nunca informa preço).
 * Preços fixos. Planejadas e ainda fora do catálogo: ver docs/SHOP_UPGRADES.md.
 */
export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  price: number;
}

export const SHOP_UPGRADES: readonly UpgradeDef[] = [
  {
    id: PLACA_MADEIRA,
    name: 'Placa de madeira',
    description: 'Um letreiro grande de madeira, com folhas, para a fachada da Novo Hiper.',
    price: 60,
  },
  {
    id: JARDINEIRAS,
    name: 'Jardineiras',
    description: 'Duas jardineiras floridas ao lado da porta da Novo Hiper.',
    price: 90,
  },
  {
    id: BANCO,
    name: 'Banco de madeira',
    description: 'Um banco para descansar na frente da loja.',
    price: 120,
  },
];

export const findUpgrade = (id: string): UpgradeDef | undefined => SHOP_UPGRADES.find((u) => u.id === id);
