import { expect, test, Page } from '@playwright/test';
import { login } from './helpers';

test.describe.configure({ mode: 'serial' });
let plantId = '';
let orderId = '';
const list = async (page: Page) => (await (await page.request.get('/api/orders')).json()) as any[];
test.beforeEach(async ({ page }) => {
  await login(page, { filterOrders: false });
  await page.locator('#tab-btn-orders').click();
});

test('F01/F02: cadastro gera pedido automático com cliente, planta, preço e próximo passo', async ({ page }) => {
  const response = await page.request.post('/api/plants', { data: { name: 'Samambaia marco 3', price: 20, stock_quantity: 5, image_path: '/pwa-192x192.png' } });
  expect(response.status()).toBe(201); plantId = (await response.json()).id;
  const orders = await list(page); expect(orders).toHaveLength(1);
  const order = orders[0]; orderId = order.id;
  expect(order.customer_name).toBeTruthy(); expect(order.destination_id).toBeTruthy();
  expect(order.items[0]).toMatchObject({ plant_id: plantId, quantity: 1, unit_price: 20 });
  expect(order.total).toBe(20);
  await expect(page.locator(`#order-card-${orderId}`)).toContainText(order.customer_name, { timeout: 20000 });
  await expect(page.locator(`#order-card-${orderId}`)).toContainText('Samambaia marco 3');
  await expect(page.getByRole('button', { name: 'Preparar Planta', exact: true })).toBeVisible();
});

test('F03/F04: preparo lento não confirma antes da API; falha de pronto permite repetir e persiste', async ({ page }, info) => {
  const card = page.locator(`#order-card-${orderId}`);
  await expect(card).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; }); let calls = 0;
  await page.route(`**/api/orders/${orderId}`, async (route) => { calls++; await gate; await route.continue(); });
  await card.getByRole('button', { name: 'Preparar Planta', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Confirmando…' })).toBeDisabled();
  await expect(card.getByText('Recebido', { exact: true })).toBeVisible();
  expect((await list(page))[0].status).toBe('recebido'); expect(calls).toBe(1);
  release(); await expect(card.getByText('Preparando', { exact: true })).toBeVisible();
  await page.unroute(`**/api/orders/${orderId}`);
  await page.getByRole('button', { name: /^Recebidos/ }).click(); await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /^Em Preparo/ }).click(); await expect(card).toBeVisible();
  await page.route(`**/api/orders/${orderId}`, (route) => route.fulfill({ status: 503, json: { error: 'Não foi possível confirmar o preparo agora.' } }));
  await card.getByRole('button', { name: 'Marcar como Pronto', exact: true }).click();
  await expect(card.getByRole('alert')).toContainText('Não foi possível confirmar');
  expect((await list(page))[0].status).toBe('preparando');
  await page.unroute(`**/api/orders/${orderId}`);
  await card.getByRole('button', { name: 'Marcar como Pronto', exact: true }).click();
  await page.getByRole('button', { name: /^Prontos para Entrega/ }).click();
  await expect(card.getByRole('button', { name: 'Continuar na Aventura' })).toBeVisible();
  await page.reload(); await page.locator('#tab-btn-orders').click();
  await expect(card.getByText('Pronto p/ Entrega', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('pedido-confirmado.png'), fullPage: true });
});

test('F05: reload, reabertura e verificações repetidas preservam um único pedido ativo', async ({ page, context }) => {
  await Promise.all([1, 2, 3].map(() => page.request.post('/api/orders/ensure', { data: {} })));
  expect((await list(page)).filter((o) => o.status !== 'entregue').map((o) => o.id)).toEqual([orderId]);
  await page.reload(); await expect(page.locator('#tab-btn-orders')).toBeVisible();
  const reopened = await context.newPage(); await reopened.goto('/'); await reopened.locator('#tab-btn-orders').click();
  await expect(reopened.locator(`#order-card-${orderId}`)).toBeVisible(); await reopened.close();
});

test('F06/F07: preço congelado, falta de estoque mantém pedido e reposição libera entrega', async ({ page }) => {
  expect((await page.request.put(`/api/plants/${plantId}`, { data: { name: 'Samambaia marco 3', price: 99, stock_quantity: 0 } })).ok()).toBe(true);
  await page.reload(); await page.locator('#tab-btn-orders').click();
  await expect(page.locator(`#order-card-${orderId}`)).toContainText('Reponha o estoque');
  let order = (await list(page)).find((o) => o.id === orderId);
  expect(order.total).toBe(20); expect(order.deliverable).toBe(false);
  expect((await page.request.post('/api/deliveries/start', { data: { order_id: orderId } })).status()).toBe(400);
  expect((await list(page)).filter((o) => o.status !== 'entregue')).toHaveLength(1);
  await page.request.put(`/api/plants/${plantId}`, { data: { name: 'Samambaia marco 3', price: 99, stock_quantity: 5 } });
  order = (await list(page)).find((o) => o.id === orderId); expect(order.deliverable).toBe(true);
});

test('F08/F03: após venda o próximo pedido aparece automaticamente na lista e histórico/filtros conferem', async ({ page }) => {
  const started = await page.request.post('/api/deliveries/start', { data: { order_id: orderId } });
  const delivery = await started.json();
  expect((await page.request.post(`/api/deliveries/${delivery.id}/finish`)).ok()).toBe(true);
  await expect.poll(async () => (await list(page)).filter((o) => o.status !== 'entregue').length, { timeout: 25000 }).toBe(1);
  const next = (await list(page)).find((o) => o.status !== 'entregue'); expect(next.id).not.toBe(orderId);
  await expect(page.locator(`#order-card-${next.id}`)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /^Entregues/ }).click();
  await expect(page.locator(`#order-card-${orderId}`)).toBeVisible(); await expect(page.locator(`#order-card-${next.id}`)).toHaveCount(0);
  await page.getByRole('button', { name: /^Recebidos/ }).click();
  await expect(page.locator(`#order-card-${next.id}`)).toBeVisible();
});
