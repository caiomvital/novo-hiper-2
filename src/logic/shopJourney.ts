import type { Plant } from '../types';

export type JourneyStep = 'register' | 'stock' | 'waiting' | 'prepare' | 'deliver' | 'grow';
export interface JourneyOrder {
  plantName: string;
  customerName: string;
  status: string;
  deliverable?: boolean;
}
export const JOURNEY_STEPS = ['Cadastrar', 'Receber pedido', 'Preparar', 'Entregar', 'Cuidar da loja'];

/** Orientação de interface derivada dos dados oficiais. Não cria marcos, pedidos ou recompensas. */
export function shopJourney({ plants, order, delivered, returning = false }: {
  plants: readonly Plant[];
  order: JourneyOrder | null;
  delivered: boolean;
  returning?: boolean;
}): { step: JourneyStep; index: number; title: string; description: string } {
  if (returning) return { step: 'grow', index: 4, title: 'Sua entrega virou resultado', description: 'Volte à Novo Hiper, confira o caixa e escolha uma melhoria na Loja de Utilidades ou cadastre outra planta.' };
  // Um pedido em andamento continua existindo mesmo se o catálogo for editado ou esvaziado.
  if (order) {
    if (order.deliverable === false) return { step: 'stock', index: 2, title: `Reponha ${order.plantName}`, description: 'O estoque atual não cobre este pedido. Abra o catálogo e ajuste a quantidade antes de preparar a entrega.' };
    if (order.status === 'pronto') return { step: 'deliver', index: 3, title: `Leve ${order.plantName} para ${order.customerName}`, description: 'A planta já está com Bernardo. Parta pela plataforma ou siga até a casa indicada e confirme a entrega com o morador.' };
    return { step: 'prepare', index: 2, title: `${order.customerName} pediu ${order.plantName}`, description: 'Entre na Novo Hiper e vá à bancada PREPARO, à direita. Pegue a planta para começar sua entrega.' };
  }
  if (!plants.length) return { step: 'register', index: 0, title: 'Sua aventura começa com uma planta sua', description: 'Tire uma foto, escolha o nome, o preço e a quantidade. Essa planta vai para a vitrine do jogo e pode ser pedida pelos moradores.' };
  if (!plants.some(p => p.stock > 0)) return { step: 'stock', index: 1, title: 'Prepare o estoque da sua loja', description: 'Suas plantas já estão no catálogo. Informe quantos vasos estão disponíveis para os moradores poderem fazer pedidos.' };
  if (delivered) return { step: 'grow', index: 4, title: 'Sua loja já faz parte do bairro', description: 'Confira o resultado das entregas, conheça as melhorias na Loja de Utilidades ou fotografe outra planta para ampliar a vitrine.' };
  return { step: 'waiting', index: 1, title: 'Sua planta já pode aparecer nos pedidos', description: 'A loja está pronta para atender. Entre na aventura para conhecer sua vitrine; o próximo pedido aparecerá aqui assim que estiver disponível.' };
}
