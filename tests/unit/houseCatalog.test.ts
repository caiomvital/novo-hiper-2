import { describe, expect, it } from 'vitest';
import { HOUSE_CATALOG, resolveDestination } from '../../src/phaser-game/config/houseCatalog';
import { CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { NEAR_DESTINATION_PX, destinationIndicator } from '../../src/phaser-game/logic/destination';
import { isWithinRadius } from '../../src/phaser-game/logic/proximity';
import { DESTINATION_IDS, LEGACY_DESTINATIONS, LEGACY_DESTINATION_TARGET } from '../../src/shared/destinations';
import { isBodyFree, reachableFrom } from '../helpers/reachability';

describe('catálogo de residências-destino', () => {
  it('é exatamente o conjunto de ids que o backend distribui (fonte única)', () => {
    expect(HOUSE_CATALOG.map((h) => h.destinationId).sort()).toEqual([...DESTINATION_IDS].sort());
    expect(HOUSE_CATALOG.length).toBeGreaterThanOrEqual(10);
    expect(HOUSE_CATALOG.length).toBeLessThanOrEqual(20);
  });

  it('ids técnicos no formato região/casa, sem posição; cada casa do mapa só vale um destino', () => {
    for (const h of HOUSE_CATALOG) {
      expect(h.destinationId).toMatch(/^bairro1\/house_\d{3}$/);
      expect(WORLD_MAP.houses.some((m) => m.id === h.mapHouseId)).toBe(true);
    }
    expect(new Set(HOUSE_CATALOG.map((h) => h.mapHouseId)).size).toBe(HOUSE_CATALOG.length);
  });

  it('a casa amarela é um destino do catálogo e coincide com o ponto provisório antigo', () => {
    const y = HOUSE_CATALOG.find((h) => h.destinationId === LEGACY_DESTINATION_TARGET)!;
    expect(y.deliveryPoint).toEqual({ x: CUSTOMER_SPOT.x, y: CUSTOMER_SPOT.y });
    expect(y.door).toEqual(WORLD_MAP.customer.door);
  });

  it('o deliveryPoint de TODA casa-destino está livre e é alcançável a pé a partir do spawn', () => {
    const reach = reachableFrom(WORLD_MAP.spawn);
    for (const h of HOUSE_CATALOG) {
      expect(isBodyFree(h.deliveryPoint), `${h.houseId} livre`).toBe(true);
      expect(reach(h.deliveryPoint), `${h.houseId} alcançável`).toBe(true);
    }
  });

  it('as casas estão distribuídas: pontos de entrega a mais de 2 raios de interação uns dos outros (nenhuma interação ambígua)', () => {
    for (const a of HOUSE_CATALOG)
      for (const b of HOUSE_CATALOG) {
        if (a === b) continue;
        const d = Math.hypot(a.deliveryPoint.x - b.deliveryPoint.x, a.deliveryPoint.y - b.deliveryPoint.y);
        expect(d, `${a.houseId} × ${b.houseId}`).toBeGreaterThan(a.interactRadius + b.interactRadius);
      }
  });

  it('cobre regiões variadas do bairro (não concentra numa rua): leste, oeste, norte, sul e perto da Novo Hiper e da praça', () => {
    const xs = HOUSE_CATALOG.map((h) => h.deliveryPoint.x);
    const ys = HOUSE_CATALOG.map((h) => h.deliveryPoint.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2000);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(1200);
    const ruas = new Set(HOUSE_CATALOG.map((h) => `${h.facing}${Math.round(h.door.y / 100)}`));
    expect(ruas.size).toBeGreaterThanOrEqual(5);
  });
});

describe('resolveDestination', () => {
  it('id moderno → a casa do catálogo', () => {
    const r = resolveDestination('bairro1/house_007');
    expect(r.status).toBe('house');
    if (r.status === 'house') {
      expect(r.house.houseId).toBe('house_007');
      expect(r.legacy).toBe(false);
    }
  });

  it('cada id legado conhecido → a casa amarela (compatibilidade explícita)', () => {
    for (const id of LEGACY_DESTINATIONS) {
      const r = resolveDestination(id);
      expect(r.status, id).toBe('house');
      if (r.status === 'house') {
        expect(r.legacy).toBe(true);
        expect(r.house.destinationId).toBe(LEGACY_DESTINATION_TARGET);
      }
    }
    for (const id of ['dest_default', 'dest_manual', 'dest_e2e']) expect(LEGACY_DESTINATIONS).toContain(id);
  });

  it('id moderno INEXISTENTE ou desconhecido NÃO cai na casa padrão: status unknown', () => {
    for (const id of ['bairro1/house_999', 'bairro2/house_002', 'bairro1/house_001', 'house_007', '', null, undefined, 'qualquer_coisa']) {
      expect(resolveDestination(id as any).status, String(id)).toBe('unknown');
    }
  });
});

describe('indicador e interação por casa', () => {
  it('o indicador aponta para a casa certa e a interação só vale perto do ponto dela', () => {
    const maria = HOUSE_CATALOG.find((h) => h.houseId === 'house_007')!;
    const joao = HOUSE_CATALOG.find((h) => h.houseId === 'house_021')!;
    const ana = HOUSE_CATALOG.find((h) => h.houseId === 'house_034')!;
    const from = WORLD_MAP.spawn;
    for (const h of [maria, joao, ana]) {
      const ind = destinationIndicator(from, h.deliveryPoint);
      expect(ind.angle).toBeCloseTo(Math.atan2(h.deliveryPoint.y - from.y, h.deliveryPoint.x - from.x), 6);
      expect(ind.pixels).toBeCloseTo(Math.hypot(h.deliveryPoint.x - from.x, h.deliveryPoint.y - from.y), 6);
    }
    // casa errada: parado no ponto de OUTRA casa não está no raio do destino ativo
    expect(isWithinRadius(joao.deliveryPoint, maria.deliveryPoint, maria.interactRadius)).toBe(false);
    expect(isWithinRadius(maria.deliveryPoint, maria.deliveryPoint, maria.interactRadius)).toBe(true);
    // "Destino próximo" abaixo de 240 px
    const near = { x: maria.deliveryPoint.x + NEAR_DESTINATION_PX - 1, y: maria.deliveryPoint.y };
    expect(destinationIndicator(near, maria.deliveryPoint).near).toBe(true);
  });
});
