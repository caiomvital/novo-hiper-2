import React from 'react';
import { Plant } from '../types';
import { formatPrice } from '../services/storage';
import { sounds } from '../services/sound';
import { Eye, Edit3, Tag, Truck } from 'lucide-react';

interface PlantCardProps {
  plant: Plant;
  onSelect: (plant: Plant) => void;
  onEdit: (plant: Plant) => void;
  onDeliver?: (plant: Plant) => void;
}

export const PlantCard: React.FC<PlantCardProps> = ({ plant, onSelect, onEdit, onDeliver }) => {
  const handleSelect = () => {
    sounds.playPlim();
    onSelect(plant);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playEditPlant();
    onEdit(plant);
  };

  const handleDeliver = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeliver) {
      sounds.playPlim();
      onDeliver(plant);
    }
  };

  return (
    <div
      id={`plant-card-${plant.id}`}
      onClick={handleSelect}
      className="group relative bg-white rounded-3xl p-3 sm:p-3.5 border border-stone-200 shadow-2xs hover:shadow-md hover:border-stone-300 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      {/* Sample demonstration badge if demo */}
      {plant.isExample && (
        <div className="absolute top-3 left-3 z-10 bg-stone-900/80 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
          <Tag className="w-3 h-3 text-stone-300" />
          <span>Espécie de Amostra</span>
        </div>
      )}

      {/* Image Container with Natural Framing */}
      <div className="relative w-full aspect-4/3 sm:aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-100 mb-3 flex items-center justify-center">
        <img
          src={plant.photoUrl}
          alt={plant.name}
          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
          loading="lazy"
        />

          {/* Floating Price Pill */}
        <div className="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm border border-stone-200 font-display font-extrabold text-emerald-900 text-sm sm:text-base flex items-center gap-1">
          <span>{formatPrice(plant.price)}</span>
        </div>

        {/* Out of stock overlay */}
        {plant.stock === 0 && (
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-2xs flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-rose-600/90 text-white font-display font-bold text-xs shadow-md border border-white/30 tracking-wide uppercase">
              Esgotado
            </span>
          </div>
        )}
      </div>

      {/* Plant Info */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-bold text-base sm:text-lg text-stone-900 leading-tight line-clamp-1 group-hover:text-emerald-800 transition-colors">
              {plant.name}
            </h3>
          </div>

          {plant.species && (
            <p className="text-xs text-stone-500 italic mt-0.5 truncate">
              {plant.species}
            </p>
          )}

          {/* Tags & Stock status */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {plant.stock === 0 ? (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                Sem estoque (0 un.)
              </span>
            ) : plant.stock <= 2 ? (
              <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                Estoque baixo: {plant.stock} un.
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                {plant.stock} un. disponíveis
              </span>
            )}

            {plant.careTag && (
              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                {plant.careTag}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 pt-3 border-t border-stone-100 flex items-center justify-between gap-1.5">
          <button
            id={`btn-view-${plant.id}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
            className="flex-1 py-2 px-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-stone-600" />
            <span>Detalhes</span>
          </button>

          {onDeliver && (
            plant.stock > 0 ? (
              <button
                id={`btn-deliver-${plant.id}`}
                type="button"
                onClick={handleDeliver}
                className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1 border border-emerald-200 transition-colors cursor-pointer"
                title="Realizar entrega no mapa"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Entregar</span>
              </button>
            ) : (
              <button
                id={`btn-deliver-${plant.id}`}
                type="button"
                disabled
                className="py-2 px-2.5 rounded-xl bg-stone-100 text-stone-400 text-xs font-bold flex items-center justify-center gap-1 border border-stone-200 cursor-not-allowed opacity-75"
                title="Planta esgotada! Reabasteça no estoque para entregar"
              >
                <Truck className="w-3.5 h-3.5 text-stone-400" />
                <span>Esgotado</span>
              </button>
            )
          )}

          <button
            id={`btn-edit-${plant.id}`}
            type="button"
            onClick={handleEdit}
            className="p-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-stone-900 border border-stone-200 transition-colors cursor-pointer"
            title="Editar dados da planta"
            aria-label={`Editar ${plant.name}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
