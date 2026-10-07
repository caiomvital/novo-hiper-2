/**
 * Ponte mínima React ↔ Phaser do vertical slice de entrega.
 *  - React → Phaser: SNAPSHOT (somente leitura para o Phaser).
 *  - Phaser → React: INTENÇÃO ('deliver'). O Phaser nunca chama a API; quem valida e chama é o React.
 */
import type { StockHint } from '../logic/emptyState';

export interface AdventureOrder {
  id: string;
  orderNumber: number;
  /** Id estável do cliente (a frase de agradecimento vem do roster compartilhado). */
  customerId: string;
  customerName: string;
  /** Destino congelado no pedido ("<região>/<casa>" ou id legado); o Phaser resolve pelo catálogo do mapa. */
  destinationId: string;
  plantName: string;
  /** O estoque atual cobre o pedido? (calculado pelo backend; false = precisa repor estoque). */
  deliverable: boolean;
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
  /** Saldo REAL do caixa (vem do backend; o Phaser só exibe). null = ainda não carregado. */
  cashBalance: number | null;
  /** Melhorias da Novo Hiper já instaladas / compradas aguardando instalação (ids; estado do backend). */
  installedUpgrades: string[];
  pendingUpgrades: string[];
  /** Um painel React (loja/instalação) está aberto: o mundo fica parado e sem interação. */
  uiOpen: boolean;
  /** Motivo de não haver pedido (catálogo vazio / sem estoque / só aguardando). null = ainda não sabido. */
  stockHint: StockHint | null;
}

export interface DeliverIntent {
  type: 'deliver';
  orderId: string;
}
/** Bernardo interagiu na porta da Loja de Utilidades / da Novo Hiper: o React abre o painel correspondente. */
export interface OpenShopIntent {
  type: 'openShop';
}
export interface OpenInstallIntent {
  type: 'openInstall';
}
export type AdventureIntent = DeliverIntent | OpenShopIntent | OpenInstallIntent;

export const DELIVERY_FEEDBACK_MS = 3000;
export const DELIVERY_ERROR_MS = 3500;
export const ORDER_POLL_MS = 10_000;

export const INITIAL_SNAPSHOT: AdventureSnapshot = {
  loaded: false,
  activeOrder: null,
  phase: 'idle',
  lastDelivery: null,
  message: null,
  cashBalance: null,
  installedUpgrades: [],
  pendingUpgrades: [],
  uiOpen: false,
  stockHint: null,
};

type SnapshotListener = (snapshot: AdventureSnapshot) => void;
type IntentHandler = (intent: AdventureIntent) => void;

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

  /**
   * Phaser emite a intenção; só é aceita com o snapshot ocioso e sem painel aberto.
   * 'deliver' ainda exige que o pedido seja o ATIVO (trava de duplo envio).
   */
  emitIntent(intent: AdventureIntent): boolean {
    const s = this.snapshot;
    if (s.phase !== 'idle' || s.uiOpen) return false;
    if (intent.type === 'deliver' && (!s.activeOrder || s.activeOrder.id !== intent.orderId)) return false;
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
