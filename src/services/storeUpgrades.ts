// Serviço de gerenciamento de melhorias e itens decorativos da Loja Novo Hiper
import { formatPrice, getStoredCashRegister, saveStoredCashRegister } from './storage';
import { sounds } from './sound';

export interface StoreUpgradeItem {
  id: 'camera' | 'ventilador';
  name: string;
  category: string;
  description: string;
  price: number;
  iconType: 'camera' | 'fan';
  purchased: boolean;
  purchasedAt?: number;
}

const UPGRADES_STORAGE_KEY = 'novo_hiper_loja_melhorias_v1';

export const INITIAL_STORE_UPGRADES: StoreUpgradeItem[] = [
  {
    id: 'camera',
    name: 'Câmera de Monitoramento',
    category: 'Segurança & Proteção',
    description: 'Instalada na parede superior da loja com LED de vigilância ativo, monitorando o balcão e as mudas do viveiro.',
    price: 45.0,
    iconType: 'camera',
    purchased: false,
  },
  {
    id: 'ventilador',
    name: 'Ventilador Vintage',
    category: 'Climatização & Brisa',
    description: 'Ventilador retrô instalado ao lado da mesa de atendimento, soprando brisa constante para refrescar o calor de Olinda.',
    price: 35.0,
    iconType: 'fan',
    purchased: false,
  },
];

export function getStoredUpgrades(): StoreUpgradeItem[] {
  try {
    const raw = localStorage.getItem(UPGRADES_STORAGE_KEY);
    if (!raw) {
      return INITIAL_STORE_UPGRADES;
    }
    const parsed: StoreUpgradeItem[] = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Mesclar para garantir que novos itens existam se adicionados futuramente
      return INITIAL_STORE_UPGRADES.map((initItem) => {
        const found = parsed.find((p) => p.id === initItem.id);
        return found ? { ...initItem, ...found } : initItem;
      });
    }
    return INITIAL_STORE_UPGRADES;
  } catch (err) {
    console.error('Erro ao ler melhorias da loja:', err);
    return INITIAL_STORE_UPGRADES;
  }
}

export function saveStoredUpgrades(upgrades: StoreUpgradeItem[]): boolean {
  try {
    localStorage.setItem(UPGRADES_STORAGE_KEY, JSON.stringify(upgrades));
    return true;
  } catch (err) {
    console.error('Erro ao salvar melhorias da loja:', err);
    return false;
  }
}

export function isUpgradePurchased(id: 'camera' | 'ventilador'): boolean {
  const items = getStoredUpgrades();
  const item = items.find((i) => i.id === id);
  return !!item?.purchased;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  item?: StoreUpgradeItem;
  newBalance?: number;
}

/**
 * Realiza a compra de um item de melhoria para a loja utilizando o saldo do caixa
 */
export function purchaseUpgrade(itemId: 'camera' | 'ventilador'): PurchaseResult {
  const upgrades = getStoredUpgrades();
  const itemIndex = upgrades.findIndex((u) => u.id === itemId);

  if (itemIndex === -1) {
    return { success: false, message: 'Item não encontrado no catálogo de melhorias.' };
  }

  const item = upgrades[itemIndex];
  if (item.purchased) {
    return { success: false, message: `Você já possui o item "${item.name}" instalado na loja!` };
  }

  const cash = getStoredCashRegister();
  if (cash.balance < item.price) {
    const falta = item.price - cash.balance;
    return {
      success: false,
      message: `Saldo insuficiente no caixa. Faltam ${formatPrice(falta)} para adquirir ${item.name}. Faça mais entregas!`,
    };
  }

  // Abater valor do caixa de forma segura
  const updatedBalance = Math.round((cash.balance - item.price) * 100) / 100;
  const updatedCash = {
    ...cash,
    balance: updatedBalance,
  };
  saveStoredCashRegister(updatedCash);

  // Atualizar status do item
  const updatedItem: StoreUpgradeItem = {
    ...item,
    purchased: true,
    purchasedAt: Date.now(),
  };

  upgrades[itemIndex] = updatedItem;
  saveStoredUpgrades(upgrades);

  // Disparar som de sucesso
  sounds.playSavePlant();

  return {
    success: true,
    message: `Parabéns! "${item.name}" foi adquirido e já está instalado na Loja Novo Hiper!`,
    item: updatedItem,
    newBalance: updatedBalance,
  };
}
