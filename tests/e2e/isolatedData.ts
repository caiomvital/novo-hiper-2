import type { Page } from '@playwright/test';
import { createSuiteOrder, suiteId } from './suiteData';

/** Saldo atual do caixa pela API (a verdade do backend). */
export const cashBalance = async (page: Page): Promise<number> => (await (await page.request.get('/api/cash/summary')).json()).balance;

/**
 * Ganha `amount` no caixa pelo fluxo REAL (pedido → start → finish), sem tela. Só para o backend ISOLADO
 * (specs *.isolated.spec.ts), onde o estado nasce zerado e pode ser controlado sem tocar no data-dev manual.
 */
export async function earn(page: Page, amount: number): Promise<void> {
  const plant = await (
    await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: `Planta R$ ${amount}`, price: amount, stock_quantity: 5, image_path: '/a.jpg' } })
  ).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Cliente Isolado' });
  const d = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
  const r = await page.request.post(`/api/deliveries/${d.id}/finish`);
  if (!r.ok()) throw new Error(`earn: finish falhou (${r.status()})`);
}

export const shopState = async (page: Page) =>
  (await (await page.request.get('/api/shop')).json()) as { balance: number; upgrades: Array<{ id: string; state: string; price: number }> };

export const purchaseDebits = async (page: Page) =>
  ((await (await page.request.get('/api/cash')).json()).transactions as any[]).filter((t) => t.type === 'upgrade_purchase');
