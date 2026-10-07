/**
 * Por que não há pedido para entregar? Distinguir (sem alarme):
 *  - 'no_plants': nenhuma planta cadastrada;
 *  - 'no_stock':  há plantas, mas nenhuma com estoque (o gerador de pedidos exige estoque);
 *  - 'ok':        há estoque; é só questão de esperar o próximo pedido.
 */
export type StockHint = 'ok' | 'no_plants' | 'no_stock';

/** Motivo devolvido pelo backend (POST /api/orders/ensure) → o que dizer ao jogador. Só plantas/estoque merecem mensagem. */
export function hintFromReason(reason: string | undefined | null): StockHint {
  if (reason === 'no_plants') return 'no_plants';
  if (reason === 'no_stock') return 'no_stock';
  return 'ok'; // active_order, cooldown (curtíssimo), no_customers (salvaguarda), disabled: mantém "Sem entregas no momento"
}

export function stockHintFor(plants: ReadonlyArray<{ stock: number }>): StockHint {
  if (plants.length === 0) return 'no_plants';
  return plants.some((p) => (p.stock ?? 0) > 0) ? 'ok' : 'no_stock';
}

export function emptyDeliveryMessage(hint: StockHint | null | undefined): string {
  switch (hint) {
    case 'no_plants':
      return 'Cadastre uma planta na Novo Hiper para começar.';
    case 'no_stock':
      return 'As plantas estão sem estoque. Passe na Novo Hiper para conferir.';
    default:
      return 'Sem entregas no momento';
  }
}
