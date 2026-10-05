import React from 'react';
import { 
  CheckCircle2, 
  Sparkles, 
  Coins, 
  ArrowRight, 
  Store, 
  ShoppingBag, 
  TrendingUp, 
  Heart,
  MapPin
} from 'lucide-react';
import { DeliveryMission } from '../../game/types';
import { formatPrice } from '../../services/storage';

interface DeliverySuccessModalProps {
  mission: DeliveryMission | null;
  isOpen: boolean;
  onNextDelivery: () => void;
  onGoToStore: () => void;
  onOpenStoreUpgrades?: () => void;
}

export const DeliverySuccessModal: React.FC<DeliverySuccessModalProps> = ({
  mission,
  isOpen,
  onNextDelivery,
  onGoToStore,
  onOpenStoreUpgrades,
}) => {
  if (!isOpen || !mission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden text-center animate-scale-up">
        {/* Banner Superior com Efeito de Celebração */}
        <div className="relative p-6 bg-gradient-to-b from-emerald-700 via-emerald-800 to-teal-900 text-white overflow-hidden">
          {/* Luzes decorativas de fundo */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Ícone de Sucesso */}
            <div className="w-16 h-16 rounded-3xl bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-emerald-300 shadow-xl mb-3 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-emerald-100 text-xs font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Entrega Realizada em Olinda!</span>
            </div>

            <h3 className="text-2xl font-display font-black text-white">
              Parabéns, Bernardo!
            </h3>
            <p className="text-xs text-emerald-100 mt-1">
              A planta foi entregue com muito carinho e cuidado.
            </p>
          </div>
        </div>

        {/* Corpo com Detalhes da Venda e Pagamento */}
        <div className="p-6 space-y-5">
          {/* Card da Planta e Cliente */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-left flex items-center gap-4">
            <img
              src={mission.plant.photoUrl}
              alt={mission.plant.name}
              className="w-16 h-16 rounded-xl object-cover border border-stone-200 flex-shrink-0 shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Planta Entregue
              </span>
              <h4 className="text-base font-display font-bold text-stone-900 truncate">
                {mission.plant.name}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                {mission.customer.avatarUrl && (
                  <img
                    src={mission.customer.avatarUrl}
                    alt={mission.customer.name}
                    className="w-5 h-5 rounded-full object-cover border border-stone-300"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="text-xs text-stone-600 truncate">
                  Cliente: <strong className="text-stone-800">{mission.customer.name}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Destaque do Pagamento no Caixa */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-800 text-xs font-bold mb-0.5">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>Pagamento Recebido & Registrado no Caixa</span>
            </div>
            <div className="text-3xl font-display font-black text-amber-950">
              +{formatPrice(mission.plant.price)}
            </div>
            <p className="text-[11px] text-amber-800/80 mt-1">
              Saldo somado ao Caixa Virtual do Novo Hiper. Estoque atualizado automaticamente.
            </p>
          </div>

          {/* Agradecimento do Cliente */}
          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-950 flex items-start gap-2 text-left">
            <Heart className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="italic">
              "{mission.customer.name}: Bernardo, a planta chegou perfeita! Muito obrigado pela dedicação e cuidado."
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2 pt-1">
            {onOpenStoreUpgrades && (
              <button
                type="button"
                onClick={onOpenStoreUpgrades}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-display font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-200" />
                <span>Comprar Melhorias para a Loja</span>
              </button>
            )}

            <button
              id="btn-game-next-delivery"
              type="button"
              onClick={onNextDelivery}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              <span>Fazer Outra Entrega no Mapa</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onGoToStore}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl border border-stone-200 hover:bg-stone-50 active:bg-stone-100 text-stone-700 font-display font-semibold text-xs transition-all cursor-pointer"
            >
              <Store className="w-4 h-4 text-stone-500" />
              <span>Voltar ao Catálogo e Caixa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
