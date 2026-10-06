import { api } from './api';
import { 
  getStoredPlants, 
  getStoredDeliveries, 
  getStoredDestinations, 
  getStoredOrders, 
  getStoredCashRegister,
  FICTIONAL_CUSTOMERS
} from './storage';
import { getStoredUpgrades } from './storeUpgrades';

export const MIGRATION_FLAG_KEY = 'novo_hiper_sqlite_migrated_v1';

export interface MigrationResult {
  migrated: boolean;
  message: string;
  counts?: {
    plants: number;
    customers: number;
    orders: number;
    deliveries: number;
    cashTransactions: number;
  };
  error?: string;
}

export async function runAutomaticLocalStorageMigration(): Promise<MigrationResult> {
  try {
    // 1. Checar conectividade com o backend Node.js + SQLite
    const isBackendAvailable = await api.checkHealth();
    if (!isBackendAvailable) {
      return {
        migrated: false,
        message: 'Backend SQLite indisponível ou offline. Operando em modo de compatibilidade local.',
      };
    }

    // 2. Obter status atual do banco no servidor
    const serverStatus = await api.getMigrationStatus();
    const hasDataOnServer =
      (serverStatus?.counts?.plants || 0) > 0 ||
      (serverStatus?.counts?.orders || 0) > 0;

    // 2.1 Importação legada desativada no servidor (produção, depois de concluída): não há o que enviar.
    //     Marca como concluída para não tentar de novo e NÃO exibe erro ao usuário.
    if (serverStatus?.legacyMigrationEnabled === false) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return {
        migrated: true,
        message: 'Base SQLite é a fonte de verdade. A importação do localStorage está desativada neste ambiente.',
        counts: serverStatus?.counts,
      };
    }

    // 3. Verificar se a migração já foi realizada com sucesso anteriormente.
    // Esta flag é autoritativa: uma vez migrado, nunca migrar de novo,
    // independentemente de o backend estar vazio ou ter dados. Um backend
    // vazio é um estado válido (ex: banco zerado intencionalmente) e não deve
    // ser confundido com "instalação nunca migrada".
    const isAlreadyMigrated = localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
    if (isAlreadyMigrated) {
      return {
        migrated: true,
        message: 'Base SQLite é a fonte de verdade. Migração do localStorage já foi concluída anteriormente.',
        counts: serverStatus?.counts,
      };
    }

    // 4. Coletar dados existentes no localStorage
    const localPlants = getStoredPlants();
    const localDeliveries = getStoredDeliveries();
    const localDestinations = getStoredDestinations();
    const localOrders = getStoredOrders();
    const localCash = getStoredCashRegister();
    const localUpgrades = getStoredUpgrades();

    const hasLocalData = 
      localPlants.length > 0 || 
      localOrders.length > 0 || 
      localDeliveries.length > 0 || 
      (localCash?.salesHistory && localCash.salesHistory.length > 0);

    // Se não há dados locais significativos para migrar e servidor já possui esquema pronto
    if (!hasLocalData && !hasDataOnServer) {
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return {
        migrated: true,
        message: 'Banco de dados SQLite inicializado. Catálogo pronto para novos cadastros.',
      };
    }

    // 5. Enviar payload de migração ao backend
    const payload = {
      plants: localPlants,
      customers: FICTIONAL_CUSTOMERS,
      destinations: localDestinations,
      orders: localOrders,
      deliveries: localDeliveries,
      cashRegister: localCash,
      upgrades: localUpgrades,
    };

    const response = await api.migrateFromLocalStorage(payload);

    if (response && response.success) {
      // 6. Confirmar que a migração terminou corretamente antes de setar a flag
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      
      // AVISO DE SEGURANÇA: Não apagar os dados do localStorage, mantendo cópia de segurança
      console.log('[Migração SQLite]: Dados do localStorage persistidos no SQLite com sucesso:', response.migrated);

      return {
        migrated: true,
        message: 'Migração do localStorage para SQLite concluída com sucesso no servidor!',
        counts: response.migrated,
      };
    } else {
      return {
        migrated: false,
        message: 'Servidor não confirmou a integridade da migração.',
        error: response?.error || 'Erro desconhecido',
      };
    }
  } catch (err: any) {
    console.warn('[Migração SQLite] Aviso ao tentar migrar dados locais:', err);
    return {
      migrated: false,
      message: 'Não foi possível migrar dados automaticamente nesta inicialização.',
      error: err.message,
    };
  }
}
