import { describe, expect, it } from 'vitest';
import { CUSTOMER_SPOT, ENTRANCE_ZONE, WORLD } from '../../src/phaser-game/config/worldConfig';
import { PIXELS_PER_METER, PLAYABLE_RECT, ROADS, WORLD_MAP, roadRect } from '../../src/phaser-game/config/worldMap';
import { NEAR_DESTINATION_PX, destinationIndicator, formatMeters } from '../../src/phaser-game/logic/destination';
import { Rect, bodyRectAt, rectsOverlap } from '../../src/phaser-game/logic/worldGeometry';
import { computeReturnPoint, isInsideEntrance } from '../../src/phaser-game/logic/worldEntrance';
import { isBodyFree, reachableFrom } from '../helpers/reachability';

const sidewalkRect = (r: (typeof ROADS)[number]) => roadRect(r, WORLD_MAP.sidewalk);

describe('geometria principal do bairro', () => {
  it('3200x2400 com margem externa de 160 px não caminhável; WORLD deriva do mapa', () => {
    expect(WORLD_MAP.width).toBe(3200);
    expect(WORLD_MAP.height).toBe(2400);
    expect(WORLD_MAP.margin).toBe(160);
    expect(PLAYABLE_RECT).toEqual({ x: 160, y: 160, w: 2880, h: 2080 });
    expect(WORLD.width).toBe(WORLD_MAP.width);
    expect(ENTRANCE_ZONE).toBe(WORLD_MAP.entrance);
    expect(CUSTOMER_SPOT).toBe(WORLD_MAP.customer);
  });

  it('4 ruas verticais, 3 horizontais (2 avenidas) e 1 travessa; ~16 quarteirões', () => {
    expect(ROADS.filter((r) => r.orientation === 'v' && r.id !== 'travessa')).toHaveLength(4);
    expect(ROADS.filter((r) => r.orientation === 'h')).toHaveLength(3);
    expect(ROADS.filter((r) => r.avenue).map((r) => r.id).sort()).toEqual(['h2', 'v2']);
    expect(ROADS.some((r) => r.id === 'travessa')).toBe(true);
    expect(WORLD_MAP.blocks.filter((b) => b.id.startsWith('q_'))).toHaveLength(16);
  });

  it('todo elemento sólido fica dentro do mundo e nenhum se sobrepõe a rua ou calçada', () => {
    for (const s of WORLD_MAP.solids) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w).toBeLessThanOrEqual(WORLD_MAP.width);
      expect(s.y + s.h).toBeLessThanOrEqual(WORLD_MAP.height);
    }
    // casas/loja/prédio fechado/praça fora das vias (barreiras de obras ficam NA via de propósito)
    const gateRects = new Set(WORLD_MAP.gates.map((g) => g.rect));
    for (const s of WORLD_MAP.solids.filter((r) => !gateRects.has(r))) {
      for (const road of ROADS) expect(rectsOverlap(s, roadRect(road)), JSON.stringify(s)).toBe(false);
    }
    for (const h of WORLD_MAP.houses) for (const road of ROADS) expect(rectsOverlap(h.rect, sidewalkRect(road)), h.id).toBe(false);
    expect(rectsOverlap(WORLD_MAP.shop.rect, sidewalkRect(ROADS.find((r) => r.id === 'h2')!))).toBe(false);
  });

  it('as casas não se sobrepõem entre si nem à Novo Hiper', () => {
    const rects: Rect[] = [...WORLD_MAP.houses.map((h) => h.rect), WORLD_MAP.shop.rect, WORLD_MAP.closedBuilding.rect];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j]), `${i} x ${j}`).toBe(false);
    expect(WORLD_MAP.houses.length).toBeGreaterThanOrEqual(30);
  });

  it('as 3 saídas ainda fechadas têm barreira que cobre a largura da via', () => {
    const byId = Object.fromEntries(WORLD_MAP.gates.map((g) => [g.id, g.rect]));
    expect(byId.obras_leste.h).toBeGreaterThanOrEqual(128); // avenida H2
    expect(byId.obras_norte.w).toBeGreaterThanOrEqual(128); // avenida V2
    expect(byId.obras_sul.w).toBeGreaterThanOrEqual(96); // rua V1
  });
});

describe('colisões essenciais e pontos importantes livres', () => {
  it('spawn, entrada da plataforma e ponto de entrega estão em posição livre', () => {
    expect(isBodyFree(WORLD_MAP.spawn)).toBe(true);
    expect(isBodyFree(WORLD_MAP.entrance)).toBe(true);
    expect(isBodyFree(WORLD_MAP.customer)).toBe(true);
  });

  it('são sólidos: Novo Hiper, fonte, árvores da praça, casa do cliente e margem externa', () => {
    const solid = (p: { x: number; y: number }) => !isBodyFree(p);
    expect(solid({ x: 1032, y: 850 })).toBe(true); // dentro da Novo Hiper
    expect(solid(WORLD_MAP.plaza.fountain)).toBe(true);
    for (const t of WORLD_MAP.plaza.trees) expect(solid(t)).toBe(true);
    const house = WORLD_MAP.houses.find((h) => h.id === WORLD_MAP.customer.houseId)!;
    expect(solid({ x: house.rect.x + house.rect.w / 2, y: house.rect.y + house.rect.h / 2 })).toBe(true);
    expect(solid({ x: 100, y: 1200 })).toBe(true); // margem esquerda
    expect(solid({ x: 3150, y: 1200 })).toBe(true); // margem direita
    expect(solid({ x: 1600, y: 90 })).toBe(true); // margem superior
  });

  it('destino, entrada da plataforma, portas, cruzamentos e praça são alcançáveis a pé a partir do spawn', () => {
    const reach = reachableFrom(WORLD_MAP.spawn);
    expect(reach(WORLD_MAP.customer)).toBe(true);
    expect(reach(WORLD_MAP.entrance)).toBe(true);
    // porta da Novo Hiper (ponto logo à frente) e de todas as casas (à frente da porta)
    expect(reach({ x: WORLD_MAP.shop.door.x, y: WORLD_MAP.shop.door.y + 40 })).toBe(true);
    for (const h of WORLD_MAP.houses) {
      const front = { x: h.rect.x + h.rect.w / 2, y: h.facing === 's' ? h.rect.y + h.rect.h + 44 : h.rect.y - 44 };
      expect(reach(front), `porta de ${h.id}`).toBe(true);
    }
    // cruzamentos
    for (const v of ROADS.filter((r) => r.orientation === 'v' && r.id !== 'travessa'))
      for (const h of ROADS.filter((r) => r.orientation === 'h')) expect(reach({ x: v.center, y: h.center }), `${v.id}x${h.id}`).toBe(true);
    // praça: caminhos em cruz e os 4 lados
    const pz = WORLD_MAP.plaza.rect;
    for (const p of [{ x: 1768, y: 960 }, { x: 1768, y: 780 }, { x: 1640, y: 872 }, { x: 1900, y: 872 }, { x: pz.x + 20, y: pz.y + 20 }])
      expect(reach(p), JSON.stringify(p)).toBe(true);
  });

  it('há mais de um caminho até o destino: bloquear a rua V3 (ou a travessa) não isola o cliente', () => {
    const v3 = ROADS.find((r) => r.id === 'v3')!;
    const blockV3: Rect = { x: v3.center - 60, y: 1300, w: 120, h: 460 };
    expect(reachableFrom(WORLD_MAP.spawn, [blockV3])(WORLD_MAP.customer)).toBe(true);
    const blockTravessa: Rect = { x: 1840 - 40, y: 1300, w: 80, h: 460 };
    expect(reachableFrom(WORLD_MAP.spawn, [blockTravessa])(WORLD_MAP.customer)).toBe(true);
    expect(reachableFrom(WORLD_MAP.spawn, [blockV3, blockTravessa])(WORLD_MAP.customer)).toBe(true); // ainda pela V4
  });

  it('o retorno da PlatformScene cai em ponto LIVRE, alcançável e fora da zona de entrada, para qualquer lado de onde se entra', () => {
    const reach = reachableFrom(WORLD_MAP.spawn);
    for (let deg = 0; deg < 360; deg += 15) {
      for (const r of [0, 20, ENTRANCE_ZONE.radius - 1]) {
        const entered = { x: ENTRANCE_ZONE.x + Math.cos((deg * Math.PI) / 180) * r, y: ENTRANCE_ZONE.y + Math.sin((deg * Math.PI) / 180) * r };
        const back = computeReturnPoint(entered);
        expect(isInsideEntrance(back)).toBe(false);
        expect(isBodyFree(back), `retorno ${JSON.stringify(back)} (entrada por ${deg}°)`).toBe(true);
        expect(reach(back)).toBe(true);
      }
    }
  });

  it('o corpo de Bernardo (32x44) cabe na menor passagem: a travessa tem folga', () => {
    const travessa = ROADS.find((r) => r.id === 'travessa')!;
    expect(travessa.width + 2 * WORLD_MAP.sidewalk).toBeGreaterThan(bodyRectAt({ x: 0, y: 0 }).w * 2);
  });
});

describe('indicador de destino (direção e distância)', () => {
  it('6 px = 1 m; direção real em radianos de tela', () => {
    expect(PIXELS_PER_METER).toBe(6);
    const ind = destinationIndicator({ x: 0, y: 0 }, { x: 600, y: 0 });
    expect(ind.meters).toBe(100);
    expect(ind.angle).toBeCloseTo(0, 6); // leste
    expect(destinationIndicator({ x: 0, y: 0 }, { x: 0, y: 300 }).angle).toBeCloseTo(Math.PI / 2, 6); // sul
    expect(Math.abs(destinationIndicator({ x: 0, y: 0 }, { x: -300, y: 0 }).angle)).toBeCloseTo(Math.PI, 6); // oeste
    expect(destinationIndicator({ x: 0, y: 0 }, { x: 0, y: -300 }).angle).toBeCloseTo(-Math.PI / 2, 6); // norte
    expect(destinationIndicator({ x: 100, y: 100 }, { x: 200, y: 0 }).angle).toBeCloseTo(-Math.PI / 4, 6); // nordeste
  });

  it('"Destino próximo" a partir de 240 px (inclusive) e não antes', () => {
    expect(NEAR_DESTINATION_PX).toBe(240);
    expect(destinationIndicator({ x: 0, y: 0 }, { x: 240, y: 0 }).near).toBe(true);
    expect(destinationIndicator({ x: 0, y: 0 }, { x: 241, y: 0 }).near).toBe(false);
    expect(destinationIndicator({ x: 0, y: 0 }, { x: 0, y: 0 }).near).toBe(true);
  });

  it('formata em metros inteiros e a distância do spawn ao cliente é plausível (~280 m)', () => {
    expect(formatMeters(277.6)).toBe('278 m');
    const d = destinationIndicator(WORLD_MAP.spawn, WORLD_MAP.customer);
    expect(d.near).toBe(false);
    expect(d.meters).toBeGreaterThan(250);
    expect(d.meters).toBeLessThan(310);
  });

  it('o raio de interação continua 80 px, menor que o limite de "Destino próximo"', () => {
    expect(CUSTOMER_SPOT.interactRadius).toBe(80);
    expect(CUSTOMER_SPOT.interactRadius).toBeLessThan(NEAR_DESTINATION_PX);
  });
});
