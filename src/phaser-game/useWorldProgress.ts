import { useEffect } from 'react';
import { api } from '../services/api';
import { BUSINESS_CHANGED, BUSINESS_STORAGE_KEY } from '../services/businessEvents';
import { AdventureBridge } from './bridge/adventureBridge';

/**
 * Lado React do estágio visual do mundo (Progressão 2B). O backend decide (`GET /api/progress`); aqui só
 * carregamos e publicamos no snapshot — o Phaser (WorldScene) nunca decide marcos nem estágios, só renderiza.
 * Atualiza após mudanças confirmadas e ao retornar ao jogo, inclusive instalações e outras abas.
 */
export function useWorldProgress(bridge: AdventureBridge) {
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const refresh = async () => {
      const started = ++revision;
      try {
        const worldStage = await api.getWorldStage();
        if (alive && started === revision) bridge.setSnapshot({ worldStage });
      } catch {
        // sem rede/sessão: mantém o estágio já exibido
      }
    };
    void refresh();
    const visible = () => { if (!document.hidden) void refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === BUSINESS_STORAGE_KEY) visible(); };
    window.addEventListener(BUSINESS_CHANGED, visible);
    window.addEventListener('storage', storage);
    window.addEventListener('online', visible);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 10000);
    let lastPhase = bridge.getSnapshot().phase;
    const off = bridge.subscribe((snap) => {
      if (snap.phase === 'done' && lastPhase !== 'done') void refresh();
      lastPhase = snap.phase;
    });
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(BUSINESS_CHANGED, visible);
      window.removeEventListener('storage', storage);
      window.removeEventListener('online', visible);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      off();
    };
  }, [bridge]);
}
