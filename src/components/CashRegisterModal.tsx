import React from 'react';
import { CashRegister, Plant } from '../types';
import { formatPrice } from '../services/storage';
import { sounds } from '../services/sound';
import { 
  X, 
  Coins, 
  TrendingUp, 
  PackageCheck, 
  Package, 
  Sparkles, 
  Store,
  Calendar,
  UserCheck,
  MapPin,
  HelpCircle
} from 'lucide-react';

interface CashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashRegister: CashRegister;
  plants: Plant[];
}

export const CashRegisterModal: React.FC<CashRegisterModalProps> = ({
  isOpen,
  onClose,
  cashRegister,
  plants
}) => {
  if (!isOpen) return null;

  const totalUnitsInStock = plants.reduce((sum, p) => sum + (p.stock || 0), 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        id="cash-register-modal-container"
        className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-900 via-emerald-800 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 flex items-center justify-center text-amber-300 shadow-sm">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-700/80 text-emerald-100 border border-emerald-600/50">
                  Lojinha do Bernardo
                </span>
                <span className="text-emerald-300 text-xs flex items-center gap-1 font-medium">
                  <Sparkles className="w-3 h-3" /> Fictício & Lúdico
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white mt-0.5">
                Caixa Virtual da Loja
              </h2>
            </div>
          </div>

          <button
            id="btn-close-cash-register"
            type="button"
            onClick={() => {
              sounds.playPlim();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/10"
            aria-label="Fechar caixa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Note for Child/Parents */}
        <div className="bg-amber-50 px-5 py-2.5 border-b border-amber-200/80 flex items-center gap-2 text-xs text-amber-900 font-medium">
          <HelpCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>
            Este saldo é <strong>100% fictício</strong> e faz parte da brincadeira de cuidar da loja, controlar o estoque e fazer entregas!
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Main Financial Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Saldo no Caixa */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-2">
                <span>Saldo Atual</span>
                <Coins className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-display font-extrabold text-emerald-950 block">
                  {formatPrice(cashRegister.balance)}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium">
                  Em caixa
                </span>
              </div>
            </div>

            {/* Total de Vendas */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-600 text-xs font-semibold mb-2">
                <span>Total Vendas</span>
                <TrendingUp className="w-4 h-4 text-stone-500" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-display font-bold text-stone-900 block">
                  {formatPrice(cashRegister.totalSales)}
                </span>
                <span className="text-[10px] text-stone-500 font-medium">
                  Faturamento fictício
                </span>
              </div>
            </div>

            {/* Entregas Concluídas */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-600 text-xs font-semibold mb-2">
                <span>Entregas</span>
                <PackageCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-display font-bold text-stone-900 block">
                  {cashRegister.salesHistory.length}
                </span>
                <span className="text-[10px] text-stone-500 font-medium">
                  {cashRegister.salesHistory.length === 1 ? 'Venda realizada' : 'Vendas realizadas'}
                </span>
              </div>
            </div>

            {/* Unidades em Estoque */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between">
              <div className="flex items-center justify-between text-stone-600 text-xs font-semibold mb-2">
                <span>Estoque</span>
                <Package className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-display font-bold text-stone-900 block">
                  {totalUnitsInStock}
                </span>
                <span className="text-[10px] text-stone-500 font-medium">
                  {totalUnitsInStock === 1 ? 'Planta no viveiro' : 'Plantas no viveiro'}
                </span>
              </div>
            </div>
          </div>

          {/* Sales History List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base sm:text-lg font-display font-bold text-stone-900 flex items-center gap-2">
                <span>Histórico de Vendas</span>
                <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  {cashRegister.salesHistory.length}
                </span>
              </h3>
              <span className="text-xs text-stone-400 font-medium">
                Vendas mais recentes primeiro
              </span>
            </div>

            {cashRegister.salesHistory.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-stone-50 border border-dashed border-stone-300">
                <Store className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-stone-800">
                  Nenhuma venda registrada ainda
                </h4>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Quando você atender a um pedido e concluir a entrega no mapa de Olinda, o valor da planta entrará automaticamente para este caixa!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {cashRegister.salesHistory.map((sale) => {
                  const formattedTime = new Intl.DateTimeFormat('pt-BR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).format(new Date(sale.timestamp));

                  return (
                    <div
                      key={sale.id}
                      className="p-3.5 rounded-2xl bg-white border border-stone-200 hover:border-emerald-300 shadow-2xs transition-all flex items-center justify-between gap-3"
                    >
                      {/* Left: Plant Image + Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {sale.plantPhotoUrl ? (
                          <img
                            src={sale.plantPhotoUrl}
                            alt={sale.plantName}
                            className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                            <Store className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className="text-sm font-display font-bold text-stone-900 truncate">
                            {sale.plantName}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            <span className="flex items-center gap-1 font-medium text-stone-700 truncate">
                              <UserCheck className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                              {sale.customerName}
                            </span>
                            <span className="text-stone-300">•</span>
                            <span className="flex items-center gap-1 text-[11px] text-stone-400">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {formattedTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Price Earned */}
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm sm:text-base font-display font-extrabold text-emerald-800 block">
                          + {formatPrice(sale.value)}
                        </span>
                        <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Entregue
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <div className="text-xs text-stone-500">
            <span>Saldo total acumulado: </span>
            <strong className="text-stone-800 font-bold">{formatPrice(cashRegister.balance)}</strong>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playPlim();
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-display font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Voltar à Loja
          </button>
        </div>
      </div>
    </div>
  );
};
