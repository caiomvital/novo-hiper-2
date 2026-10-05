import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Clock, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Sparkles, 
  Plus, 
  AlertCircle,
  ArrowRight,
  Sprout,
  Store,
  UserCheck,
  Gamepad2
} from 'lucide-react';
import { CustomerOrder, OrderStatus, Plant } from '../types';
import { formatPrice } from '../services/storage';
import { sounds } from '../services/sound';

interface OrdersViewProps {
  orders: CustomerOrder[];
  plants: Plant[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onDispatchToMap: (order: CustomerOrder) => void;
  onStartGameDelivery?: (order: CustomerOrder) => void;
  onReceiveNewOrder: () => void;
  onGoToCatalog: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  plants,
  onUpdateOrderStatus,
  onDispatchToMap,
  onStartGameDelivery,
  onReceiveNewOrder,
  onGoToCatalog
}) => {
  const [filter, setFilter] = useState<'todos' | OrderStatus>('todos');

  // Contadores para os filtros
  const countRecebidos = orders.filter(o => o.status === 'recebido').length;
  const countPreparando = orders.filter(o => o.status === 'preparando').length;
  const countProntos = orders.filter(o => o.status === 'pronto').length;
  const countEntregues = orders.filter(o => o.status === 'entregue').length;

  const availablePlantsCount = plants.filter((p) => (p.stock ?? 0) > 0).length;
  const isCatalogEmpty = plants.length === 0;
  const isAllOutOfStock = plants.length > 0 && availablePlantsCount === 0;

  const filteredOrders = orders.filter(order => {
    if (filter === 'todos') return true;
    return order.status === filter;
  });

  const handleStartPrep = (orderId: string) => {
    sounds.playPreparePlant();
    onUpdateOrderStatus(orderId, 'preparando');
  };

  const handleMarkReady = (orderId: string) => {
    sounds.playBellRing();
    onUpdateOrderStatus(orderId, 'pronto');
  };

  const handleGoToMap = (order: CustomerOrder) => {
    sounds.playPlim();
    onDispatchToMap(order);
  };

  // Se não houver plantas no catálogo
  if (plants.length === 0) {
    return (
      <div className="py-12 px-4 max-w-xl mx-auto text-center bg-white rounded-3xl border border-stone-200 shadow-xs p-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-display font-bold text-stone-900 mb-2">
          Cadastre suas plantas primeiro!
        </h3>
        <p className="text-sm text-stone-600 mb-6 leading-relaxed">
          Para que os clientes fictícios de Olinda façam pedidos na sua loja, é necessário ter produtos cadastrados com foto e preço no estoque do Novo Hiper.
        </p>
        <button
          id="btn-go-to-catalog-from-orders"
          type="button"
          onClick={onGoToCatalog}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm shadow-xs transition-all cursor-pointer"
        >
          <Store className="w-4 h-4" />
          <span>Ir para a Loja & Catálogo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-wider text-emerald-800 uppercase bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              Comércio e Vendas
            </span>
            <span className="text-stone-300">•</span>
            <span className="text-xs font-medium text-stone-500">
              Clientes de Olinda
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-display font-bold text-stone-900 flex items-center gap-2.5">
            <span>Central de Pedidos</span>
            <span className="text-xs font-sans font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
              {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 mt-1">
            Consulte as solicitações dos clientes, prepare os vasos de plantas e despache para entrega no mapa.
          </p>
        </div>

        {/* Botão de Receber Novo Pedido */}
        <button
          id="btn-receive-new-order"
          type="button"
          onClick={onReceiveNewOrder}
          className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-display font-bold text-sm shadow-xs transition-all cursor-pointer flex-shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-100" />
          <span>Receber Novo Pedido 🔔</span>
        </button>
      </div>

      {/* Alerta de Catálogo Vazio, Estoque Esgotado ou Loja em Funcionamento */}
      {isCatalogEmpty ? (
        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 text-xs sm:text-sm shadow-xs">
          <div className="flex items-center gap-2.5">
            <Sprout className="w-5 h-5 text-amber-700 flex-shrink-0" />
            <span>
              <strong>Catálogo Vazio:</strong> Cadastre suas primeiras plantas no catálogo para que os clientes de Olinda possam fazer pedidos.
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-xl font-bold text-xs self-start sm:self-auto transition-colors cursor-pointer flex-shrink-0"
          >
            Cadastrar Plantas 🪴
          </button>
        </div>
      ) : isAllOutOfStock ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-900 text-xs sm:text-sm shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>
              <strong>Viveiro esgotado:</strong> Não há plantas com estoque disponível para novos pedidos. Reabasteça os vasos no catálogo!
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold text-xs self-start sm:self-auto transition-colors cursor-pointer flex-shrink-0"
          >
            Reabastecer no Catálogo 🪴
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2 text-emerald-950 text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            <span>
              <strong>Loja Aberta:</strong> {availablePlantsCount} {availablePlantsCount === 1 ? 'espécie' : 'espécies'} prontas para receber pedidos de Olinda.
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 hidden md:inline">
            Pedidos chegam ao longo do dia 🔔
          </span>
        </div>
      )}

      {/* Barra de Filtros de Status */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          type="button"
          onClick={() => { setFilter('todos'); sounds.playPlim(); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'todos'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <span>Todos</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setFilter('recebido'); sounds.playPlim(); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'recebido'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Recebidos</span>
          {countRecebidos > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-900 font-extrabold">
              {countRecebidos}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setFilter('preparando'); sounds.playPlim(); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'preparando'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Sprout className="w-3.5 h-3.5" />
          <span>Em Preparo</span>
          {countPreparando > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-900 font-extrabold">
              {countPreparando}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setFilter('pronto'); sounds.playPlim(); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'pronto'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Prontos para Entrega</span>
          {countProntos > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-extrabold">
              {countProntos}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setFilter('entregue'); sounds.playPlim(); }}
          className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'entregue'
              ? 'bg-stone-700 text-white shadow-xs'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Entregues</span>
          {countEntregues > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-200 text-stone-800 font-semibold">
              {countEntregues}
            </span>
          )}
        </button>
      </div>

      {/* Lista de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="py-12 px-4 text-center bg-white rounded-3xl border border-stone-200 p-8">
          <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          {isCatalogEmpty ? (
            <>
              <h4 className="text-base font-display font-bold text-stone-800 mb-1">
                Nenhum pedido ainda
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mb-5">
                O viveiro do Novo Hiper ainda está vazio. Cadastre e precifique suas primeiras plantas para que os clientes de Olinda façam pedidos!
              </p>
              <button
                type="button"
                onClick={onGoToCatalog}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Ir para o Catálogo de Plantas</span>
              </button>
            </>
          ) : isAllOutOfStock ? (
            <>
              <h4 className="text-base font-display font-bold text-stone-800 mb-1">
                Viveiro sem estoque disponível
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mb-5">
                Todas as espécies cadastradas estão esgotadas no momento. Reabasteça o estoque no catálogo para receber novos pedidos!
              </p>
              <button
                type="button"
                onClick={onGoToCatalog}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>Reabastecer Estoque 🪴</span>
              </button>
            </>
          ) : (
            <>
              <h4 className="text-base font-display font-bold text-stone-800 mb-1">
                Nenhum pedido nesta categoria
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mb-5">
                Você tem {availablePlantsCount} {availablePlantsCount === 1 ? 'planta com estoque' : 'plantas com estoque'}. Toque abaixo para receber um novo pedido de um cliente de Olinda!
              </p>
              <button
                type="button"
                onClick={onReceiveNewOrder}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-100" />
                <span>Receber Novo Pedido 🔔</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {filteredOrders.map((order) => {
            const isCompleted = order.status === 'entregue';
            const isReady = order.status === 'pronto';
            const isPreparing = order.status === 'preparando';
            const isReceived = order.status === 'recebido';

            const matchedPlant = plants.find((p) => p.id === order.plantId);
            const stockAvailable = matchedPlant?.stock ?? 0;
            const isOutOfStock = stockAvailable <= 0;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-sm ${
                  isReady 
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10' 
                    : isPreparing
                    ? 'border-blue-200'
                    : isCompleted
                    ? 'border-stone-200 opacity-90'
                    : 'border-stone-200'
                }`}
              >
                {/* Cabeçalho do Card */}
                <div className="p-4 sm:p-5 border-b border-stone-100">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar do Cliente */}
                      <div className="relative flex-shrink-0">
                        <img
                          src={order.customerAvatarUrl}
                          alt={order.customerName}
                          className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm sm:text-base font-display font-bold text-stone-900 leading-tight">
                            {order.customerName}
                          </h4>
                          <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                            #{order.orderNumber}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-stone-500">
                          {order.customerRole}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isReceived && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          <span>Recebido</span>
                        </span>
                      )}
                      {isPreparing && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                          <Sprout className="w-3 h-3 text-blue-600" />
                          <span>Preparando</span>
                        </span>
                      )}
                      {isReady && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse">
                          <Truck className="w-3 h-3 text-emerald-700" />
                          <span>Pronto p/ Entrega</span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Entregue</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Endereço de Entrega */}
                  <div className="flex items-start gap-1.5 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-1 leading-snug">
                      {order.customerAddress}
                    </span>
                  </div>

                  {/* Mensagem do Cliente */}
                  {order.customerMessage && (
                    <p className="mt-2.5 text-xs italic text-stone-500 bg-emerald-50/40 px-3 py-2 rounded-xl border border-emerald-100/60 leading-relaxed">
                      "{order.customerMessage}"
                    </p>
                  )}
                </div>

                {/* Bloco da Planta Solicitada */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div className="flex items-center gap-3.5 mb-4 p-2.5 rounded-2xl bg-stone-50 border border-stone-100">
                    <img
                      src={order.plantPhotoUrl}
                      alt={order.plantName}
                      className="w-14 h-14 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                        Planta Escolhida
                      </span>
                      <h5 className="text-sm font-display font-bold text-stone-900 truncate">
                        {order.plantName}
                      </h5>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-stone-500">
                            Qtd: {order.quantity} {order.quantity === 1 ? 'vaso' : 'vasos'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              isOutOfStock
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : stockAvailable <= 2
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {isOutOfStock ? 'Sem estoque (0 un.)' : `${stockAvailable} un. no viveiro`}
                          </span>
                        </div>
                        <span className="text-sm font-display font-extrabold text-stone-900">
                          {formatPrice(order.totalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alerta de Estoque Zerado */}
                  {isOutOfStock && !isCompleted && (
                    <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                        <span className="truncate">Estoque zerado no viveiro.</span>
                      </div>
                      <button
                        type="button"
                        onClick={onGoToCatalog}
                        className="text-emerald-800 font-bold underline hover:text-emerald-950 text-[11px] cursor-pointer whitespace-nowrap"
                      >
                        Reabastecer
                      </button>
                    </div>
                  )}

                  {/* Barra de Progresso em 4 Etapas */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 mb-1.5 px-0.5">
                      <span className={isReceived || isPreparing || isReady || isCompleted ? 'text-stone-800' : ''}>
                        1. Recebido
                      </span>
                      <span className={isPreparing || isReady || isCompleted ? 'text-stone-800' : ''}>
                        2. Preparando
                      </span>
                      <span className={isReady || isCompleted ? 'text-stone-800' : ''}>
                        3. Pronto
                      </span>
                      <span className={isCompleted ? 'text-emerald-700 font-extrabold' : ''}>
                        4. Entregue
                      </span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted
                            ? 'w-full bg-emerald-600'
                            : isReady
                            ? 'w-3/4 bg-emerald-500'
                            : isPreparing
                            ? 'w-2/4 bg-blue-500'
                            : 'w-1/4 bg-amber-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Ações do Fluxo */}
                  <div className="pt-2">
                    {isReceived && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartPrep(order.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          <Sprout className="w-4 h-4" />
                          <span>Preparar Planta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoToMap(order)}
                          className="py-2.5 px-3 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-display font-semibold text-xs transition-all cursor-pointer"
                          title="Ir direto ao mapa"
                        >
                          <Truck className="w-4 h-4 text-stone-500" />
                        </button>
                      </div>
                    )}

                    {isPreparing && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkReady(order.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Marcar como Pronto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoToMap(order)}
                          className="py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 font-display font-semibold text-xs transition-all cursor-pointer"
                          title="Entregar agora no mapa"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {isReady && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isOutOfStock) {
                              sounds.playPop();
                              onGoToCatalog();
                            } else if (onStartGameDelivery) {
                              sounds.playPlim();
                              onStartGameDelivery(order);
                            } else {
                              handleGoToMap(order);
                            }
                          }}
                          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-display font-bold text-sm shadow-xs transition-all cursor-pointer ${
                            isOutOfStock
                              ? 'bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white'
                              : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white'
                          }`}
                        >
                          <Gamepad2 className="w-4 h-4 text-emerald-300" />
                          <span>{isOutOfStock ? 'Reabastecer Planta no Catálogo' : 'Entregar no Mini-Jogo 2D 🎮'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>

                        {!isOutOfStock && (
                          <button
                            type="button"
                            onClick={() => handleGoToMap(order)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-display font-medium text-xs transition-all cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 text-stone-400" />
                            <span>Ou ver rota no Mapa Clássico</span>
                          </button>
                        )}
                      </div>
                    )}

                    {isCompleted && (
                      <div className="flex items-center justify-between bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-xs text-stone-600">
                        <span className="flex items-center gap-1.5 font-medium text-emerald-800">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          <span>Entregue ao cliente</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleGoToMap(order)}
                          className="text-stone-500 hover:text-stone-900 underline font-medium text-[11px] cursor-pointer"
                        >
                          Ver no Mapa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
