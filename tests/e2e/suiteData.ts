import type { Page } from '@playwright/test';

/**
 * Isolamento dos dados do E2E no backend de DEV compartilhado com o teste manual.
 * Regra: a suíte só vê, só finaliza e só limpa o que ELA mesma criou (ids com este prefixo).
 * Pedidos manuais ou de outras origens nunca são lidos pela Aventura nos testes nem finalizados por eles.
 */
export const SUITE_PREFIX = 'e2e_';

let seq = 0;
export const suiteId = (tag: string) => `${SUITE_PREFIX}${tag}_${Date.now()}_${++seq}`;
export const isSuiteId = (id: unknown): boolean => typeof id === 'string' && id.startsWith(SUITE_PREFIX);

/**
 * A Aventura escolhe o pedido ativo entre TODOS os pedidos abertos devolvidos por GET /api/orders.
 * Aqui a resposta recebida pelo navegador é filtrada para só conter pedidos da suíte; o banco não é tocado.
 */
export async function isolateSuiteOrders(page: Page) {
  await page.route(/\/api\/orders(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const body = await response.json();
    await route.fulfill({ response, json: Array.isArray(body) ? body.filter((o) => isSuiteId(o?.id)) : body });
  });
}

/** Finaliza (pelo fluxo oficial) somente pedidos ABERTOS criados pela suíte; `except` preserva ids. */
export async function closeSuiteOrders(page: Page, except: string[] = []) {
  const orders = (await (await page.request.get('/api/orders')).json()) as any[];
  for (const o of orders) {
    if (!isSuiteId(o.id) || o.status === 'entregue' || except.includes(o.id)) continue;
    for (const it of o.items ?? []) {
      const p = await (await page.request.get(`/api/plants/${it.plant_id}`)).json();
      if (isSuiteId(it.plant_id) && p && p.stock_quantity < it.quantity) {
        await page.request.put(`/api/plants/${it.plant_id}`, { data: { name: p.name, price: p.price, stock_quantity: 100 } });
      }
    }
    const d = await page.request.post('/api/deliveries/start', { data: { order_id: o.id } });
    if (d.ok()) await page.request.post(`/api/deliveries/${(await d.json()).id}/finish`);
  }
}
