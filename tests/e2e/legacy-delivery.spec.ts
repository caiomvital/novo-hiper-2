import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('mapa legado: sem pedido ativo a "entrega avulsa" não pode creditar dinheiro nem baixar estoque', async ({ page }) => {
  await login(page);
  // cria uma planta real (backend de DEV) para o comprovante do mapa aparecer
  const id = `plant_e2e_${Date.now()}`;
  const created = await page.request.post('/api/plants', {
    data: { id, name: 'Planta E2E', price: 10, stock_quantity: 3, image_path: '/uploads/plants/e2e.jpg' },
  });
  expect(created.status()).toBe(201);
  try {
    await page.reload();
    await page.locator('#tab-btn-deliveries').click();

    const button = page.locator('#btn-confirm-delivery');
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button).toContainText('Escolha um pedido para entregar');

    // mesmo forçando o clique, nada é creditado nem baixado no servidor
    const before = await (await page.request.get('/api/cash/summary')).json();
    await button.click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1500);
    expect(await (await page.request.get('/api/cash/summary')).json()).toEqual(before);
    const plant = await (await page.request.get(`/api/plants/${id}`)).json();
    expect(plant.stock_quantity).toBe(3);
  } finally {
    await page.request.delete(`/api/plants/${id}`); // soft-delete (limpeza)
  }
});
