/**
 * Ponte mínima React ↔ Phaser do vertical slice de entrega.
 *  - React → Phaser: SNAPSHOT (somente leitura para o Phaser).
 *  - Phaser → React: INTENÇÃO ('deliver'). O Phaser nunca chama a API; quem valida e chama é o React.
 */
export interface AdventureOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  /** Destino congelado no pedido ("<região>/<casa>" ou id legado); o Phaser resolve pelo catálogo do mapa. */
  destinationId: string;
  plantName: string;
  /** Valor do pedido em reais (o servidor é a autoridade; aqui é só para exibir). */
  total: number;
}

export type DeliveryPhase = 'idle' | 'delivering' | 'done' | 'error';

export interface AdventureSnapshot {
  /** Pedidos já foram carregados do servidor? (evita mostrar "sem entregas" antes da hora) */
  loaded: boolean;
  /** Pedido que o cliente do mapa espera. Durante o feedback ('done') continua sendo o pedido RECÉM-ENTREGUE. */
  activeOrder: AdventureOrder | null;
  phase: DeliveryPhase;
  /** Preenchido em 'done': o pedido entregue e o valor creditado. */
  lastDelivery: { order: AdventureOrder; reward: number } | null;
  /** Mensagem curta para o jogador (erros, por exemplo). */
  message: string | null;
}

export interface DeliverIntent {
  type: 'deliver';
  orderId: string;
}

export const DELIVERY_FEEDBACK_MS = 3000;
export const DELIVERY_ERROR_MS = 3500;
export const ORDER_POLL_MS = 10_000;

export const INITIAL_SNAPSHOT: AdventureSnapshot = {
  loaded: false,
  activeOrder: null,
  phase: 'idle',
  lastDelivery: null,
  message: null,
};

type SnapshotListener = (snapshot: AdventureSnapshot) => void;
type IntentHandler = (intent: DeliverIntent) => void;

export class AdventureBridge {
  private snapshot: AdventureSnapshot = { ...INITIAL_SNAPSHOT };
  private snapshotListeners = new Set<SnapshotListener>();
  private intentHandlers = new Set<IntentHandler>();

  getSnapshot(): AdventureSnapshot {
    return this.snapshot;
  }

  /** React publica uma atualização (mescla com o snapshot atual) e avisa quem assinou. */
  setSnapshot(patch: Partial<AdventureSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.snapshotListeners.forEach((l) => l(this.snapshot));
  }

  subscribe(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  /** Phaser emite a intenção; só é aceita se o snapshot estiver ocioso e o pedido for o ativo (trava de duplo envio). */
  emitIntent(intent: DeliverIntent): boolean {
    const s = this.snapshot;
    if (s.phase !== 'idle' || !s.activeOrder || s.activeOrder.id !== intent.orderId) return false;
    this.intentHandlers.forEach((h) => h(intent));
    return true;
  }

  onIntent(handler: IntentHandler): () => void {
    this.intentHandlers.add(handler);
    return () => this.intentHandlers.delete(handler);
  }

  /** Quantidade de assinantes (usado pelos testes de vazamento). */
  listenerCount(): number {
    return this.snapshotListeners.size + this.intentHandlers.size;
  }
}
