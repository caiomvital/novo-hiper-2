import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div 
      id="pwa-offline-banner"
      role="status"
      className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 select-none shadow-2xs z-40 sticky top-0"
    >
      <WifiOff className="w-4 h-4 text-amber-700 flex-shrink-0 animate-pulse" />
      <span>
        Você está sem internet. Pode consultar os últimos dados carregados. Salvar, entregar e comprar precisam de conexão; ao reconectar, a loja confere os dados do servidor.
      </span>
    </div>
  );
};
