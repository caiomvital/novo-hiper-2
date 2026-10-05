import React from 'react';
import { DeliveryDestination } from '../types';
import { sounds } from '../services/sound';
import { AlertTriangle, Trash2, X, MapPin, User } from 'lucide-react';

interface DeleteDestinationModalProps {
  destination: DeliveryDestination | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteDestinationModal: React.FC<DeleteDestinationModalProps> = ({
  destination,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !destination) return null;

  return (
    <div className="fixed inset-0 z-60 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="delete-destination-modal"
        className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2 text-rose-700">
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="font-display font-bold text-base text-stone-900">
              Excluir Endereço
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playPlim();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-stone-50 hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-xs sm:text-sm text-stone-600 space-y-2">
          <p>
            Deseja remover o endereço de <strong>{destination.name}</strong> do mapa de entregas?
          </p>
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600 flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
            <span className="font-medium text-stone-800">{destination.address}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={() => {
              sounds.playPlim();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold text-xs sm:text-sm cursor-pointer"
          >
            Voltar
          </button>
          <button
            id="btn-confirm-delete-destination"
            type="button"
            onClick={() => {
              sounds.playDeleteConfirm();
              onConfirm();
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-display font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Sim, Excluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
