import React, { useState, useRef, useEffect } from 'react';
import { Plant } from '../types';
import { REALISTIC_PLANT_PRESETS, CARE_TAGS, compressImage } from '../services/storage';
import { api } from '../services/api';
import { sounds } from '../services/sound';
import { Camera, Image as ImageIcon, Sparkles, X, Check, AlertCircle, Trash2, RefreshCw, Layers, Package, Plus, Minus } from 'lucide-react';
import confetti from 'canvas-confetti';

interface PlantFormModalProps {
  initialPlant?: Plant | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (plantData: Omit<Plant, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) => void;
}

export const PlantFormModal: React.FC<PlantFormModalProps> = ({
  initialPlant,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [price, setPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('5');
  const [photoUrl, setPhotoUrl] = useState('');
  const [careTag, setCareTag] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPlant) {
      setName(initialPlant.name);
      setSpecies(initialPlant.species || '');
      setPrice(initialPlant.price.toString());
      setStock(initialPlant.stock !== undefined ? initialPlant.stock.toString() : '5');
      setPhotoUrl(initialPlant.photoUrl);
      setCareTag(initialPlant.careTag || '');
    } else {
      setName('');
      setSpecies('');
      setPrice('');
      setStock('5');
      setPhotoUrl('');
      setCareTag('');
    }
    setErrorMsg(null);
    setShowPresets(false);
  }, [initialPlant, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingPhoto(true);
    setErrorMsg(null);
    try {
      let finalUrl = '';
      try {
        finalUrl = await api.uploadImage(file);
      } catch (uploadErr) {
        console.warn('Servidor offline para upload direto, usando compressão local:', uploadErr);
        finalUrl = await compressImage(file, 800, 0.85);
      }
      setPhotoUrl(finalUrl);
      setShowPresets(false);
      sounds.playSelectPhoto();
    } catch (err) {
      console.error(err);
      setErrorMsg('Não foi possível carregar a fotografia. Tente novamente.');
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSelectPreset = (preset: typeof REALISTIC_PLANT_PRESETS[0]) => {
    setPhotoUrl(preset.imageUrl);
    if (!name) setName(preset.name);
    if (!species) setSpecies(preset.species);
    if (!price) setPrice(preset.price.toString());
    if (preset.stock !== undefined) setStock(preset.stock.toString());
    if (!careTag) setCareTag(preset.careTag);
    setShowPresets(false);
    setErrorMsg(null);
    sounds.playSelectPhoto();
  };

  const handleQuickPrice = (value: number) => {
    sounds.playPlim();
    setPrice(value.toString());
    setErrorMsg(null);
  };

  const handleStockDelta = (delta: number) => {
    sounds.playPop();
    const current = parseInt(stock, 10) || 0;
    const next = Math.max(0, current + delta);
    setStock(next.toString());
    setErrorMsg(null);
  };

  const handleQuickStock = (value: number) => {
    sounds.playPlim();
    setStock(value.toString());
    setErrorMsg(null);
  };

  const handleToggleCareTag = (tag: string) => {
    sounds.playPlim();
    setCareTag(careTag === tag ? '' : tag);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Por favor, informe o nome da planta para o catálogo.');
      return;
    }

    const parsedPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg('Digite um preço numérico válido em reais (R$).');
      return;
    }

    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      setErrorMsg('Informe uma quantidade válida para o estoque (número inteiro igual ou maior que zero).');
      return;
    }

    if (!photoUrl) {
      setErrorMsg('Tire uma foto da planta ou escolha uma fotografia do acervo.');
      return;
    }

    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#047857', '#059669', '#10b981', '#34d399'],
      });
    } catch {}

    onSave({
      id: initialPlant?.id,
      createdAt: initialPlant?.createdAt,
      name: trimmedName,
      species: species.trim() || undefined,
      price: Math.round(parsedPrice * 100) / 100,
      stock: parsedStock,
      photoUrl,
      careTag: careTag || undefined,
      isExample: false,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        id="plant-form-container"
        className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Gestão de Estoque
            </span>
            <h2 className="text-lg sm:text-xl font-display font-bold text-stone-900">
              {initialPlant ? 'Editar Planta' : 'Cadastrar Nova Planta no Novo Hiper'}
            </h2>
          </div>
          <button
            id="btn-close-form"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center border border-stone-200 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4.5 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Realistic Plant Photo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
              1. Fotografia da Planta <span className="text-rose-600">*</span>
            </label>

            {photoUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 aspect-4/3 flex items-center justify-center group">
                <img
                  src={photoUrl}
                  alt="Fotografia da planta"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-white text-stone-900 font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-stone-50 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                    Trocar Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPlim();
                      setPhotoUrl('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-rose-800 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    id="btn-take-photo"
                    type="button"
                    disabled={isProcessingPhoto}
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-4 rounded-2xl border border-stone-300 hover:border-emerald-600 hover:bg-stone-50 transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-emerald-100 text-stone-700 group-hover:text-emerald-800 flex items-center justify-center transition-colors">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block font-display font-bold text-xs sm:text-sm text-stone-900">
                        Câmera
                      </span>
                      <span className="text-[11px] text-stone-500">Fotografar agora</span>
                    </div>
                  </button>

                  <button
                    id="btn-gallery-photo"
                    type="button"
                    disabled={isProcessingPhoto}
                    onClick={() => galleryInputRef.current?.click()}
                    className="p-4 rounded-2xl border border-stone-300 hover:border-emerald-600 hover:bg-stone-50 transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-emerald-100 text-stone-700 group-hover:text-emerald-800 flex items-center justify-center transition-colors">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block font-display font-bold text-xs sm:text-sm text-stone-900">
                        Galeria de Fotos
                      </span>
                      <span className="text-[11px] text-stone-500">Selecionar arquivo</span>
                    </div>
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPlim();
                      setShowPresets(!showPresets);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold flex items-center justify-center gap-2 border border-stone-200 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-stone-500" />
                    <span>Ou escolher fotografia botânica do acervo</span>
                  </button>

                  {showPresets && (
                    <div className="mt-2.5 p-3 bg-stone-50 rounded-2xl border border-stone-200 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {REALISTIC_PLANT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className="p-2 rounded-xl bg-white hover:border-emerald-600 border border-stone-200 flex flex-col items-start gap-1.5 transition-all cursor-pointer text-left group"
                        >
                          <img
                            src={preset.imageUrl}
                            alt={preset.name}
                            className="w-full h-20 rounded-lg object-cover"
                          />
                          <div className="min-w-0 w-full">
                            <span className="text-xs font-bold text-stone-900 block truncate">
                              {preset.name}
                            </span>
                            <span className="text-[10px] text-stone-500 italic block truncate">
                              {preset.species}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Section 2: Name and Botanical Species */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="input-plant-name"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
              >
                2. Nome da Planta <span className="text-rose-600">*</span>
              </label>
              <input
                id="input-plant-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ex: Costela-de-Adão, Orquídea..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400"
              />
            </div>

            <div>
              <label
                htmlFor="input-plant-species"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
              >
                Espécie / Variedade <span className="text-xs font-normal text-stone-400">(opcional)</span>
              </label>
              <input
                id="input-plant-species"
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="Ex: Monstera deliciosa"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none text-sm font-medium text-stone-900 placeholder:text-stone-400 italic"
              />
            </div>
          </div>

          {/* Section 3: Price */}
          <div>
            <label
              htmlFor="input-plant-price"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              3. Preço de Venda (R$) <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-display font-bold text-stone-500 text-sm">
                R$
              </span>
              <input
                id="input-plant-price"
                type="number"
                step="0.50"
                min="0"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="0,00"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none font-display font-bold text-base text-stone-900 placeholder:text-stone-400"
              />
            </div>

            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-xs text-stone-400 font-medium mr-1 flex-shrink-0">
                Atalhos de valor:
              </span>
              {[15, 25, 35, 50, 75].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickPrice(val)}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-xs font-semibold cursor-pointer flex-shrink-0"
                >
                  R$ {val},00
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Stock Quantity */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="input-plant-stock"
                className="block text-xs font-bold uppercase tracking-wider text-stone-700"
              >
                4. Quantidade em Estoque (Vasos) <span className="text-rose-600">*</span>
              </label>
              <span className="text-xs text-stone-500 font-medium">
                {parseInt(stock, 10) === 0 ? 'Sem estoque' : `${stock} no viveiro`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={(parseInt(stock, 10) || 0) <= 0}
                onClick={() => handleStockDelta(-1)}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 disabled:opacity-40 text-stone-700 flex items-center justify-center border border-stone-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
                title="Diminuir 1 unidade"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <input
                  id="input-plant-stock"
                  type="number"
                  step="1"
                  min="0"
                  value={stock}
                  onChange={(e) => {
                    setStock(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="5"
                  className="w-full text-center px-4 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 outline-none font-display font-bold text-base text-stone-900 placeholder:text-stone-400"
                />
              </div>

              <button
                type="button"
                onClick={() => handleStockDelta(1)}
                className="w-10 h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Adicionar 1 unidade"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-xs text-stone-400 font-medium mr-1 flex-shrink-0">
                Quantidades rápidas:
              </span>
              {[1, 3, 5, 8, 12].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickStock(val)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer flex-shrink-0 transition-colors ${
                    parseInt(stock, 10) === val
                      ? 'bg-emerald-800 text-white border-emerald-800'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200'
                  }`}
                >
                  {val} un.
                </button>
              ))}
            </div>
          </div>

          {/* Section 5: Care and Environment */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
              5. Ambiente e Cuidados
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CARE_TAGS.map((tag) => {
                const isSelected = careTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleCareTag(tag)}
                    className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                    }`}
                  >
                    <span>{tag}</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2.5">
            <button
              id="btn-cancel-form"
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
              id="btn-save-plant"
              type="submit"
              disabled={isProcessingPhoto}
              className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-display font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{initialPlant ? 'Salvar Alterações' : 'Cadastrar no Estoque'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
