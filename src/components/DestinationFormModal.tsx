import React, { useState, useEffect } from 'react';
import { DeliveryDestination } from '../types';
import { generateRealisticCoordinatesForAddress } from '../services/storage';
import { sounds } from '../services/sound';
import { X, MapPin, User, Building, Home, GraduationCap, Trees, Store, Check, AlertCircle, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';

interface DestinationFormModalProps {
  initialDestination?: DeliveryDestination | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (destination: DeliveryDestination) => void;
}

export const DestinationFormModal: React.FC<DestinationFormModalProps> = ({
  initialDestination,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<DeliveryDestination['type']>('familia');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialDestination) {
      setName(initialDestination.name);
      setAddress(initialDestination.address);
      setType(initialDestination.type);
      setNotes(initialDestination.notes || '');
    } else {
      setName('');
      setAddress('');
      setType('familia');
      setNotes('');
    }
    setErrorMsg(null);
  }, [initialDestination, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Por favor, digite o nome do cliente (ex: Tio Rodolfo, Vó Maria, Cliente Ana).');
      return;
    }

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setErrorMsg('Por favor, informe o endereço completo (ex: Avenida Olinda, 152 apto 02).');
      return;
    }

    // Calcula coordenadas e distância realista do novo endereço em relação à loja
    const geo = generateRealisticCoordinatesForAddress(trimmedAddress);

    const destination: DeliveryDestination = {
      id: initialDestination?.id || 'dest_custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: trimmedName,
      address: trimmedAddress,
      type,
      distanceKm: initialDestination?.distanceKm || geo.distanceKm,
      lat: initialDestination?.lat || geo.lat,
      lng: initialDestination?.lng || geo.lng,
      description: `Endereço de entrega para ${trimmedName} (${trimmedAddress}).`,
      notes: notes.trim() || undefined,
      isCustom: true,
      createdAt: initialDestination?.createdAt || Date.now(),
    };

    sounds.playSavePlant();
    try {
      confetti({
        particleCount: 40,
        spread: 55,
        origin: { y: 0.6 },
        colors: ['#047857', '#059669', '#34d399', '#3b82f6'],
      });
    } catch {}

    onSave(destination);
    onClose();
  };

  const handleQuickAddress = (quickName: string, quickAddress: string, quickType: DeliveryDestination['type']) => {
    sounds.playPlim();
    setName(quickName);
    setAddress(quickAddress);
    setType(quickType);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        id="destination-form-modal"
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Cadastro de Endereços • Olinda, PE 🌴
            </span>
            <h2 className="text-lg sm:text-xl font-display font-bold text-stone-900">
              {initialDestination ? 'Editar Endereço do Cliente' : 'Cadastrar Novo Cliente no Mapa'}
            </h2>
          </div>
          <button
            id="btn-close-destination-form"
            type="button"
            onClick={() => {
              sounds.playPlim();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center border border-stone-200 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Examples */}
          {!initialDestination && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
              <span className="text-xs font-bold text-emerald-900 block mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <span>Exemplos rápidos de clientes em Olinda:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickAddress('Tio Rodolfo', 'Avenida Olinda, 152 - Apto 02', 'familia')}
                  className="text-xs bg-white hover:bg-emerald-100/70 text-emerald-900 font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer shadow-2xs"
                >
                  Tio Rodolfo (Av. Olinda, 152)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddress('Tia Beatriz', 'Rua do Amparo, 84 - Centro Histórico', 'familia')}
                  className="text-xs bg-white hover:bg-emerald-100/70 text-emerald-900 font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer shadow-2xs"
                >
                  Tia Beatriz (Rua do Amparo)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddress('Padaria do Alto da Sé', 'Alto da Sé, 45 - Carmo', 'comercio')}
                  className="text-xs bg-white hover:bg-emerald-100/70 text-emerald-900 font-semibold px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer shadow-2xs"
                >
                  Padaria Alto da Sé
                </button>
              </div>
            </div>
          )}

          {/* Client Name */}
          <div>
            <label
              htmlFor="input-dest-name"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              1. Nome do Cliente ou Destinatário <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-dest-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ex: Tio Rodolfo, Prima Larissa, Vizinha Clara..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400"
              />
            </div>
          </div>

          {/* Full Street Address */}
          <div>
            <label
              htmlFor="input-dest-address"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              2. Endereço Completo no Mapa de Olinda <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input-dest-address"
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ex: Avenida Olinda, 152 apto 02, Varadouro, Olinda - PE"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              O Novo Hiper posicionará automaticamente o marcador geográfico no mapa de Olinda - PE.
            </p>
          </div>

          {/* Category / Type */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
              3. Tipo de Destino
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'familia', label: 'Família / Parente', icon: Home },
                { id: 'residencia', label: 'Amigo / Residência', icon: Building },
                { id: 'comercio', label: 'Comércio / Loja', icon: Store },
                { id: 'escola', label: 'Escola / Curso', icon: GraduationCap },
                { id: 'parque', label: 'Parque / Jardim', icon: Trees },
              ].map((item) => {
                const isSelected = type === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      sounds.playPlim();
                      setType(item.id as DeliveryDestination['type']);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                        : 'border-stone-200 bg-stone-50 hover:bg-white text-stone-700'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-stone-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Delivery Notes (Intercom, Reference, etc.) */}
          <div>
            <label
              htmlFor="input-dest-notes"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              4. Ponto de Referência ou Observações <span className="text-xs font-normal text-stone-400">(opcional)</span>
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <textarea
                id="input-dest-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Interfone 02, portão verde, deixar com o porteiro..."
                className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-xs sm:text-sm font-medium text-stone-900 placeholder:text-stone-400 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              id="btn-cancel-destination"
              type="button"
              onClick={() => {
                sounds.playPlim();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold text-xs sm:text-sm cursor-pointer"
            >
              Cancelar
            </button>
            <button
              id="btn-save-destination"
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{initialDestination ? 'Salvar Alterações' : 'Adicionar ao Mapa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
