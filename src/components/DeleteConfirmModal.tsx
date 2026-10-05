import React from 'react';
import { Plant } from '../types';
import { Trash2 } from 'lucide-react';
import { sounds } from '../services/sound';

interface DeleteConfirmModalProps {
  plant: Plant | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  plant,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !plant) return null;

  const handleConfirm = () => {
    sounds.playDeleteConfirm();
    onConfirm();
  };

  const handleCancel = () => {
    sounds.playPlim();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="delete-confirm-dialog"
        className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-stone-200 text-center animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <Trash2 className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-display font-bold text-stone-900 mb-2">
          Remover Planta do Estoque?
        </h3>

        <p className="text-xs sm:text-sm text-stone-600 mb-6 leading-relaxed">
          Tem certeza de que deseja retirar a planta{' '}
          <strong className="text-stone-900 font-bold">"{plant.name}"</strong> do catálogo do{' '}
          <strong>Novo Hiper</strong>?
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            id="btn-cancel-delete"
            type="button"
            onClick={handleCancel}
            className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            Manter no Estoque
          </button>
          <button
            id="btn-confirm-delete"
            type="button"
            onClick={handleConfirm}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-display font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer"
          >
            Sim, Remover
          </button>
        </div>
      </div>
    </div>
  );
};
