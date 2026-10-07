import { UNAUTHORIZED_EVENT } from './auth';
import { Plant, DeliveryRecord, CustomerOrder, OrderStatus, CashRegister, SaleRecord } from '../types';

export type EnsureReason = 'active_order' | 'cooldown' | 'no_plants' | 'no_stock' | 'no_customers' | 'disabled';

export interface ShopUpgradeView {
  id: string;
  name: string;
  description: string;
  price: number;
  state: 'available' | 'pending' | 'installed';
  purchasedAt: number | null;
  installedAt: number | null;
}
export interface ShopSnapshot {
  balance: number;
  upgrades: ShopUpgradeView[];
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string>),
    };

    if (!(options?.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin', // cookie de sessão HttpOnly (mesma origem)
    });

    // Sessão inválida/expirada no servidor: avisa a aplicação (volta ao login sem apagar dados do negócio)
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    if (!response.ok) {
      let errorMessage = `Erro na requisição (${response.status})`;
      let code: string | undefined;
      try {
        const errJson = await response.json();
        if (errJson?.error) {
          errorMessage = errJson.error;
        }
        if (typeof errJson?.code === 'string') code = errJson.code;
      } catch {
        // Ignora caso não seja JSON
      }
      throw Object.assign(new Error(errorMessage), { code });
    }

    return response.json();
  }

  // Checagem de disponibilidade do backend
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- Plantas ---
  async getPlants(): Promise<Plant[]> {
    const data = await this.request<any[]>('/plants');
    return data.map((p) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      stock: Number(p.stock_quantity ?? 0),
      photoUrl: p.image_path,
      species: p.species || undefined,
      careTag: p.care_tag || undefined,
      createdAt: p.created_at,
    }));
  }

  async createPlant(plant: {
    id?: string;
    name: string;
    price: number;
    stock: number;
    photoUrl: string;
    species?: string;
    careTag?: string;
  }): Promise<Plant> {
    const created = await this.request<any>('/plants', {
      method: 'POST',
      body: JSON.stringify({
        id: plant.id,
        name: plant.name,
        price: plant.price,
        stock_quantity: plant.stock,
        image_path: plant.photoUrl,
        species: plant.species,
        care_tag: plant.careTag,
      }),
    });
    return {
      id: created.id,
      name: created.name,
      price: Number(created.price),
      stock: Number(created.stock_quantity),
      photoUrl: created.image_path,
      species: created.species,
      careTag: created.care_tag,
      createdAt: created.created_at,
    };
  }

  async updatePlant(id: string, plant: {
    name: string;
    price: number;
    stock: number;
    photoUrl: string;
    species?: string;
    careTag?: string;
  }): Promise<Plant> {
    const updated = await this.request<any>(`/plants/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: plant.name,
        price: plant.price,
        stock_quantity: plant.stock,
        image_path: plant.photoUrl,
        species: plant.species,
        care_tag: plant.careTag,
      }),
    });
    return {
      id: updated.id,
      name: updated.name,
      price: Number(updated.price),
      stock: Number(updated.stock_quantity),
      photoUrl: updated.image_path,
      species: updated.species,
      careTag: updated.care_tag,
      createdAt: updated.created_at,
    };
  }

  async deletePlant(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/plants/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.success;
  }

  async getStockSummary(): Promise<{ totalUnits: number; plants: any[] }> {
    return this.request<{ totalUnits: number; plants: any[] }>('/plants/stock');
  }

  // --- Upload de Fotos das Plantas ---
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);

    const res = await this.request<{ success: boolean; filePath: string }>('/upload', {
      method: 'POST',
      body: formData,
    });

    return res.filePath;
  }

  // --- Pedidos ---
  async getOrders(): Promise<CustomerOrder[]> {
    const data = await this.request<any[]>('/orders');
    return data.map((o) => {
      const firstItem = o.items?.[0];
      return {
        id: o.id,
        orderNumber: o.order_number || 101,
        customerId: o.customer_id,
        customerName: o.customer_name || 'Cliente',
        customerAvatarUrl: o.customer_avatar_url || '',
        customerRole: o.customer_role || '',
        customerAddress: o.customer_address || '',
        destinationId: o.destination_id || 'dest_default',
        plantId: firstItem?.plant_id || '',
        plantName: firstItem?.plant_name || '',
        plantPrice: Number(firstItem?.unit_price ?? o.total),
        plantPhotoUrl: firstItem?.plant_photo_url || '',
        quantity: Number(firstItem?.quantity || 1),
        totalPrice: Number(o.total),
        status: o.status as OrderStatus,
        createdAt: o.created_at,
        customerMessage: o.customer_message || undefined,
        deliverable: o.deliverable,
      };
    });
  }

  /**
   * PEDE ao backend uma verificação de novo pedido automático. Quem decide (e escolhe cliente, planta, preço e número)
   * é o backend; o cliente só recebe o resultado.
   */
  async ensureOrder(): Promise<{ created: boolean; reason?: EnsureReason }> {
    const r = await this.request<{ created: boolean; reason?: EnsureReason }>('/orders/ensure', { method: 'POST', body: JSON.stringify({}) });
    return { created: r.created, reason: r.reason };
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    await this.request(`/orders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // --- Entregas ---
  async getDeliveries(): Promise<DeliveryRecord[]> {
    const data = await this.request<any[]>('/deliveries');
    return data.map((d) => ({
      id: d.id,
      plantId: '',
      plantName: `Pedido #${d.order_number || d.order_id}`,
      plantPrice: Number(d.order_total || 0),
      plantPhotoUrl: '',
      destinationId: d.destination_id || '',
      destinationName: d.customer_name || 'Destino Olinda',
      destinationAddress: d.customer_address || '',
      timestamp: d.finished_at || d.created_at,
      status: 'entregue',
    }));
  }

  async startDelivery(orderId: string, gameState?: any): Promise<any> {
    return this.request<any>('/deliveries/start', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, game_state: gameState }),
    });
  }

  async updateDeliveryState(deliveryId: string, gameState: any, status?: string): Promise<any> {
    return this.request<any>(`/deliveries/${encodeURIComponent(deliveryId)}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ game_state: gameState, status }),
    });
  }

  async finishDelivery(deliveryId: string): Promise<{
    success: boolean;
    delivery: any;
    order: any;
    cashBalance: number;
    totalSales: number;
  }> {
    return this.request<any>(`/deliveries/${encodeURIComponent(deliveryId)}/finish`, {
      method: 'POST',
    });
  }

  // --- Caixa ---
  async getCashRegister(): Promise<CashRegister> {
    const data = await this.request<any>('/cash');
    const salesHistory: SaleRecord[] = (data.transactions || []).map((t: any) => ({
      id: t.id,
      orderId: t.order_id || undefined,
      deliveryId: t.delivery_id || t.id,
      plantId: '',
      plantName: t.description || 'Venda',
      value: Number(t.amount || 0),
      timestamp: t.created_at,
      customerName: t.customer_name || 'Cliente',
      destinationName: t.destination_name || 'Olinda',
    }));

    return {
      balance: Number(data.balance || 0),
      totalSales: Number(data.totalSales || 0),
      salesHistory,
    };
  }

  // --- Loja de Utilidades (o backend é a autoridade de preço, saldo, compra e instalação) ---
  async getShop(): Promise<ShopSnapshot> {
    return this.request<ShopSnapshot>('/shop');
  }

  async purchaseShopUpgrade(id: string): Promise<ShopSnapshot & { alreadyApplied: boolean }> {
    return this.request(`/shop/upgrades/${encodeURIComponent(id)}/purchase`, { method: 'POST', body: JSON.stringify({}) });
  }

  async installShopUpgrade(id: string): Promise<ShopSnapshot & { alreadyApplied: boolean }> {
    return this.request(`/shop/upgrades/${encodeURIComponent(id)}/install`, { method: 'POST', body: JSON.stringify({}) });
  }

  // --- Jogo / Estado ---
  async getGameCurrent(): Promise<any> {
    return this.request<any>('/game/current');
  }

  async updateGameProgress(progress: {
    active_order_id?: string;
    active_delivery_id?: string;
    player_x?: number;
    player_y?: number;
    mission_state?: any;
    store_upgrades?: any;
  }): Promise<any> {
    return this.request<any>('/game/progress', {
      method: 'PUT',
      body: JSON.stringify(progress),
    });
  }

  // --- Migração ---
  async getMigrationStatus(): Promise<{ initialized: boolean; legacyMigrationEnabled?: boolean; counts: any }> {
    return this.request<{ initialized: boolean; legacyMigrationEnabled?: boolean; counts: any }>('/migration/status');
  }

  async migrateFromLocalStorage(payload: any): Promise<any> {
    return this.request<any>('/migration', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
