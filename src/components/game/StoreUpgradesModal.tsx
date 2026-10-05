import React from 'react';
import { 
  Store, 
  X, 
  Camera, 
  Fan, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Wind, 
  Wallet,
  AlertCircle
} from 'lucide-react';
import { StoreUpgradeItem, purchaseUpgrade } from '../../services/storeUpgrades';
import { formatPrice } from '../../services/storage';

interface StoreUpgradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  upgrades: StoreUpgradeItem[];
  onUpgradePurchased: (updatedUpgrades: StoreUpgradeItem[], newBalance: number) => void;
}

export const StoreUpgradesModal: React.FC<StoreUpgradesModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  upgrades,
  onUpgradePurchased,
}) => {
  if (!isOpen) return null;

  const handleBuy = (item: StoreUpgradeItem) => {
    const result = purchaseUpgrade(item.id);
    if (result.success && result.newBalance !== undefined) {
      const updated = upgrades.map((u) => (u.id === item.id ? { ...u, purchased: true } : u));
      onUpgradePurchased(updated, result.newBalance);
    }
  };

  const purchasedCount = upgrades.filter((u) => u.purchased).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-upgrades-title"
      >
        {/* Topo Decorado */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-emerald-950 via-stone-900 to-stone-900 border-b border-stone-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h2 id="store-upgrades-title" className="font-display font-bold text-lg sm:text-xl text-stone-100 flex items-center gap-2">
                  Melhorias da Loja
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-normal border border-amber-400/30">
                    Novo Hiper
                  </span>
                </h2>
                <p className="text-xs text-stone-400">
                  Instale móveis e equipamentos para modernizar sua loja em Olinda
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Saldo Atual do Caixa */}
          <div className="mt-4 p-3 rounded-2xl bg-stone-950/70 border border-stone-800/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 block">
                  Saldo do Caixa Virtual
                </span>
                <span className="text-base sm:text-lg font-display font-bold text-emerald-400">
                  {formatPrice(currentBalance)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 block">Itens Instalados</span>
              <span className="text-xs font-bold text-stone-200">
                {purchasedCount} de {upgrades.length}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Itens Disponíveis */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="text-xs text-stone-400 flex items-center gap-1.5 px-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Ao adquirir um item, uma <strong>miniatura animada</strong> aparece imediatamente no interior da sua loja no mapa 2D!
            </span>
          </div>

          {upgrades.map((item) => {
            const canAfford = currentBalance >= item.price;
            const isCamera = item.id === 'camera';

            return (
              <div
                key={item.id}
                className={`relative p-4 rounded-2xl border transition-all ${
                  item.purchased
                    ? 'bg-emerald-950/25 border-emerald-800/50'
                    : canAfford
                    ? 'bg-stone-850/60 border-stone-800 hover:border-stone-700'
                    : 'bg-stone-900/40 border-stone-800/60 opacity-80'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Ícone do Item */}
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      item.purchased
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                        : isCamera
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {isCamera ? <Camera className="w-6 h-6" /> : <Fan className="w-6 h-6" />}
                  </div>

                  {/* Informações */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                        {item.name}
                        {item.purchased && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            Instalado na Loja
                          </span>
                        )}
                      </h3>
                      <span className="font-display font-bold text-sm sm:text-base text-amber-300 shrink-0">
                        {formatPrice(item.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mt-0.5 mb-1.5">
                      {isCamera ? (
                        <ShieldCheck className="w-3 h-3 text-sky-400" />
                      ) : (
                        <Wind className="w-3 h-3 text-amber-400" />
                      )}
                      <span>{item.category}</span>
                    </div>

                    <p className="text-xs text-stone-400 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Ação */}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-stone-500">
                        {item.purchased ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Ativo e visível no interior da loja 2D
                          </span>
                        ) : canAfford ? (
                          <span className="text-stone-400">Pronto para comprar</span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Faltam {formatPrice(item.price - currentBalance)}
                          </span>
                        )}
                      </div>

                      {item.purchased ? (
                        <button
                          disabled
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-950/60 text-emerald-300 text-xs font-semibold border border-emerald-800/40 cursor-default"
                        >
                          Adquirido
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={!canAfford}
                          className={`px-4 py-2 rounded-xl text-xs font-display font-bold transition-all cursor-pointer ${
                            canAfford
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-md active:scale-95'
                              : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-800'
                          }`}
                        >
                          Comprar por {formatPrice(item.price)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé informativo */}
        <div className="p-4 bg-stone-950/60 border-t border-stone-800/70 flex items-center justify-between text-xs">
          <span className="text-stone-400">
            Realize mais entregas de plantas em Olinda para obter saldo e desbloquear novos itens!
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium rounded-xl transition-colors cursor-pointer shrink-0 ml-3"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
