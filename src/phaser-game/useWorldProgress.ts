import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import { AdventureBridge } from './bridge/adventureBridge';

/**
 * Lado React do estágio visual do mundo (Progressão 2B). O backend decide (`GET /api/progress`); aqui só
 * carregamos e publicamos no snapshot — o Phaser (WorldScene) nunca decide marcos nem estágios, só renderiza.
 * Recarrega ao montar e quando uma entrega termina (é o evento que mais costuma mudar o estágio no jogo).
 */
export function useWorldProgress(bridge: AdventureBridge) {
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const refresh = async () => {
      try {
        const worldStage = await api.getWorldStage();
        if (aliveRef.current) bridge.setSnapshot({ worldStage });
      } catch {
        // sem rede/sessão: mantém o estágio já exibido
      }
    };
    void refresh();
    let lastPhase = bridge.getSnapshot().phase;
    const off = bridge.subscribe((snap) => {
      if (snap.phase === 'done' && lastPhase !== 'done') void refresh();
      lastPhase = snap.phase;
    });
    return () => {
      aliveRef.current = false;
      off();
    };
  }, [bridge]);
}
