import React from 'react';
import { 
  Package, 
  MapPin, 
  ArrowRight, 
  X, 
  ShoppingBag, 
  Plus, 
  AlertCircle, 
  Store, 
  Sparkles, 
  Clock 
} from 'lucide-react';
import { CustomerOrder, Plant } from '../../types';
import { formatPrice } from '../../services/storage';

interface MissionSelectModalProps {
  orders: CustomerOrder[];
  plants: Plant[];
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (order: CustomerOrder) => void;
  onCreateSimulationOrder: () => void;
  onGoToCatalog: () => void;
}

export const MissionSelectModal: React.FC<MissionSelectModalProps> = ({
  orders,
  plants,
  isOpen,
  onClose,
  onSelectOrder,
  onCreateSimulationOrder,
  onGoToCatalog,
}) => {
  if (!isOpen) return null;

  // Filtrar apenas pedidos que ainda não foram entregues
  const pendingOrders = orders.filter((o) => o.status !== 'entregue');
  const availablePlants = plants.filter((p) => (p.stock ?? 0) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Package className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold">
                Escolher Missão de Entrega
              </h3>
              <p className="text-xs text-emerald-100">
                Selecione um pedido para Bernardo levar pelas ruas de Olinda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Pedidos Disponíveis */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {pendingOrders.length === 0 ? (
            <div className="text-center py-8 px-4 bg-stone-50 rounded-2xl border border-stone-200">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <h4 className="text-base font-display font-bold text-stone-900 mb-1">
                Nenhum pedido pendente no momento
              </h4>
              <p className="text-xs text-stone-600 mb-5 max-w-sm mx-auto leading-relaxed">
                {plants.length === 0
                  ? 'Você ainda não cadastrou plantas no catálogo do Novo Hiper.'
                  : availablePlants.length === 0
                  ? 'Todas as suas plantas cadastradas estão com estoque esgotado no viveiro.'
                  : 'Todos os pedidos recebidos já foram entregues! Gere um novo pedido de cliente para iniciar outra entrega.'}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                {plants.length === 0 || availablePlants.length === 0 ? (
                  <button
                    type="button"
                    onClick={onGoToCatalog}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Store className="w-4 h-4" />
                    <span>Ir ao Catálogo de Plantas</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCreateSimulationOrder}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Gerar Novo Pedido de Cliente</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            pendingOrders.map((order) => {
              const plant = plants.find((p) => p.id === order.plantId);
              const isStockOut = !plant || (plant.stock ?? 0) <= 0;

              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isStockOut
                      ? 'bg-stone-50 border-stone-200 opacity-70'
                      : 'bg-white border-stone-200 hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Foto da planta */}
                    <img
                      src={order.plantPhotoUrl}
                      alt={order.plantName}
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-display font-bold text-stone-900">
                          {order.plantName}
                        </h4>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          {formatPrice(order.totalPrice)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-stone-600">
                        <span className="font-semibold text-stone-900">
                          Cliente: {order.customerName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-stone-500">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                        <span className="line-clamp-1">{order.customerAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ação */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                    {isStockOut ? (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        Sem estoque
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectOrder(order)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        <span>Entregar 🚴</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com atalho para novo pedido rápido */}
        {pendingOrders.length > 0 && (
          <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3 text-xs text-stone-600">
            <span>Quer mais opções de entrega?</span>
            <button
              type="button"
              onClick={onCreateSimulationOrder}
              className="inline-flex items-center gap-1.5 text-emerald-800 font-bold hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simular Outro Pedido</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
