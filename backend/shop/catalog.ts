import { PLACA_MADEIRA } from '../../src/shared/shop';

/**
 * Catálogo da Loja de Utilidades — AUTORIDADE de ids e preços (o cliente nunca informa preço).
 * Preços fixos. Neste marco só a placa é comprável; as demais melhorias planejadas estão em docs/SHOP_UPGRADES.md.
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
];

export const findUpgrade = (id: string): UpgradeDef | undefined => SHOP_UPGRADES.find((u) => u.id === id);
