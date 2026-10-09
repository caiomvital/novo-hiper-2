import { expect, Page, test } from '@playwright/test';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';
import { PLACA_MADEIRA } from '../../src/shared/shop';
import { ROSTER, rosterById, thanksFor } from '../../src/shared/roster';
import { leaveAdventure, login, openAdventure, pickUpActiveOrder, state, teleport } from './helpers';
import { suiteId } from './suiteData';

// Backend ISOLADO com a geração automática LIGADA e banco novo. Roteiro serial (estado cumulativo, como uma partida):
// sem plantas → planta cadastrada → o BACKEND cria o primeiro pedido → entrega → feedback com a frase → próximo pedido
// → duas abas sem duplicar → grupo 2 de clientes → reload. Nenhum timer do frontend participa.
test.describe.configure({ mode: 'serial' });

const delivery = async (page: Page) => (await state(page)).delivery!;
const waitDelivery = (page: Page, pred: string, timeout = 30_000) =>
  page.waitForFunction(`(() => { const d = window.__NH_ADVENTURE__?.getState().delivery; return Boolean(d && (${pred})); })()`, null, { timeout });
const api = async (page: Page, method: 'get' | 'post' | 'put', url: string, data?: unknown) => {
  const res = await page.request[method](url, data === undefined ? undefined : { data });
  const text = await res.text();
  return { status: res.status(), body: text ? JSON.parse(text) : null };
};
const orders = async (page: Page): Promise<any[]> => (await api(page, 'get', '/api/orders')).body;
const openOrders = async (page: Page) => (await orders(page)).filter((o) => o.status !== 'entregue');
const balance = async (page: Page): Promise<number> => (await api(page, 'get', '/api/cash/summary')).body.balance;
const houseOf = (customerId: string) => HOUSE_CATALOG.find((h) => h.destinationId === rosterById(customerId)!.destinationId)!;

/** O recuo técnico pode segurar o próximo pedido por instantes: pede a verificação até existir um pedido ativo. */
async function waitForOpenOrder(page: Page) {
  for (let i = 0; i < 20; i++) {
    const open = await openOrders(page);
    if (open.length > 0) return open[0];
    await page.waitForTimeout(300);
    await api(page, 'post', '/api/orders/ensure');
  }
  throw new Error('nenhum pedido ativo apareceu');
}

/** Entrega pelo fluxo oficial da API (o mesmo que a Aventura usa), sem tela. */
async function deliverViaApi(page: Page) {
  const o = await waitForOpenOrder(page);
  const d = await api(page, 'post', '/api/deliveries/start', { order_id: o.id });
  expect(d.status).toBeLessThan(300);
  expect((await api(page, 'post', `/api/deliveries/${d.body.id}/finish`)).status).toBe(200);
  return o;
}

let plantId = '';
let firstOrderId = '';
let firstCustomer = '';
const PRICE = 37.5;
const manualPostsToOrders: string[] = []; // POST /api/orders feitos pelo navegador (não deve haver nenhum)

test.beforeEach(async ({ page }) => {
  page.on('request', (r) => {
    if (r.method() === 'POST' && /\/api\/orders$/.test(r.url())) manualPostsToOrders.push(r.url());
  });
  await login(page, { filterOrders: false }); // aqui queremos ver exatamente o que o backend criou
});

test('1. banco novo, sem plantas: nenhum pedido e a Aventura diz o que fazer', async ({ page }) => {
  expect(await orders(page)).toHaveLength(0);
  await openAdventure(page);
  await waitDelivery(page, "d.hud === 'Cadastre uma planta na Novo Hiper para começar.'");
  expect((await delivery(page)).activeOrderId).toBeNull();
  expect(await orders(page)).toHaveLength(0); // abrir a Aventura não inventa pedido sem planta
});

test('2. cadastrar uma planta: o BACKEND cria o primeiro pedido (preço da planta, cliente do grupo inicial, casa do roster) sem timer', async ({ page }) => {
  const r = await api(page, 'post', '/api/plants', { id: suiteId('plant'), name: 'Samambaia da Loja', price: PRICE, stock_quantity: 50, image_path: '/a.jpg' });
  expect(r.status).toBe(201);
  plantId = r.body.id;

  const list = await orders(page);
  expect(list).toHaveLength(1);
  const o = list[0];
  firstOrderId = o.id;
  firstCustomer = o.customer_id;
  expect(ROSTER.filter((c) => c.group === 1).map((c) => c.id)).toContain(o.customer_id);
  expect(o.order_number).toBe(101);
  expect(o.items[0]).toMatchObject({ plant_id: plantId, quantity: 1, unit_price: PRICE });
  expect(o.total).toBe(PRICE);
  expect(o.destination_id).toBe(rosterById(o.customer_id)!.destinationId);

  // a Aventura mostra esse pedido (abrir/voltar à Aventura pede a verificação; o backend responde "já há pedido ativo")
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(o.id)}`);
  const d = await delivery(page);
  expect(d.customerName).toBe(rosterById(o.customer_id)!.name);
  expect(d.customerVisible).toBe(true);
  expect(d.destination).toMatchObject({ status: 'house', id: rosterById(o.customer_id)!.destinationId });
  expect(d.customer).toEqual(houseOf(o.customer_id).deliveryPoint);
});

test('3. sem timer no frontend: capacidade 1 — esperando e consultando, nunca aparece um segundo pedido', async ({ page }) => {
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(firstOrderId)}`);
  await page.waitForTimeout(13_000); // mais que um ciclo de consulta da Aventura (10 s)
  expect(await orders(page)).toHaveLength(1);
  expect((await delivery(page)).activeOrderId).toBe(firstOrderId);
  expect(manualPostsToOrders).toEqual([]); // o navegador NUNCA criou pedido (nem mandou preço/número)
});

test('4. entregar: feedback com a frase do cliente, caixa recebe o preço da planta e o backend cria o próximo pedido', async ({ page }) => {
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(firstOrderId)}`);
  const stockBefore = (await api(page, 'get', `/api/plants/${plantId}`)).body.stock_quantity;
  await pickUpActiveOrder(page); // pega a planta na Novo Hiper antes de poder entregar
  const target = houseOf(firstCustomer).deliveryPoint;
  await teleport(page, target.x, target.y + 20);
  await waitDelivery(page, 'd.near');
  await page.keyboard.press('KeyE');
  await waitDelivery(page, "d.phase === 'done'");

  expect((await delivery(page)).feedbackLine).toBe(thanksFor(firstCustomer)); // frase do roster
  expect(await balance(page)).toBe(PRICE);
  expect((await api(page, 'get', `/api/plants/${plantId}`)).body.stock_quantity).toBe(stockBefore - 1);

  // o próximo pedido nasce no backend sem espera artificial e é de OUTRO cliente
  await waitDelivery(page, `d.activeOrderId && d.activeOrderId !== ${JSON.stringify(firstOrderId)}`, 20_000);
  const open = await openOrders(page);
  expect(open).toHaveLength(1);
  expect(open[0].customer_id).not.toBe(firstCustomer);
  expect(open[0].order_number).toBe(102);
  expect(open[0].items[0].unit_price).toBe(PRICE);
  expect(manualPostsToOrders).toEqual([]);
});

test('5. duas abas/páginas pedindo verificação ao mesmo tempo não criam pedidos duplicados', async ({ page, context }) => {
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('#tab-btn-adventure')).toBeVisible();
  await deliverViaApi(page); // fecha o ativo; o evento de entrega faz o servidor criar o próximo
  expect(await openOrders(page)).toHaveLength(1);
  const afterFirst = (await orders(page)).length;
  await deliverViaApi(page); // fecha de novo: o recuo técnico (1 s neste ambiente) ainda segura o seguinte
  expect(await openOrders(page)).toHaveLength(0);
  await page.waitForTimeout(1300);

  // 12 pedidos de verificação simultâneos vindos das duas páginas: o servidor decide e cria exatamente UM
  const results = await Promise.all([
    ...Array.from({ length: 6 }, () => api(page, 'post', '/api/orders/ensure')),
    ...Array.from({ length: 6 }, () => api(second, 'post', '/api/orders/ensure')),
  ]);
  expect(results.every((r) => r.status === 200)).toBe(true);
  expect(results.filter((r) => r.body.created === true)).toHaveLength(1);
  expect(results.filter((r) => r.body.reason === 'active_order').length).toBe(11);
  expect(await openOrders(page)).toHaveLength(1);
  expect((await orders(page)).length).toBe(afterFirst + 1);
  const numbers = (await orders(page)).map((o) => o.order_number);
  expect(new Set(numbers).size).toBe(numbers.length); // sem número repetido
  await second.close();
});

test('6. grupo 2: aparece só depois de uma melhoria instalada e 3 entregas, e o cliente novo usa a casa esperada', async ({ page }) => {
  const done = (await orders(page)).filter((o) => o.status === 'entregue').length;
  expect(done).toBeGreaterThanOrEqual(3); // entregas dos passos anteriores
  // sem melhoria instalada: grupo 1 apenas, mesmo com 3+ entregas
  const progress0 = (await api(page, 'get', '/api/progress')).body;
  expect(progress0.milestones.vizinhos_2.achieved).toBe(false);
  for (const o of await orders(page)) expect(ROSTER.find((c) => c.id === o.customer_id)!.group).toBe(1);

  // compra e instala a placa (já há saldo das entregas) → grupo 2 liberado
  expect((await api(page, 'post', `/api/shop/upgrades/${PLACA_MADEIRA}/purchase`, {})).status).toBe(200);
  expect((await api(page, 'post', `/api/shop/upgrades/${PLACA_MADEIRA}/install`, {})).status).toBe(200);
  await deliverViaApi(page); // uma entrega a mais para os eventos reavaliarem
  const p = (await api(page, 'get', '/api/progress')).body;
  expect(p.milestones.vizinhos_2.achieved).toBe(true);
  expect(p.milestones.vizinhos_3.achieved).toBe(false);

  // entre as próximas entregas aparece alguém do grupo 2 (nunca do 3), com a casa do roster
  let seenGroup2: any = null;
  for (let i = 0; i < 40 && !seenGroup2; i++) {
    const o = await waitForOpenOrder(page);
    const entry = ROSTER.find((c) => c.id === o.customer_id)!;
    expect(entry.group, `${entry.name} é de um grupo ainda bloqueado`).toBeLessThanOrEqual(2);
    if (entry.group === 2) seenGroup2 = o;
    else await deliverViaApi(page);
  }
  expect(seenGroup2, 'um morador do grupo 2 apareceu').toBeTruthy();
  const entry = rosterById(seenGroup2.customer_id)!;
  expect(seenGroup2.destination_id).toBe(entry.destinationId);

  // e a Aventura leva Bernardo à casa certa: destaque, NPC e ponto de entrega do cliente novo
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(seenGroup2.id)}`);
  const d = await delivery(page);
  expect(d.customerName).toBe(entry.name);
  expect(d.customer).toEqual(houseOf(entry.id).deliveryPoint);
  expect(d.highlightVisible).toBe(true);
});

test('7. reload e reentrada preservam pedido, cliente e marcos', async ({ page }) => {
  const before = (await openOrders(page))[0];
  const milestones = (await api(page, 'get', '/api/progress')).body.milestones;
  await page.reload();
  await page.locator('#tab-btn-adventure').click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(before.id)}`);
  expect((await delivery(page)).customerName).toBe(rosterById(before.customer_id)!.name);
  await leaveAdventure(page);
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(before.id)}`);
  const after = (await api(page, 'get', '/api/progress')).body.milestones;
  expect(after.vizinhos_2).toEqual(milestones.vizinhos_2); // mesmo achieved_at
  expect(await openOrders(page)).toHaveLength(1);
  expect(manualPostsToOrders).toEqual([]);
});

test('8. estoque baixado à mão com pedido aberto: o pedido fica, a interface pede reposição e nada de estoque negativo; repor libera', async ({ page }) => {
  const o = (await openOrders(page))[0];
  const p = (await api(page, 'get', `/api/plants/${o.items[0].plant_id}`)).body;
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(o.id)}`);
  expect((await delivery(page)).deliverable).toBe(true);

  await api(page, 'put', `/api/plants/${p.id}`, { name: p.name, price: p.price, stock_quantity: 0 });
  await waitDelivery(page, 'd.deliverable === false', 25_000); // a consulta periódica reflete o estoque
  const d = await delivery(page);
  expect(d.activeOrderId).toBe(o.id); // o pedido NÃO sumiu
  expect(d.hud).toMatch(/falta estoque.*Reponha na Novo Hiper/i);
  expect(d.customerVisible).toBe(false);
  expect(d.indicator).toBeNull();
  expect((await openOrders(page))).toHaveLength(1); // nenhum outro pedido para "contornar"
  expect((await api(page, 'get', `/api/plants/${p.id}`)).body.stock_quantity).toBe(0); // nunca negativo

  await teleport(page, houseOf(o.customer_id).deliveryPoint.x, houseOf(o.customer_id).deliveryPoint.y + 20);
  await page.waitForTimeout(500);
  expect((await delivery(page)).promptVisible).toBe(false); // sem estoque não oferece entregar

  await api(page, 'put', `/api/plants/${p.id}`, { name: p.name, price: p.price, stock_quantity: 10 });
  await waitDelivery(page, 'd.deliverable === true', 25_000);
  expect((await delivery(page)).customerVisible).toBe(true);
});
