import React from 'react';
import { Database, CheckCircle, RefreshCw, Server, AlertCircle } from 'lucide-react';
import { MigrationResult } from '../services/migration';

interface BackendStatusBannerProps {
  isBackendConnected: boolean;
  migrationResult: MigrationResult | null;
  isMigrating: boolean;
  onTriggerMigration: () => void;
}

export const BackendStatusBanner: React.FC<BackendStatusBannerProps> = ({
  isBackendConnected,
  migrationResult,
  isMigrating,
  onTriggerMigration,
}) => {
  if (!isBackendConnected) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Modo Local:</strong> O backend SQLite não respondeu. Seus dados continuam salvos no navegador com segurança.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-950 text-emerald-100 border-b border-emerald-900/60 px-4 py-1.5 text-xs">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <div className="flex items-center gap-1.5 font-medium">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Backend Node.js + SQLite ativo</span>
            <span className="text-emerald-500">•</span>
            <span className="text-emerald-300">
              {migrationResult?.migrated
                ? 'Persistência no servidor ativa'
                : 'Pronto para persistência'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMigrating ? (
            <span className="flex items-center gap-1 text-emerald-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Migrando localStorage...
            </span>
          ) : migrationResult?.counts ? (
            <span className="hidden sm:inline text-emerald-400/90 text-[11px]">
              {migrationResult.counts.plants} plantas • {migrationResult.counts.orders} pedidos no SQLite
            </span>
          ) : (
            <button
              onClick={onTriggerMigration}
              className="px-2 py-0.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-medium text-[11px] transition-colors cursor-pointer"
            >
              Sincronizar com SQLite
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
