import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Plant, DeliveryDestination, DeliveryRecord, CustomerOrder } from '../types';
import { NOVO_HIPER_HEADQUARTERS, formatPrice } from '../services/storage';
import { sounds } from '../services/sound';
import { DestinationFormModal } from './DestinationFormModal';
import { DeleteDestinationModal } from './DeleteDestinationModal';
import { 
  Truck, 
  MapPin, 
  Navigation, 
  Clock, 
  Building2, 
  Home, 
  GraduationCap, 
  Trees, 
  ShoppingBag,
  PackageCheck,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  Search,
  SlidersHorizontal,
  Compass,
  Sparkles,
  ArrowLeft,
  Coins,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DeliveryMapProps {
  plants: Plant[];
  destinations: DeliveryDestination[];
  onOpenAddPlant: () => void;
  onDeliveryComplete: (record: DeliveryRecord, linkedOrderId?: string) => void;
  recentDeliveries: DeliveryRecord[];
  onSaveDestination: (destination: DeliveryDestination) => void;
  onDeleteDestination: (id: string) => void;
  activeOrder?: CustomerOrder | null;
  onClearActiveOrder?: () => void;
}

export const DeliveryMap: React.FC<DeliveryMapProps> = ({
  plants,
  destinations,
  onOpenAddPlant,
  onDeliveryComplete,
  recentDeliveries,
  onSaveDestination,
  onDeleteDestination,
  activeOrder,
  onClearActiveOrder,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  const [selectedDestinationId, setSelectedDestinationId] = useState<string>(
    activeOrder?.destinationId || destinations[0]?.id || ''
  );
  const [selectedPlantId, setSelectedPlantId] = useState<string>(
    activeOrder?.plantId || plants[0]?.id || ''
  );
  const [isDelivering, setIsDelivering] = useState(false);
  const [completedDelivery, setCompletedDelivery] = useState<DeliveryRecord | null>(null);

  // Sincroniza destino e planta se um pedido for selecionado
  useEffect(() => {
    if (activeOrder) {
      if (activeOrder.destinationId) {
        setSelectedDestinationId(activeOrder.destinationId);
      }
      if (activeOrder.plantId) {
        setSelectedPlantId(activeOrder.plantId);
      }
    }
  }, [activeOrder]);

  // Modals for Custom Addresses
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [editingDestination, setEditingDestination] = useState<DeliveryDestination | null>(null);
  const [destinationToDelete, setDestinationToDelete] = useState<DeliveryDestination | null>(null);
  const [filterType, setFilterType] = useState<string>('todos');
  const [searchDestination, setSearchDestination] = useState<string>('');

  // Fallback to first destination if current selection is deleted
  useEffect(() => {
    if (!destinations.some((d) => d.id === selectedDestinationId) && destinations.length > 0) {
      setSelectedDestinationId(destinations[0].id);
    }
  }, [destinations, selectedDestinationId]);

  const selectedDestination =
    destinations.find((d) => d.id === selectedDestinationId) || destinations[0] || null;

  // Sync selected plant if plants list updates
  useEffect(() => {
    if (!selectedPlantId && plants.length > 0) {
      setSelectedPlantId(plants[0].id);
    }
  }, [plants, selectedPlantId]);

  const selectedPlant = plants.find((p) => p.id === selectedPlantId) || plants[0] || null;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Centered around Novo Hiper headquarters
    const map = L.map(mapContainerRef.current, {
      center: [NOVO_HIPER_HEADQUARTERS.lat, NOVO_HIPER_HEADQUARTERS.lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    // Realistic OpenStreetMap / CartoDB Voyager clean tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Headquarters marker (Store & Nursery in Olinda)
    const hqIcon = L.divIcon({
      className: 'custom-hq-pin',
      html: `
        <div style="background:#065f46;color:#ffffff;padding:6px 12px;border-radius:12px;border:2px solid #ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.3);font-family:'Outfit',sans-serif;font-weight:700;font-size:12px;display:flex;align-items:center;gap:6px;white-space:nowrap;">
          <span style="display:inline-block;width:8px;height:8px;background:#34d399;border-radius:50%;"></span>
          <span>Loja Novo Hiper • Olinda</span>
        </div>
      `,
      iconSize: [165, 36],
      iconAnchor: [82, 18],
    });

    L.marker([NOVO_HIPER_HEADQUARTERS.lat, NOVO_HIPER_HEADQUARTERS.lng], { icon: hqIcon })
      .addTo(map)
      .bindPopup(`<b>${NOVO_HIPER_HEADQUARTERS.name}</b><br/>${NOVO_HIPER_HEADQUARTERS.address}<br/><span style="color:#059669;font-weight:600;">Olinda, Pernambuco</span>`);

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Dynamic Markers on the Map when destinations or selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((marker) => {
      map.removeLayer(marker);
    });
    markersRef.current = {};

    // Add all current destinations
    destinations.forEach((dest) => {
      const isSelected = dest.id === selectedDestinationId;
      const isCustomClient = !!dest.isCustom;

      const badgeColor = isSelected ? '#065f46' : isCustomClient ? '#1e3a8a' : '#059669';
      const borderCol = isSelected ? '#34d399' : '#ffffff';
      const iconSymbol = isCustomClient ? '👤' : '📍';

      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div id="pin-${dest.id}" style="background:${badgeColor};color:#ffffff;padding:5px 9px;border-radius:10px;border:2px solid ${borderCol};box-shadow:0 3px 10px rgba(0,0,0,0.25);font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:11px;display:flex;align-items:center;gap:5px;white-space:nowrap;cursor:pointer;transform:${isSelected ? 'scale(1.08)' : 'scale(1)'};transition:all 0.2s;">
            <span style="font-size:11px;">${iconSymbol}</span>
            <span>${dest.name}</span>
          </div>
        `,
        iconSize: [120, 32],
        iconAnchor: [60, 16],
      });

      const marker = L.marker([dest.lat, dest.lng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>${dest.name}</b><br/>${dest.address}${dest.notes ? `<br/><i>Obs: ${dest.notes}</i>` : ''}`);

      marker.on('click', () => {
        sounds.playPlim();
        setSelectedDestinationId(dest.id);
      });

      markersRef.current[dest.id] = marker;
    });
  }, [destinations, selectedDestinationId]);

  // Update Route Polyline whenever selected destination changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedDestination) return;

    // Remove existing polyline
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

    // Street route simulation: midpoint dogleg for realism
    const start: [number, number] = [NOVO_HIPER_HEADQUARTERS.lat, NOVO_HIPER_HEADQUARTERS.lng];
    const end: [number, number] = [selectedDestination.lat, selectedDestination.lng];
    const corner: [number, number] = [start[0], end[1]];

    const routePolyline = L.polyline([start, corner, end], {
      color: selectedDestination.isCustom ? '#2563eb' : '#059669',
      weight: 4,
      opacity: 0.88,
      dashArray: '8, 8',
    }).addTo(map);

    routeLayerRef.current = routePolyline;

    // Fit bounds smoothly to show headquarters and selected destination
    const bounds = L.latLngBounds([start, end]);
    map.fitBounds(bounds, { padding: [55, 55], maxZoom: 16 });
  }, [selectedDestination]);

  const handleSelectDestination = (dest: DeliveryDestination) => {
    sounds.playPlim();
    setSelectedDestinationId(dest.id);
  };

  const handleOpenAddDestination = () => {
    sounds.playAddPlant();
    setEditingDestination(null);
    setIsDestinationModalOpen(true);
  };

  const handleOpenEditDestination = (dest: DeliveryDestination, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playEditPlant();
    setEditingDestination(dest);
    setIsDestinationModalOpen(true);
  };

  const handleOpenDeleteDestination = (dest: DeliveryDestination, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playPlim();
    setDestinationToDelete(dest);
  };

  const handleSaveDestination = (dest: DeliveryDestination) => {
    onSaveDestination(dest);
    setSelectedDestinationId(dest.id);
  };

  const handleDeleteDestinationConfirm = () => {
    if (!destinationToDelete) return;
    onDeleteDestination(destinationToDelete.id);
    setDestinationToDelete(null);
  };

  const handleConfirmDelivery = () => {
    if (!selectedPlant || !selectedDestination) return;
    // Entrega avulsa (sem pedido) foi desativada: dinheiro só entra pelo fluxo de pedido/entrega
    if (!activeOrder) return;

    if ((selectedPlant.stock ?? 0) <= 0) {
      sounds.playPop();
      return;
    }

    setIsDelivering(true);

    setTimeout(() => {
      const record: DeliveryRecord = {
        id: 'ent_' + Date.now(),
        plantId: selectedPlant.id,
        plantName: selectedPlant.name,
        plantPrice: selectedPlant.price,
        plantPhotoUrl: selectedPlant.photoUrl,
        destinationId: selectedDestination.id,
        destinationName: activeOrder 
          ? `${activeOrder.customerName} (${selectedDestination.name})` 
          : selectedDestination.name,
        destinationAddress: activeOrder 
          ? activeOrder.customerAddress 
          : selectedDestination.address,
        timestamp: Date.now(),
        status: 'entregue',
      };

      sounds.playDeliverySuccess();
      try {
        confetti({
          particleCount: 55,
          spread: 65,
          origin: { y: 0.5 },
          colors: ['#059669', '#10b981', '#34d399', '#2563eb', '#f59e0b'],
        });
      } catch {}

      onDeliveryComplete(record, activeOrder?.id);
      setCompletedDelivery(record);
      setIsDelivering(false);
    }, 700);
  };

  const getDestinationIcon = (type: DeliveryDestination['type'], isCustom?: boolean) => {
    if (isCustom) {
      return <UserCheck className="w-4 h-4 text-blue-700" />;
    }
    switch (type) {
      case 'familia':
      case 'residencia':
        return <Home className="w-4 h-4 text-emerald-700" />;
      case 'escola':
        return <GraduationCap className="w-4 h-4 text-sky-700" />;
      case 'parque':
        return <Trees className="w-4 h-4 text-emerald-800" />;
      case 'comercio':
        return <Building2 className="w-4 h-4 text-stone-700" />;
      default:
        return <MapPin className="w-4 h-4 text-emerald-700" />;
    }
  };

  // Filtered destinations
  const filteredDestinations = destinations.filter((dest) => {
    const matchesSearch =
      dest.name.toLowerCase().includes(searchDestination.toLowerCase()) ||
      dest.address.toLowerCase().includes(searchDestination.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'clientes') return !!dest.isCustom;
    if (filterType === 'predefinidos') return !dest.isCustom;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Active Order Highlight Banner */}
      {activeOrder && (
        <div className="bg-emerald-950 text-white rounded-3xl p-5 border border-emerald-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <img
                src={activeOrder.customerAvatarUrl}
                alt={activeOrder.customerName}
                className="w-13 h-13 rounded-full object-cover border-2 border-emerald-400 shadow-xs"
                referrerPolicy="no-referrer"
              />
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-stone-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md shadow-xs">
                #{activeOrder.orderNumber}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-900 px-2 py-0.5 rounded border border-emerald-700">
                  Entregando Pedido do Cliente
                </span>
                <span className="text-emerald-500 text-xs">•</span>
                <span className="text-xs text-emerald-200">
                  {activeOrder.customerRole}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-display font-bold text-white">
                {activeOrder.customerName} • {activeOrder.plantName}
              </h3>
              <p className="text-xs text-emerald-200/90 flex items-center gap-1.5 mt-0.5 line-clamp-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>{activeOrder.customerAddress}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onClearActiveOrder && (
              <button
                type="button"
                onClick={onClearActiveOrder}
                className="text-xs font-semibold text-emerald-200 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                Trocar p/ Entrega Livre
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overview Card with Map */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              <Navigation className="w-4 h-4 text-emerald-600" />
              <span>Logística & Roteiro de Entregas</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold normal-case text-[11px] border border-emerald-200">
                Olinda, Pernambuco 🌴
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-stone-900 mt-0.5">
              Mapa de Entregas em Olinda
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Sede no Carmo • Entregas para Amparo, Varadouro, Bairro Novo, Casa Caiada e toda a cidade
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-add-destination-header"
              type="button"
              onClick={handleOpenAddDestination}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Cadastrar Novo Endereço</span>
            </button>
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-stone-100 text-stone-700 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              <span>Origem: Carmo, Olinda - PE</span>
            </div>
          </div>
        </div>

        {/* Real Geographic Leaflet Map */}
        <div className="relative w-full h-[320px] sm:h-[400px] rounded-2xl overflow-hidden border border-stone-200 shadow-inner">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Floating Route Status Overlay */}
          {selectedDestination && (
            <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-md border border-stone-200 text-xs text-stone-800 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${selectedDestination.isCustom ? 'bg-blue-600' : 'bg-emerald-500'}`}></span>
              <span className="font-semibold">{selectedDestination.name}</span>
              <span className="text-stone-400">•</span>
              <span className="text-stone-600 font-medium">{selectedDestination.distanceKm} km</span>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Dispatch Desk: Plant & Destination Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Select Destination & Select Plant */}
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: Destination Selection & Management */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div>
                <h3 className="text-base font-display font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">1</span>
                  <span>Endereços & Clientes Cadastrados</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Selecione quem vai receber a entrega ou cadastre um novo cliente (como o Tio Rodolfo).
                </p>
              </div>

              <button
                id="btn-add-destination-desk"
                type="button"
                onClick={handleOpenAddDestination}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Novo Endereço</span>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  placeholder="Buscar por nome do cliente ou rua..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-emerald-700 bg-stone-50/50"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilterType('todos')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    filterType === 'todos'
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  Todos ({destinations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('clientes')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    filterType === 'clientes'
                      ? 'bg-blue-700 text-white'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  Meus Clientes ({destinations.filter(d => d.isCustom).length})
                </button>
              </div>
            </div>

            {/* Destination Cards List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
              {filteredDestinations.map((dest) => {
                const isSelected = selectedDestination?.id === dest.id;
                return (
                  <div
                    key={dest.id}
                    id={`dest-card-${dest.id}`}
                    onClick={() => handleSelectDestination(dest)}
                    className={`group p-3.5 rounded-2xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? dest.isCustom
                          ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600'
                          : 'border-emerald-600 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-600'
                        : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-xl border shadow-2xs flex-shrink-0 ${
                            dest.isCustom ? 'bg-blue-50 border-blue-200' : 'bg-white border-stone-200'
                          }`}>
                            {getDestinationIcon(dest.type, dest.isCustom)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-display font-bold text-sm text-stone-900 truncate">
                              {dest.name}
                            </h4>
                            {dest.isCustom && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.2 rounded inline-block">
                                Cliente Cadastrado
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md flex-shrink-0">
                          {dest.distanceKm} km
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 line-clamp-2 mt-0.5">
                        {dest.address}
                      </p>

                      {dest.notes && (
                        <p className="text-[11px] text-stone-400 italic truncate mt-1">
                          Obs: {dest.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions for Custom Destination */}
                    {dest.isCustom && (
                      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-stone-200/60">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditDestination(dest, e)}
                          className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors"
                          title="Editar endereço"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenDeleteDestination(dest, e)}
                          className="p-1 rounded-md text-rose-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Remover endereço"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredDestinations.length === 0 && (
                <div className="col-span-2 p-6 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center">
                  <MapPin className="w-6 h-6 text-stone-400 mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-stone-700">
                    Nenhum endereço encontrado para esta busca.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenAddDestination}
                    className="mt-2 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
                  >
                    + Cadastrar um novo endereço agora
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Plant Selection */}
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-display font-bold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs flex items-center justify-center font-bold">2</span>
                <span>Escolha a Planta para Entrega</span>
              </h3>
              {plants.length > 0 && (
                <span className="text-xs text-stone-500 font-medium">
                  {plants.length} disponíveis
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mb-3.5">
              Selecione o vaso ou planta do estoque da sua loja que sairá para entrega.
            </p>

            {plants.length === 0 ? (
              <div className="p-6 rounded-2xl bg-stone-50 border border-dashed border-stone-300 text-center">
                <ShoppingBag className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-stone-800">
                  Nenhuma planta no catálogo ainda
                </p>
                <p className="text-xs text-stone-500 mt-1 mb-3">
                  Cadastre uma planta primeiro para poder despachá-la na entrega.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddPlant}
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  + Cadastrar Planta Agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {plants.map((plant) => {
                  const isSelected = selectedPlant?.id === plant.id;
                  const plantStock = plant.stock ?? 0;
                  const isOutOfStock = plantStock <= 0;

                  return (
                    <button
                      key={plant.id}
                      type="button"
                      onClick={() => {
                        sounds.playPlim();
                        setSelectedPlantId(plant.id);
                      }}
                      className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer flex flex-col items-start relative ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600'
                          : isOutOfStock
                          ? 'border-stone-200 bg-stone-50/70 hover:border-stone-300 opacity-80'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 hover:bg-white'
                      }`}
                    >
                      <div className="relative w-full mb-2">
                        <img
                          src={plant.photoUrl}
                          alt={plant.name}
                          className="w-full h-20 sm:h-24 object-cover rounded-xl border border-stone-200"
                        />
                        <span
                          className={`absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-2xs backdrop-blur-xs ${
                            isOutOfStock
                              ? 'bg-rose-600 text-white'
                              : plantStock <= 2
                              ? 'bg-amber-600 text-white'
                              : 'bg-emerald-800 text-white'
                          }`}
                        >
                          {isOutOfStock ? 'Esgotado' : `${plantStock} un.`}
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-xs text-stone-900 truncate w-full">
                        {plant.name}
                      </h4>
                      <p className="text-xs font-bold text-emerald-800 mt-0.5">
                        {formatPrice(plant.price)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Dispatch Slip / Summary */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm sticky top-24 space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Resumo da Ordem de Entrega
              </span>
              <h3 className="text-lg font-display font-bold text-stone-900 mt-0.5">
                Comprovante de Envio
              </h3>
            </div>

            {selectedPlant && selectedDestination ? (
              <div className="space-y-4">
                {/* Product in order */}
                <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-stone-50 border border-stone-200">
                  <img
                    src={selectedPlant.photoUrl}
                    alt={selectedPlant.name}
                    className="w-16 h-16 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-semibold text-stone-400 uppercase">
                      Produto Selecionado
                    </span>
                    <h4 className="font-display font-bold text-sm text-stone-900 truncate">
                      {selectedPlant.name}
                    </h4>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm font-bold text-emerald-800">
                        {formatPrice(selectedPlant.price)}
                      </p>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          (selectedPlant.stock ?? 0) <= 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : (selectedPlant.stock ?? 0) <= 2
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {(selectedPlant.stock ?? 0) <= 0
                          ? '0 no estoque'
                          : `${selectedPlant.stock} disponíveis`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Warning if plant has 0 stock */}
                {(selectedPlant.stock ?? 0) <= 0 && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="leading-snug">
                      <strong>Estoque Esgotado:</strong> Esta planta não possui vasos disponíveis para envio. Adicione mais unidades no catálogo para liberar a entrega.
                    </p>
                  </div>
                )}

                {/* Destination Details */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Origem:</span>
                    <span className="font-semibold text-stone-800">Loja Novo Hiper</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Destinatário:</span>
                    <span className="font-bold text-stone-900 text-right flex items-center gap-1">
                      {selectedDestination.name}
                      {selectedDestination.isCustom && (
                        <span className="text-[10px] text-blue-700 bg-blue-50 px-1 rounded">Cliente</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Endereço:</span>
                    <span className="font-medium text-stone-700 text-right max-w-[200px] truncate">
                      {selectedDestination.address}
                    </span>
                  </div>
                  {selectedDestination.notes && (
                    <div className="flex justify-between py-1.5 border-b border-stone-100">
                      <span className="text-stone-500">Observações:</span>
                      <span className="text-stone-600 italic text-right max-w-[200px] truncate">
                        {selectedDestination.notes}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Distância estimada:</span>
                    <span className="font-semibold text-stone-800">{selectedDestination.distanceKm} km</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-stone-100">
                    <span className="text-stone-500">Tempo de trânsito:</span>
                    <span className="font-semibold text-stone-800">
                      ~{Math.round(selectedDestination.distanceKm * 5)} minutos
                    </span>
                  </div>
                  <div className="flex justify-between py-2 pt-3 font-bold text-sm text-stone-900">
                    <span>Valor do Pedido:</span>
                    <span className="text-emerald-800 font-extrabold text-base">
                      {formatPrice(selectedPlant.price)}
                    </span>
                  </div>
                </div>

                {/* Dispatch Button */}
                <button
                  id="btn-confirm-delivery"
                  type="button"
                  disabled={isDelivering || !activeOrder || (selectedPlant.stock ?? 0) <= 0}
                  onClick={handleConfirmDelivery}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-display font-bold text-base shadow-md shadow-emerald-800/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Truck className="w-5 h-5" />
                  <span>
                    {!activeOrder
                      ? 'Escolha um pedido para entregar'
                      : (selectedPlant.stock ?? 0) <= 0
                      ? 'Sem Estoque para Envio'
                      : isDelivering
                      ? 'Despachando Entrega...'
                      : 'Confirmar e Realizar Entrega'}
                  </span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-stone-500">
                Selecione uma planta e um endereço para preencher o comprovante.
              </p>
            )}

            {/* Delivery Success Notification Modal/Card */}
            {completedDelivery && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 animate-in fade-in zoom-in-95">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-display font-bold text-sm text-emerald-950">
                      Entrega Concluída com Sucesso!
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                      A planta <strong>{completedDelivery.plantName}</strong> chegou ao destino:{' '}
                      <strong>{completedDelivery.destinationName}</strong> ({completedDelivery.destinationAddress}).
                    </p>

                    <div className="mt-2.5 py-2 px-3 rounded-xl bg-emerald-100/90 text-xs font-bold text-emerald-950 flex items-center gap-2 border border-emerald-300/70">
                      <Coins className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>+{formatPrice(completedDelivery.plantPrice)} adicionados ao Caixa Virtual da Loja!</span>
                    </div>

                    {activeOrder && (
                      <div className="mt-2 py-1.5 px-2.5 rounded-lg bg-emerald-100/70 text-[11px] font-medium text-emerald-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Pedido #{activeOrder.orderNumber} de {activeOrder.customerName} marcado como <strong>Entregue</strong>!</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setCompletedDelivery(null)}
                      className="mt-2.5 text-xs font-bold text-emerald-900 hover:underline cursor-pointer"
                    >
                      Dispensar aviso
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Deliveries Log */}
      {recentDeliveries.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-display font-bold text-stone-900">
                Histórico de Entregas Realizadas
              </h3>
              <p className="text-xs text-stone-500">
                Registro oficial dos pedidos despachados pelo Novo Hiper
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
              {recentDeliveries.length} {recentDeliveries.length === 1 ? 'entrega' : 'entregas'}
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {recentDeliveries.slice(0, 5).map((delivery) => {
              const timeStr = new Intl.DateTimeFormat('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short',
              }).format(new Date(delivery.timestamp));

              return (
                <div key={delivery.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={delivery.plantPhotoUrl}
                      alt={delivery.plantName}
                      className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-sm text-stone-900 truncate">
                        {delivery.plantName}
                      </h4>
                      <p className="text-xs text-stone-600 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>Entregue para: <strong>{delivery.destinationName}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-800 block">
                      {formatPrice(delivery.plantPrice)}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      {timeStr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Destination Form Modal (Add / Edit Client Address) */}
      <DestinationFormModal
        initialDestination={editingDestination}
        isOpen={isDestinationModalOpen}
        onClose={() => {
          setIsDestinationModalOpen(false);
          setEditingDestination(null);
        }}
        onSave={handleSaveDestination}
      />

      {/* Delete Destination Modal */}
      <DeleteDestinationModal
        destination={destinationToDelete}
        isOpen={!!destinationToDelete}
        onClose={() => setDestinationToDelete(null)}
        onConfirm={handleDeleteDestinationConfirm}
      />
    </div>
  );
};
