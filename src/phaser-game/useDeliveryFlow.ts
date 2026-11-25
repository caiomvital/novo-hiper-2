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
import { hintFromReason, stockHintFor, StockHint } from './logic/emptyState';
import { resolveDestination } from './config/houseCatalog';

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
          if (r.reason === 'disabled') stockHint = stockHintFor(await api.getPlants());
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

    const confirmDelivery = (order: AdventureOrder, reward: number) => {
      deliveryIdByOrder.current.delete(order.id);
      if (!alive) return;
      bridge.setSnapshot({ phase: 'done', lastDelivery: { order, reward }, message: null, navigationGoal: 'store' });
      void onDataChangedRef.current?.();
      later(() => void reload(), DELIVERY_FEEDBACK_MS);
    };

    // Sem pedido para entregar: de tempos em tempos (nunca em rajada) PEDE ao backend nova verificação; com pedido, só reflete
    // mudanças (pedido novo, estoque reposto/baixado). Não há timer de criação aqui: quem decide é o servidor.
    let polling = false;
    const refreshActive = async () => {
      if (polling) return;
      if (!alive || document.hidden || bridge.getSnapshot().phase !== 'idle' || bridge.getSnapshot().uiOpen) return;
      const before = bridge.getSnapshot();
      polling = true;
      try {
        const { order, stockHint } = await loadActive();
        const snap = bridge.getSnapshot();
        if (!alive || snap.phase !== 'idle' || snap.activeOrder !== before.activeOrder) return;
        const changed =
          (snap.activeOrder?.id ?? null) !== (order?.id ?? null) || (snap.activeOrder?.deliverable ?? null) !== (order?.deliverable ?? null)
          || (snap.activeOrder?.status ?? null) !== (order?.status ?? null);
        if (changed) bridge.setSnapshot({ loaded: true, activeOrder: order, stockHint });
        else if (snap.stockHint !== stockHint) bridge.setSnapshot({ stockHint });
      } catch {
        /* sem rede/sessão: mantém o que já está na tela */
      } finally { polling = false; }
    };
    let wasUiOpen = bridge.getSnapshot().uiOpen;
    const offUi = bridge.subscribe(snapshot => {
      const closed = wasUiOpen && !snapshot.uiOpen;
      wasUiOpen = snapshot.uiOpen;
      if (closed) void refreshActive();
    });
    const poll = setInterval(() => void refreshActive(), ORDER_POLL_MS);
    const refreshVisible = () => { if (!document.hidden) void refreshActive(); };
    const refreshStorage = (event: StorageEvent) => { if (event.key === 'novo_hiper_business_changed') void refreshActive(); };
    window.addEventListener('online', refreshVisible);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('storage', refreshStorage);
    document.addEventListener('visibilitychange', refreshVisible);

    const offIntent = bridge.onIntent(async (intent) => {
      if (intent.type === 'completePlatform') {
        try {
          const orders = await api.getOrders();
          if (!alive) return;
          const order = pickActiveOrder(orders);
          bridge.setSnapshot({ activeOrder: order ? toAdventureOrder(order) : null, loaded: true });
          if (!order || order.id !== intent.orderId || order.destinationId !== intent.destinationId || order.status !== 'pronto' || order.deliverable === false) {
            intent.done({ error: 'Este pedido mudou. Volte ao bairro para conferir sua entrega.' }); return;
          }
          const destination = resolveDestination(order.destinationId);
          if (destination.status !== 'house') { intent.done({ error: 'Não encontramos a casa deste cliente. Volte ao bairro para conferir.' }); return; }
          const house = destination.house;
          intent.done({ point: { x: house.deliveryPoint.x, y: house.deliveryPoint.y + (house.facing === 's' ? 20 : -20) } });
        } catch { if (alive) intent.done({ error: 'Não foi possível conferir o pedido. Tente novamente ou volte ao bairro.' }); }
        return;
      }
      if (intent.type === 'pickup') {
        // Pegar o vaso na bancada de preparo (NovoHiperInteriorScene): inicia a entrega no backend (idempotente —
        // se Bernardo tentar pegar de novo, só devolve a entrega já em andamento) e republica o pedido com o novo status.
        if (pickingRef.current) return;
        const snap = bridge.getSnapshot();
        const order = snap.activeOrder;
        if (!order || snap.phase !== 'idle' || order.id !== intent.orderId || order.status === 'pronto') return;
        pickingRef.current = true;
        bridge.setSnapshot({ phase: 'picking', message: null });
        try {
          const started = await api.startDelivery(order.id);
          deliveryIdByOrder.current.set(order.id, started.id);
          if (alive) {
            bridge.setSnapshot({ activeOrder: { ...order, status: 'pronto' }, phase: 'idle', message: null });
            void onDataChangedRef.current?.();
          }
        } catch (err) {
          if (alive) {
            const raw = err instanceof Error && !(err instanceof TypeError) && !['TimeoutError', 'AbortError'].includes(err.name) ? err.message : '';
            bridge.setSnapshot({ phase: 'idle', message: raw ? raw.slice(0, 140) : 'Não foi possível pegar a planta. Confira sua conexão.' });
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
        if (!deliveryId) {
          deliveryId = (await api.startDelivery(order.id)).id;
          deliveryIdByOrder.current.set(order.id, deliveryId);
        }
        const result = await api.finishDelivery(deliveryId);
        const reward = Number(result?.order?.total ?? order.total);
        confirmDelivery(order, reward);
      } catch (err) {
        if (!alive) return;
        // A resposta pode ter sido perdida depois do COMMIT. Consulte o estado oficial
        // antes de apresentar falha ou permitir nova tentativa.
        try {
          const confirmed = (await api.getOrders()).find(o => o.id === order.id && o.status === 'entregue');
          if (confirmed) {
            confirmDelivery(order, confirmed.totalPrice);
            return;
          }
        } catch { /* sem conexão: mantém o vaso e permite repetir o finish idempotente */ }
        if (!alive) return;
        const raw = err instanceof Error && !(err instanceof TypeError) && !['TimeoutError', 'AbortError'].includes(err.name) ? err.message : '';
        bridge.setSnapshot({ phase: 'error', message: raw ? raw.slice(0, 140) : 'Não foi possível confirmar a entrega. Confira sua conexão e tente novamente.' });
        later(() => void reload(), DELIVERY_ERROR_MS);
      }
    });

    void reload();

    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener('online', refreshVisible);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('storage', refreshStorage);
      document.removeEventListener('visibilitychange', refreshVisible);
      timers.forEach(clearTimeout);
      timers.clear();
      offIntent();
      offUi();
    };
  }, [bridge]);
}
