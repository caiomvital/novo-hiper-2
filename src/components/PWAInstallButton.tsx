import React, { useState } from 'react';
import { Download, Share, PlusSquare, CheckCircle, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { sounds } from '../services/sound';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running inside standalone app, do not display install triggers
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    sounds.playPlim();
    if (isInstallable) {
      const success = await install();
      if (success) {
        sounds.playBellRing();
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // If browser doesn't support beforeinstallprompt and it's not iOS, don't show or show friendly guide
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {justInstalled ? (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold animate-fade-in">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>Instalado!</span>
        </div>
      ) : (
        <button
          id="btn-pwa-install"
          type="button"
          onClick={handleInstallClick}
          aria-label="Instalar aplicativo Novo Hiper"
          title="Instalar aplicativo no celular ou computador"
          className={`inline-flex items-center gap-1.5 rounded-xl font-display font-bold transition-all cursor-pointer shadow-2xs ${
            compact
              ? 'p-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs border border-emerald-600'
              : 'px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm border border-emerald-600 active:scale-95'
          }`}
        >
          <Download className="w-3.5 h-3.5 flex-shrink-0 animate-bounce" />
          <span className="whitespace-nowrap">
            {compact ? 'Instalar' : 'Instalar App'}
          </span>
        </button>
      )}

      {/* Modal Guia de Instalação para iPhone / iPad (Safari) */}
      {showIOSModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowIOSModal(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-stone-900 text-base">
                  Instalar no iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
                aria-label="Fechar guia"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs sm:text-sm text-stone-600">
              <p className="text-stone-700 font-medium">
                No Safari da Apple, você pode instalar o <strong>Novo Hiper</strong> direto na tela inicial em 2 passos rápidos:
              </p>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg flex-shrink-0 mt-0.5">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block text-stone-800 text-xs">1. Toque em Compartilhar</strong>
                  <span className="text-[11px] text-stone-500">
                    O botão com ícone de seta saindo do quadrado na barra do Safari (na parte inferior ou superior).
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg flex-shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block text-stone-800 text-xs">2. Adicionar à Tela de Início</strong>
                  <span className="text-[11px] text-stone-500">
                    Role a lista para baixo e toque em &quot;Adicionar à Tela de Início&quot;.
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playPlim();
                setShowIOSModal(false);
              }}
              className="w-full mt-2 py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-display font-bold text-xs sm:text-sm cursor-pointer"
            >
              Entendido! 🪴
            </button>
          </div>
        </div>
      )}
    </>
  );
};
