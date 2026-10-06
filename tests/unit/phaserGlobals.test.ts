// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Imita o Phaser 3.90: start() roda DEPOIS (assíncrono), registra listeners globais e o destroy
// NÃO os remove — só emite DESTROY.
vi.mock('phaser', () => {
  class FakeEvents {
    private handlers: Record<string, Array<() => void>> = {};
    once(ev: string, fn: () => void) {
      (this.handlers[ev] ??= []).push(fn);
    }
    emit(ev: string) {
      (this.handlers[ev] ?? []).splice(0).forEach((fn) => fn());
    }
  }
  class FakeGame {
    events = new FakeEvents();
    constructor() {
      queueMicrotask(() => this.start());
    }
    start() {
      document.addEventListener('visibilitychange', FakeGame.onChange, false);
      window.onblur = () => {};
      window.onfocus = () => {};
    }
    static onChange = () => {};
    destroy() {
      this.events.emit('destroy');
    }
  }
  return { default: { Game: FakeGame, Core: { Events: { DESTROY: 'destroy' } } } };
});

import { createGameWithCleanup } from '../../src/phaser-game/phaserGlobals';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createGameWithCleanup (vazamento de listeners globais do Phaser)', () => {
  beforeEach(() => {
    window.onblur = null;
    window.onfocus = null;
  });

  function spyDocument() {
    const net = { visibility: 0 };
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    document.addEventListener = ((t: string, l: any, o?: any) => (t === 'visibilitychange' && net.visibility++, add(t, l, o))) as any;
    document.removeEventListener = ((t: string, l: any, o?: any) => (t === 'visibilitychange' && net.visibility--, remove(t, l, o))) as any;
    return net;
  }

  it('remove o visibilitychange e o onblur/onfocus que o Phaser deixa ao destruir', async () => {
    const net = spyDocument();
    const game = createGameWithCleanup({} as any);
    await tick(); // start() assíncrono do Phaser
    expect(net.visibility).toBe(1);
    expect(window.onblur).not.toBeNull();

    (game as any).destroy(true);

    expect(net.visibility).toBe(0);
    expect(window.onblur).toBeNull();
    expect(window.onfocus).toBeNull();
  });

  it('StrictMode: dois jogos criados em sequência (um destruído antes do outro) não vazam nem se atrapalham', async () => {
    const net = spyDocument();
    const first = createGameWithCleanup({} as any);
    const second = createGameWithCleanup({} as any);
    await tick();
    expect(net.visibility).toBe(2);
    (first as any).destroy(true);
    expect(net.visibility).toBe(1);
    expect(window.onblur).not.toBeNull(); // o do segundo continua valendo
    (second as any).destroy(true);
    expect(net.visibility).toBe(0);
    expect(window.onblur).toBeNull();
  });

  it('não captura listeners alheios registrados fora do start() do jogo', async () => {
    const net = spyDocument();
    const game = createGameWithCleanup({} as any);
    const other = () => {};
    document.addEventListener('visibilitychange', other);
    await tick();
    (game as any).destroy(true);
    expect(net.visibility).toBe(1); // só o "other" permanece
    document.removeEventListener('visibilitychange', other);
  });
});
