import type { CustomerOrder } from '../../types';
import type { AdventureOrder } from '../bridge/adventureBridge';

/**
 * Status de pedido com os quais o fluxo atual do backend ACEITA iniciar/continuar uma entrega:
 * `POST /deliveries/start` só recusa 'entregue'; 'pronto' é o pedido cuja entrega já foi iniciada (continuar).
 * 'entregue' é terminal e nunca é elegível. Lista EXPLÍCITA (não "tudo que não é entregue").
 */
export const DELIVERABLE_STATUSES = ['pronto', 'preparando', 'recebido'] as const;

/** Prioridade: continuar uma entrega já iniciada ('pronto') antes de começar outra. Depois, o mais antigo. */
export function pickActiveOrder(orders: CustomerOrder[]): CustomerOrder | null {
  const rank = (s: string) => (DELIVERABLE_STATUSES as readonly string[]).indexOf(s);
  const open = orders.filter((o) => rank(o.status) >= 0);
  if (open.length === 0) return null;
  // prefere o que dá para entregar agora; se nenhum der (estoque baixado à mão), mostra mesmo assim para avisar
  const deliverableNow = open.filter((o) => o.deliverable !== false);
  const eligible = deliverableNow.length > 0 ? deliverableNow : open;
  eligible.sort((a, b) => rank(a.status) - rank(b.status) || a.createdAt - b.createdAt || a.orderNumber - b.orderNumber);
  return eligible[0];
}

export function toAdventureOrder(o: CustomerOrder): AdventureOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customerName,
    destinationId: o.destinationId,
    plantName: o.plantName,
    deliverable: o.deliverable !== false,
    total: o.totalPrice,
    status: o.status,
  };
}
