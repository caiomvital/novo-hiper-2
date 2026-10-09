import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Plant, DeliveryDestination, DeliveryRecord, MainTab, CustomerOrder, OrderStatus, CashRegister } from './types';
import { 
  getStoredPlants, 
  saveStoredPlants, 
  getStoredDeliveries, 
  saveStoredDeliveries, 
  getStoredDestinations,
  saveStoredDestinations,
  getStoredOrders,
  saveStoredOrders,
  REALISTIC_PLANT_PRESETS,
  formatPrice,
  getStoredCashRegister,
  saveStoredCashRegister,
  recordSale
} from './services/storage';
import { sounds } from './services/sound';
import { Header } from './components/Header';
import { PlantCard } from './components/PlantCard';
import { EmptyState } from './components/EmptyState';
import { PlantFormModal } from './components/PlantFormModal';
import { PlantDetailModal } from './components/PlantDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { DeliveryMap } from './components/DeliveryMap';
import { OrdersView } from './components/OrdersView';
import { CashRegisterModal } from './components/CashRegisterModal';
import { LoginScreen } from './components/LoginScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { BackendStatusBanner } from './components/BackendStatusBanner';
import { DeliveryGameView } from './components/game/DeliveryGameView';
import { checkSession, clearLegacyAuthFlag, logout as performLogout, UNAUTHORIZED_EVENT } from './services/auth';
import { api } from './services/api';
import { runAutomaticLocalStorageMigration, MigrationResult } from './services/migration';

// Carregado sob demanda: o Phaser só é baixado quando a aba "Aventura (Beta)" é aberta
const AdventureGameScreen = lazy(() =>
  import('./phaser-game').then((module) => ({ default: module.AdventureGameScreen }))
);
import { Plus, Search, CheckCircle2, Store, Truck, DollarSign, Package, ShoppingBag, Coins } from 'lucide-react';

export default function App() {
  // Autenticação: a AUTORIDADE é a sessão no servidor (cookie HttpOnly). 'checking' = ainda perguntando ao servidor.
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'anonymous'>('checking');
  const isAuthenticated = authStatus === 'authenticated';
  const setIsAuthenticated = (value: boolean) => setAuthStatus(value ? 'authenticated' : 'anonymous');

  useEffect(() => {
    clearLegacyAuthFlag(); // remove o antigo flag de login do localStorage (não é mais autoridade)
    let active = true;
    checkSession().then((s) => {
      if (!active) return;
      setAuthStatus(s !== 'unknown' && s.authenticated ? 'authenticated' : 'anonymous');
    });
    // Qualquer API que responda 401 → sessão inválida: volta ao login SEM apagar dados do negócio
    const onUnauthorized = () => setAuthStatus('anonymous');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);
  const [plants, setPlants] = useState<Plant[]>(() => getStoredPlants());
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>(() => getStoredDeliveries());
  const [destinations, setDestinations] = useState<DeliveryDestination[]>(() => getStoredDestinations());
  const [orders, setOrders] = useState<CustomerOrder[]>(() => getStoredOrders());
  const [cashRegister, setCashRegister] = useState<CashRegister>(() => getStoredCashRegister());
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<CustomerOrder | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>('catalogo');
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [plantToDelete, setPlantToDelete] = useState<Plant | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  // Inicializar e conectar ao backend Node.js + SQLite com migração segura do localStorage
  useEffect(() => {
    if (authStatus !== 'authenticated') return; // só sincroniza com a API depois de autenticado
    let isMounted = true;

    async function initializeBackendSync() {
      try {
        const isHealthy = await api.checkHealth();
        if (!isMounted) return;
        setIsBackendConnected(isHealthy);

        if (isHealthy) {
          setIsMigrating(true);
          const migRes = await runAutomaticLocalStorageMigration();
          if (!isMounted) return;
          setMigrationResult(migRes);
          setIsMigrating(false);

          // Evento: app aberto → pede ao backend uma verificação de novo pedido (ele decide; capacidade 1)
          await api.ensureOrder().catch(() => null);

          // Carregar dados oficiais do SQLite
          try {
            const dbPlants = await api.getPlants();
            if (isMounted && dbPlants.length > 0) {
              setPlants(dbPlants);
            }
            const dbOrders = await api.getOrders();
            if (isMounted && dbOrders.length > 0) {
              setOrders(dbOrders);
            }
            const dbCash = await api.getCashRegister();
            if (isMounted && dbCash) {
              setCashRegister(dbCash);
            }
            const dbDeliveries = await api.getDeliveries();
            if (isMounted && dbDeliveries.length > 0) {
              setDeliveries(dbDeliveries);
            }
          } catch (fetchErr) {
            console.warn('[Sync Backend]: Dados mantidos via localStorage de backup:', fetchErr);
          }
        }
      } catch (err) {
        if (isMounted) setIsBackendConnected(false);
      }
    }

    initializeBackendSync();

    return () => {
      isMounted = false;
    };
  }, [authStatus]);

  // Recarrega do backend (fonte de verdade) o que uma entrega feita na Aventura altera: pedidos, estoque, caixa e entregas
  const reloadBusinessData = useCallback(async () => {
    try {
      const dbPlants = await api.getPlants();
      if (dbPlants.length > 0) setPlants(dbPlants);
      const dbOrders = await api.getOrders();
      if (dbOrders.length > 0) setOrders(dbOrders);
      const dbCash = await api.getCashRegister();
      if (dbCash) setCashRegister(dbCash);
      const dbDeliveries = await api.getDeliveries();
      if (dbDeliveries.length > 0) setDeliveries(dbDeliveries);
    } catch (err) {
      console.warn('[Sync Backend]: Não foi possível recarregar os dados após a entrega:', err);
    }
  }, []);

  const handleManualMigration = async () => {
    setIsMigrating(true);
    const res = await runAutomaticLocalStorageMigration();
    setMigrationResult(res);
    setIsMigrating(false);
    if (res.migrated) {
      showToast('Dados do localStorage sincronizados no banco SQLite da VPS!');
      try {
        const dbPlants = await api.getPlants();
        if (dbPlants.length > 0) setPlants(dbPlants);
        const dbOrders = await api.getOrders();
        if (dbOrders.length > 0) setOrders(dbOrders);
        const dbCash = await api.getCashRegister();
        setCashRegister(dbCash);
      } catch {}
    } else {
      showToast(res.message);
    }
  };

  // Refs para manter dados atualizados no loop do timer sem recriar timers desnecessariamente
  const plantsRef = useRef(plants);
  const destinationsRef = useRef(destinations);
  const ordersRef = useRef(orders);

  useEffect(() => {
    plantsRef.current = plants;
  }, [plants]);

  useEffect(() => {
    destinationsRef.current = destinations;
  }, [destinations]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Sync to localStorage
  useEffect(() => {
    saveStoredPlants(plants);
  }, [plants]);

  useEffect(() => {
    saveStoredDeliveries(deliveries);
  }, [deliveries]);

  useEffect(() => {
    saveStoredDestinations(destinations);
  }, [destinations]);

  useEffect(() => {
    saveStoredOrders(orders);
  }, [orders]);

  useEffect(() => {
    saveStoredCashRegister(cashRegister);
  }, [cashRegister]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleOpenNewForm = () => {
    sounds.playAddPlant();
    setEditingPlant(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (plant: Plant) => {
    sounds.playEditPlant();
    setEditingPlant(plant);
    setIsFormOpen(true);
    setSelectedPlant(null);
  };

  // Pedidos automáticos nascem NO BACKEND (POST /api/orders/ensure decide: capacidade, estoque, cliente, planta, preço e número).
  // Aqui o frontend só PEDE a verificação em eventos (abrir o app, salvar planta) e recarrega o que o servidor devolve.

  const handleSavePlant = (
    plantData: Omit<Plant, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
  ) => {
    if (plantData.id) {
      sounds.playEditPlant();
      const updatedPayload = {
        name: plantData.name,
        species: plantData.species,
        price: plantData.price,
        photoUrl: plantData.photoUrl,
        careTag: plantData.careTag,
        stock: plantData.stock !== undefined ? plantData.stock : 5,
      };

      setPlants((prev) =>
        prev.map((p) =>
          p.id === plantData.id
            ? {
                ...p,
                ...updatedPayload,
                isExample: false,
              }
            : p
        )
      );
      showToast(`Planta "${plantData.name}" atualizada com sucesso.`);

      if (isBackendConnected) {
        api
          .updatePlant(plantData.id, updatedPayload)
          .then(() => reloadBusinessData()) // reposição de estoque pode ter feito o servidor criar um pedido
          .catch((err) => {
            console.warn('[Backend SQLite]: Erro ao atualizar planta:', err);
          });
      }
    } else {
      sounds.playSavePlant();
      const plantId = 'planta_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newPlant: Plant = {
        id: plantId,
        name: plantData.name,
        species: plantData.species,
        price: plantData.price,
        photoUrl: plantData.photoUrl,
        createdAt: Date.now(),
        careTag: plantData.careTag,
        stock: plantData.stock !== undefined ? plantData.stock : 5,
        isExample: false,
      };
      setPlants((prev) => [newPlant, ...prev]);
      showToast(`Planta "${plantData.name}" cadastrada no catálogo do Novo Hiper.`);

      if (isBackendConnected) {
        api
          .createPlant(newPlant)
          .then(() => reloadBusinessData()) // a primeira planta faz o servidor criar o primeiro pedido
          .catch((err) => {
            console.warn('[Backend SQLite]: Erro ao cadastrar planta:', err);
          });
      }
    }
  };

  const handleDeleteConfirm = () => {
    if (!plantToDelete) return;
    const name = plantToDelete.name;
    const plantId = plantToDelete.id;
    setPlants((prev) => prev.filter((p) => p.id !== plantId));
    if (selectedPlant?.id === plantId) {
      setSelectedPlant(null);
    }
    setPlantToDelete(null);
    showToast(`Planta "${name}" removida do estoque.`);

    if (isBackendConnected) {
      api.deletePlant(plantId).catch((err) => {
        console.warn('[Backend SQLite]: Erro ao excluir planta:', err);
      });
    }
  };

  const handleAddExample = () => {
    const nextPreset = REALISTIC_PLANT_PRESETS[plants.length % REALISTIC_PLANT_PRESETS.length];
    const examplePlant: Plant = {
      id: 'demo_' + Date.now(),
      name: nextPreset.name,
      species: nextPreset.species,
      price: nextPreset.price,
      photoUrl: nextPreset.imageUrl,
      createdAt: Date.now(),
      careTag: nextPreset.careTag,
      stock: 5,
      isExample: true,
    };
    setPlants((prev) => [examplePlant, ...prev]);
    showToast(`Amostra de "${nextPreset.name}" adicionada ao catálogo.`);
  };

  const handleDeliveryComplete = (record: DeliveryRecord, linkedOrderId?: string) => {
    // Crédito de venda SÓ nasce do fluxo de pedido/entrega. Entrega avulsa (sem pedido) não gera dinheiro nem baixa estoque.
    if (!linkedOrderId) {
      showToast('Para receber o pagamento, entregue um pedido de cliente (aba Pedidos).');
      return;
    }
    // 1. Record delivery history
    setDeliveries((prev) => [record, ...prev]);

    // 2. Decrement stock for delivered plant (cannot drop below 0)
    setPlants((prev) =>
      prev.map((p) => {
        if (p.id === record.plantId) {
          const currentStock = p.stock ?? 1;
          const nextStock = Math.max(0, currentStock - 1);
          return { ...p, stock: nextStock };
        }
        return p;
      })
    );

    // 3. Register sale in virtual cash register
    const updatedRegister = recordSale(cashRegister, {
      deliveryId: record.id,
      plantId: record.plantId,
      plantName: record.plantName,
      plantPhotoUrl: record.plantPhotoUrl,
      value: record.plantPrice,
      orderId: linkedOrderId,
      customerName: linkedOrderId ? record.destinationName : undefined,
      destinationName: record.destinationName,
    });
    setCashRegister(updatedRegister);
    sounds.playCashRegister();

    // 4. Update order status if delivery was for a specific customer order
    if (linkedOrderId) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === linkedOrderId ? { ...o, status: 'entregue', completedAt: Date.now() } : o
        )
      );
      showToast(`Pedido de ${record.destinationName} entregue! +${formatPrice(record.plantPrice)} no Caixa Virtual.`);
    } else {
      showToast(`Entrega de "${record.plantName}" concluída! +${formatPrice(record.plantPrice)} no Caixa Virtual.`);
    }

    // 5. Persistir entrega e transação no backend SQLite com validação
    if (isBackendConnected) {
      if (linkedOrderId) {
        api.startDelivery(linkedOrderId)
          .then((del) => {
            if (del?.id) {
              return api.finishDelivery(del.id);
            }
          })
          .catch((err) => {
            console.warn('[Backend SQLite]: Registro de entrega processado ou em andamento:', err);
          });
      }
    }
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    if (newStatus === 'preparando') {
      showToast('Planta em preparo: regada e pronta para embalagem!');
    } else if (newStatus === 'pronto') {
      showToast('Pedido preparado com carinho! Pronto para entrega.');
    }

    if (isBackendConnected) {
      api.updateOrderStatus(orderId, newStatus).catch((err) => {
        console.warn('[Backend SQLite]: Erro ao atualizar status do pedido:', err);
      });
    }
  };

  const handleDispatchToMap = (order: CustomerOrder) => {
    setActiveOrder(order);
    setActiveTab('entregas');
    showToast(`Pedido #${order.orderNumber} de ${order.customerName} despachado para o mapa!`);
  };

  const handleGameDelivery = (
    orderId: string, 
    plantId: string, 
    value: number, 
    customerName: string, 
    destinationName: string
  ) => {
    const targetPlant = plants.find((p) => p.id === plantId);
    const targetDest = destinations.find((d) => d.name === destinationName) || destinations[0];

    const newDelivery: DeliveryRecord = {
      id: `game-del-${Date.now()}`,
      plantId,
      plantName: targetPlant?.name || 'Muda de Planta',
      plantPrice: value,
      plantPhotoUrl: targetPlant?.photoUrl || '',
      destinationId: targetDest?.id || 'dest-olinda',
      destinationName: customerName,
      destinationAddress: destinationName,
      timestamp: Date.now(),
      status: 'entregue'
    };
    handleDeliveryComplete(newDelivery, orderId);
    showToast(`Entrega concluída! +${formatPrice(value)} adicionados ao caixa virtual.`);
  };

  const handleSaveDestination = (newDest: DeliveryDestination) => {
    setDestinations((prev) => {
      const exists = prev.some((d) => d.id === newDest.id);
      if (exists) {
        return prev.map((d) => (d.id === newDest.id ? newDest : d));
      }
      return [newDest, ...prev];
    });
    showToast(`Endereço de "${newDest.name}" adicionado ao mapa com sucesso!`);
  };

  const handleDeleteDestination = (id: string) => {
    const dest = destinations.find((d) => d.id === id);
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    if (dest) {
      showToast(`Endereço de "${dest.name}" removido do mapa.`);
    }
  };

  const handleSendToDelivery = (plant: Plant) => {
    setSelectedPlant(null);
    setActiveOrder(null);
    setActiveTab('entregas');
    showToast(`Planta "${plant.name}" selecionada para entrega.`);
  };

  // Filter plants by search query
  const filteredPlants = plants.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.species && p.species.toLowerCase().includes(q))
    );
  });

  // Calculate quick metrics for shopkeeper
  const totalStockUnits = plants.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  const totalStockValue = plants.reduce((sum, p) => sum + (p.price * (p.stock ?? 1)), 0);
  const pendingOrdersCount = orders.filter((o) => o.status !== 'entregue').length;

  const handleLogout = () => {
    sounds.playPlim();
    void performLogout(); // invalida a sessão no servidor e limpa o cookie
    setIsAuthenticated(false);
    showToast('Você saiu da loja. Até logo, Bernardo!');
  };

  // Ainda perguntando ao servidor se a sessão é válida (evita "piscar" a tela de login)
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center text-stone-500 text-sm" role="status" aria-live="polite">
        Abrindo a loja…
      </div>
    );
  }

  // Se não estiver autenticado, exibe a tela de login integrada
  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          showToast('Bem-vindo à sua loja, Bernardo! 🌿');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-70 max-w-sm w-[90%] bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold border border-stone-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="flex-1">{toastMessage}</span>
        </div>
      )}

      {/* Offline Status Indicator */}
      <OfflineBanner />

      {/* Backend SQLite Connection & Migration Status */}
      <BackendStatusBanner 
        isBackendConnected={isBackendConnected}
        migrationResult={migrationResult}
        isMigrating={isMigrating}
        onTriggerMigration={handleManualMigration}
      />

      {/* Header with Navigation, Sound, Logout and Caixa */}
      <Header 
        plantCount={totalStockUnits} 
        deliveryCount={deliveries.length}
        pendingOrdersCount={pendingOrdersCount}
        cashBalance={cashRegister.balance}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'entregas') {
            setActiveOrder(null);
          }
        }}
        onAddPlant={handleOpenNewForm}
        onOpenCashRegister={() => setIsCashModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 pt-4 sm:pt-6 flex-1">
        {/* Realistic Shop Dashboard Banner */}
        <section className="relative rounded-3xl bg-stone-900 text-white p-5 sm:p-7 shadow-sm border border-stone-800 overflow-hidden mb-6">
          <div 
            className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1470058869958-2a77ade41c02?auto=format&fit=crop&w=1200&q=80')`
            }}
          />
          <div className="relative z-10 max-w-2xl">
            <span className="inline-block text-[11px] font-bold text-emerald-400 tracking-wider uppercase mb-1">
              Novo Hiper • Plantas e Jardinagem
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight leading-tight mb-2">
              Painel do Dono da Loja
            </h2>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed mb-5">
              Gerencie o estoque de plantas da sua loja, atenda pedidos de clientes reais de Olinda, prepare os vasinhos e realize entregas no mapa.
            </p>

            {/* Shopkeeper Status Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-2xl">
              <div 
                onClick={() => setActiveTab('catalogo')}
                className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 cursor-pointer hover:bg-white/15 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-stone-400 text-[11px] font-semibold mb-0.5">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Estoque</span>
                </div>
                <span className="text-base sm:text-lg font-display font-bold text-white">
                  {totalStockUnits} {totalStockUnits === 1 ? 'vaso' : 'vasos'}
                </span>
                <span className="text-[10px] text-stone-400 block truncate">
                  {plants.length} {plants.length === 1 ? 'espécie' : 'espécies'}
                </span>
              </div>

              <div 
                onClick={() => setActiveTab('pedidos')}
                className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 cursor-pointer hover:bg-white/15 transition-colors relative"
              >
                <div className="flex items-center gap-1.5 text-stone-400 text-[11px] font-semibold mb-0.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pedidos</span>
                </div>
                <span className="text-base sm:text-lg font-display font-bold text-white">
                  {pendingOrdersCount} {pendingOrdersCount === 1 ? 'pendente' : 'pendentes'}
                </span>
                <span className="text-[10px] text-amber-300 block truncate">
                  {orders.length} no histórico
                </span>
              </div>

              <div 
                onClick={() => setActiveTab('entregas')}
                className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/10 cursor-pointer hover:bg-white/15 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-stone-400 text-[11px] font-semibold mb-0.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Entregas</span>
                </div>
                <span className="text-base sm:text-lg font-display font-bold text-white">
                  {deliveries.length} feitas
                </span>
                <span className="text-[10px] text-emerald-300 block truncate">
                  {destinations.length} endereços
                </span>
              </div>

              <div 
                onClick={() => {
                  sounds.playPlim();
                  setIsCashModalOpen(true);
                }}
                className="p-3 rounded-2xl bg-amber-500/20 backdrop-blur-xs border border-amber-400/30 cursor-pointer hover:bg-amber-500/25 transition-colors"
                title="Clique para abrir o Caixa Virtual"
              >
                <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-semibold mb-0.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Caixa da Loja</span>
                </div>
                <span className="text-base sm:text-lg font-display font-bold text-amber-100 truncate block">
                  {formatPrice(cashRegister.balance)}
                </span>
                <span className="text-[10px] text-amber-300/80 block truncate">
                  {cashRegister.salesHistory.length} vendas
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab 1: Plant Catalog */}
        {activeTab === 'catalogo' && (
          <div className="space-y-6">
            {plants.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-display font-bold text-stone-900 flex items-center gap-2">
                    <span>Catálogo de Plantas</span>
                    <span className="text-xs font-sans font-semibold text-stone-600 px-2.5 py-0.5 rounded-full bg-stone-200">
                      {filteredPlants.length} no estoque
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Selecione qualquer planta para visualizar detalhes técnicos ou despachar no mapa.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nome ou espécie..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-stone-200 focus:border-emerald-800 focus:ring-1 focus:ring-emerald-800 outline-none text-xs sm:text-sm placeholder:text-stone-400 transition-all"
                    />
                  </div>

                  <button
                    id="btn-add-more-plants"
                    type="button"
                    onClick={handleOpenNewForm}
                    className="p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </button>
                </div>
              </div>
            )}

            {plants.length === 0 ? (
              <EmptyState
                onAddPlant={handleOpenNewForm}
              />
            ) : filteredPlants.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 p-6">
                <p className="text-3xl mb-2">🌿</p>
                <h4 className="text-base font-display font-bold text-stone-800">
                  Nenhuma planta encontrada
                </h4>
                <p className="text-xs text-stone-500 mt-1">
                  Não encontramos nenhuma planta com o termo "{searchQuery}".
                </p>
                <button
                  onClick={() => {
                    sounds.playPlim();
                    setSearchQuery('');
                  }}
                  className="mt-3 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {filteredPlants.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    onSelect={(p) => setSelectedPlant(p)}
                    onEdit={(p) => handleOpenEditForm(p)}
                    onDeliver={(p) => handleSendToDelivery(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Fictional Customer Orders View */}
        {activeTab === 'pedidos' && (
          <OrdersView
            orders={orders}
            plants={plants}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDispatchToMap={handleDispatchToMap}
            onGoToCatalog={() => setActiveTab('catalogo')}
          />
        )}

        {/* Tab 3: Realistic Delivery Map & Dispatch Desk */}
        {activeTab === 'entregas' && (
          <DeliveryMap
            plants={plants}
            destinations={destinations}
            onOpenAddPlant={handleOpenNewForm}
            onDeliveryComplete={handleDeliveryComplete}
            recentDeliveries={deliveries}
            onSaveDestination={handleSaveDestination}
            onDeleteDestination={handleDeleteDestination}
            activeOrder={activeOrder}
            onClearActiveOrder={() => setActiveOrder(null)}
          />
        )}

        {/* Tab 4: 2D Delivery Mini-Game (Bernardo em Olinda) */}
        {activeTab === 'jogo' && (
          <DeliveryGameView
            orders={orders}
            plants={plants}
            destinations={destinations}
            cashRegister={cashRegister}
            initialOrder={activeOrder}
            onDeliverOrder={handleGameDelivery}
            onCreateSimulationOrder={() => undefined}
            onGoToCatalog={() => setActiveTab('catalogo')}
            onGoToOrders={() => setActiveTab('pedidos')}
            onUpdateCashRegister={(updated) => setCashRegister(updated)}
          />
        )}

        {/* Tab 5: Vertical slice do jogo 2D com Phaser (mapa top-down + plataforma) — protótipo isolado, sem dados reais */}
        {activeTab === 'aventura' && (
          <Suspense
            fallback={
              <div className="w-full h-[82vh] sm:h-[85vh] max-h-[920px] rounded-3xl border border-stone-800 bg-stone-950 flex items-center justify-center text-stone-400 text-sm">
                Carregando Aventura 2D...
              </div>
            }
          >
            <AdventureGameScreen onExit={() => setActiveTab('catalogo')} onDataChanged={reloadBusinessData} onNavigateTab={setActiveTab} />
          </Suspense>
        )}
      </main>

      {/* Floating Action Button on Mobile for Quick Add */}
      {activeTab === 'catalogo' && plants.length > 0 && (
        <div className="sm:hidden fixed bottom-5 right-5 z-30">
          <button
            id="btn-fab-add-plant"
            onClick={handleOpenNewForm}
            className="w-13 h-13 rounded-2xl bg-emerald-800 text-white shadow-lg flex items-center justify-center hover:bg-emerald-900 active:scale-95 transition-all cursor-pointer"
            aria-label="Cadastrar nova planta"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* Modals */}
      <PlantFormModal
        initialPlant={editingPlant}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingPlant(null);
        }}
        onSave={handleSavePlant}
      />

      <PlantDetailModal
        plant={selectedPlant}
        isOpen={!!selectedPlant}
        onClose={() => setSelectedPlant(null)}
        onEdit={(plant) => handleOpenEditForm(plant)}
        onDeleteRequest={(plant) => setPlantToDelete(plant)}
        onSendToDelivery={(plant) => handleSendToDelivery(plant)}
      />

      <DeleteConfirmModal
        plant={plantToDelete}
        isOpen={!!plantToDelete}
        onClose={() => setPlantToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      <CashRegisterModal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        cashRegister={cashRegister}
        onUpdateRegister={(updated) => setCashRegister(updated)}
      />
    </div>
  );
}
