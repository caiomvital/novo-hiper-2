import React from 'react';
import { Camera, Plus, Leaf } from 'lucide-react';
import { sounds } from '../services/sound';

interface EmptyStateProps {
  onAddPlant: () => void;
  onAddExample?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAddPlant }) => {
  const handleAddClick = () => {
    sounds.playAddPlant();
    onAddPlant();
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-2xs text-center max-w-lg mx-auto my-6">
      {/* Icon badge */}
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
        <Leaf className="w-8 h-8" />
      </div>

      <h2 className="text-xl sm:text-2xl font-display font-bold text-stone-900 mb-2">
        Catálogo do Novo Hiper Pronto
      </h2>
      <p className="text-stone-600 text-sm leading-relaxed mb-6 max-w-md mx-auto">
        Ainda não há plantas cadastradas no estoque da loja. 
        Tire uma fotografia de uma planta ou flor, informe o nome e determine o preço de venda para abrir os pedidos!
      </p>

      <div className="flex items-center justify-center">
        <button
          id="btn-empty-add-plant"
          onClick={handleAddClick}
          className="flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm px-6 py-3.5 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Camera className="w-5 h-5" />
          <span>Cadastrar Primeira Planta</span>
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-stone-100 grid grid-cols-3 gap-3 text-center text-xs">
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-100">
          <p className="font-bold text-stone-900">1. Fotografe</p>
          <p className="text-[11px] text-stone-500 mt-0.5">Plantas reais com a câmera</p>
        </div>
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-100">
          <p className="font-bold text-stone-900">2. Precifique</p>
          <p className="text-[11px] text-stone-500 mt-0.5">Defina o valor em R$</p>
        </div>
        <div className="p-3 rounded-xl bg-stone-50 border border-stone-100">
          <p className="font-bold text-stone-900">3. Entregue</p>
          <p className="text-[11px] text-stone-500 mt-0.5">Despache pelo mapa</p>
        </div>
      </div>
    </div>
  );
};
