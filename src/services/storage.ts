import { Plant, DeliveryDestination, DeliveryRecord, Customer, CustomerOrder, OrderStatus, CashRegister, SaleRecord } from '../types';

const PLANTS_STORAGE_KEY = 'novo_hiper_plantas_v2';
const DELIVERIES_STORAGE_KEY = 'novo_hiper_entregas_v1';
const DESTINATIONS_STORAGE_KEY = 'novo_hiper_destinos_olinda_v1';
const ORDERS_STORAGE_KEY = 'novo_hiper_pedidos_v1';
const CASH_REGISTER_STORAGE_KEY = 'novo_hiper_caixa_v1';

// Clientes fictícios realistas de Olinda para a loja infantil
export const FICTIONAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust_dona_maria',
    name: 'Dona Maria',
    roleDescription: 'Aposentada e amante de flores',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    destinationId: 'dest_vovo',
    address: 'Rua do Amparo, 142 - Amparo, Olinda - PE',
    notes: 'Adora plantas floridas e orquídeas na janela da sala colonial.'
  },
  {
    id: 'cust_seu_joao',
    name: 'Seu João',
    roleDescription: 'Vizinho e jardineiro amador',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    destinationId: 'dest_amigo',
    address: 'Avenida Presidente Getúlio Vargas, 650 - Bairro Novo, Olinda - PE',
    notes: 'Cultiva folhagens resistentes à maresia na calçada.'
  },
  {
    id: 'cust_ana',
    name: 'Ana',
    roleDescription: 'Arquiteta de Interiores',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    destinationId: 'dest_cliente',
    address: 'Avenida Governador Carlos de Lima Cavalcanti, 1200 - Casa Caiada, Olinda - PE',
    notes: 'Busca folhagens elegantes para salas e varandas de clientes.'
  },
  {
    id: 'cust_carlos',
    name: 'Carlos',
    roleDescription: 'Professor em Olinda',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    destinationId: 'dest_tio_rodolfo',
    address: 'Avenida Olinda, 152 - Apto 02 - Varadouro, Olinda - PE',
    notes: 'Interfone 02 - Quer presentear uma pessoa querida com uma planta saudável.'
  },
  {
    id: 'cust_floricultura',
    name: 'Floricultura Varadouro',
    roleDescription: 'Comércio parceiro no Carmo',
    avatarUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=400&q=80',
    destinationId: 'dest_escola',
    address: 'Rua de São Bento, 220 - Varadouro, Olinda - PE',
    notes: 'Mudas ornamentais para reposição de canteiros e floreiras.'
  }
];

// Fotografias realistas de plantas em vasos e ambientes naturais
export const REALISTIC_PLANT_PRESETS = [
  {
    id: 'monstera',
    name: 'Costela-de-Adão',
    species: 'Monstera deliciosa',
    price: 45.0,
    stock: 6,
    careTag: 'Meia Sombra ⛅',
    imageUrl: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=800&q=80',
    description: 'Folhagem verde exuberante em vaso de cerâmica natural, ideal para interiores.'
  },
  {
    id: 'ficus_lyrata',
    name: 'Ficus Lyrata',
    species: 'Ficus lyrata',
    price: 65.0,
    stock: 4,
    careTag: 'Ambiente Interno 🏠',
    imageUrl: 'https://images.unsplash.com/photo-1597055181374-4b533e4905a5?auto=format&fit=crop&w=800&q=80',
    description: 'Folhas largas e brilhantes com porte elegante para decoração.'
  },
  {
    id: 'suculenta_echeveria',
    name: 'Suculenta Echeveria',
    species: 'Echeveria elegans',
    price: 18.0,
    stock: 8,
    careTag: 'Sol Pleno ☀️',
    imageUrl: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=800&q=80',
    description: 'Roseta natural compacta em vaso de terracota artesanal.'
  },
  {
    id: 'espada_sao_jorge',
    name: 'Espada-de-São-Jorge',
    species: 'Sansevieria trifasciata',
    price: 32.0,
    stock: 5,
    careTag: 'Planta Purificadora 🍃',
    imageUrl: 'https://images.unsplash.com/photo-1599598425947-320d754b2d39?auto=format&fit=crop&w=800&q=80',
    description: 'Planta resistente de linhas verticais marcantes e folhas rajadas.'
  },
  {
    id: 'samambaia',
    name: 'Samambaia Americana',
    species: 'Nephrolepis exaltata',
    price: 38.0,
    stock: 3,
    careTag: 'Rega Moderada 💧',
    imageUrl: 'https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=800&q=80',
    description: 'Folhas pendentes volumosas e frescas para suporte aéreo ou estante.'
  },
  {
    id: 'orquidea',
    name: 'Orquídea Branca',
    species: 'Phalaenopsis',
    price: 52.0,
    stock: 2,
    careTag: 'Floresce na Primavera 🌸',
    imageUrl: 'https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=80',
    description: 'Haste floral em floração com substrato de casca de pinus natural.'
  }
];

// Ponto de partida do Novo Hiper (Loja & Viveiro Central em Olinda, Pernambuco)
export const NOVO_HIPER_HEADQUARTERS = {
  name: 'Loja Novo Hiper (Viveiro Central)',
  address: 'Praça do Carmo, 10 - Carmo, Olinda - PE',
  city: 'Olinda, Pernambuco',
  lat: -8.0142,
  lng: -34.8485,
};

// Destinos realistas em Olinda, Pernambuco para as entregas no mapa
export const REALISTIC_DESTINATIONS: DeliveryDestination[] = [
  {
    id: 'dest_vovo',
    name: 'Casa da Vovó',
    type: 'familia',
    address: 'Rua do Amparo, 142 - Amparo, Olinda - PE',
    distanceKm: 0.6,
    lat: -8.0125,
    lng: -34.8520,
    description: 'Casarão colonial histórico com varanda ensolarada, vasos floridos e canteiros de ervas.'
  },
  {
    id: 'dest_amigo',
    name: 'Casa do Amigo',
    type: 'residencia',
    address: 'Avenida Presidente Getúlio Vargas, 650 - Bairro Novo, Olinda - PE',
    distanceKm: 1.8,
    lat: -7.9995,
    lng: -34.8415,
    description: 'Casa no Bairro Novo com jardim frontal gramado e espaço para novas mudas floridas.'
  },
  {
    id: 'dest_escola',
    name: 'Jardim da Escola',
    type: 'escola',
    address: 'Rua de São Bento, 220 - Varadouro, Olinda - PE',
    distanceKm: 0.8,
    lat: -8.0175,
    lng: -34.8530,
    description: 'Horta comunitária e canteiro de botânica perto do Mosteiro de São Bento.'
  },
  {
    id: 'dest_praca',
    name: 'Praça do Carmo',
    type: 'parque',
    address: 'Praça do Carmo, s/n - Carmo, Olinda - PE',
    distanceKm: 0.3,
    lat: -8.0150,
    lng: -34.8475,
    description: 'Praça arborizada com coqueiros, árvores nativas, coreto e canteiros públicos.'
  },
  {
    id: 'dest_alto_se',
    name: 'Mirante do Alto da Sé',
    type: 'parque',
    address: 'Alto da Sé, s/n - Carmo, Olinda - PE',
    distanceKm: 0.5,
    lat: -8.0135,
    lng: -34.8495,
    description: 'Famoso mirante histórico com vista do mar de Olinda e brisa fresca para as plantas.'
  },
  {
    id: 'dest_cliente',
    name: 'Residência da Cliente',
    type: 'comercio',
    address: 'Avenida Governador Carlos de Lima Cavalcanti, 1200 - Casa Caiada, Olinda - PE',
    distanceKm: 3.1,
    lat: -7.9890,
    lng: -34.8385,
    description: 'Sacada espaçosa com vista para a praia de Casa Caiada que encomendou plantas do viveiro.'
  }
];

export const CARE_TAGS = [
  'Sol Pleno ☀️',
  'Meia Sombra ⛅',
  'Rega Moderada 💧',
  'Ambiente Interno 🏠',
  'Planta Purificadora 🍃',
  'Floresce na Primavera 🌸'
];

export function getStoredPlants(): Plant[] {
  try {
    const raw = localStorage.getItem(PLANTS_STORAGE_KEY);
    if (!raw) {
      // Primeira utilização: catálogo começa vazio, sem plantas pré-cadastradas
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Preservar exclusivamente plantas cadastradas pelo usuário.
      // Dados de demonstração antigos gerados automaticamente são filtrados.
      const userRegistered = parsed.filter(
        (p) => !p.isExample && !p.id?.startsWith('plant_preset_') && !p.id?.startsWith('demo_')
      );

      // Se o usuário ainda não cadastrou nenhuma planta própria, o catálogo permanece vazio []
      if (userRegistered.length === 0) {
        if (parsed.length > 0) {
          saveStoredPlants([]);
        }
        return [];
      }

      // Validar estoque para todas as plantas existentes cadastradas pelo usuário
      let needsSave = false;
      const validated = userRegistered.map((p) => {
        if (typeof p.stock !== 'number' || isNaN(p.stock) || p.stock < 0) {
          needsSave = true;
          return {
            ...p,
            stock: 5,
          };
        }
        return p;
      });
      if (needsSave || userRegistered.length !== parsed.length) {
        saveStoredPlants(validated);
      }
      return validated;
    }
    return [];
  } catch (err) {
    console.error('Erro ao ler plantas do localStorage:', err);
    return [];
  }
}

export function saveStoredPlants(plants: Plant[]): boolean {
  try {
    localStorage.setItem(PLANTS_STORAGE_KEY, JSON.stringify(plants));
    return true;
  } catch (err) {
    console.error('Erro ao salvar plantas no localStorage:', err);
    return false;
  }
}

export function getStoredDeliveries(): DeliveryRecord[] {
  try {
    const raw = localStorage.getItem(DELIVERIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Erro ao ler entregas do localStorage:', err);
    return [];
  }
}

export function saveStoredDeliveries(deliveries: DeliveryRecord[]): boolean {
  try {
    localStorage.setItem(DELIVERIES_STORAGE_KEY, JSON.stringify(deliveries));
    return true;
  } catch (err) {
    console.error('Erro ao salvar entregas no localStorage:', err);
    return false;
  }
}

/**
 * Retorna os destinos cadastrados em Olinda, incluindo os pré-definidos e os clientes adicionados pelo usuário.
 */
export function getStoredDestinations(): DeliveryDestination[] {
  try {
    const raw = localStorage.getItem(DESTINATIONS_STORAGE_KEY);
    if (!raw) {
      // Começa com a lista de destinos realistas de Olinda e inclui o Tio Rodolfo na Avenida Olinda!
      const initial: DeliveryDestination[] = [
        ...REALISTIC_DESTINATIONS,
        {
          id: 'dest_tio_rodolfo',
          name: 'Tio Rodolfo',
          type: 'familia',
          address: 'Avenida Olinda, 152 - Apto 02 - Varadouro, Olinda - PE',
          distanceKm: 1.6,
          lat: -8.0225,
          lng: -34.8610,
          description: 'Apartamento do Tio Rodolfo na Avenida Olinda com varanda para plantas e folhagens.',
          isCustom: true,
          notes: 'Interfone 02 - Deixar na portaria ou entregar na porta',
          createdAt: Date.now() - 3600000 * 5,
        }
      ];
      saveStoredDestinations(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Migração suave caso algum registro antigo tenha ficado com coordenadas de fora de Olinda
      const migrated = parsed.map((item: DeliveryDestination) => {
        if (item.lat < -15 || item.lng < -40) {
          const geo = generateRealisticCoordinatesForAddress(item.address);
          return {
            ...item,
            lat: geo.lat,
            lng: geo.lng,
            distanceKm: geo.distanceKm,
          };
        }
        return item;
      });
      return migrated;
    }
    return REALISTIC_DESTINATIONS;
  } catch (err) {
    console.error('Erro ao ler destinos do localStorage:', err);
    return REALISTIC_DESTINATIONS;
  }
}

export function saveStoredDestinations(destinations: DeliveryDestination[]): boolean {
  try {
    localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(destinations));
    return true;
  } catch (err) {
    console.error('Erro ao salvar destinos no localStorage:', err);
    return false;
  }
}

/**
 * Fórmula de Haversine para calcular distância real em km entre dois pontos geográficos
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Gera uma coordenada geográfica realista no mapa a partir do endereço fornecido,
 * mantendo o destino coerente com o mapa da cidade em volta da Loja Novo Hiper.
 */
export function generateRealisticCoordinatesForAddress(address: string): { lat: number; lng: number; distanceKm: number } {
  // Gera um hash determinístico do endereço para manter o pino no mesmo local se o endereço for igual
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const normalizedHash = Math.abs(hash);
  
  // Variação angular e radial ao redor da loja sede (entre 0.6 km e 3.2 km)
  const angle = (normalizedHash % 360) * (Math.PI / 180);
  const distanceOffsetKm = 0.6 + (normalizedHash % 25) * 0.1; // 0.6 a 3.0 km
  
  // 1 grau lat ~ 111 km, 1 grau lng ~ 111 * cos(lat) km
  const latDelta = (Math.cos(angle) * distanceOffsetKm) / 111;
  const lngDelta = (Math.sin(angle) * distanceOffsetKm) / (111 * Math.cos((NOVO_HIPER_HEADQUARTERS.lat * Math.PI) / 180));
  
  const lat = Math.round((NOVO_HIPER_HEADQUARTERS.lat + latDelta) * 10000) / 10000;
  const lng = Math.round((NOVO_HIPER_HEADQUARTERS.lng + lngDelta) * 10000) / 10000;
  
  const distanceKm = calculateDistanceKm(
    NOVO_HIPER_HEADQUARTERS.lat,
    NOVO_HIPER_HEADQUARTERS.lng,
    lat,
    lng
  );
  
  return {
    lat,
    lng,
    distanceKm: Math.max(0.5, distanceKm)
  };
}

export async function compressImage(file: File, maxDimension = 800, quality = 0.84): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de foto'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Retorna os pedidos armazenados no localStorage.
 * Na primeira utilização, nenhum pedido é criado antecipadamente (catálogo vazio = sem pedidos).
 * Mantém exclusivamente pedidos associados a plantas reais cadastradas pelo usuário.
 */
export function getStoredOrders(plants?: Plant[], destinations?: DeliveryDestination[]): CustomerOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const currentPlants = plants || getStoredPlants();
      const validPlantIds = new Set(currentPlants.map((p) => p.id));
      
      // Filtrar pedidos para manter apenas os vinculados a plantas reais cadastradas
      const validOrders = parsed.filter((order) => validPlantIds.has(order.plantId));
      if (validOrders.length !== parsed.length) {
        saveStoredOrders(validOrders);
      }
      return validOrders;
    }
    return [];
  } catch (err) {
    console.error('Erro ao ler pedidos do localStorage:', err);
    return [];
  }
}

export function saveStoredOrders(orders: CustomerOrder[]): boolean {
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
    return true;
  } catch (err) {
    console.error('Erro ao salvar pedidos no localStorage:', err);
    return false;
  }
}

export function createDefaultOrders(plants: Plant[], destinations: DeliveryDestination[]): CustomerOrder[] {
  // Configuração inicial limpa: nenhum pedido inicial automático
  return [];
}

// A criação de pedidos automáticos é do BACKEND (POST /api/orders/ensure). O frontend não escolhe cliente, planta, preço nem número.

/**
 * Recupera o caixa virtual e o histórico de vendas do Novo Hiper.
 * Se for a primeira inicialização mas já existirem entregas gravadas,
 * migra as entregas existentes para o histórico de vendas de forma segura.
 */
export function getStoredCashRegister(existingDeliveries?: DeliveryRecord[]): CashRegister {
  try {
    const raw = localStorage.getItem(CASH_REGISTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed && 
        typeof parsed.balance === 'number' && 
        typeof parsed.totalSales === 'number' && 
        Array.isArray(parsed.salesHistory)
      ) {
        return parsed;
      }
    }

    // Se não há caixa salvo ainda, migra suavemente a partir de entregas pré-existentes se houver
    const deliveries = existingDeliveries || getStoredDeliveries();
    if (deliveries.length > 0) {
      const salesHistory: SaleRecord[] = deliveries.map((d) => ({
        id: 'sale_' + d.id,
        deliveryId: d.id,
        plantId: d.plantId,
        plantName: d.plantName,
        plantPhotoUrl: d.plantPhotoUrl,
        value: d.plantPrice,
        timestamp: d.timestamp,
        customerName: d.destinationName,
        destinationName: d.destinationAddress,
      }));
      const totalSales = Math.round(salesHistory.reduce((sum, s) => sum + s.value, 0) * 100) / 100;
      const initial: CashRegister = {
        balance: totalSales,
        totalSales,
        salesHistory,
      };
      saveStoredCashRegister(initial);
      return initial;
    }

    const defaultRegister: CashRegister = {
      balance: 0,
      totalSales: 0,
      salesHistory: [],
    };
    saveStoredCashRegister(defaultRegister);
    return defaultRegister;
  } catch (err) {
    console.error('Erro ao ler caixa virtual do localStorage:', err);
    return {
      balance: 0,
      totalSales: 0,
      salesHistory: [],
    };
  }
}

export function saveStoredCashRegister(register: CashRegister): boolean {
  try {
    localStorage.setItem(CASH_REGISTER_STORAGE_KEY, JSON.stringify(register));
    return true;
  } catch (err) {
    console.error('Erro ao salvar caixa virtual no localStorage:', err);
    return false;
  }
}

/**
 * Registra uma nova venda no caixa virtual, evitando duplicidades de entregas.
 */
export function recordSale(
  currentRegister: CashRegister,
  sale: Omit<SaleRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): CashRegister {
  // Evitar duplicidade pelo identificador da entrega
  if (currentRegister.salesHistory.some((s) => s.deliveryId === sale.deliveryId)) {
    return currentRegister;
  }

  const newSale: SaleRecord = {
    id: sale.id || 'sale_' + Date.now(),
    orderId: sale.orderId,
    deliveryId: sale.deliveryId,
    plantId: sale.plantId,
    plantName: sale.plantName,
    plantPhotoUrl: sale.plantPhotoUrl,
    value: sale.value,
    timestamp: sale.timestamp || Date.now(),
    customerName: sale.customerName,
    destinationName: sale.destinationName,
  };

  const updated: CashRegister = {
    balance: Math.round((currentRegister.balance + sale.value) * 100) / 100,
    totalSales: Math.round((currentRegister.totalSales + sale.value) * 100) / 100,
    salesHistory: [newSale, ...currentRegister.salesHistory],
  };

  saveStoredCashRegister(updated);
  return updated;
}
