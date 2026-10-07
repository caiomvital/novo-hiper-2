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

  it('interact: KeyE mapeado; Enter NÃO é mapeado (preventDefault faria o Phaser ignorar o Enter)', () => {
    const input = new InputState();
    input.attachKeyboard();
    key('keydown', 'KeyE');
    expect(input.snapshot.interact).toBe(true);
    key('keyup', 'KeyE');
    expect(input.snapshot.interact).toBe(false);
    const enter = new KeyboardEvent('keydown', { code: 'Enter', cancelable: true });
    window.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    input.detachKeyboard();
  });

  it('consumePress: o aperto fica travado até ser consumido (toque rápido não se perde entre quadros)', () => {
    const input = new InputState();
    input.attachKeyboard();
    key('keydown', 'KeyE');
    key('keyup', 'KeyE'); // soltou antes de o jogo olhar
    expect(input.snapshot.interact).toBe(false);
    expect(input.consumePress('interact')).toBe(true);
    expect(input.consumePress('interact')).toBe(false); // consumido
    input.detachKeyboard();
  });

  it('consumePress: tecla segurada (repeat) conta UMA vez; toque também trava', () => {
    const input = new InputState();
    input.attachKeyboard();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', cancelable: true }));
    expect(input.consumePress('interact')).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', repeat: true, cancelable: true }));
    expect(input.consumePress('interact')).toBe(false);
    key('keyup', 'KeyE');
    input.setTouch('interact', true);
    input.setTouch('interact', false);
    expect(input.consumePress('interact')).toBe(true);
    input.detachKeyboard();
    expect(input.consumePress('interact')).toBe(false);
  });
});

describe('InputState suspenso (painel React aberto)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('não consome teclas nem toque e NÃO faz preventDefault; volta ao normal ao retomar', () => {
    const input = new InputState();
    input.attachKeyboard();
    const press = (code: string) => {
      const ev = new KeyboardEvent('keydown', { code, cancelable: true });
      window.dispatchEvent(ev);
      return ev;
    };

    input.setSuspended(true);
    expect(press('KeyE').defaultPrevented).toBe(false); // a interface HTML pode usar a tecla
    expect(input.consumePress('interact')).toBe(false);
    input.setTouch('left', true);
    expect(input.snapshot.left).toBe(false);

    input.setSuspended(false);
    expect(press('KeyE').defaultPrevented).toBe(true);
    expect(input.consumePress('interact')).toBe(true);
    input.detachKeyboard();
  });

  it('suspender limpa o que estava pressionado (Bernardo não fica "preso" andando ao fechar o painel)', () => {
    const input = new InputState();
    input.setTouch('right', true);
    expect(input.snapshot.right).toBe(true);
    input.setSuspended(true);
    expect(input.snapshot.right).toBe(false);
    input.setSuspended(false);
    expect(input.snapshot.right).toBe(false);
  });
});
