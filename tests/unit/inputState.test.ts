// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputState } from '../../src/phaser-game/input/InputState';

function key(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true }));
}

describe('InputState (teclado + touch)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mapeia setas para as quatro direções e solta ao levantar a tecla', () => {
    const input = new InputState();
    input.attachKeyboard();
    const cases: [string, 'up' | 'down' | 'left' | 'right'][] = [
      ['ArrowUp', 'up'],
      ['ArrowDown', 'down'],
      ['ArrowLeft', 'left'],
      ['ArrowRight', 'right'],
    ];
    for (const [code, action] of cases) {
      key('keydown', code);
      expect(input.snapshot[action], code).toBe(true);
      key('keyup', code);
      expect(input.snapshot[action], code).toBe(false);
    }
    input.detachKeyboard();
  });

  it('WASD equivale às setas e Espaço é o pulo', () => {
    const input = new InputState();
    input.attachKeyboard();
    for (const [code, action] of [['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'], ['Space', 'jump']] as const) {
      key('keydown', code);
      expect(input.snapshot[action], code).toBe(true);
      key('keyup', code);
    }
    input.detachKeyboard();
  });

  it('teclas diagonais acumulam (esquerda + pulo ao mesmo tempo)', () => {
    const input = new InputState();
    input.attachKeyboard();
    key('keydown', 'ArrowLeft');
    key('keydown', 'Space');
    expect(input.snapshot.left && input.snapshot.jump).toBe(true);
    input.detachKeyboard();
  });

  it('controles touch alimentam o mesmo estado', () => {
    const input = new InputState();
    input.setTouch('jump', true);
    input.setTouch('right', true);
    expect(input.snapshot.jump && input.snapshot.right).toBe(true);
    input.setTouch('jump', false);
    expect(input.snapshot.jump).toBe(false);
  });

  it('detachKeyboard remove os listeners e zera teclas presas', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const input = new InputState();
    input.attachKeyboard();
    key('keydown', 'ArrowRight');
    input.detachKeyboard();
    expect(input.snapshot.right).toBe(false);
    key('keydown', 'ArrowRight');
    expect(input.snapshot.right).toBe(false);
    const added = add.mock.calls.map((c) => c[0]).sort();
    const removed = remove.mock.calls.map((c) => c[0]).sort();
    expect(removed).toEqual(added);
  });

  it('ciclos repetidos de attach/detach não acumulam listeners', () => {
    const input = new InputState();
    for (let i = 0; i < 5; i++) {
      input.attachKeyboard();
      input.detachKeyboard();
    }
    key('keydown', 'ArrowUp');
    expect(input.snapshot.up).toBe(false);
  });
});
