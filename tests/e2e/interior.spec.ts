import { expect, Page, test } from '@playwright/test';
import { COUNTER, INTERIOR_ROOM, PREP_BENCH, SHELVES, STOCK } from '../../src/phaser-game/config/interiorMap';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import {
  enterStore,
  leaveAdventure,
  leaveStore,
  login,
  openAdventure,
  state,
  teleport,
} from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';

// Interior explorável da Novo Hiper: entrada/saída pela porta, prateleiras/estoque/balcão abrindo as telas React
// já existentes, e o ciclo de retirada da planta (persistente no backend via status do pedido). Roda no backend
// ISOLADO do grupo "general" (o mesmo de adventure.spec.ts/sprites.spec.ts): nunca toca no data-dev manual.
test.describe.configure({ mode: 'serial' });

const delivery = async (page: Page) => (await state(page)).delivery!;
const waitDelivery = (page: Page, pred: string, timeout = 30_000) =>
  page.waitForFunction(`(() => { const d = window.__NH_ADVENTURE__?.getState().delivery; return Boolean(d && (${pred})); })()`, null, { timeout });

test.beforeEach(async ({ page }) => {
  await login(page);
});
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

test('entrar pela porta e sair: posição segura, sem instância de cena duplicada', async ({ page }) => {
  await openAdventure(page);
  const beforeInstance = (await state(page)).instance;

  await enterStore(page);
  const inside = await state(page);
  expect(inside.player!.x).toBeGreaterThan(0);
  expect(inside.player!.x).toBeLessThan(INTERIOR_ROOM.width);
  expect(inside.player!.y).toBeGreaterThan(0);
  expect(inside.player!.y).toBeLessThan(INTERIOR_ROOM.height);

  // a porta só rearma depois que Bernardo se afasta dela (mesmo padrão da entrada da plataforma no bairro);
  // anda pra dentro da sala antes de tentar sair, como um jogador real faria
  await teleport(page, COUNTER.interact.x, COUNTER.interact.y);
  await page.waitForTimeout(200);

  await leaveStore(page);
  const back = await state(page);
  expect(back.scene).toBe('world');
  expect(back.instance).toBe((beforeInstance ?? 0) + 1); // WorldScene foi recriada exatamente uma vez (scene.start)

  // entra e sai de novo: continua jogável, sem travar (a porta do bairro também só rearma ao se afastar)
  await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y);
  await page.waitForTimeout(200);
  await enterStore(page);
  await teleport(page, COUNTER.interact.x, COUNTER.interact.y);
  await page.waitForTimeout(200);
  await leaveStore(page);
  await page.waitForTimeout(300);
  expect((await state(page)).scene).toBe('world');
  expect((await state(page)).transitioning).toBe(false);
});

test('bancada sem pedido ativo: mensagem própria, interagir não faz nada', async ({ page }) => {
  await openAdventure(page);
  await enterStore(page);
  await teleport(page, PREP_BENCH.interact.x, PREP_BENCH.interact.y);
  await waitDelivery(page, "d.interior.nearPrep && !d.interior.canPickup && d.hud.includes('Nenhum pedido')");
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  expect((await delivery(page)).interior!.carrying).toBe(false);
});

test('bancada com pedido sem estoque: orienta reposição, não deixa pegar', async ({ page }) => {
  const plant = await (
    await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Sem Estoque Interior', price: 20, stock_quantity: 0, image_path: '/a.jpg' } })
  ).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Cliente Sem Estoque' });

  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
  await enterStore(page);
  await teleport(page, PREP_BENCH.interact.x, PREP_BENCH.interact.y);
  await waitDelivery(page, "d.interior.nearPrep && d.hud.toLowerCase().includes('estoque')");
  expect((await delivery(page)).interior!.canPickup).toBe(false);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  expect((await delivery(page)).interior!.carrying).toBe(false);
});

test('pegar a planta: fica carregando, não duplica ao apertar de novo, e persiste depois de sair/voltar', async ({ page }) => {
  const plant = await (
    await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Costela de Adão', price: 35, stock_quantity: 5, image_path: '/a.jpg' } })
  ).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Cliente Interior' });

  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
  await enterStore(page);
  await teleport(page, PREP_BENCH.interact.x, PREP_BENCH.interact.y);
  await waitDelivery(page, 'd.interior.canPickup');

  await page.keyboard.press('KeyE');
  await waitDelivery(page, 'd.interior.carrying');
  expect((await delivery(page)).activeOrderId).toBe(order.id);

  // apertar de novo já carregando: não quebra, não muda nada (idempotente)
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  expect((await delivery(page)).interior!.carrying).toBe(true);
  expect((await delivery(page)).activeOrderId).toBe(order.id);

  const backendOrder = await (await page.request.get(`/api/orders`)).json();
  expect(backendOrder.find((o: any) => o.id === order.id).status).toBe('pronto');

  // sai da loja e volta: continua carregando (o status vem do backend, não de estado efêmero da cena)
  await leaveStore(page);
  await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y); // se afasta da porta para rearmá-la
  await page.waitForTimeout(200);
  await enterStore(page);
  await waitDelivery(page, 'd.interior.carrying');

  // sai da Aventura inteira e volta: continua carregando
  await leaveAdventure(page);
  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
  await enterStore(page);
  await waitDelivery(page, 'd.interior.carrying');
});

test('balcão sem melhoria pendente leva para a tela de pedidos; prateleira e estoque levam ao catálogo', async ({ page }) => {
  await openAdventure(page);
  await enterStore(page);

  await teleport(page, COUNTER.interact.x, COUNTER.interact.y);
  await waitDelivery(page, "d.interior.nearCounter && d.hud.toLowerCase().includes('pedidos')");
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !window.__NH_ADVENTURE__);
  await expect(page.locator('#tab-btn-orders')).toHaveClass(/bg-white/);

  await page.locator('#tab-btn-adventure').click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await enterStore(page);
  await teleport(page, SHELVES[0].interact.x, SHELVES[0].interact.y);
  await waitDelivery(page, 'd.interior.nearShelf');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !window.__NH_ADVENTURE__);
  await expect(page.locator('#tab-btn-catalog')).toHaveClass(/bg-white/);

  await page.locator('#tab-btn-adventure').click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await enterStore(page);
  await teleport(page, STOCK.interact.x, STOCK.interact.y);
  await waitDelivery(page, 'd.interior.nearStock');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !window.__NH_ADVENTURE__);
  await expect(page.locator('#tab-btn-catalog')).toHaveClass(/bg-white/);
});
