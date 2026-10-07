import React, { useEffect, useRef } from 'react';
import { Hammer, Store, X, Check } from 'lucide-react';
import type { ShopSnapshot, ShopUpgradeView } from '../../services/api';
import { formatBRL } from '../logic/format';
import type { ShopPanelMode } from '../useShopFlow';

interface ShopPanelProps {
  mode: ShopPanelMode;
  shop: ShopSnapshot | null;
  busy: boolean;
  message: { kind: 'ok' | 'error'; text: string } | null;
  onClose: () => void;
  onBuy: (id: string) => void;
  onInstall: (id: string) => void;
}

/** Painel HTML (dentro de #adventure-root, então funciona em tela cheia). O saldo e os estados vêm do backend. */
export const ShopPanel: React.FC<ShopPanelProps> = ({ mode, shop, busy, message, onClose, onBuy, onInstall }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isShop = mode === 'shop';
  const items = (shop?.upgrades ?? []).filter((u) => (isShop ? true : u.state !== 'available'));

  const action = (u: ShopUpgradeView) => {
    if (isShop) {
      if (u.state === 'available') {
        const missing = shop ? u.price - shop.balance : 0;
        return (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              id={`btn-shop-buy-${u.id}`}
              disabled={busy}
              onClick={() => onBuy(u.id)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-sm"
            >
              Comprar por {formatBRL(u.price)}
            </button>
            {missing > 0 && <span className="text-[11px] text-amber-300">Faltam {formatBRL(missing)}</span>}
          </div>
        );
      }
      return u.state === 'pending' ? (
        <span id={`shop-state-${u.id}`} className="text-xs font-bold text-amber-300 text-right">
          Comprada — leve para a Novo Hiper e instale
        </span>
      ) : (
        <span id={`shop-state-${u.id}`} className="text-xs font-bold text-emerald-300 flex items-center gap-1">
          <Check className="w-4 h-4" /> Instalada
        </span>
      );
    }
    return u.state === 'pending' ? (
      <button
        type="button"
        id={`btn-shop-install-${u.id}`}
        disabled={busy}
        onClick={() => onInstall(u.id)}
        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-900 font-bold text-sm"
      >
        Instalar
      </button>
    ) : (
      <span id={`shop-state-${u.id}`} className="text-xs font-bold text-emerald-300 flex items-center gap-1">
        <Check className="w-4 h-4" /> Instalada
      </span>
    );
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-stone-950/70" role="dialog" aria-modal="true" aria-labelledby="shop-title">
      <div id="shop-panel" className="w-full max-w-md max-h-full overflow-auto rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl text-stone-100">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-700">
          <div className="flex items-center gap-2 min-w-0">
            {isShop ? <Store className="w-5 h-5 text-sky-300 shrink-0" /> : <Hammer className="w-5 h-5 text-amber-300 shrink-0" />}
            <h2 id="shop-title" className="font-bold truncate">
              {isShop ? 'Loja de Utilidades' : 'Minha loja — melhorias'}
            </h2>
          </div>
          <button ref={closeRef} type="button" id="btn-shop-close" onClick={onClose} aria-label="Fechar" className="p-2 rounded-lg hover:bg-stone-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-baseline justify-between rounded-xl bg-stone-800 px-4 py-2">
            <span className="text-xs uppercase tracking-wide text-stone-400">Caixa</span>
            <span id="shop-balance" className="text-xl font-extrabold text-emerald-300">
              {shop ? formatBRL(shop.balance) : '…'}
            </span>
          </div>
        </div>

        <ul className="px-4 py-3 space-y-3">
          {items.length === 0 && <li className="text-sm text-stone-400">Nada por aqui por enquanto.</li>}
          {items.map((u) => (
            <li key={u.id} id={`shop-item-${u.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-stone-700 p-3">
              <div className="min-w-0">
                <div className="font-bold">{u.name}</div>
                <div className="text-xs text-stone-400">{u.description}</div>
                {isShop && u.state === 'available' && <div className="mt-1 text-sm font-bold text-amber-300">{formatBRL(u.price)}</div>}
              </div>
              <div className="shrink-0">{action(u)}</div>
            </li>
          ))}
        </ul>

        {message && (
          <div
            id="shop-message"
            role="status"
            className={`mx-4 mb-4 rounded-lg px-3 py-2 text-sm font-semibold ${message.kind === 'ok' ? 'bg-emerald-900/60 text-emerald-200' : 'bg-red-900/60 text-red-200'}`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
};
