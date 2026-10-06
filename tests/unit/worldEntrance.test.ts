import { describe, expect, it } from 'vitest';
import { ENTRANCE_ZONE, WORLD } from '../../src/phaser-game/config/worldConfig';
import {
  REARM_DISTANCE,
  computeReturnPoint,
  distanceToEntrance,
  isInsideEntrance,
} from '../../src/phaser-game/logic/worldEntrance';
import { consumeWorldReturnPoint, setWorldReturnPoint } from '../../src/phaser-game/transition/transitionStore';

describe('posição de retorno da WorldScene', () => {
  // Todos os pontos em que o gatilho poderia disparar (dentro do raio), em várias direções.
  const entryPoints: { x: number; y: number }[] = [];
  for (let angle = 0; angle < 360; angle += 15) {
    for (const r of [0, 5, 20, ENTRANCE_ZONE.radius - 0.5]) {
      const rad = (angle * Math.PI) / 180;
      entryPoints.push({ x: ENTRANCE_ZONE.x + Math.cos(rad) * r, y: ENTRANCE_ZONE.y + Math.sin(rad) * r });
    }
  }

  it('nunca cai dentro da zona que dispara a PlatformScene (regressão do loop de reentrada)', () => {
    for (const entry of entryPoints) {
      const ret = computeReturnPoint(entry);
      expect(isInsideEntrance(ret), `entrada ${JSON.stringify(entry)} → retorno ${JSON.stringify(ret)}`).toBe(false);
    }
  });

  it('também fica fora da distância de rearme, então nem precisa do rearme para evitar o loop', () => {
    for (const entry of entryPoints) {
      expect(distanceToEntrance(computeReturnPoint(entry))).toBeGreaterThan(REARM_DISTANCE);
    }
  });

  it('fica próximo da entrada (visível, ≤ 160px) e dentro dos limites do mundo', () => {
    for (const entry of entryPoints) {
      const ret = computeReturnPoint(entry);
      expect(distanceToEntrance(ret)).toBeLessThanOrEqual(160);
      expect(ret.x).toBeGreaterThanOrEqual(0);
      expect(ret.x).toBeLessThanOrEqual(WORLD.width);
      expect(ret.y).toBeGreaterThanOrEqual(0);
      expect(ret.y).toBeLessThanOrEqual(WORLD.height);
    }
  });

  it('o antigo cálculo (y + 70) realmente falhava para quem entra por cima — o novo não', () => {
    const enteredFromTop = { x: ENTRANCE_ZONE.x, y: ENTRANCE_ZONE.y - (ENTRANCE_ZONE.radius - 2) };
    const oldReturn = { x: enteredFromTop.x, y: enteredFromTop.y + 70 };
    expect(isInsideEntrance(oldReturn)).toBe(true);
    expect(isInsideEntrance(computeReturnPoint(enteredFromTop))).toBe(false);
  });

  it('reaparece do lado de onde veio', () => {
    const fromLeft = computeReturnPoint({ x: ENTRANCE_ZONE.x - 30, y: ENTRANCE_ZONE.y });
    expect(fromLeft.x).toBeLessThan(ENTRANCE_ZONE.x);
    const fromBelow = computeReturnPoint({ x: ENTRANCE_ZONE.x, y: ENTRANCE_ZONE.y + 30 });
    expect(fromBelow.y).toBeGreaterThan(ENTRANCE_ZONE.y);
  });

  it('o ponto de retorno é consumido uma única vez', () => {
    setWorldReturnPoint({ x: 1, y: 2 });
    expect(consumeWorldReturnPoint()).toEqual({ x: 1, y: 2 });
    expect(consumeWorldReturnPoint()).toBeNull();
  });
});
