export interface Plant {
  id: string;
  name: string;
  price: number;
  stock: number;
  photoUrl: string;
  createdAt: number;
  careTag?: string;
  isExample?: boolean;
  species?: string;
}

export interface DeliveryDestination {
  id: string;
  name: string;
  type: 'residencia' | 'familia' | 'escola' | 'parque' | 'comercio';
  address: string;
  distanceKm: number;
  lat: number;
  lng: number;
  description: string;
  isCustom?: boolean;
  notes?: string;
  createdAt?: number;
}

export interface DeliveryRecord {
  id: string;
  plantId: string;
  plantName: string;
  plantPrice: number;
  plantPhotoUrl: string;
  destinationId: string;
  destinationName: string;
  destinationAddress: string;
  timestamp: number;
  status: 'entregue';
}

export type OrderStatus = 'recebido' | 'preparando' | 'pronto' | 'entregue';

export interface Customer {
  id: string;
  name: string;
  avatarUrl: string;
  roleDescription: string;
  destinationId: string;
  address: string;
  notes?: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: number;
  customerId: string;
  customerName: string;
  customerAvatarUrl: string;
  customerRole: string;
  customerAddress: string;
  destinationId: string;
  plantId: string;
  plantName: string;
  plantPrice: number;
  plantPhotoUrl: string;
  quantity: number;
  totalPrice: number;
  status: OrderStatus;
  createdAt: number;
  completedAt?: number;
  customerMessage?: string;
  isDemo?: boolean;
  /** Calculado pelo backend: o estoque atual cobre este pedido aberto. */
  deliverable?: boolean;
}

export type MainTab = 'catalogo' | 'pedidos' | 'entregas' | 'jogo' | 'aventura';

export interface SaleRecord {
  id: string;
  orderId?: string;
  deliveryId: string;
  plantId: string;
  plantName: string;
  plantPhotoUrl?: string;
  value: number;
  timestamp: number;
  customerName: string;
  destinationName: string;
}

export interface CashRegister {
  balance: number;
  totalSales: number;
  salesHistory: SaleRecord[];
}
