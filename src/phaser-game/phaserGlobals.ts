import Phaser from 'phaser';

/**
 * O Phaser 3.90 registra `visibilitychange` no `document` e `window.onblur/onfocus` em
 * `Game.start()` (que roda de forma assíncrona, após o carregamento das texturas internas) e
 * NUNCA os remove ao destruir o jogo. Sem tratamento, cada entrada/saída da Aventura vazaria um
 * listener (e manteria o Game destruído vivo).
 *
 * Esta função cria o jogo e envolve `start()` do próprio jogo para capturar exatamente esses
 * registros (sem confundir com listeners de outros jogos/componentes) e desfazê-los quando o jogo
 * é destruído.
 */
export function createGameWithCleanup(config: Phaser.Types.Core.GameConfig): Phaser.Game {
  const game = new Phaser.Game(config);

  const captured: Array<{ type: string; listener: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }> = [];
  const previousOnBlur = window.onblur;
  const previousOnFocus = window.onfocus;
  let ownOnBlur: typeof window.onblur = null;
  let ownOnFocus: typeof window.onfocus = null;

  const anyGame = game as any;
  const originalStart = anyGame.start;
  if (typeof originalStart === 'function') {
    anyGame.start = function (this: Phaser.Game, ...args: unknown[]) {
      const originalAdd = document.addEventListener;
      document.addEventListener = function (type: string, listener: any, options?: any) {
        if (type.endsWith('visibilitychange')) captured.push({ type, listener, options });
        return originalAdd.call(document, type, listener, options);
      } as typeof document.addEventListener;
      try {
        return originalStart.apply(this, args);
      } finally {
        document.addEventListener = originalAdd;
        ownOnBlur = window.onblur;
        ownOnFocus = window.onfocus;
      }
    };
  }

  // `destroy()` do Phaser é adiado para o próximo quadro, DEPOIS de start(); o evento garante a ordem.
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    captured.forEach(({ type, listener, options }) => document.removeEventListener(type, listener, options));
    captured.length = 0;
    if (window.onblur === ownOnBlur) window.onblur = previousOnBlur;
    if (window.onfocus === ownOnFocus) window.onfocus = previousOnFocus;
  });

  return game;
}
