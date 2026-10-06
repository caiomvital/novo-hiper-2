import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FACING_ROW,
  TOPDOWN_BODY,
  TOPDOWN_BODY_OFFSET,
  TOPDOWN_ORIGIN,
  TOPDOWN_SPRITE,
  frameIndex,
} from '../../src/phaser-game/config/topdownSpriteConfig';
import { ENTRANCE_ZONE, WORLD, CUSTOMER_SPOT } from '../../src/phaser-game/config/worldConfig';
import { WORLD_MAP, streetPositions } from '../../src/phaser-game/config/worldMap';
import { facingFromMovement, selectTopdownAnimation } from '../../src/phaser-game/logic/topdownAnimation';

describe('animação top-down', () => {
  it('parado → idle da última direção (as 4 direções)', () => {
    for (const f of ['down', 'left', 'right', 'up'] as const) {
      expect(selectTopdownAnimation(f, false)).toBe(`idle-${f}`);
      expect(selectTopdownAnimation(f, true)).toBe(`walk-${f}`);
    }
  });

  it('cada direção de movimento escolhe a animação correspondente', () => {
    expect(facingFromMovement('down', -1, 0)).toBe('left');
    expect(facingFromMovement('down', 1, 0)).toBe('right');
    expect(facingFromMovement('down', 0, -1)).toBe('up');
    expect(facingFromMovement('up', 0, 1)).toBe('down');
  });

  it('diagonal usa a horizontal; parar mantém a última direção', () => {
    expect(facingFromMovement('up', 1, -1)).toBe('right');
    expect(facingFromMovement('down', -1, 1)).toBe('left');
    expect(facingFromMovement('left', 0, 0)).toBe('left');
    expect(facingFromMovement('up', 0, 0)).toBe('up');
  });

  it('andar e parar: o idle é o da direção em que ele estava andando', () => {
    let facing = facingFromMovement('down', 1, 0); // andou para a direita
    expect(selectTopdownAnimation(facing, true)).toBe('walk-right');
    facing = facingFromMovement(facing, 0, 0); // soltou as teclas
    expect(selectTopdownAnimation(facing, false)).toBe('idle-right');
  });
});

describe('layout do spritesheet e collider', () => {
  it('linhas: baixo, esquerda, direita, cima; coluna 0 = idle, 1..4 = caminhada', () => {
    expect(FACING_ROW).toEqual({ down: 0, left: 1, right: 2, up: 3 });
    expect(frameIndex('down', 0)).toBe(0);
    expect(frameIndex('left', 1)).toBe(6);
    expect(frameIndex('right', 4)).toBe(14);
    expect(frameIndex('up', 4)).toBe(19);
  });

  it('o PNG derivado tem exatamente 5 colunas x 4 linhas de 72x80', () => {
    const file = path.resolve('public/assets/bernardo-sprites/topdown/bernardo-topdown.png');
    const buf = fs.readFileSync(file);
    expect(buf.subarray(1, 4).toString()).toBe('PNG');
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(TOPDOWN_SPRITE.frameWidth * TOPDOWN_SPRITE.columns);
    expect(height).toBe(TOPDOWN_SPRITE.frameHeight * 4);
  });

  it('o collider continua 32x44 e fica centrado na posição do jogador (comportamento anterior)', () => {
    expect(TOPDOWN_BODY).toEqual({ width: 32, height: 44 });
    const centerX = TOPDOWN_BODY_OFFSET.x + TOPDOWN_BODY.width / 2;
    const centerY = TOPDOWN_BODY_OFFSET.y + TOPDOWN_BODY.height / 2;
    expect(centerX).toBeCloseTo(TOPDOWN_ORIGIN.x * TOPDOWN_SPRITE.frameWidth, 6);
    expect(centerY).toBeCloseTo(TOPDOWN_ORIGIN.y * TOPDOWN_SPRITE.frameHeight, 6);
  });

  it('o body é bem menor que o frame inteiro e a base do body coincide com a base do pé do desenho', () => {
    expect(TOPDOWN_BODY.width).toBeLessThan(TOPDOWN_SPRITE.frameWidth / 2);
    expect(TOPDOWN_BODY.height).toBeLessThan(TOPDOWN_SPRITE.frameHeight);
    expect(TOPDOWN_BODY_OFFSET.y + TOPDOWN_BODY.height).toBeCloseTo(TOPDOWN_SPRITE.feet.y, 6);
  });
});

describe('WORLD_MAP (preparação para mapa maior)', () => {
  it('WORLD, entrada e cliente derivam do mapa (fonte única)', () => {
    expect(WORLD.width).toBe(WORLD_MAP.width);
    expect(WORLD.height).toBe(WORLD_MAP.height);
    expect(WORLD.defaultSpawn).toBe(WORLD_MAP.spawn);
    expect(ENTRANCE_ZONE).toBe(WORLD_MAP.entrance);
    expect(CUSTOMER_SPOT).toBe(WORLD_MAP.customer);
  });

  it('todas as entidades do mapa ficam dentro dos limites do mundo', () => {
    const inside = (p: { x: number; y: number }, margin = 0) =>
      p.x >= margin && p.y >= margin && p.x <= WORLD_MAP.width - margin && p.y <= WORLD_MAP.height - margin;
    expect(inside(WORLD_MAP.spawn, 20)).toBe(true);
    expect(inside(WORLD_MAP.entrance, WORLD_MAP.entrance.radius)).toBe(true);
    expect(inside(WORLD_MAP.customer, WORLD_MAP.customer.interactRadius / 2)).toBe(true);
    for (const b of WORLD_MAP.buildings) expect(inside(b, WORLD_MAP.buildingSize / 2)).toBe(true);
  });

  it('as ruas cobrem o mapa de acordo com a dimensão (qualquer tamanho de mundo)', () => {
    expect(streetPositions(1600, WORLD_MAP.streets)).toEqual([200, 600, 1000, 1400]);
    expect(streetPositions(1200, WORLD_MAP.streets)).toEqual([200, 600, 1000]);
    // um mundo bem maior gera mais ruas sem nenhuma mudança de código
    expect(streetPositions(6000, WORLD_MAP.streets).length).toBe(15);
    expect(streetPositions(6000, WORLD_MAP.streets).every((p) => p < 6000)).toBe(true);
  });

  it('a velocidade do jogador não depende do tamanho do mundo', () => {
    expect(WORLD.playerSpeed).toBe(220);
  });
});
