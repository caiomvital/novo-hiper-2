import React, { useState, useRef, useEffect } from 'react';
import { 
  Package, 
  MapPin, 
  Compass, 
  ArrowLeft, 
  ShoppingBag, 
  Sparkles, 
  AlertCircle, 
  RotateCcw, 
  Info,
  Store,
  Volume2,
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { CustomerOrder, Plant, DeliveryDestination, CashRegister } from '../../types';
import { DeliveryMission } from '../../game/types';
import { useGameEngine } from '../../game/useGameEngine';
import { renderGame } from '../../game/renderer';
import { VirtualControls } from './VirtualControls';
import { MissionSelectModal } from './MissionSelectModal';
import { DeliverySuccessModal } from './DeliverySuccessModal';
import { StoreUpgradesModal } from './StoreUpgradesModal';
import { 
  createMissionFromOrder, 
  clearActiveMission, 
  getStoredActiveMission 
} from '../../services/gameStorage';
import { 
  getStoredUpgrades, 
  StoreUpgradeItem 
} from '../../services/storeUpgrades';
import { formatPrice } from '../../services/storage';
import { sounds } from '../../services/sound';

interface DeliveryGameViewProps {
  orders: CustomerOrder[];
  plants: Plant[];
  destinations: DeliveryDestination[];
  cashRegister: CashRegister;
  initialOrder?: CustomerOrder | null;
  onDeliverOrder: (orderId: string, plantId: string, value: number, customerName: string, destinationName: string) => void;
  onCreateSimulationOrder: () => void;
  onGoToCatalog: () => void;
  onGoToOrders: () => void;
  onUpdateCashRegister?: (newRegister: CashRegister) => void;
}

export const DeliveryGameView: React.FC<DeliveryGameViewProps> = ({
  orders,
  plants,
  destinations,
  cashRegister,
  initialOrder,
  onDeliverOrder,
  onCreateSimulationOrder,
  onGoToCatalog,
  onGoToOrders,
  onUpdateCashRegister,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isUpgradesModalOpen, setIsUpgradesModalOpen] = useState(false);
  const [completedMissionData, setCompletedMissionData] = useState<DeliveryMission | null>(null);

  // Estado das melhorias da loja (câmera, ventilador)
  const [upgrades, setUpgrades] = useState<StoreUpgradeItem[]>(() => getStoredUpgrades());

  // Inicializar missão se recebida via prop
  const [selectedMission, setSelectedMission] = useState<DeliveryMission | null>(() => {
    if (initialOrder && initialOrder.status !== 'entregue') {
      const result = createMissionFromOrder(initialOrder, plants, destinations);
      if (result.success && result.mission) return result.mission;
    }
    return getStoredActiveMission();
  });

  // Atualizar quando initialOrder mudar externamente
  useEffect(() => {
    if (initialOrder && initialOrder.status !== 'entregue') {
      const result = createMissionFromOrder(initialOrder, plants, destinations);
      if (result.success && result.mission) {
        setSelectedMission(result.mission);
      }
    }
  }, [initialOrder, plants, destinations]);

  // Hook da física do jogo
  const {
    player,
    mission,
    setMission,
    particles,
    interactionPrompt,
    setInputDirection,
    executeInteraction,
    getCompass,
  } = useGameEngine({
    initialMission: selectedMission,
    onMissionCompleted: (completed) => {
      // 1. Executar entrega no sistema existente (atualiza pedidos, estoque e caixa)
      onDeliverOrder(
        completed.orderId,
        completed.plant.id,
        completed.plant.price,
        completed.customer.name,
        completed.destination.name
      );

      // 2. Apresentar tela de celebração e pagamento
      setCompletedMissionData(completed);
      setIsSuccessModalOpen(true);
      clearActiveMission();
    },
  });

  // Observador de redimensionamento do container do canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Loop de renderização no Canvas com visão panorâmica e suporte a plantas e itens da loja
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const upgradesStatus = {
      hasCamera: upgrades.some((u) => u.id === 'camera' && u.purchased),
      hasFan: upgrades.some((u) => u.id === 'ventilador' && u.purchased),
    };

    const loop = (time: number) => {
      renderGame(
        ctx, 
        dimensions.width, 
        dimensions.height, 
        player, 
        mission, 
        particles, 
        time,
        plants,
        upgradesStatus
      );
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, player, mission, particles, plants, upgrades]);

  // Manipulação de seleção de pedido
  const handleSelectOrder = (order: CustomerOrder) => {
    const result = createMissionFromOrder(order, plants, destinations);
    if (result.success && result.mission) {
      setSelectedMission(result.mission);
      setMission(result.mission);
      setIsSelectModalOpen(false);
      sounds.playPlim();
    } else {
      alert(result.error || 'Não foi possível iniciar esta missão.');
    }
  };

  const compass = getCompass();
  const purchasedCount = upgrades.filter((u) => u.purchased).length;

  return (
    <div className="relative w-full h-[82vh] sm:h-[85vh] max-h-[920px] rounded-3xl overflow-hidden border border-stone-800 bg-stone-950 shadow-2xl flex flex-col select-none">
      {/* 1. Barra Superior do Jogo (HUD) */}
      <div className="relative z-20 px-3 sm:px-5 py-2.5 sm:py-3 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-white flex items-center justify-between gap-2 sm:gap-4">
        {/* Lado Esquerdo: Voltar & Título */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onGoToOrders}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Voltar para a lista de pedidos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-display font-bold text-white truncate">
                Mini-Jogo 2D — Entregas em Olinda
              </span>
              <span className="hidden lg:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Bernardo 🌿
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-stone-400 truncate">
              {mission
                ? `Pedido #${mission.orderNumber} • ${mission.plant.name} • ${formatPrice(mission.plant.price)}`
                : 'Nenhum pedido ativo — vá à loja ou selecione um pedido'}
            </p>
          </div>
        </div>

        {/* Centro: Bússola & Distância */}
        {mission && (
          <div className="hidden sm:flex items-center gap-2 bg-stone-950/80 px-3 py-1.5 rounded-xl border border-stone-800 text-xs">
            <div
              style={{ transform: `rotate(${compass.angleDeg}deg)` }}
              className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-500/50 flex items-center justify-center text-emerald-400 transition-transform duration-150"
            >
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-stone-200">
              {compass.distanceMeters}m
            </span>
            <span className="text-[10px] text-stone-400 truncate max-w-[120px]">
              até {mission.state === 'INDO_PARA_RETIRADA' || mission.state === 'AGUARDANDO_INICIO' ? 'Loja' : mission.customer.name}
            </span>
          </div>
        )}

        {/* Lado Direito: Saldo, Melhorias da Loja e Escolher Pedido */}
        <div className="flex items-center gap-2">
          {/* Indicador de Saldo do Caixa */}
          <div 
            onClick={() => setIsUpgradesModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-950 border border-stone-800 text-xs cursor-pointer hover:border-amber-500/40 transition-colors"
            title="Saldo no Caixa Virtual (clique para abrir melhorias da loja)"
          >
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-emerald-400 text-xs">{formatPrice(cashRegister.balance)}</span>
          </div>

          {/* Botão Loja de Itens / Melhorias da Loja */}
          <button
            type="button"
            onClick={() => setIsUpgradesModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 font-display font-bold text-xs transition-all cursor-pointer whitespace-nowrap"
            title="Abrir catálogo de melhorias para a Loja Novo Hiper"
          >
            <Store className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Melhorar Loja</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 font-semibold">
              {purchasedCount}/2
            </span>
          </button>

          {/* Botão Escolher Pedido */}
          <button
            type="button"
            onClick={() => setIsSelectModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-display font-bold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Package className="w-4 h-4 text-emerald-200" />
            <span>{mission ? 'Trocar' : 'Pedidos'}</span>
          </button>
        </div>
      </div>

      {/* 2. Área do Jogo (Canvas Interativo) */}
      <div 
        ref={containerRef} 
        className="relative flex-1 w-full h-full overflow-hidden bg-stone-900 cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 w-full h-full block"
        />

        {/* Notificação / Prompt Flutuante de Ação (Balcão ou Entrega) */}
        {interactionPrompt.canInteract && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-bounce pointer-events-auto">
            <button
              onClick={executeInteraction}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 font-display font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                interactionPrompt.action === 'pickup'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-300 ring-4 ring-emerald-950/60'
                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 border-2 border-amber-200 ring-4 ring-amber-950/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{interactionPrompt.label}</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-black/20 text-[10px] font-mono">
                [Espaço / E]
              </span>
            </button>
          </div>
        )}

        {/* Alerta se não houver missão ativa */}
        {!mission && (
          <div className="absolute top-4 left-4 z-20 hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-stone-900/80 backdrop-blur-md border border-stone-800 text-stone-200 text-xs shadow-lg">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Aproxime-se do balcão da loja para retirar uma planta ou escolha um pedido.</span>
          </div>
        )}

        {/* 3. Controles Virtuais para Telas Touch e Ação Rápida */}
        <VirtualControls
          onDirectionChange={setInputDirection}
          onActionPress={executeInteraction}
          actionLabel={interactionPrompt.action === 'pickup' ? 'Pegar' : interactionPrompt.action === 'deliver' ? 'Entregar' : 'Ação'}
          actionDisabled={!interactionPrompt.canInteract}
          isActionActive={interactionPrompt.canInteract}
        />
      </div>

      {/* 4. Barra de Informação da Loja no Rodapé */}
      <div className="relative z-20 px-4 py-2 bg-stone-900/90 border-t border-stone-800 text-stone-400 text-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 truncate">
          <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">
            Loja Novo Hiper: {plants.length === 0 ? 'Balcão Vazio (Cadastre plantas)' : `${plants.length} muda(s) no balcão`}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsUpgradesModalOpen(true)}
            className="text-amber-400 hover:text-amber-300 font-semibold underline text-xs cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Loja de Itens ({purchasedCount}/2)
          </button>
          <span className="hidden sm:inline text-stone-600">•</span>
          <span className="hidden sm:inline text-[11px] text-stone-500">
            Mover: Teclado W/A/S/D ou Setas • Interagir: Espaço / E
          </span>
        </div>
      </div>

      {/* Modals do Jogo */}
      <MissionSelectModal
        isOpen={isSelectModalOpen}
        onClose={() => setIsSelectModalOpen(false)}
        orders={orders}
        plants={plants}
        destinations={destinations}
        onSelectOrder={handleSelectOrder}
        onCreateSimulationOrder={onCreateSimulationOrder}
        onGoToCatalog={onGoToCatalog}
      />

      <DeliverySuccessModal
        mission={completedMissionData}
        isOpen={isSuccessModalOpen}
        onNextDelivery={() => {
          setIsSuccessModalOpen(false);
          setIsSelectModalOpen(true);
        }}
        onGoToStore={() => {
          setIsSuccessModalOpen(false);
          onGoToCatalog();
        }}
        onOpenStoreUpgrades={() => {
          setIsSuccessModalOpen(false);
          setIsUpgradesModalOpen(true);
        }}
      />

      {/* Modal de Melhorias da Loja (Câmera e Ventilador) */}
      <StoreUpgradesModal
        isOpen={isUpgradesModalOpen}
        onClose={() => setIsUpgradesModalOpen(false)}
        currentBalance={cashRegister.balance}
        upgrades={upgrades}
        onUpgradePurchased={(updatedUpgrades, newBalance) => {
          setUpgrades(updatedUpgrades);
          if (onUpdateCashRegister) {
            onUpdateCashRegister({
              ...cashRegister,
              balance: newBalance,
            });
          }
        }}
      />
    </div>
  );
};
