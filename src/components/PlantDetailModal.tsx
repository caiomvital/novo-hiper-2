import React from 'react';
import { Plant } from '../types';
import { formatPrice } from '../services/storage';
import { sounds } from '../services/sound';
import { X, Edit3, Trash2, Calendar, Tag, Truck, CheckCircle2, Package, Plus, Minus, AlertCircle } from 'lucide-react';

interface PlantDetailModalProps {
  plant: Plant | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (plant: Plant) => void;
  onDeleteRequest: (plant: Plant) => void;
  onSendToDelivery?: (plant: Plant) => void;
  onUpdateStock?: (plantId: string, newStock: number) => void;
}

export const PlantDetailModal: React.FC<PlantDetailModalProps> = ({
  plant,
  isOpen,
  onClose,
  onEdit,
  onDeleteRequest,
  onSendToDelivery,
  onUpdateStock,
}) => {
  if (!isOpen || !plant) return null;

  const formattedDate = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(plant.createdAt));

  const handleEditClick = () => {
    sounds.playEditPlant();
    onEdit(plant);
  };

  const handleDeleteClick = () => {
    sounds.playPlim();
    onDeleteRequest(plant);
  };

  const handleDeliverClick = () => {
    if (plant.stock <= 0) {
      sounds.playPop();
      return;
    }
    sounds.playPlim();
    if (onSendToDelivery) {
      onSendToDelivery(plant);
    }
  };

  const handleStockChange = (delta: number) => {
    const nextStock = Math.max(0, (plant.stock || 0) + delta);
    sounds.playPop();
    if (onUpdateStock) {
      onUpdateStock(plant.id, nextStock);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        id="plant-detail-container"
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header / Top Close */}
        <div className="absolute top-3 right-3 z-20">
          <button
            id="btn-close-detail"
            onClick={() => {
              sounds.playPlim();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-stone-700 hover:text-stone-950 flex items-center justify-center shadow-md border border-stone-200 transition-all cursor-pointer"
            aria-label="Fechar detalhes"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Featured Botanical Photo */}
        <div className="relative w-full aspect-4/3 bg-stone-100 overflow-hidden">
          <img
            src={plant.photoUrl}
            alt={plant.name}
            className="w-full h-full object-cover"
          />

          {plant.isExample && (
            <div className="absolute top-3 left-3 bg-stone-900/80 text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-stone-300" />
              <span>Amostra Botânica</span>
            </div>
          )}

          {/* Out of Stock Overlay */}
          {plant.stock === 0 && (
            <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-2xs flex items-center justify-center">
              <div className="bg-rose-700 text-white px-4 py-1.5 rounded-full text-sm font-display font-bold shadow-lg border border-white/30 tracking-wider uppercase">
                Esgotado no Estoque
              </div>
            </div>
          )}

          {/* Price Pill */}
          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl shadow-lg border border-stone-200 font-display font-extrabold text-emerald-900 text-xl sm:text-2xl">
            {formatPrice(plant.price)}
          </div>
        </div>

        {/* Plant Technical & Store Sheet */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Registro de Produto • Novo Hiper
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-stone-900 leading-tight mt-0.5">
              {plant.name}
            </h2>

            {plant.species && (
              <p className="text-sm text-stone-500 italic mt-0.5">
                {plant.species}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {plant.careTag && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-200">
                  {plant.careTag}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-stone-500 px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Cadastrada em {formattedDate}
              </span>
            </div>
          </div>

          {/* Estoque e Reabastecimento Rápido */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  plant.stock === 0
                    ? 'bg-rose-100 text-rose-800'
                    : plant.stock <= 2
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-display font-bold text-stone-900">
                    Estoque Disponível
                  </h4>
                  <p className="text-xs text-stone-500">
                    {plant.stock === 0 
                      ? 'Nenhuma unidade no momento' 
                      : `${plant.stock} ${plant.stock === 1 ? 'vaso disponível' : 'vasos disponíveis'}`
                    }
                  </p>
                </div>
              </div>

              {/* Botões rápidos de adicionar/remover estoque */}
              {onUpdateStock && (
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
                  <button
                    type="button"
                    disabled={plant.stock <= 0}
                    onClick={() => handleStockChange(-1)}
                    className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 active:bg-stone-300 disabled:opacity-40 text-stone-700 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="Diminuir 1 unidade do estoque"
                    aria-label="Diminuir estoque"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-display font-extrabold text-stone-900 text-sm">
                    {plant.stock}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStockChange(1)}
                    className="w-8 h-8 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="Adicionar 1 unidade ao estoque"
                    aria-label="Aumentar estoque"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {plant.stock === 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Esta planta está esgotada. Toque no botão <strong>+</strong> acima para repor o estoque!</span>
              </div>
            )}
          </div>

          {/* Delivery Dispatch Callout */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-display font-bold text-stone-900">
                  {plant.stock > 0 ? 'Pronta para Entrega' : 'Aguardando Estoque'}
                </h4>
                <p className="text-xs text-stone-500">
                  {plant.stock > 0 
                    ? 'Envie esta planta para um endereço no mapa.' 
                    : 'Reabasteça o estoque para poder entregar.'
                  }
                </p>
              </div>
            </div>

            {onSendToDelivery && (
              plant.stock > 0 ? (
                <button
                  type="button"
                  onClick={handleDeliverClick}
                  className="px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer flex-shrink-0"
                >
                  <span>Despachar</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="px-3.5 py-2 rounded-xl bg-stone-200 text-stone-400 text-xs font-display font-bold flex items-center gap-1.5 cursor-not-allowed flex-shrink-0"
                >
                  <span>Esgotado</span>
                </button>
              )
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-stone-200 flex items-center gap-2.5">
            <button
              id="btn-edit-detail"
              type="button"
              onClick={handleEditClick}
              className="flex-1 py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-stone-600" />
              <span>Editar Dados</span>
            </button>

            <button
              id="btn-delete-detail"
              type="button"
              onClick={handleDeleteClick}
              className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 border border-rose-200 transition-colors cursor-pointer"
              title="Remover planta do estoque"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Remover</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
