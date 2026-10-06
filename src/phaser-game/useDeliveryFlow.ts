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

    const fetchActive = async (): Promise<AdventureOrder | null> => {
      const order = pickActiveOrder(await api.getOrders());
      return order ? toAdventureOrder(order) : null;
    };

    /** (Re)carrega o pedido ativo e volta ao estado ocioso. */
    const reload = async () => {
      try {
        const next = await fetchActive();
        if (alive) bridge.setSnapshot({ loaded: true, activeOrder: next, phase: 'idle', lastDelivery: null, message: null });
      } catch {
        if (alive) bridge.setSnapshot({ loaded: true, phase: 'idle', lastDelivery: null, message: null });
      }
    };

    // Pedidos novos podem chegar enquanto o jogador explora: consulta periódica, só quando ocioso
    const poll = setInterval(async () => {
      if (!alive || document.hidden || bridge.getSnapshot().phase !== 'idle') return;
      try {
        const next = await fetchActive();
        const snap = bridge.getSnapshot();
        if (alive && snap.phase === 'idle' && (snap.activeOrder?.id ?? null) !== (next?.id ?? null)) {
          bridge.setSnapshot({ loaded: true, activeOrder: next });
        }
      } catch {
        /* sem rede/sessão: mantém o que já está na tela */
      }
    }, ORDER_POLL_MS);

    const offIntent = bridge.onIntent(async (intent) => {
      const snap = bridge.getSnapshot();
      const order = snap.activeOrder;
      // trava: só uma entrega por vez, e só do pedido que está na tela
      if (!order || snap.phase !== 'idle' || order.id !== intent.orderId) return;

      bridge.setSnapshot({ phase: 'delivering', message: null });
      try {
        const delivery = await api.startDelivery(order.id);
        const result = await api.finishDelivery(delivery.id);
        const reward = Number(result?.order?.total ?? order.total);

        // próximo pedido (já sem o entregue), mas só é PUBLICADO depois do feedback
        let next: AdventureOrder | null = null;
        try {
          next = await fetchActive();
        } catch {
          /* publica "sem pedido" e a consulta periódica corrige */
        }
        if (next?.id === order.id) next = null;
        if (!alive) return;

        // activeOrder continua sendo o pedido recém-entregue durante o feedback
        bridge.setSnapshot({ phase: 'done', lastDelivery: { order, reward }, message: null });
        void onDataChangedRef.current?.();
        later(() => bridge.setSnapshot({ activeOrder: next, phase: 'idle', lastDelivery: null, message: null }), DELIVERY_FEEDBACK_MS);
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
