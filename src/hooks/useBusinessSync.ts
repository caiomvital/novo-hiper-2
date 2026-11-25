import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { API_UNAVAILABLE, BUSINESS_CHANGED, BUSINESS_MUTATION, BUSINESS_STORAGE_KEY } from '../services/businessEvents';
import type { CashRegister, CustomerOrder, DeliveryRecord, Plant } from '../types';
export interface BusinessSnapshot { plants: Plant[]; orders: CustomerOrder[]; cash: CashRegister; deliveries: DeliveryRecord[] }

/** Publica as quatro leituras juntas. Uma escrita invalida qualquer leitura anterior. */
export function useBusinessSync(enabled: boolean, apply: (snapshot: BusinessSnapshot) => void) {
  const [connected, setConnected] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const revision = useRef(0);
  const mutations = useRef(0);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const refresh = useCallback(function refreshBusiness(): Promise<void> {
    if (!enabledRef.current || !navigator.onLine) { setConnected(false); return Promise.resolve(); }
    if (running.current || mutations.current) { again.current = true; return running.current ?? Promise.resolve(); }
    const started = revision.current;
    const operation = (async () => {
      try {
        const [plants, orders, cash, deliveries] = await Promise.all([api.getPlants(), api.getOrders(), api.getCashRegister(), api.getDeliveries()]);
        if (!enabledRef.current) return;
        if (started !== revision.current || mutations.current) { again.current = true; return; }
        applyRef.current({ plants, orders, cash, deliveries });
        setConnected(true);
      } catch { if (enabledRef.current) setConnected(false); }
    })();
    running.current = operation.finally(() => {
      running.current = null;
      if (again.current && !mutations.current && enabledRef.current) {
        again.current = false;
        void refreshBusiness();
      }
    });
    return running.current;
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;
    revision.current++;
    mutations.current = 0;
    if (!enabled) { setConnected(false); return; }
    const changed = () => { revision.current++; void refresh(); };
    const mutation = (event: Event) => {
      const phase = (event as CustomEvent<'start' | 'end'>).detail;
      revision.current++;
      mutations.current = Math.max(0, mutations.current + (phase === 'start' ? 1 : -1));
      if (phase === 'end') void refresh();
    };
    const storage = (event: StorageEvent) => { if (event.key === BUSINESS_STORAGE_KEY) changed(); };
    const visible = () => { if (!document.hidden) void refresh(); };
    const offline = () => { revision.current++; setConnected(false); };
    window.addEventListener(BUSINESS_MUTATION, mutation);
    window.addEventListener(BUSINESS_CHANGED, changed);
    window.addEventListener('storage', storage);
    window.addEventListener('online', changed);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', visible);
    window.addEventListener(API_UNAVAILABLE, offline);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 10000);
    void refresh();
    return () => {
      enabledRef.current = false;
      revision.current++;
      clearInterval(timer);
      window.removeEventListener(BUSINESS_MUTATION, mutation);
      window.removeEventListener(BUSINESS_CHANGED, changed);
      window.removeEventListener('storage', storage);
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', visible);
      window.removeEventListener(API_UNAVAILABLE, offline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, refresh]);
  return { connected, refresh };
}
