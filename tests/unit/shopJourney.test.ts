import { describe, expect, it } from 'vitest';
import { shopJourney, type JourneyOrder } from '../../src/logic/shopJourney';
import type { Plant } from '../../src/types';
const plant: Plant = { id: 'p', name: 'Manjericão do Bernardo', price: 27.5, stock: 3, photoUrl: '/uploads/plants/p.png', createdAt: 1 };
const order: JourneyOrder = { plantName: plant.name, customerName: 'Ana', status: 'recebido', deliverable: true };
const journey = (plants: Plant[], active: JourneyOrder | null = null, delivered = false, returning = false) => shopJourney({ plants, order: active, delivered, returning });
describe('jornada da loja derivada dos dados oficiais', () => {
  it('começa pelo cadastro e distingue loja pronta de estoque vazio', () => {
    expect(journey([]).step).toBe('register');
    expect(journey([plant]).step).toBe('waiting');
    expect(journey([{ ...plant, stock: 0 }]).step).toBe('stock');
  });
  it('usa a planta e o cliente do pedido e retoma uma retirada após recarregar', () => {
    expect(journey([plant], order)).toMatchObject({ step: 'prepare', index: 2 });
    expect(journey([plant], order).title).toContain(plant.name);
    expect(journey([plant], { ...order, status: 'pronto' })).toMatchObject({ step: 'deliver', index: 3 });
  });
  it('preserva pedido aberto mesmo com catálogo vazio e prioriza falta de estoque', () => {
    expect(journey([], { ...order, deliverable: false }).step).toBe('stock');
    expect(journey([], { ...order, status: 'pronto' }).step).toBe('deliver');
  });
  it('conclusão orienta retorno e crescimento, sem criar outra recompensa', () => {
    expect(journey([plant], order, true, true).step).toBe('grow');
    expect(journey([plant], null, true).step).toBe('grow');
    expect(journey([plant], order, true).step).toBe('prepare');
  });
});
