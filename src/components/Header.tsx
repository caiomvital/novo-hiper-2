import React, { useState } from 'react';
import { MainTab } from '../types';
import { Plus, Leaf, Volume2, VolumeX, Store, MapPinned, ShoppingBag, Coins, LogOut, Rocket } from 'lucide-react';
import { sounds } from '../services/sound';
import { formatPrice } from '../services/storage';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  plantCount: number;
  deliveryCount: number;
  pendingOrdersCount?: number;
  cashBalance?: number;
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onAddPlant: () => void;
  onOpenCashRegister?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  plantCount, 
  deliveryCount, 
  pendingOrdersCount = 0,
  cashBalance = 0,
  activeTab, 
  onTabChange, 
  onAddPlant,
  onOpenCashRegister,
  onLogout
}) => {
  const [isMuted, setIsMuted] = useState(() => sounds.getMuted());

  const handleToggleSound = () => {
    const nextMuted = sounds.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleAddClick = () => {
    sounds.playAddPlant();
    onAddPlant();
  };

  const handleTab = (tab: MainTab) => {
    sounds.playPlim();
    onTabChange(tab);
  };

  const handleLogoutClick = () => {
    sounds.playPlim();
    onLogout?.();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-2xs">
      <div className="max-w-5xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Logo and Shop Identification */}
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-800 flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Leaf className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-stone-900">
                  Novo Hiper
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  Plantas e Jardinagem
                </span>
              </div>
              <p className="text-xs font-medium text-stone-500 flex items-center gap-1.5">
                <span className="text-emerald-800 font-semibold">Plantas e Jardinagem</span>
                <span className="text-stone-300">•</span>
                <span className="text-stone-600">
                  {plantCount === 0 
                    ? 'Catálogo vazio' 
                    : plantCount === 1 
                    ? '1 planta no estoque' 
                    : `${plantCount} plantas no estoque`}
                </span>
              </p>
            </div>
          </div>

          {/* Caixa & Sound Toggle (Mobile view position) */}
          <div className="sm:hidden flex items-center gap-1.5">
            <button
              id="btn-open-cash-mobile"
              type="button"
              onClick={() => {
                sounds.playPlim();
                onOpenCashRegister?.();
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-display font-bold text-xs cursor-pointer"
              title="Caixa Virtual"
            >
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>{formatPrice(cashBalance)}</span>
            </button>

            <PWAInstallButton compact />

            <button
              id="btn-toggle-sound-mobile"
              type="button"
              onClick={handleToggleSound}
              className="p-2 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 bg-stone-50 cursor-pointer"
              aria-label={isMuted ? 'Ativar sons' : 'Silenciar sons'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {onLogout && (
              <button
                id="btn-logout-mobile"
                type="button"
                onClick={handleLogoutClick}
                className="p-2 rounded-xl border border-stone-200 text-stone-400 hover:text-rose-700 hover:bg-rose-50 bg-stone-50 cursor-pointer transition-colors"
                aria-label="Sair da loja"
                title="Sair da loja"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl border border-stone-200 self-stretch sm:self-auto overflow-x-auto">
          <button
            id="tab-btn-catalog"
            type="button"
            onClick={() => handleTab('catalogo')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'catalogo'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Store className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>Catálogo</span>
          </button>

          <button
            id="tab-btn-orders"
            type="button"
            onClick={() => handleTab('pedidos')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all cursor-pointer whitespace-nowrap relative ${
              activeTab === 'pedidos'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>Pedidos</span>
            {pendingOrdersCount > 0 && (
              <span className="min-w-4 h-4 sm:min-w-5 sm:h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          <button
            id="tab-btn-deliveries"
            type="button"
            onClick={() => handleTab('entregas')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'entregas'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MapPinned className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>Entregas</span>
            {deliveryCount > 0 && (
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-700 text-white text-[10px] flex items-center justify-center font-bold">
                {deliveryCount}
              </span>
            )}
          </button>

          {/* Jogo 2D 🎮 (legado) desativado: foco passou a ser a Aventura (Beta). Código preservado em src/game/. */}

          <button
            id="tab-btn-adventure"
            type="button"
            onClick={() => handleTab('aventura')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-display font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'aventura'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Protótipo experimental — mapa top-down e trechos de plataforma"
          >
            <Rocket className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Aventura (Beta)</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            id="btn-open-cash-desktop"
            type="button"
            onClick={() => {
              sounds.playPlim();
              onOpenCashRegister?.();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-200 text-amber-900 cursor-pointer shadow-2xs transition-colors"
            title="Abrir Caixa Virtual do Novo Hiper"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Coins className="w-4 h-4" />
            </div>
            <div className="text-left leading-tight">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Caixa Virtual
              </span>
              <span className="font-extrabold text-stone-900 font-display text-sm">
                {formatPrice(cashBalance)}
              </span>
            </div>
          </button>

          <PWAInstallButton />

          <button
            id="btn-toggle-sound"
            type="button"
            onClick={handleToggleSound}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              isMuted
                ? 'bg-stone-100 border-stone-200 text-stone-400 hover:text-stone-600'
                : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
            }`}
            title={isMuted ? 'Ativar avisos sonoros' : 'Silenciar avisos sonoros'}
            aria-label={isMuted ? 'Ativar sons' : 'Silenciar sons'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onLogout && (
            <button
              id="btn-logout-desktop"
              type="button"
              onClick={handleLogoutClick}
              className="p-2.5 rounded-xl border border-stone-200 text-stone-400 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 bg-stone-50 transition-colors cursor-pointer flex items-center justify-center"
              title="Sair da conta"
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          <button
            id="btn-header-add-plant"
            onClick={handleAddClick}
            className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer flex-shrink-0"
            aria-label="Cadastrar nova planta"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nova Planta</span>
          </button>
        </div>
      </div>
    </header>
  );
};
