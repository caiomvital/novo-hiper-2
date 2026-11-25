import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ShopSnapshot } from '../services/api';
import { BUSINESS_CHANGED, BUSINESS_STORAGE_KEY } from '../services/businessEvents';
import { AdventureBridge } from './bridge/adventureBridge';
import { InputState } from './input/InputState';

export type ShopPanelMode = 'shop' | 'install';

/**
 * Lado React da Loja de Utilidades. O Phaser só emite as INTENÇÕES 'openShop' / 'openInstall'; aqui o React:
 *  1. carrega o estado REAL do backend (catálogo, preços, saldo, melhorias) e o publica no snapshot (HUD e visual da loja);
 *  2. abre o painel, pausando o mundo (uiOpen) e o teclado do jogo;
 *  3. compra/instala SEMPRE pelo backend (autoridade); o saldo exibido é o devolvido por ele;
 *  4. avisa o App (onDataChanged) para o caixa do aplicativo acompanhar.
 */
export function useShopFlow(bridge: AdventureBridge, inputState: InputState, onDataChanged?: () => void | Promise<void>) {
  const onDataChangedRef = useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;

  const [panel, setPanel] = useState<ShopPanelMode | null>(null);
  const [shop, setShop] = useState<ShopSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const busyRef = useRef(false); // trava síncrona: clique duplo não dispara duas requisições
  const aliveRef = useRef(true);
  const revision = useRef(0);

  const publish = useCallback(
    (data: ShopSnapshot) => {
      setShop(data);
      bridge.setSnapshot({
        cashBalance: data.balance,
        installedUpgrades: data.upgrades.filter((u) => u.state === 'installed').map((u) => u.id),
        pendingUpgrades: data.upgrades.filter((u) => u.state === 'pending').map((u) => u.id),
      });
    },
    [bridge]
  );

  const refresh = useCallback(async () => {
    const started = ++revision.current;
    try {
      const data = await api.getShop();
      if (aliveRef.current && !busyRef.current && started === revision.current) publish(data);
      return data;
    } catch {
      return null; // sem rede/sessão: mantém o que já está na tela
    }
  }, [publish]);

  // Carga inicial e atualização do saldo quando uma entrega termina (o caixa acabou de receber o crédito)
  useEffect(() => {
    aliveRef.current = true;
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
      aliveRef.current = false;
      revision.current++;
      clearInterval(timer);
      window.removeEventListener(BUSINESS_CHANGED, visible);
      window.removeEventListener('storage', storage);
      window.removeEventListener('online', visible);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      off();
    };
  }, [bridge, refresh]);

  const open = useCallback(
    async (mode: ShopPanelMode) => {
      setMessage(null);
      inputState.setSuspended(true);
      bridge.setSnapshot({ uiOpen: true });
      setPanel(mode);
      await refresh(); // saldo/estado frescos ao abrir
    },
    [bridge, inputState, refresh]
  );

  const close = useCallback(() => {
    setPanel(null);
    setMessage(null);
    inputState.setSuspended(false);
    bridge.setSnapshot({ uiOpen: false });
  }, [bridge, inputState]);

  useEffect(() => {
    const off = bridge.onIntent((intent) => {
      if (intent.type === 'openShop') void open('shop');
      else if (intent.type === 'openInstall') void open('install');
    });
    return off;
  }, [bridge, open]);

  // Ao desmontar com painel aberto, devolve o teclado à página
  useEffect(
    () => () => {
      inputState.setSuspended(false);
    },
    [inputState]
  );

  const purchase = useCallback(
    async (id: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current++;
      setBusy(true);
      setMessage(null);
      try {
        const res = await api.purchaseShopUpgrade(id);
        if (!aliveRef.current) return;
        revision.current++;
        publish(res);
        setMessage({ kind: 'ok', text: res.alreadyApplied ? 'Você já tinha comprado esta melhoria.' : 'Comprada! Volte à Novo Hiper, entre e instale no balcão.' });
        void onDataChangedRef.current?.();
      } catch (err) {
        const current = await refresh();
        if (!aliveRef.current) return;
        if (current) publish(current);
        if (current?.upgrades.some(u => u.id === id && u.state !== 'available')) {
          setMessage({ kind: 'ok', text: 'Compra confirmada na loja. A melhoria já é sua.' });
          void onDataChangedRef.current?.();
        } else {
          const code = (err as { code?: string }).code;
          const raw = err instanceof Error && !(err instanceof TypeError) && !['TimeoutError', 'AbortError'].includes(err.name) ? err.message : '';
          setMessage({ kind: 'error', text: code === 'INSUFFICIENT_FUNDS' ? 'Saldo insuficiente para esta compra.' : raw || 'Não foi possível confirmar a compra. Confira sua conexão e tente novamente.' });
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [publish, refresh]
  );

  const install = useCallback(
    async (id: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      revision.current++;
      setBusy(true);
      setMessage(null);
      try {
        const res = await api.installShopUpgrade(id);
        if (!aliveRef.current) return;
        revision.current++;
        publish(res);
        if (res.upgrades.some((u) => u.state === 'pending')) {
          setMessage({ kind: 'ok', text: 'Instalada! Ainda há melhorias para instalar.' });
        } else {
          close(); // nada mais a instalar: o jogador vê a melhoria aparecer na fachada
        }
      } catch (err) {
        const current = await refresh();
        if (!aliveRef.current) return;
        if (current) publish(current);
        if (current?.upgrades.some(u => u.id === id && u.state === 'installed')) {
          setMessage({ kind: 'ok', text: 'Instalação confirmada na Novo Hiper.' });
        } else {
          const raw = err instanceof Error && !(err instanceof TypeError) && !['TimeoutError', 'AbortError'].includes(err.name) ? err.message : '';
          setMessage({ kind: 'error', text: raw || 'Não foi possível confirmar a instalação. Confira sua conexão e tente novamente.' });
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [publish, refresh, close]
  );

  return { panel, shop, busy, message, close, purchase, install };
}
