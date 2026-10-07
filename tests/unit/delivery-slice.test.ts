import { describe, expect, it, vi } from 'vitest';
import type { CustomerOrder } from '../../src/types';
import { AdventureBridge, AdventureOrder, INITIAL_SNAPSHOT } from '../../src/phaser-game/bridge/adventureBridge';
import { DELIVERABLE_STATUSES, pickActiveOrder, toAdventureOrder } from '../../src/phaser-game/logic/activeOrder';
import { formatBRL } from '../../src/phaser-game/logic/format';
import { isWithinRadius } from '../../src/phaser-game/logic/proximity';
import { CUSTOMER_SPOT, ENTRANCE_ZONE, WORLD } from '../../src/phaser-game/config/worldConfig';

const order = (over: Partial<CustomerOrder>): CustomerOrder => ({
  id: 'o1', orderNumber: 101, customerId: 'c', customerName: 'Ana', customerAvatarUrl: '', customerRole: '', customerAddress: '',
  destinationId: 'd', plantId: 'p', plantName: 'Samambaia', plantPrice: 10, plantPhotoUrl: '', quantity: 1, totalPrice: 10,
  status: 'recebido', createdAt: 1000, ...over,
});

describe('pedido ativo (status elegíveis EXPLÍCITOS)', () => {
  it('os status elegíveis são exatamente pronto, preparando e recebido; entregue nunca', () => {
    expect([...DELIVERABLE_STATUSES].sort()).toEqual(['preparando', 'pronto', 'recebido']);
    expect(pickActiveOrder([order({ status: 'entregue' })])).toBeNull();
  });
  it('sem pedidos → null', () => {
    expect(pickActiveOrder([])).toBeNull();
  });
  it('status desconhecido/inesperado nunca é elegível (não vale "tudo que não é entregue")', () => {
    expect(pickActiveOrder([order({ status: 'cancelado' as any }), order({ id: 'o2', status: 'qualquer' as any })])).toBeNull();
  });
  it('prioriza "pronto" (entrega já iniciada: continuar), depois preparando, depois recebido', () => {
    const list = [
      order({ id: 'a', status: 'recebido', createdAt: 1 }),
      order({ id: 'b', status: 'preparando', createdAt: 2 }),
      order({ id: 'c', status: 'pronto', createdAt: 3 }),
    ];
    expect(pickActiveOrder(list)!.id).toBe('c');
    expect(pickActiveOrder(list.filter((o) => o.id !== 'c'))!.id).toBe('b');
  });
  it('dentro do mesmo status, o mais antigo primeiro; ignora os entregues', () => {
    const list = [
      order({ id: 'novo', createdAt: 50 }),
      order({ id: 'velho', createdAt: 10 }),
      order({ id: 'feito', status: 'entregue', createdAt: 1 }),
    ];
    expect(pickActiveOrder(list)!.id).toBe('velho');
  });
  it('toAdventureOrder leva só o necessário para a tela (sem endereço do cliente)', () => {
    const a = toAdventureOrder(order({ customerAddress: 'Rua Real, 142', totalPrice: 22.5, destinationId: 'bairro1/house_007' }));
    expect(a).toEqual({ id: 'o1', orderNumber: 101, customerName: 'Ana', destinationId: 'bairro1/house_007', plantName: 'Samambaia', total: 22.5 });
    expect(JSON.stringify(a)).not.toContain('Rua Real');
  });
});

describe('proximidade', () => {
  it('limite inclusivo no raio de interação', () => {
    const c = { x: CUSTOMER_SPOT.x, y: CUSTOMER_SPOT.y };
    expect(isWithinRadius({ x: c.x, y: c.y + CUSTOMER_SPOT.interactRadius }, c, CUSTOMER_SPOT.interactRadius)).toBe(true);
    expect(isWithinRadius({ x: c.x, y: c.y + CUSTOMER_SPOT.interactRadius + 1 }, c, CUSTOMER_SPOT.interactRadius)).toBe(false);
    expect(isWithinRadius({ x: c.x + 60, y: c.y + 60 }, c, 80)).toBe(false); // diagonal 84,8
    expect(isWithinRadius({ x: c.x + 50, y: c.y + 50 }, c, 80)).toBe(true); // diagonal 70,7
  });
  it('o cliente provisório fica dentro do mapa e longe do spawn e da entrada da plataforma', () => {
    expect(CUSTOMER_SPOT.x).toBeGreaterThan(0);
    expect(CUSTOMER_SPOT.x).toBeLessThan(WORLD.width);
    expect(CUSTOMER_SPOT.y).toBeLessThan(WORLD.height);
    expect(isWithinRadius(WORLD.defaultSpawn, CUSTOMER_SPOT, CUSTOMER_SPOT.interactRadius)).toBe(false);
    expect(isWithinRadius(ENTRANCE_ZONE, CUSTOMER_SPOT, CUSTOMER_SPOT.interactRadius)).toBe(false);
  });
});

describe('formatBRL', () => {
  it('formata em reais com vírgula e espaço comum', () => {
    expect(formatBRL(10)).toBe('R$ 10,00');
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(12.5)).not.toContain(' ');
  });
});

describe('AdventureBridge', () => {
  const o: AdventureOrder = { id: 'o1', orderNumber: 101, customerName: 'Ana', destinationId: 'dest_e2e', plantName: 'X', total: 10 };

  it('setSnapshot mescla e notifica; unsubscribe para de notificar', () => {
    const b = new AdventureBridge();
    const spy = vi.fn();
    const off = b.subscribe(spy);
    b.setSnapshot({ loaded: true, activeOrder: o });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(b.getSnapshot()).toMatchObject({ ...INITIAL_SNAPSHOT, loaded: true, activeOrder: o });
    off();
    b.setSnapshot({ message: 'x' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(b.listenerCount()).toBe(0);
  });

  it('a intenção só é aceita com snapshot ocioso e para o pedido ATIVO (trava de duplo envio)', () => {
    const b = new AdventureBridge();
    const handler = vi.fn();
    b.onIntent(handler);
    expect(b.emitIntent({ type: 'deliver', orderId: 'o1' })).toBe(false); // sem pedido ativo
    b.setSnapshot({ loaded: true, activeOrder: o });
    expect(b.emitIntent({ type: 'deliver', orderId: 'outro' })).toBe(false); // pedido errado
    expect(b.emitIntent({ type: 'deliver', orderId: 'o1' })).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    for (const phase of ['delivering', 'done', 'error'] as const) {
      b.setSnapshot({ phase });
      expect(b.emitIntent({ type: 'deliver', orderId: 'o1' })).toBe(false); // bloqueado fora de 'idle'
    }
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('onIntent devolve função de limpeza (sem vazamento)', () => {
    const b = new AdventureBridge();
    const off = b.onIntent(() => {});
    expect(b.listenerCount()).toBe(1);
    off();
    expect(b.listenerCount()).toBe(0);
  });
});
