import { expect, Page, test } from '@playwright/test';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { DELIVERY_ERROR_MS, DELIVERY_FEEDBACK_MS } from '../../src/phaser-game/bridge/adventureBridge';
import { formatBRL } from '../../src/phaser-game/logic/format';
import { login, openAdventure, pickUpActiveOrder, state, teleport, walkRoute } from './helpers';
import { ROUTE_TO_CUSTOMER } from './routes';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';


async function api(page: Page, method: 'get' | 'post' | 'put', url: string, data?: unknown) {
  const res = await page.request[method](url, data === undefined ? undefined : { data });
  const text = await res.text();
  return { status: res.status(), body: text ? JSON.parse(text) : null };
}
const createPlant = async (page: Page, over: Record<string, unknown> = {}) => {
  const id = suiteId('plant');
  const r = await api(page, 'post', '/api/plants', { id, name: 'Planta E2E', price: 12.5, stock_quantity: 5, image_path: '/uploads/plants/e2e.jpg', ...over });
  expect(r.status).toBe(201);
  return r.body;
};
const createOrder = async (page: Page, plantId: string, quantity = 1, customer = 'Cliente E2E') => {
  // cliente na casa amarela (o ponto CUSTOMER_SPOT que estes testes percorrem)
  return createSuiteOrder(page, { plantId, quantity, customerName: customer });
};
const orderStatus = async (page: Page, id: string) => (await api(page, 'get', `/api/orders/${id}`)).body.status as string;
const stock = async (page: Page, id: string) => (await api(page, 'get', `/api/plants/${id}`)).body.stock_quantity as number;
const cash = async (page: Page) => (await api(page, 'get', '/api/cash')).body as { balance: number; transactions: any[] };

const delivery = async (page: Page) => (await state(page)).delivery!;
const waitDelivery = (page: Page, pred: string, timeout = 30_000) =>
  page.waitForFunction(`(() => { const d = window.__NH_ADVENTURE__?.getState().delivery; return Boolean(d && (${pred})); })()`, null, { timeout });

/** `walk=true` percorre as ruas de verdade; senão teletransporta para junto do destino (quando andar não é o que se testa). */
async function goToCustomer(page: Page, walk = false) {
  if (walk) await walkRoute(page, ROUTE_TO_CUSTOMER, 12);
  else await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 20);
  await waitDelivery(page, 'd.near');
}

function countRequests(page: Page) {
  const calls = { start: 0, finish: 0 };
  page.on('request', (r) => {
    if (r.method() !== 'POST') return;
    if (r.url().endsWith('/api/deliveries/start')) calls.start++;
    if (/\/api\/deliveries\/[^/]+\/finish$/.test(r.url())) calls.finish++;
  });
  return calls;
}

// não deixa pedido aberto da suíte no DEV (o teste manual não deve vê-lo); só toca em ids da suíte
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

test.describe('vertical slice: pedido real → mapa → cliente → entrega → caixa', () => {
  test('fluxo completo: entrega uma vez (estoque e caixa exatamente 1×), feedback preservando o cliente e só depois o próximo pedido', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await createPlant(page, { name: 'Samambaia E2E', price: 12.5, stock_quantity: 5 });
    const first = await createOrder(page, plant.id, 1, 'Dona Maria E2E');
    const second = await createOrder(page, plant.id, 1, 'Seu João E2E');
    expect([first.order_number, second.order_number].every(Number.isInteger)).toBe(true);

    const cashBefore = await cash(page);
    const calls = countRequests(page);
    await openAdventure(page);

    // pedido REAL do backend aparece no mundo (o mais antigo)
    await waitDelivery(page, `d.loaded && d.activeOrderId === ${JSON.stringify(first.id)}`);
    let d = await delivery(page);
    expect(d.customerVisible).toBe(true);
    expect(d.customerName).toBe('Dona Maria E2E');
    expect(d.hud).toContain('Samambaia E2E');

    // longe do cliente: E não entrega nada
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
    expect(calls.start).toBe(0);

    // pega a planta na Novo Hiper antes de poder entregar (único POST /deliveries/start do teste;
    // o handler de entrega reaproveita esse id em vez de chamar start de novo)
    await pickUpActiveOrder(page);

    await goToCustomer(page, true); // percorre as ruas até a casa do cliente
    expect((await delivery(page)).promptVisible).toBe(true);

    // várias teclas E seguidas: uma única intenção chega ao backend
    await page.keyboard.press('KeyE');
    await page.keyboard.press('KeyE');
    await page.keyboard.press('KeyE');
    await waitDelivery(page, "d.phase === 'done'");

    // FEEDBACK: o pedido/cliente recém-entregue continua na tela; recompensa e HUD mostram o valor
    d = await delivery(page);
    expect(d.activeOrderId).toBe(first.id);
    expect(d.customerName).toBe('Dona Maria E2E');
    expect(d.customerVisible).toBe(true);
    expect(d.lastReward).toBe(12.5);
    expect(d.hud).toContain(formatBRL(12.5));
    expect(d.promptVisible).toBe(false);

    // backend: estoque e caixa alterados EXATAMENTE uma vez
    expect(await orderStatus(page, first.id)).toBe('entregue');
    expect(await stock(page, plant.id)).toBe(4);
    const cashAfter = await cash(page);
    expect(cashAfter.balance).toBeCloseTo(cashBefore.balance + 12.5, 5);
    expect(cashAfter.transactions.length).toBe(cashBefore.transactions.length + 1);
    expect(cashAfter.transactions.filter((t) => t.order_id === first.id)).toHaveLength(1);
    expect(calls).toEqual({ start: 1, finish: 1 });

    // durante o feedback nenhuma nova entrega pode ser iniciada
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    expect(calls).toEqual({ start: 1, finish: 1 });

    // só DEPOIS do feedback o próximo pedido é publicado
    await waitDelivery(page, `d.phase === 'idle' && d.activeOrderId === ${JSON.stringify(second.id)}`, DELIVERY_FEEDBACK_MS + 15_000);
    d = await delivery(page);
    expect(d.customerName).toBe('Seu João E2E');
    expect(d.lastReward).toBeNull();
    // ainda não retirado na loja: o HUD orienta a passar na Novo Hiper antes (sem o nome do cliente, por ora)
    expect(d.hud).toContain('pegue');
    expect(d.hud).toContain('Novo Hiper');

    // o App recarregou estoque/caixa: o caixa do cabeçalho mostra o saldo novo
    const header = (await page.locator('#btn-open-cash-mobile, #btn-open-cash-desktop').locator('visible=true').first().innerText()).replace(/\s/g, ' ');
    expect(header).toContain(formatBRL(cashAfter.balance));

    // e o mundo continua jogável: o jogador ainda anda
    const p0 = (await state(page)).player!;
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');
    expect((await state(page)).player!.x).toBeLessThan(p0.x - 20);

    // limpeza: fecha o 2º pedido pelo fluxo oficial
    await closeSuiteOrders(page);
  });

  test('sem pedido ativo: mundo explorável, aviso discreto e nenhuma chamada de entrega', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    await createPlant(page); // com estoque: "sem pedido" é só questão de esperar (sem plantas a mensagem seria outra)
    const calls = countRequests(page);
    await openAdventure(page);
    await waitDelivery(page, 'd.loaded');
    const d = await delivery(page);
    expect(d.activeOrderId).toBeNull();
    expect(d.customerVisible).toBe(false);
    expect(d.hud).toBe('Sem entregas no momento');

    await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 40);
    await page.waitForTimeout(500);
    expect((await delivery(page)).promptVisible).toBe(false);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(800);
    expect(calls).toEqual({ start: 0, finish: 0 });
    expect((await delivery(page)).phase).toBe('idle');
  });

  test('erro do servidor (estoque insuficiente): mostra a mensagem, o pedido continua aberto e dá para tentar de novo', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await createPlant(page, { stock_quantity: 2, price: 10 });
    const order = await createOrder(page, plant.id, 2);
    const cashBefore = await cash(page);
    await openAdventure(page);
    await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)} && d.deliverable === true`);
    await pickUpActiveOrder(page); // estoque ainda suficiente neste momento
    await goToCustomer(page);

    // o dono baixa o estoque à mão logo antes de Bernardo entregar (a tela ainda não percebeu): o SERVIDOR recusa
    const p0 = (await api(page, 'get', `/api/plants/${plant.id}`)).body;
    await api(page, 'put', `/api/plants/${plant.id}`, { name: p0.name, price: p0.price, stock_quantity: 1 });
    await page.keyboard.press('KeyE');
    await waitDelivery(page, "d.phase === 'error'");
    expect((await delivery(page)).hud).toMatch(/Estoque insuficiente/i);
    expect(await orderStatus(page, order.id)).not.toBe('entregue');
    expect(await stock(page, plant.id)).toBe(1); // nunca negativo
    expect((await cash(page)).transactions.length).toBe(cashBefore.transactions.length);

    // volta ao normal sozinho, com o MESMO pedido ativo (agora a tela sabe que falta estoque)
    await waitDelivery(page, `d.phase === 'idle' && d.activeOrderId === ${JSON.stringify(order.id)}`, DELIVERY_ERROR_MS + 15_000);

    // reabastece (catálogo): a tela percebe, libera a entrega e entrega normalmente, uma única vez
    await api(page, 'put', `/api/plants/${plant.id}`, { name: p0.name, price: p0.price, stock_quantity: 5 });
    await waitDelivery(page, 'd.deliverable === true && d.near', 30_000);
    await page.keyboard.press('KeyE');
    await waitDelivery(page, "d.phase === 'done'");
    expect(await orderStatus(page, order.id)).toBe('entregue');
    expect(await stock(page, plant.id)).toBe(3);
    expect((await cash(page)).transactions.filter((t) => t.order_id === order.id)).toHaveLength(1);
  });
});

test.describe('botão touch', () => {
  test.use({ hasTouch: true });

  test('o botão "Interagir" entrega o pedido', async ({ page }) => {
    await login(page);
    await closeSuiteOrders(page);
    const plant = await createPlant(page, { price: 10, stock_quantity: 3 });
    const order = await createOrder(page, plant.id, 1);
    await openAdventure(page);
    await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
    await pickUpActiveOrder(page);
    await goToCustomer(page);

    const button = page.getByRole('button', { name: 'Interagir' });
    await expect(button).toBeVisible();
    await button.click();
    await waitDelivery(page, "d.phase === 'done'");
    expect(await orderStatus(page, order.id)).toBe('entregue');
    expect(await stock(page, plant.id)).toBe(2);
    expect((await cash(page)).transactions.filter((t) => t.order_id === order.id)).toHaveLength(1);
  });
});
