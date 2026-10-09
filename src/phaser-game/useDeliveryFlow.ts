import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  AdventureBridge,
  AdventureOrder,
  DELIVERY_ERROR_MS,
  DELIVERY_FEEDBACK_MS,
  ORDER_POLL_MS,
} from './bridge/adventureBridge';
import { pickActiveOrder, toAdventureOrder } from './logic/activeOrder';
import { hintFromReason, StockHint } from './logic/emptyState';

/**
 * Lado React do vertical slice de entrega. O Phaser só emite a INTENÇÃO 'deliver'; aqui o React:
 *  1. carrega o pedido ativo REAL do backend e publica o snapshot;
 *  2. ao receber a intenção, chama start → finish (ambos idempotentes; o backend é a autoridade);
 *  3. publica o resultado, mantém o pedido recém-entregue visível durante o feedback e só então publica o próximo;
 *  4. avisa o App (onDataChanged) para recarregar pedidos/estoque/caixa.
 */
export function useDeliveryFlow(bridge: AdventureBridge, onDataChanged?: () => void | Promise<void>) {
  const onDataChangedRef = useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;
  const pickingRef = useRef(false); // trava síncrona: toque duplo na bancada não dispara duas chamadas
  // Id da entrega já iniciada na retirada (pickup), para não chamar startDelivery de novo ao entregar (ele é
  // idempotente, mas chamar de novo seria uma requisição à toa). Se for perdido (ex.: reload entre pegar e
  // entregar), o handler de 'deliver' se recupera chamando startDelivery de novo — devolve a entrega já
  // existente, porque order.status já está 'pronto'.
  const deliveryIdByOrder = useRef(new Map<string, string>());

  useEffect(() => {
    let alive = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (alive) fn();
      }, ms);
      timers.add(t);
    };

    /**
     * Pedido ativo REAL do backend. Sem pedido, PEDE uma verificação (POST /orders/ensure): o backend decide se nasce um
     * pedido (capacidade, estoque, clientes…) e devolve o motivo quando não nasce — usado só para a mensagem.
     */
    const loadActive = async (): Promise<{ order: AdventureOrder | null; stockHint: StockHint }> => {
      let picked = pickActiveOrder(await api.getOrders());
      let stockHint: StockHint = 'ok';
      if (!picked) {
        try {
          const r = await api.ensureOrder();
          stockHint = hintFromReason(r.reason);
          if (r.created) picked = pickActiveOrder(await api.getOrders());
        } catch {
          /* sem rede/sessão: mantém "Sem entregas no momento" */
        }
      }
      return { order: picked ? toAdventureOrder(picked) : null, stockHint };
    };

    /** (Re)carrega o pedido ativo e volta ao estado ocioso. */
    const reload = async () => {
      try {
        const { order, stockHint } = await loadActive();
        if (alive) bridge.setSnapshot({ loaded: true, activeOrder: order, stockHint, phase: 'idle', lastDelivery: null, message: null });
      } catch {
        if (alive) bridge.setSnapshot({ loaded: true, phase: 'idle', lastDelivery: null, message: null });
      }
    };

    // Sem pedido para entregar: de tempos em tempos (nunca em rajada) PEDE ao backend nova verificação; com pedido, só reflete
    // mudanças (pedido novo, estoque reposto/baixado). Não há timer de criação aqui: quem decide é o servidor.
    const poll = setInterval(async () => {
      if (!alive || document.hidden || bridge.getSnapshot().phase !== 'idle' || bridge.getSnapshot().uiOpen) return;
      try {
        const { order, stockHint } = await loadActive();
        const snap = bridge.getSnapshot();
        if (!alive || snap.phase !== 'idle') return;
        const changed =
          (snap.activeOrder?.id ?? null) !== (order?.id ?? null) || (snap.activeOrder?.deliverable ?? null) !== (order?.deliverable ?? null);
        if (changed) bridge.setSnapshot({ loaded: true, activeOrder: order, stockHint });
        else if (snap.stockHint !== stockHint) bridge.setSnapshot({ stockHint });
      } catch {
        /* sem rede/sessão: mantém o que já está na tela */
      }
    }, ORDER_POLL_MS);

    const offIntent = bridge.onIntent(async (intent) => {
      if (intent.type === 'pickup') {
        // Pegar o vaso na bancada de preparo (NovoHiperInteriorScene): inicia a entrega no backend (idempotente —
        // se Bernardo tentar pegar de novo, só devolve a entrega já em andamento) e republica o pedido com o novo status.
        if (pickingRef.current) return;
        const snap = bridge.getSnapshot();
        const order = snap.activeOrder;
        if (!order || snap.phase !== 'idle' || order.id !== intent.orderId || order.status === 'pronto') return;
        pickingRef.current = true;
        try {
          const started = await api.startDelivery(order.id);
          deliveryIdByOrder.current.set(order.id, started.id);
          const { order: refreshed, stockHint } = await loadActive();
          if (alive) bridge.setSnapshot({ activeOrder: refreshed, stockHint });
        } catch (err) {
          if (alive) {
            const raw = err instanceof Error ? err.message : '';
            bridge.setSnapshot({ message: raw ? raw.slice(0, 140) : 'Não foi possível pegar a planta agora.' });
          }
        } finally {
          pickingRef.current = false;
        }
        return;
      }
      if (intent.type !== 'deliver') return; // loja/instalação são tratadas por useShopFlow
      const snap = bridge.getSnapshot();
      const order = snap.activeOrder;
      // trava: só uma entrega por vez, só do pedido que está na tela, e só depois de pegar a planta na loja
      if (!order || snap.phase !== 'idle' || order.id !== intent.orderId || order.status !== 'pronto') return;

      bridge.setSnapshot({ phase: 'delivering', message: null });
      try {
        let deliveryId = deliveryIdByOrder.current.get(order.id);
        if (!deliveryId) deliveryId = (await api.startDelivery(order.id)).id;
        const result = await api.finishDelivery(deliveryId);
        deliveryIdByOrder.current.delete(order.id);
        const reward = Number(result?.order?.total ?? order.total);

        // próximo pedido (já sem o entregue), mas só é PUBLICADO depois do feedback
        // (o backend já pode ter criado o próximo pedido ao finalizar; senão pedimos a verificação)
        let next: AdventureOrder | null = null;
        let stockHint: StockHint = 'ok';
        try {
          ({ order: next, stockHint } = await loadActive());
        } catch {
          /* publica "sem pedido" e a consulta periódica corrige */
        }
        if (next?.id === order.id) next = null;
        if (!alive) return;

        // activeOrder continua sendo o pedido recém-entregue durante o feedback
        bridge.setSnapshot({ phase: 'done', lastDelivery: { order, reward }, message: null });
        void onDataChangedRef.current?.();
        later(() => bridge.setSnapshot({ activeOrder: next, stockHint, phase: 'idle', lastDelivery: null, message: null }), DELIVERY_FEEDBACK_MS);
      } catch (err) {
        if (!alive) return;
        const raw = err instanceof Error ? err.message : '';
        bridge.setSnapshot({ phase: 'error', message: raw ? raw.slice(0, 140) : 'Não foi possível entregar agora.' });
        later(() => void reload(), DELIVERY_ERROR_MS);
      }
    });

    void reload();

    return () => {
      alive = false;
      clearInterval(poll);
      timers.forEach(clearTimeout);
      timers.clear();
      offIntent();
    };
  }, [bridge]);
}
