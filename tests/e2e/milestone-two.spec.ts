import fs from 'node:fs';
import { expect, test, Page } from '@playwright/test';
import { login, PASSWORD, USERNAME } from './helpers';
import { createSuiteOrder } from './suiteData';

// A configuração Playwright sobe APIs/SQLite/arquivos descartáveis. Nunca usa produção.
const PHOTO = fs.readFileSync('public/pwa-192x192.png');
const SECOND_PHOTO = fs.readFileSync('public/pwa-512x512.png');
const file = (buffer = PHOTO) => ({ name: 'foto.png', mimeType: 'image/png', buffer });
test.use({ viewport: { width: 480, height: 800 } });

test.beforeEach(async ({ page }) => {
  await page.route('https://images.unsplash.com/**', (route) => route.fulfill({ contentType: 'image/png', body: PHOTO }));
  await login(page, { filterOrders: false });
});

test.afterEach(async ({ page }) => {
  await page.request.post('/api/auth/login', { data: { username: USERNAME, password: PASSWORD } });
  const orders = await (await page.request.get('/api/orders')).json();
  for (const order of orders.filter((o: any) => o.status !== 'entregue')) {
    for (const item of order.items) {
      const plant = await (await page.request.get(`/api/plants/${item.plant_id}`)).json();
      await page.request.put(`/api/plants/${plant.id}`, { data: { name: plant.name, price: plant.price, stock_quantity: Math.max(plant.stock_quantity, item.quantity) } });
    }
    const delivery = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
    await page.request.post(`/api/deliveries/${delivery.id}/finish`);
  }
  const plants = await (await page.request.get('/api/plants')).json();
  for (const plant of plants) expect((await page.request.delete(`/api/plants/${plant.id}`)).ok()).toBe(true);
});

async function newForm(page: Page) {
  await page.locator('#btn-start-catalog').click();
  await expect(page.locator('#plant-form-container')).toBeVisible();
}
async function uploadPhoto(page: Page, buffer = PHOTO, input = '#input-gallery-photo') {
  const chooser = page.waitForEvent('filechooser');
  if (input === '#input-camera-photo') await page.locator('#btn-take-photo').click();
  else await page.locator('#btn-gallery-photo:visible, #btn-replace-photo:visible').first().click();
  await (await chooser).setFiles(file(buffer));
  await expect(page.getByRole('img', { name: 'Fotografia da planta', exact: true })).toBeVisible();
  await expect(page.locator('#btn-save-plant')).toBeEnabled();
}
async function fill(page: Page, name: string, price = '20', stock = '5') {
  await page.locator('#input-plant-name').fill(name);
  await page.locator('#input-plant-price').fill(price);
  await page.locator('#input-plant-stock').fill(stock);
}
async function save(page: Page, name: string) {
  await page.locator('#btn-save-plant').click();
  await expect(page.locator('#plant-form-container')).toHaveCount(0);
  const plants = await (await page.request.get('/api/plants')).json();
  const plant = plants.find((p: any) => p.name === name);
  expect(plant).toBeDefined();
  return plant;
}
async function create(page: Page, name: string, price = '20', stock = '5') {
  await newForm(page); await uploadPhoto(page); await fill(page, name, price, stock);
  return save(page, name);
}
async function edit(page: Page, id: string) {
  await page.locator(`#btn-view-${id}`).click();
  await page.locator('#btn-edit-detail').click();
  await expect(page.locator('#plant-form-container')).toBeVisible();
}

test('C01/C02/D01/D06/E01/E02/E03: criar, buscar, conferir, editar foto e recuperar após nova sessão', async ({ page }, info) => {
  await newForm(page); await uploadPhoto(page); await fill(page, 'Samambaia', '20,37');
  await page.locator('#input-plant-species').fill('Nephrolepis');
  await page.getByRole('button', { name: 'Meia Sombra ⛅', exact: true }).click();
  const plant = await save(page, 'Samambaia');
  expect(plant).toMatchObject({ price: 20.37, stock_quantity: 5, species: 'Nephrolepis', care_tag: 'Meia Sombra ⛅' });
  expect(Buffer.from(await (await page.request.get(plant.image_path)).body())).toEqual(PHOTO);
  const search = page.getByPlaceholder('Buscar por nome ou espécie...');
  for (const term of ['samam', 'nephro']) {
    await search.fill(term); await expect(page.locator(`#plant-card-${plant.id}`)).toBeVisible();
  }
  await search.fill('inexistente');
  await expect(page.getByText('Nenhuma planta encontrada')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await page.locator(`#btn-view-${plant.id}`).click();
  await expect(page.locator('#plant-detail-container')).toContainText('5 vasos disponíveis');
  await expect(page.locator('#plant-detail-container')).toContainText('Meia Sombra');
  await expect(page.locator('#plant-detail-container')).toContainText('20,37');
  await page.locator('#btn-edit-detail').click();
  await uploadPhoto(page, SECOND_PHOTO);
  await fill(page, 'Samambaia editada', '21,45', '2');
  const edited = await save(page, 'Samambaia editada');
  expect(edited.id).toBe(plant.id);
  expect(edited.image_path).not.toBe(plant.image_path);
  expect(Buffer.from(await (await page.request.get(edited.image_path)).body())).toEqual(SECOND_PHOTO);
  await page.reload();
  await expect(page.locator(`#plant-card-${plant.id}`)).toContainText('Estoque baixo: 2 un.');
  await page.locator('#btn-logout-mobile:visible, #btn-logout-desktop:visible').first().click();
  await expect(page.locator('#login-password')).toBeVisible();
  await login(page, { filterOrders: false });
  await expect(page.locator(`#plant-card-${plant.id}`)).toContainText('Samambaia editada');
  await expect.poll(() => page.locator(`#plant-card-${plant.id} img`).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('catalogo-confirmado.png'), fullPage: true });
});

test('C03/C04/C05/D03: validação específica, centavos e zeros; acervo seleciona a planta correta', async ({ page }) => {
  await newForm(page);
  await fill(page, ' ', '20', '5');
  await page.locator('#btn-save-plant').click();
  await expect(page.getByRole('alert')).toContainText('nome da planta');
  for (const price of ['', '-1', 'abc', '20,999']) {
    await fill(page, 'Validar', price, '5'); await page.locator('#btn-save-plant').click();
    await expect(page.getByRole('alert')).toContainText('preço');
  }
  for (const stock of ['', '-1', 'abc', '2.9', '2,9']) {
    await fill(page, 'Validar', '20', stock); await page.locator('#btn-save-plant').click();
    await expect(page.getByRole('alert')).toContainText('número inteiro');
  }
  await fill(page, 'Validar', '0', '0'); await page.locator('#btn-save-plant').click();
  await expect(page.getByRole('alert')).toContainText('foto da planta');
  await page.getByRole('button', { name: /escolher fotografia botânica/ }).click();
  await page.getByRole('button', { name: 'Costela-de-Adão Monstera deliciosa' }).click();
  await expect(page.locator('#input-plant-species')).toHaveValue('Monstera deliciosa');
  await expect(page.locator('#input-plant-stock')).toHaveValue('0');
  await expect(page.locator('#input-plant-price')).toHaveValue('0');
  await fill(page, 'Zero', '0', '0');
  const plant = await save(page, 'Zero');
  expect(plant).toMatchObject({ price: 0, stock_quantity: 0 });
  expect(plant.image_path).toContain('photo-1614594975525');
  await expect(page.locator(`#plant-card-${plant.id}`)).toContainText('Sem estoque');
});

test('C06: resposta lenta e envios repetidos não confirmam antes da API nem duplicam planta', async ({ page }) => {
  await newForm(page); await uploadPhoto(page); await fill(page, 'Uma só');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route('**/api/plants', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    calls++; await gate; await route.continue();
  });
  await page.locator('#btn-save-plant').click();
  await expect(page.locator('#btn-save-plant')).toBeDisabled();
  await expect(page.locator('#btn-save-plant')).toHaveText('Salvando…');
  await page.locator('#plant-form-container form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(calls).toBe(1);
  expect((await (await page.request.get('/api/plants')).json()).length).toBe(0);
  release();
  await expect(page.locator('#plant-form-container')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Uma só', { exact: true })).toHaveCount(1);
});

test('C06: resposta perdida após salvar permite repetir o mesmo cadastro sem duplicar', async ({ page }) => {
  await newForm(page); await uploadPhoto(page); await fill(page, 'Resposta perdida');
  await page.route('**/api/plants', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fetch(); await route.abort('failed');
  });
  await page.locator('#btn-save-plant').click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar');
  await expect(page.locator('#input-plant-name')).toHaveValue('Resposta perdida');
  await page.unroute('**/api/plants');
  await save(page, 'Resposta perdida');
  const plants = await (await page.request.get('/api/plants')).json();
  expect(plants.filter((p: any) => p.name === 'Resposta perdida')).toHaveLength(1);
});

test('C07: cancelar e fechar não cadastram planta incompleta', async ({ page }) => {
  await newForm(page); await fill(page, 'Cancelar'); await page.locator('#btn-cancel-form').click();
  await newForm(page); await fill(page, 'Fechar'); await page.locator('#btn-close-form').click();
  expect(await (await page.request.get('/api/plants')).json()).toEqual([]);
});

test('D04/D05: formato inválido, arquivo falso, tamanho excessivo e upload recusado permitem recuperação', async ({ page }) => {
  await newForm(page);
  for (const [photo, message] of [
    [{ name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('texto') }, 'JPG, PNG ou WEBP'],
    [{ name: 'falsa.png', mimeType: 'image/png', buffer: Buffer.from('texto') }, 'foto válida'],
    [{ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }, 'até 5 MB'],
  ] as const) {
    await page.locator('#input-gallery-photo').setInputFiles(photo);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('img', { name: 'Fotografia da planta', exact: true })).toHaveCount(0);
  }
  await page.route('**/api/upload', (route) => route.fulfill({ status: 503, json: { error: 'Não foi possível enviar a foto agora.' } }));
  await page.locator('#input-gallery-photo').setInputFiles(file());
  await expect(page.getByRole('alert')).toContainText('Não foi possível enviar');
  await expect(page.getByRole('img', { name: 'Fotografia da planta', exact: true })).toHaveCount(0);
  await page.unroute('**/api/upload');
  await uploadPhoto(page); await fill(page, 'Foto recuperada');
  const plant = await save(page, 'Foto recuperada');
  expect(plant.image_path).toMatch(/^\/uploads\/plants\//);
});

test('D02: câmera em celular emulado, cancelamento e alternativa pela galeria', async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: info.project.use.baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await login(page, { filterOrders: false }); await newForm(page);
    await expect(page.locator('#input-camera-photo')).toHaveAttribute('capture', 'environment');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#btn-take-photo').click();
    await chooser;
    await page.locator('#input-camera-photo').dispatchEvent('cancel');
    await expect(page.locator('#btn-save-plant')).toBeEnabled();
    await expect(page.getByText(/Se a câmera não abrir/)).toBeVisible();
    await uploadPhoto(page, PHOTO, '#input-camera-photo'); await fill(page, 'Câmera emulada');
    await save(page, 'Câmera emulada');
  } finally { await context.close(); }
});

test('E03: falha de edição mantém valores confirmados e permite nova tentativa', async ({ page }) => {
  const plant = await create(page, 'Original'); await edit(page, plant.id);
  await fill(page, 'Nova', '22,17', '1');
  await page.route(`**/api/plants/${plant.id}`, (route) => route.request().method() === 'PUT'
    ? route.fulfill({ status: 503, json: { error: 'Não foi possível salvar agora.' } }) : route.continue());
  await page.locator('#btn-save-plant').click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar');
  expect((await (await page.request.get(`/api/plants/${plant.id}`)).json()).name).toBe('Original');
  await expect(page.locator('#input-plant-name')).toHaveValue('Nova');
  await page.unroute(`**/api/plants/${plant.id}`);
  await save(page, 'Nova'); await page.reload();
  await expect(page.locator(`#plant-card-${plant.id}`)).toContainText('Nova');
});

test('E04/E05/E07: estoque zero bloqueia pedido, reposição libera; exclusão recusada preserva planta', async ({ page }) => {
  const plant = await create(page, 'Pedido aberto');
  const order = await createSuiteOrder(page, { plantId: plant.id });
  await page.reload(); await page.locator(`#btn-view-${plant.id}`).click();
  await page.locator('#btn-delete-detail').click(); await page.locator('#btn-confirm-delete').click();
  await expect(page.locator('#delete-confirm-dialog [role=alert]')).toContainText('pedidos em andamento');
  await expect(page.locator(`#plant-card-${plant.id}`)).toBeVisible();
  await page.locator('#btn-cancel-delete').click(); await page.locator('#btn-edit-detail').click();
  await expect(page.locator('#plant-form-container')).toContainText('pedido em andamento');
  await fill(page, plant.name, '30', '0'); await save(page, plant.name);
  const blocked = (await (await page.request.get('/api/orders')).json()).find((o: any) => o.id === order.id);
  expect(blocked.deliverable).toBe(false);
  expect(blocked.total).toBe(20);
  await page.locator(`#btn-view-${plant.id}`).click();
  await expect(page.locator('#plant-detail-container')).toContainText('Editar');
  await expect(page.locator('#plant-detail-container')).toContainText('repor');
  await page.locator('#btn-edit-detail').click(); await fill(page, plant.name, '30', '5'); await save(page, plant.name);
  expect((await (await page.request.get('/api/orders')).json()).find((o: any) => o.id === order.id).deliverable).toBe(true);
});

test('E06/E08: cancelar exclusão mantém planta; confirmar preserva venda e última planta não retorna', async ({ page }) => {
  const plant = await create(page, 'Histórica');
  const order = await createSuiteOrder(page, { plantId: plant.id });
  const delivery = await (await page.request.post('/api/deliveries/start', { data: { order_id: order.id } })).json();
  expect((await page.request.post(`/api/deliveries/${delivery.id}/finish`)).ok()).toBe(true);
  const cash = await (await page.request.get('/api/cash')).json();
  await page.reload(); await page.locator(`#btn-view-${plant.id}`).click();
  await page.locator('#btn-delete-detail').click(); await page.locator('#btn-cancel-delete').click();
  await expect(page.locator(`#plant-card-${plant.id}`)).toBeVisible();
  await page.locator('#btn-delete-detail').click(); await page.locator('#btn-confirm-delete').click();
  await expect(page.locator('#delete-confirm-dialog')).toHaveCount(0);
  await expect(page.locator('#btn-empty-add-plant')).toBeVisible();
  expect(await (await page.request.get('/api/cash')).json()).toEqual(cash);
  expect((await (await page.request.get(`/api/orders/${order.id}`)).json()).status).toBe('entregue');
  await page.reload(); await expect(page.locator('#btn-empty-add-plant')).toBeVisible();
  await expect(page.getByText('Histórica', { exact: true })).toHaveCount(0);
});

test('D06: foto indisponível mostra alternativa sem quebrar catálogo ou detalhes', async ({ page }) => {
  const plant = await create(page, 'Foto ausente');
  await page.route(`**${plant.image_path}`, (route) => route.fulfill({ status: 404, body: '' }));
  await page.reload();
  await expect(page.locator(`#plant-card-${plant.id}`)).toContainText('Foto indisponível');
  await page.locator(`#btn-view-${plant.id}`).click();
  await expect(page.locator('#plant-detail-container')).toContainText('Foto indisponível');
  await expect(page.locator('#btn-edit-detail')).toBeEnabled();
});

test('D05/C07: foto antiga chegando depois de fechar não substitui a escolha do novo formulário', async ({ page }) => {
  await newForm(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let uploaded = false;
  await page.route('**/api/upload', async (route) => {
    const response = await route.fetch(); uploaded = true;
    await gate; await route.fulfill({ response });
  });
  await page.locator('#input-gallery-photo').setInputFiles(file());
  await expect.poll(() => uploaded).toBe(true);
  await expect(page.locator('#btn-save-plant')).toBeDisabled();
  await page.locator('#btn-close-form').click();
  await newForm(page);
  await page.getByRole('button', { name: /escolher fotografia botânica/ }).click();
  await page.getByRole('button', { name: 'Costela-de-Adão Monstera deliciosa' }).click();
  const response = page.waitForResponse('**/api/upload'); release(); await (await response).finished();
  await fill(page, 'Nova escolha');
  const plant = await save(page, 'Nova escolha');
  expect(plant.image_path).toContain('photo-1614594975525');
});

test('C06/E06: cadastro e exclusão com falha não alteram catálogo; saída lenta não duplica remoção', async ({ page }) => {
  await newForm(page); await uploadPhoto(page); await fill(page, 'Operação confirmada');
  await page.route('**/api/plants', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, json: { error: 'Cadastro indisponível agora.' } }) : route.continue());
  await page.locator('#btn-save-plant').click();
  await expect(page.getByRole('alert')).toContainText('Cadastro indisponível');
  expect(await (await page.request.get('/api/plants')).json()).toEqual([]);
  await page.unroute('**/api/plants');
  const plant = await save(page, 'Operação confirmada');
  await page.locator(`#btn-view-${plant.id}`).click(); await page.locator('#btn-delete-detail').click();
  await page.route(`**/api/plants/${plant.id}`, (route) => route.request().method() === 'DELETE'
    ? route.fulfill({ status: 503, json: { error: 'Remoção indisponível agora.' } }) : route.continue());
  await page.locator('#btn-confirm-delete').click();
  await expect(page.locator('#delete-confirm-dialog [role=alert]')).toContainText('Remoção indisponível');
  await expect(page.locator(`#plant-card-${plant.id}`)).toBeVisible();
  expect((await page.request.get(`/api/plants/${plant.id}`)).ok()).toBe(true);
  await page.unroute(`**/api/plants/${plant.id}`);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route(`**/api/plants/${plant.id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    calls++; await gate; await route.continue();
  });
  await page.locator('#btn-confirm-delete').click();
  await expect(page.locator('#btn-confirm-delete')).toBeDisabled();
  await page.locator('#btn-confirm-delete').evaluate((button: HTMLButtonElement) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(calls).toBe(1);
  release();
  await expect(page.locator('#delete-confirm-dialog')).toHaveCount(0);
  await expect(page.locator('#btn-empty-add-plant')).toBeVisible();
});
