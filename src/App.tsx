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
} from './services/storage';
import { sounds } from './services/sound';
import { ShopJourney } from './components/ShopJourney';
import { Header } from './components/Header';
import { PlantCard } from './components/PlantCard';
import { EmptyState } from './components/EmptyState';
import { PlantFormModal } from './components/PlantFormModal';
import { PlantDetailModal } from './components/PlantDetailModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { OrdersView } from './components/OrdersView';
import { CashRegisterModal } from './components/CashRegisterModal';
import { LoginScreen } from './components/LoginScreen';
import { BookPromo } from './components/BookPromo';
import { OfflineBanner } from './components/OfflineBanner';
import { BackendStatusBanner } from './components/BackendStatusBanner';
import { checkSession, clearLegacyAuthFlag, logout as performLogout, UNAUTHORIZED_EVENT } from './services/auth';
import { api } from './services/api';
import { useBusinessSync, BusinessSnapshot } from './hooks/useBusinessSync';
import { runAutomaticLocalStorageMigration, MigrationResult } from './services/migration';

// Telas secundárias não entram no download inicial do login e catálogo.
const DeliveryMap = lazy(() => import('./components/DeliveryMap').then(module => ({ default: module.DeliveryMap })));
const DeliveryGameView = lazy(() => import('./components/game/DeliveryGameView').then(module => ({ default: module.DeliveryGameView })));

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

  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const logoutPending = useRef(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const applyBusinessSnapshot = useCallback((data: BusinessSnapshot) => {
    setPlants(data.plants); setOrders(data.orders); setCashRegister(data.cash); setDeliveries(data.deliveries);
    setActiveOrder((current) => current ? data.orders.find(o => o.id === current.id && o.status !== 'entregue') ?? null : null);
  }, []);
  const { connected: isBackendConnected, refresh: reloadBusinessData } = useBusinessSync(isAuthenticated, applyBusinessSnapshot);

  // Inicializar e conectar ao backend Node.js + SQLite com migração segura do localStorage
  useEffect(() => {
    if (authStatus !== 'authenticated') return; // só sincroniza com a API depois de autenticado
    let isMounted = true;

    async function initializeBackendSync() {
      try {
        const isHealthy = await api.checkHealth();
        if (!isMounted) return;


        if (isHealthy) {
          setIsMigrating(true);
          const migRes = await runAutomaticLocalStorageMigration();
          if (!isMounted) return;
          setMigrationResult(migRes);
          setIsMigrating(false);

          // Evento: app aberto → pede ao backend uma verificação de novo pedido (ele decide; capacidade 1)
          await api.ensureOrder().catch(() => null);

          await reloadBusinessData();
        }
      } catch (err) {
        // A sincronização sinaliza indisponibilidade e retenta ao reconectar.
      }
    }

    initializeBackendSync();

    return () => {
      isMounted = false;
    };
  }, [authStatus, reloadBusinessData]);

  const handleManualMigration = async () => {
    setIsMigrating(true);
    const res = await runAutomaticLocalStorageMigration();
    setMigrationResult(res);
    setIsMigrating(false);
    if (res.migrated) {
      showToast('Dados do localStorage sincronizados no banco SQLite da VPS!');
      await reloadBusinessData();
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

  const handleSavePlant = async (
    plantData: Omit<Plant, 'id' | 'createdAt'> & { id?: string; createdAt?: number }
  ): Promise<void> => {
    const payload = {
      name: plantData.name, species: plantData.species, price: plantData.price,
      photoUrl: plantData.photoUrl, careTag: plantData.careTag, stock: plantData.stock ?? 0,
    };
    const editing = plantData.createdAt !== undefined;
    const saved = editing
      ? await api.updatePlant(plantData.id!, payload)
      : await api.createPlant({ ...payload, id: plantData.id });
    setPlants((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
    sounds.playSavePlant();
    showToast(`Planta "${saved.name}" ${editing ? 'atualizada' : 'cadastrada'} com sucesso.`);
    void reloadBusinessData();
  };

  const deletePending = useRef(false);
  const [isDeletingPlant, setIsDeletingPlant] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const handleDeleteConfirm = async () => {
    if (!plantToDelete || deletePending.current) return;
    deletePending.current = true;
    setIsDeletingPlant(true);
    setDeleteError(null);
    const { id, name } = plantToDelete;
    try {
      await api.deletePlant(id);
      setPlants((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlant?.id === id) setSelectedPlant(null);
      setPlantToDelete(null);
      showToast(`Planta "${name}" removida do catálogo.`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Não foi possível remover a planta. Tente novamente.');
    } finally {
      deletePending.current = false;
      setIsDeletingPlant(false);
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

  const deliveryPending = useRef(false);
  const handleDeliveryComplete = async (record: DeliveryRecord, linkedOrderId?: string): Promise<void> => {
    if (!linkedOrderId) throw new Error('Escolha um pedido de cliente para entregar.');
    if (deliveryPending.current) throw new Error('Aguarde a confirmação da entrega.');
    deliveryPending.current = true;
    try {
      let total: number;
      try {
        const delivery = await api.startDelivery(linkedOrderId);
        const result = await api.finishDelivery(delivery.id);
        total = Number(result.order.total);
      } catch (error) {
        const confirmed = (await api.getOrders()).find(o => o.id === linkedOrderId && o.status === 'entregue');
        if (!confirmed) throw error;
        total = confirmed.totalPrice;
      }
      await reloadBusinessData();
      sounds.playCashRegister();
      showToast(`Entrega confirmada! +${formatPrice(total)} no Caixa Virtual.`);
    } finally { deliveryPending.current = false; }
  };

  const orderPendingRef = useRef(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (orderPendingRef.current) return;
    orderPendingRef.current = true;
    setPendingOrderId(orderId);
    setOrderError(null);
    try {
      await api.updateOrderStatus(orderId, newStatus);
      const confirmed = await api.getOrders();
      setOrders(confirmed);
      if (newStatus === 'pronto') sounds.playBellRing();
      else sounds.playPreparePlant();
      showToast(newStatus === 'preparando' ? 'Planta em preparo!' : 'Pedido pronto para entrega.');
    } catch (err) {
      setOrderError(err instanceof Error && !(err instanceof TypeError) && !['TimeoutError', 'AbortError'].includes(err.name)
        ? err.message : 'Não foi possível confirmar o preparo. Confira sua conexão e tente novamente.');
    } finally {
      orderPendingRef.current = false;
      setPendingOrderId(null);
    }
  };

  // O servidor decide quando nasce o próximo pedido; a leitura é compartilhada entre todas as telas.
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'pedidos') return;
    let alive = true;
    let polling = false;
    const refresh = async () => {
      if (!alive || document.hidden || polling || orderPendingRef.current) return;
      polling = true;
      try { await api.ensureOrder(); if (alive) await reloadBusinessData(); }
      catch { /* próxima consulta ou reconexão retenta */ }
      finally { polling = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => { alive = false; clearInterval(timer); };
  }, [isAuthenticated, activeTab, reloadBusinessData]);

  const handleDispatchToMap = (order: CustomerOrder) => {
    setActiveOrder(order);
    setActiveTab('entregas');
    showToast(`Pedido #${order.orderNumber} de ${order.customerName} despachado para o mapa!`);
  };

  const handleGameDelivery = async (
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
    await handleDeliveryComplete(newDelivery, orderId);
  };

  const handleSaveDestination = (newDest: DeliveryDestination) => {
    const exists = destinations.some((d) => d.id === newDest.id);
    const updated = exists ? destinations.map((d) => d.id === newDest.id ? newDest : d) : [newDest, ...destinations];
    if (!saveStoredDestinations(updated)) throw new Error('Não foi possível salvar o endereço neste navegador. Libere espaço ou permita o armazenamento e tente novamente.');
    setDestinations(updated);
    showToast(`Endereço de "${newDest.name}" salvo neste navegador.`);
  };

  const handleDeleteDestination = (id: string) => {
    const dest = destinations.find((d) => d.id === id);
    const updated = destinations.filter((d) => d.id !== id);
    if (!saveStoredDestinations(updated)) throw new Error('Não foi possível remover o endereço neste navegador. Tente novamente.');
    setDestinations(updated);
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

  const handleLogout = async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setLogoutError(null);
    sounds.playPlim();
    try {
      await performLogout();
      setIsCashModalOpen(false);
      setIsFormOpen(false);
      setSelectedPlant(null);
      setPlantToDelete(null);
      setActiveOrder(null);
      setActiveTab('catalogo');
      setIsAuthenticated(false);
    } catch {
      setLogoutError('Não foi possível sair da loja. Confira sua conexão e tente Sair novamente.');
    } finally {
      logoutPending.current = false;
    }
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
      {logoutError && <p role="alert" className="bg-rose-50 text-rose-800 p-3 text-sm">{logoutError}</p>}

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
        {activeTab === 'catalogo' && <ShopJourney plants={plants} orders={orders} deliveries={deliveries} cash={cashRegister} connected={isBackendConnected} onAddPlant={handleOpenNewForm} onCatalog={() => document.getElementById('catalog-plants')?.scrollIntoView({ behavior: 'smooth' })} onAdventure={() => setActiveTab('aventura')} onCash={() => setIsCashModalOpen(true)} />}
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
              Sua loja, Bernardo!
            </h2>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed mb-5">
              Cadastre suas plantas com foto, nome, preço e estoque. No jogo, Bernardo cuida dessa mesma loja e leva as encomendas aos moradores. As entregas confirmadas ficam registradas no seu painel.
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              <button id="btn-start-catalog" onClick={handleOpenNewForm} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold">Cadastrar planta</button>
              <button id="btn-start-adventure" onClick={() => setActiveTab('aventura')} className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold">Jogar Aventura</button>
            </div>

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
          <div id="catalog-plants" className="space-y-6">
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
                    Escolha uma planta para ver a foto, o preço e a quantidade disponível.
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
            pendingOrderId={pendingOrderId}
            error={orderError}
            onStartGameDelivery={() => setActiveTab('aventura')}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onDispatchToMap={handleDispatchToMap}
            onGoToCatalog={() => setActiveTab('catalogo')}
          />
        )}

        {/* Tab 3: Realistic Delivery Map & Dispatch Desk */}
        {activeTab === 'entregas' && (
          <Suspense fallback={<div role="status" className="p-8 text-center text-stone-500">Abrindo o mapa…</div>}>
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
          </Suspense>
        )}

        {/* Tab 4: 2D Delivery Mini-Game (Bernardo em Olinda) */}
        {activeTab === 'jogo' && (
          <Suspense fallback={<div role="status" className="p-8 text-center text-stone-500">Abrindo as entregas…</div>}>
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
          </Suspense>
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
            <AdventureGameScreen plants={plants} onExit={() => setActiveTab('catalogo')} onDataChanged={reloadBusinessData} onNavigateTab={setActiveTab} />
          </Suspense>
        )}
      </main>

      {activeTab !== 'aventura' && (
        <div className="max-w-5xl mx-auto px-4 pb-24 sm:pb-10">
          <BookPromo className="max-w-md mx-auto" />
        </div>
      )}

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
        hasOpenOrder={Boolean(editingPlant && orders.some((o) => o.plantId === editingPlant.id && o.status !== 'entregue'))}
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
        onDeleteRequest={(plant) => { setDeleteError(null); setPlantToDelete(plant); }}
        onSendToDelivery={(plant) => handleSendToDelivery(plant)}
      />

      <DeleteConfirmModal
        plant={plantToDelete}
        isOpen={!!plantToDelete}
        onClose={() => { if (!isDeletingPlant) setPlantToDelete(null); }}
        busy={isDeletingPlant}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
      />

      <CashRegisterModal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        cashRegister={cashRegister}
        plants={plants}
      />
    </div>
  );
}
