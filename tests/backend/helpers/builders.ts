import type { TestServer } from './testServer';

let seq = 0;
const uid = (p: string) => `${p}_t${++seq}`;

export async function createPlant(s: TestServer, over: Record<string, unknown> = {}) {
  const res = await s.post('/api/plants', {
    id: uid('plant'),
    name: 'Planta de teste',
    price: 10,
    stock_quantity: 5,
    image_path: '/uploads/plants/teste.jpg',
    species: 'Teste',
    care_tag: 'Sol',
    ...over,
  });
  if (res.status !== 201) throw new Error(`createPlant falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function createOrder(
  s: TestServer,
  items: Array<{ plant_id: string; quantity?: number; unit_price?: number }>,
  over: Record<string, unknown> = {}
) {
  const res = await s.post('/api/orders', {
    id: uid('ord'),
    customer_name: 'Cliente Fictício',
    destination_id: 'dest_teste',
    items: items.map((i) => ({ quantity: 1, ...i })),
    ...over,
  });
  if (res.status !== 201) throw new Error(`createOrder falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function startDelivery(s: TestServer, orderId: string) {
  const res = await s.post('/api/deliveries/start', { order_id: orderId });
  if (res.status !== 201 && res.status !== 200) throw new Error(`startDelivery falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export const stockOf = async (s: TestServer, plantId: string) =>
  (await s.db.get('SELECT stock_quantity FROM plants WHERE id = ?', plantId))?.stock_quantity as number;

export const cashRows = (s: TestServer) => s.db.all('SELECT * FROM cash_transactions ORDER BY created_at');
