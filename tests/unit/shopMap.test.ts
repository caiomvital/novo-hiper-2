import { describe, expect, it, vi } from 'vitest';
import { HOUSE_CATALOG } from '../../src/phaser-game/config/houseCatalog';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { AdventureBridge } from '../../src/phaser-game/bridge/adventureBridge';
import { isWithinRadius } from '../../src/phaser-game/logic/proximity';
import { rectContainsPoint } from '../../src/phaser-game/logic/worldGeometry';
import { isBodyFree, reachableFrom } from '../helpers/reachability';

const { utilities, shop } = WORLD_MAP;

describe('Loja de Utilidades e porta da Novo Hiper no mapa', () => {
  it('o prédio da Utilidades é sólido; o ponto de interação (calçada da H3) está livre, alcançável e junto à porta', () => {
    expect(WORLD_MAP.solids).toContainEqual(utilities.rect);
    expect(rectContainsPoint(utilities.rect, utilities.interact)).toBe(false);
    expect(isBodyFree(utilities.interact)).toBe(true);
    expect(reachableFrom(WORLD_MAP.spawn)(utilities.interact)).toBe(true);
    expect(isWithinRadius(utilities.interact, utilities.door, utilities.interactRadius)).toBe(true);
    // a porta fica na face voltada para a H3 (norte) e a interação é do lado de fora
    expect(utilities.door.y).toBe(utilities.rect.y);
    expect(utilities.interact.y).toBeLessThan(utilities.rect.y);
  });

  it('o ponto de instalação da Novo Hiper está livre, alcançável e junto à porta; o spawn NÃO dispara a interação', () => {
    expect(isBodyFree(shop.interact)).toBe(true);
    expect(reachableFrom(WORLD_MAP.spawn)(shop.interact)).toBe(true);
    expect(isWithinRadius(shop.interact, shop.door, shop.interactRadius)).toBe(true);
    expect(isWithinRadius(WORLD_MAP.spawn, shop.interact, shop.interactRadius)).toBe(false);
  });

  it('as interações das lojas não se sobrepõem às das 18 casas-destino nem entre si', () => {
    const spots = [
      { name: 'utilidades', p: utilities.interact, r: utilities.interactRadius },
      { name: 'novo hiper', p: shop.interact, r: shop.interactRadius },
    ];
    for (const s of spots) {
      for (const h of HOUSE_CATALOG) {
        expect(Math.hypot(s.p.x - h.deliveryPoint.x, s.p.y - h.deliveryPoint.y), `${s.name} × ${h.houseId}`).toBeGreaterThan(s.r + h.interactRadius);
      }
    }
    expect(Math.hypot(spots[0].p.x - spots[1].p.x, spots[0].p.y - spots[1].p.y)).toBeGreaterThan(spots[0].r + spots[1].r);
  });

  it('a Utilidades fica no quarteirão sul-central, longe do spawn (vale a caminhada)', () => {
    const d = Math.hypot(utilities.interact.x - WORLD_MAP.spawn.x, utilities.interact.y - WORLD_MAP.spawn.y);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(1500);
  });
});

describe('ponte: intents da loja', () => {
  it('openShop/openInstall só são aceitas com o jogo ocioso e sem painel aberto', () => {
    const b = new AdventureBridge();
    const handler = vi.fn();
    b.onIntent(handler);
    expect(b.emitIntent({ type: 'openShop' })).toBe(true);
    expect(b.emitIntent({ type: 'openInstall' })).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
    b.setSnapshot({ uiOpen: true });
    expect(b.emitIntent({ type: 'openShop' })).toBe(false); // painel já aberto: sem duplo envio
    b.setSnapshot({ uiOpen: false, phase: 'delivering' });
    expect(b.emitIntent({ type: 'openShop' })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('deliver continua exigindo o pedido ativo e é bloqueada com painel aberto', () => {
    const b = new AdventureBridge();
    const handler = vi.fn();
    b.onIntent(handler);
    b.setSnapshot({ loaded: true, activeOrder: { id: 'o1', orderNumber: 1, customerId: 'c1', customerName: 'A', destinationId: 'dest_e2e', plantName: 'X', deliverable: true, total: 1, status: 'pronto' } });
    expect(b.emitIntent({ type: 'deliver', orderId: 'o1' })).toBe(true);
    b.setSnapshot({ uiOpen: true });
    expect(b.emitIntent({ type: 'deliver', orderId: 'o1' })).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('o snapshot inicial não traz saldo nem melhorias (nada inventado no cliente)', () => {
    const s = new AdventureBridge().getSnapshot();
    expect(s.cashBalance).toBeNull();
    expect(s.installedUpgrades).toEqual([]);
    expect(s.pendingUpgrades).toEqual([]);
    expect(s.uiOpen).toBe(false);
  });
});
