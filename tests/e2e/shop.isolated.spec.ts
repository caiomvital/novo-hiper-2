import { expect, Page, test } from '@playwright/test';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { BANCO, JARDINEIRAS, PLACA_MADEIRA } from '../../src/shared/shop';
import { cashBalance, earn, purchaseDebits, shopState } from './isolatedData';
import { leaveAdventure, login, openAdventure, state, teleport } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';

// Roda no backend ISOLADO (banco temporário descartável): o estado é CUMULATIVO entre os passos, como numa partida
// (sem saldo → entrega → compra → instalação → persistência), e nunca toca o data-dev do teste manual.
test.describe.configure({ mode: 'serial' });

const { utilities, shop } = WORLD_MAP;
const delivery = async (page: Page) => (await state(page)).delivery!;
const waitDelivery = (page: Page, pred: string, timeout = 30_000) =>
  page.waitForFunction(`(() => { const d = window.__NH_ADVENTURE__?.getState().delivery; return Boolean(d && (${pred})); })()`, null, { timeout });
const hudCash = async (page: Page) => (await delivery(page)).shop.cashText;
const BRL = (v: string) => new RegExp(`^Caixa:\\s*R\\$\\s*${v}$`);

test.beforeEach(async ({ page }) => {
  await login(page);
});
test.afterEach(({ page }) => closeSuiteOrders(page).catch(() => undefined));

test('0a. sem nenhuma planta cadastrada: a Aventura diz o que fazer, sem alarme', async ({ page }) => {
  await openAdventure(page);
  await waitDelivery(page, 'd.loaded');
  await waitDelivery(page, "d.hud === 'Cadastre uma planta na Novo Hiper para começar.'");
  expect((await delivery(page)).activeOrderId).toBeNull();
});

test('0b. plantas cadastradas, mas todas sem estoque: mensagem própria', async ({ page }) => {
  const r = await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Sem estoque', price: 10, stock_quantity: 0, image_path: '/a.jpg' } });
  expect(r.status()).toBe(201);
  await openAdventure(page);
  await waitDelivery(page, "d.hud === 'As plantas estão sem estoque. Passe na Novo Hiper para conferir.'");
});

test('1. sem saldo suficiente: a compra não conclui, mostra mensagem simples e nada é debitado nem adquirido', async ({ page }) => {
  await earn(page, 30);
  expect(await cashBalance(page)).toBe(30);

  await openAdventure(page);
  await waitDelivery(page, 'd.shop.cashBalance !== null');
  expect(await hudCash(page)).toMatch(BRL('30,00'));
  // há plantas com estoque e nenhum pedido aberto: mensagem comum
  await waitDelivery(page, "d.hud === 'Sem entregas no momento'");

  await teleport(page, utilities.interact.x, utilities.interact.y);
  await waitDelivery(page, 'd.shop.nearUtilities && d.promptVisible');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-balance')).toHaveText(/R\$\s*30,00/);
  await expect(page.locator('#shop-item-' + PLACA_MADEIRA)).toContainText('60,00');
  await expect(page.locator('#shop-item-' + PLACA_MADEIRA)).toContainText(/Faltam R\$\s*30,00/);

  await page.locator('#btn-shop-buy-' + PLACA_MADEIRA).click();
  await expect(page.locator('#shop-message')).toContainText(/saldo insuficiente/i);
  await expect(page.locator('#shop-balance')).toHaveText(/R\$\s*30,00/);
  expect(await cashBalance(page)).toBe(30);
  expect(await purchaseDebits(page)).toHaveLength(0);
  expect((await shopState(page)).upgrades[0].state).toBe('available');

  // ESC fecha o painel e o mundo volta a responder
  await page.keyboard.press('Escape');
  await expect(page.locator('#shop-panel')).toHaveCount(0);
  await waitDelivery(page, '!d.shop.uiOpen');
});

test('2. entrega real: o HUD "Caixa" acompanha o saldo do backend depois de entregar', async ({ page }) => {
  const plant = await (
    await page.request.post('/api/plants', { data: { id: suiteId('plant'), name: 'Samambaia Loja', price: 45, stock_quantity: 5, image_path: '/a.jpg' } })
  ).json();
  const order = await createSuiteOrder(page, { plantId: plant.id, customerName: 'Dona Maria Loja' });

  await openAdventure(page);
  await waitDelivery(page, `d.activeOrderId === ${JSON.stringify(order.id)}`);
  expect(await hudCash(page)).toMatch(BRL('30,00'));

  await teleport(page, CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 20);
  await waitDelivery(page, 'd.near');
  await page.keyboard.press('KeyE');
  await waitDelivery(page, "d.phase === 'done'");
  await waitDelivery(page, "d.shop.cashBalance === 75");
  expect(await hudCash(page)).toMatch(BRL('75,00'));
  expect(await cashBalance(page)).toBe(75);
});

test('3. compra com duplo clique: exatamente UM débito de R$ 60, melhoria "aguardando instalação", saldo atualizado', async ({ page }) => {
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.cashBalance === 75');
  await teleport(page, utilities.interact.x, utilities.interact.y);
  await waitDelivery(page, 'd.shop.nearUtilities');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await waitDelivery(page, 'd.shop.uiOpen');

  // o mundo fica parado com o painel aberto (e a tecla de andar não move Bernardo)
  const before = (await state(page)).player!;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const after = (await state(page)).player!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(2);

  const buy = page.locator('#btn-shop-buy-' + PLACA_MADEIRA);
  await buy.dblclick();
  await expect(page.locator('#shop-message')).toContainText(/comprada/i);
  await expect(page.locator('#shop-balance')).toHaveText(/R\$\s*15,00/);
  await expect(page.locator('#shop-state-' + PLACA_MADEIRA)).toContainText(/leve para a Novo Hiper/i);
  await expect(buy).toHaveCount(0); // não dá para comprar de novo

  expect(await cashBalance(page)).toBe(15);
  const debits = await purchaseDebits(page);
  expect(debits).toHaveLength(1);
  expect(debits[0].amount).toBe(60);
  expect((await shopState(page)).upgrades[0].state).toBe('pending');
  await waitDelivery(page, "d.shop.pendingUpgrades.length === 1 && d.shop.cashBalance === 15");
  expect(await hudCash(page)).toMatch(BRL('15,00'));
  expect((await delivery(page)).shop.installedUpgrades).toEqual([]);
  expect((await delivery(page)).shop.placaVisible).toBe(false); // ainda NÃO está na fachada

  await page.keyboard.press('Escape');
  await expect(page.locator('#shop-panel')).toHaveCount(0);
});

test('4. voltar à Novo Hiper, instalar a placa (fachada muda), sair/entrar e continuar instalada', async ({ page }) => {
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.pendingUpgrades.length === 1');
  expect((await delivery(page)).shop.placaVisible).toBe(false);

  // longe da porta da Novo Hiper não há interação; perto dela aparece a de instalação
  await teleport(page, WORLD_MAP.spawn.x, WORLD_MAP.spawn.y);
  await page.waitForTimeout(500);
  expect((await delivery(page)).shop.nearShop).toBe(false);
  await teleport(page, shop.interact.x, shop.interact.y);
  await waitDelivery(page, 'd.shop.nearShop && d.promptVisible');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-title')).toContainText(/minha loja/i);

  await page.locator('#btn-shop-install-' + PLACA_MADEIRA).click();
  await expect(page.locator('#shop-panel')).toHaveCount(0);
  await waitDelivery(page, "d.shop.placaVisible && d.shop.installedUpgrades.includes('placa_madeira') && !d.shop.uiOpen");
  expect((await shopState(page)).upgrades[0].state).toBe('installed');
  expect(await cashBalance(page)).toBe(15); // instalar não cobra nada

  // não há mais nada para instalar: a interação some
  await page.waitForTimeout(500);
  expect((await delivery(page)).shop.nearShop).toBe(false);

  // sair da Aventura e voltar: a placa continua lá (estado vem do backend)
  await leaveAdventure(page);
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.cashBalance !== null');
  await waitDelivery(page, 'd.shop.placaVisible');
  expect((await delivery(page)).shop.installedUpgrades).toEqual([PLACA_MADEIRA]);
  expect(await hudCash(page)).toMatch(BRL('15,00'));

  // e recarregar a página inteira também mantém
  await page.reload();
  await page.locator('#tab-btn-adventure').click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await waitDelivery(page, 'd.shop.placaVisible');
});

test('5. a placa já comprada/instalada não pode ser comprada de novo (painel mostra "Instalada")', async ({ page }) => {
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.placaVisible');
  await teleport(page, utilities.interact.x, utilities.interact.y);
  await waitDelivery(page, 'd.shop.nearUtilities');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();
  await expect(page.locator('#shop-state-' + PLACA_MADEIRA)).toContainText(/instalada/i);
  await expect(page.locator('#btn-shop-buy-' + PLACA_MADEIRA)).toHaveCount(0);

  // mesmo por fora da tela, o backend não cobra de novo
  const again = await page.request.post(`/api/shop/upgrades/${PLACA_MADEIRA}/purchase`, { data: {} });
  expect((await again.json()).alreadyApplied).toBe(true);
  expect(await cashBalance(page)).toBe(15);
  expect(await purchaseDebits(page)).toHaveLength(1);
});

const progress = async (page: Page) => (await page.request.get('/api/progress')).json();

test('6. três melhorias na loja; banco sem saldo não debita nada; jardineiras compradas ficam aguardando instalação', async ({ page }) => {
  await earn(page, 100); // 15 + 100
  expect(await cashBalance(page)).toBe(115);
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.cashBalance === 115');
  await teleport(page, utilities.interact.x, utilities.interact.y);
  await waitDelivery(page, 'd.shop.nearUtilities');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#shop-panel')).toBeVisible();

  // placa instalada; jardineiras R$ 90 e banco R$ 120 à venda
  await expect(page.locator('#shop-state-' + PLACA_MADEIRA)).toContainText(/instalada/i);
  await expect(page.locator('#shop-item-' + JARDINEIRAS)).toContainText('90,00');
  await expect(page.locator('#shop-item-' + BANCO)).toContainText('120,00');
  await expect(page.locator('#shop-item-' + BANCO)).toContainText(/Faltam R\$\s*5,00/);
  await expect(page.locator('#shop-item-' + JARDINEIRAS)).not.toContainText(/Faltam/);

  // banco: 115 < 120 → o backend recusa; nada muda
  await page.locator('#btn-shop-buy-' + BANCO).click();
  await expect(page.locator('#shop-message')).toContainText(/saldo insuficiente/i);
  await expect(page.locator('#shop-balance')).toHaveText(/R\$\s*115,00/);
  expect(await cashBalance(page)).toBe(115);
  expect(await purchaseDebits(page)).toHaveLength(1); // só a placa
  expect((await shopState(page)).upgrades.find((u) => u.id === BANCO)!.state).toBe('available');

  // jardineiras: compra (um débito de R$ 90) e fica "aguardando instalação"; ainda NÃO aparece na fachada
  await page.locator('#btn-shop-buy-' + JARDINEIRAS).dblclick();
  await expect(page.locator('#shop-balance')).toHaveText(/R\$\s*25,00/);
  await expect(page.locator('#shop-state-' + JARDINEIRAS)).toContainText(/leve para a Novo Hiper/i);
  expect(await cashBalance(page)).toBe(25);
  expect((await purchaseDebits(page)).filter((t) => t.amount === 90)).toHaveLength(1);
  await waitDelivery(page, "d.shop.pendingUpgrades.includes('jardineiras') && d.shop.cashBalance === 25");
  expect((await delivery(page)).shop.visuals).not.toContain(JARDINEIRAS);
  await page.keyboard.press('Escape');
});

test('7. compra do banco; volta à Novo Hiper e instala as duas; jardineiras e banco aparecem e persistem (reentrada e reload)', async ({ page }) => {
  await earn(page, 100); // 25 + 100
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.cashBalance === 125');
  await teleport(page, utilities.interact.x, utilities.interact.y);
  await waitDelivery(page, 'd.shop.nearUtilities');
  await page.keyboard.press('KeyE');
  await page.locator('#btn-shop-buy-' + BANCO).click();
  await expect(page.locator('#shop-balance')).toHaveText(/R\$\s*5,00/);
  expect(await cashBalance(page)).toBe(5);
  await page.keyboard.press('Escape');
  await waitDelivery(page, 'd.shop.pendingUpgrades.length === 2');
  expect((await delivery(page)).shop.visuals).toEqual([PLACA_MADEIRA]); // nada novo na fachada ainda

  // na Novo Hiper: as duas pendentes aparecem; instalar uma mantém o painel aberto até acabar
  await teleport(page, shop.interact.x, shop.interact.y);
  await waitDelivery(page, 'd.shop.nearShop && d.promptVisible');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#btn-shop-install-' + JARDINEIRAS)).toBeVisible();
  await expect(page.locator('#btn-shop-install-' + BANCO)).toBeVisible();

  await page.locator('#btn-shop-install-' + JARDINEIRAS).click();
  await expect(page.locator('#shop-message')).toContainText(/ainda há melhorias/i);
  await expect(page.locator('#shop-panel')).toBeVisible();
  await waitDelivery(page, "d.shop.visuals.includes('jardineiras') && !d.shop.visuals.includes('banco')");

  await page.locator('#btn-shop-install-' + BANCO).click();
  await expect(page.locator('#shop-panel')).toHaveCount(0);
  await waitDelivery(page, "d.shop.visuals.includes('jardineiras') && d.shop.visuals.includes('banco') && !d.shop.uiOpen");
  expect(new Set((await delivery(page)).shop.visuals)).toEqual(new Set([PLACA_MADEIRA, JARDINEIRAS, BANCO]));
  expect(await cashBalance(page)).toBe(5); // instalar não cobra

  // reentrada: as três já aparecem direto
  await leaveAdventure(page);
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.visuals.length === 3');
  // reload da página inteira
  await page.reload();
  await page.locator('#tab-btn-adventure').click();
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().scene === 'world');
  await waitDelivery(page, 'd.shop.visuals.length === 3');
  expect(new Set((await delivery(page)).shop.installedUpgrades)).toEqual(new Set([PLACA_MADEIRA, JARDINEIRAS, BANCO]));
});

test('8. progressão: marcos gravados pelos eventos, bairro_vivo ainda não, e a Aventura não mostra checklist', async ({ page }) => {
  const p = await progress(page);
  expect(p.stats).toMatchObject({ upgradesPurchased: 3, upgradesInstalled: 3, plantsRegisteredHistorical: expect.any(Number) });
  for (const id of ['primeira_planta', 'primeira_entrega', 'primeira_melhoria', 'melhorias_3']) {
    expect(p.milestones[id].achieved, id).toBe(true);
    expect(p.milestones[id].achievedAt).toBeGreaterThan(0);
  }
  expect(p.milestones.entregas_10.achieved).toBe(false); // poucas entregas neste banco
  expect(p.milestones.bairro_vivo.achieved).toBe(false);

  // nada de contador/objetivo no HUD: só o saldo e as mensagens de sempre
  await openAdventure(page);
  await waitDelivery(page, 'd.shop.cashBalance !== null');
  const hud = (await delivery(page)).hud;
  expect(hud).not.toMatch(/\d+\s*\/\s*\d+/);
  expect(hud).not.toMatch(/miss|n[ií]vel|xp|marco/i);
});
