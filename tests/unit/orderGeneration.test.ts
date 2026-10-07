import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CustomerOrder } from '../../src/types';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { pickActiveOrder, toAdventureOrder } from '../../src/phaser-game/logic/activeOrder';
import { emptyDeliveryMessage, hintFromReason } from '../../src/phaser-game/logic/emptyState';
import { ROSTER, rosterById, thanksFor } from '../../src/shared/roster';
import { isModernDestination } from '../../src/shared/destinations';
import { reachableFrom } from '../helpers/reachability';

const src = (rel: string) => fs.readFileSync(path.resolve(rel), 'utf8');

describe('o gerador de pedidos saiu do frontend (o backend é a autoridade)', () => {
  const app = src('src/App.tsx');
  const api = src('src/services/api.ts');
  const storage = src('src/services/storage.ts');
  const orders = src('src/components/OrdersView.tsx');

  it('App.tsx: sem timer de pedidos, sem 15 s, sem flag de localStorage, sem escolha de planta/cliente/número', () => {
    for (const forbidden of [
      'handleReceiveNewOrder',
      'hasRealPlantTrigger',
      'novo_hiper_real_plant_registered',
      'createNewRandomOrder',
      '15000',
      'scheduleNextOrder',
      '60000 + Math.floor',
    ]) {
      expect(app, forbidden).not.toContain(forbidden);
    }
  });

  it('o frontend só PEDE a verificação (ensure) e não cria pedido nem manda preço/número', () => {
    expect(api).toContain("'/orders/ensure'");
    expect(api).not.toMatch(/createOrder\s*\(/);
    expect(api).not.toMatch(/request<[^>]*>\(\s*'\/orders'\s*,\s*\{\s*method:\s*'POST'/);
    expect(api).not.toMatch(/unit_price\s*:/); // só LÊ o valor que o backend devolve; nunca o envia
    expect(api).not.toMatch(/order_number\s*:/); // lê o número do backend; nunca o envia
    expect(storage).not.toContain('createNewRandomOrder');
    expect(storage).not.toMatch(/FICTIONAL_CUSTOMERS\[Math\.floor/); // o frontend não sorteia mais clientes
  });

  it('o botão manual "Receber Novo Pedido" não existe mais', () => {
    expect(orders).not.toContain('Receber Novo Pedido');
    expect(orders).not.toContain('btn-receive-new-order');
    expect(orders).not.toContain('onReceiveNewOrder');
    expect(app).not.toContain('onReceiveNewOrder');
  });

  it('o fluxo da Aventura não decide cliente/planta/preço: só consulta e pede ensure', () => {
    const flow = src('src/phaser-game/useDeliveryFlow.ts');
    expect(flow).toContain('api.ensureOrder()');
    for (const forbidden of ['Math.random', 'unit_price', 'order_number', 'createOrder']) expect(flow, forbidden).not.toContain(forbidden);
    const scene = src('src/phaser-game/scenes/WorldScene.ts');
    expect(scene).not.toMatch(/ensureOrder|api\./); // o Phaser nem fala com a API
  });
});

describe('mensagens: motivo do backend → o que Bernardo lê', () => {
  it('no_plants / no_stock têm mensagem própria; o resto fica "Sem entregas no momento" (sem cronômetro)', () => {
    expect(emptyDeliveryMessage(hintFromReason('no_plants'))).toBe('Cadastre uma planta na Novo Hiper para começar.');
    expect(emptyDeliveryMessage(hintFromReason('no_stock'))).toBe('As plantas estão sem estoque. Passe na Novo Hiper para conferir.');
    for (const r of ['active_order', 'cooldown', 'no_customers', 'disabled', undefined, null]) {
      expect(emptyDeliveryMessage(hintFromReason(r as any)), String(r)).toBe('Sem entregas no momento');
    }
  });
});

describe('pedido ativo: prefere o que dá para entregar', () => {
  const base = (over: Partial<CustomerOrder>): CustomerOrder => ({
    id: 'o', orderNumber: 101, customerId: 'cust_ana', customerName: 'Ana', customerAvatarUrl: '', customerRole: '', customerAddress: '',
    destinationId: 'bairro1/house_017', plantId: 'p', plantName: 'Samambaia', plantPrice: 10, plantPhotoUrl: '', quantity: 1, totalPrice: 10,
    status: 'recebido', createdAt: 1, ...over,
  });

  it('um pedido sem estoque cobrindo ("deliverable: false") não bloqueia outro que dá para entregar', () => {
    const blocked = base({ id: 'velho', createdAt: 1, deliverable: false });
    const ok = base({ id: 'novo', createdAt: 2, deliverable: true });
    expect(pickActiveOrder([blocked, ok])!.id).toBe('novo');
  });

  it('se nenhum dá para entregar, o pedido continua visível (para avisar que falta estoque), com customerId e deliverable no snapshot', () => {
    const only = base({ id: 'so', deliverable: false });
    const picked = pickActiveOrder([only])!;
    expect(picked.id).toBe('so');
    expect(toAdventureOrder(picked)).toMatchObject({ customerId: 'cust_ana', deliverable: false });
  });
});

describe('roster compartilhado: frases e distribuição espacial', () => {
  it('cada cliente tem uma frase própria, distinta e curta; desconhecidos recebem uma frase genérica', () => {
    const lines = ROSTER.map((r) => thanksFor(r.id));
    expect(new Set(lines).size).toBe(8);
    for (const l of lines) {
      expect(l.length).toBeLessThan(60);
      expect(l).not.toMatch(/samambaia|orqu[ií]dea|suculenta|ficus|costela/i); // vale para qualquer planta
    }
    expect(thanksFor('cust_dona_maria')).toBe('Obrigada, Bernardo! Vai ficar linda aqui.');
    expect(thanksFor('cust_bia')).toBe('Adorei! Vai ficar muito bonita aqui.');
    expect(thanksFor('cliente_qualquer')).toBe('Obrigado, Bernardo!');
    expect(thanksFor(undefined)).toBe('Obrigado, Bernardo!');
  });

  it('as casas do roster existem no catálogo do mapa, estão livres/alcançáveis e não se repetem', () => {
    const reach = reachableFrom(WORLD_MAP.spawn);
    const ids = new Set<string>();
    for (const r of ROSTER) {
      expect(isModernDestination(r.destinationId)).toBe(true);
      const h = HOUSE_CATALOG.find((x) => x.destinationId === r.destinationId);
      expect(h, r.name).toBeTruthy();
      expect(reach(h!.deliveryPoint), `${r.name} alcançável`).toBe(true);
      ids.add(r.destinationId);
    }
    expect(ids.size).toBe(ROSTER.length);
  });

  it('a expansão da clientela é também espacial: cada grupo fica, em média, mais longe da Novo Hiper', () => {
    const o = WORLD_MAP.shop.interact;
    const dist = (id: string) => {
      const h = HOUSE_CATALOG.find((x) => x.destinationId === rosterById(id)!.destinationId)!;
      return Math.hypot(h.deliveryPoint.x - o.x, h.deliveryPoint.y - o.y);
    };
    const avg = (g: number) => {
      const ds = ROSTER.filter((r) => r.group === g).map((r) => dist(r.id));
      return ds.reduce((a, b) => a + b, 0) / ds.length;
    };
    const max = (g: number) => Math.max(...ROSTER.filter((r) => r.group === g).map((r) => dist(r.id)));
    expect(avg(1)).toBeLessThan(avg(2));
    expect(avg(2)).toBeLessThan(avg(3));
    expect(max(1)).toBeLessThan(max(2));
    expect(max(2)).toBeLessThan(max(3));
    expect(max(1) / 6).toBeLessThan(100); // início: até ~93 m
    expect(max(3) / 6).toBeLessThan(250);
  });
});
