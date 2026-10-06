import { RefObject, useCallback, useEffect, useState } from 'react';

/** Fullscreen API (com prefixo webkit quando existir). Sem suporte adequado → `supported=false` e o botão não aparece. */
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fsElement = () => (document as FsDocument).fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

function isSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const d = document as FsDocument;
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

/**
 * Coloca o ELEMENTO indicado (o container inteiro da Aventura: Phaser + HUD + controles) em tela cheia.
 * Não recria nada: só pede fullscreen ao elemento e avisa quando o estado muda (inclui sair com Esc).
 * `onChange` é chamado depois de cada entrada/saída para o Phaser recalcular o tamanho do canvas.
 */
export function useFullscreen(target: RefObject<HTMLElement | null>, onChange?: () => void) {
  const [supported] = useState(isSupported);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setIsFullscreen(fsElement() !== null && fsElement() === target.current);
      onChange?.();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [target, onChange]);

  const toggle = useCallback(async () => {
    const el = target.current as FsElement | null;
    if (!el) return;
    try {
      if (fsElement()) {
        const d = document as FsDocument;
        await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* o navegador recusou (sem gesto, política etc.): permanece como está */
    }
  }, [target]);

  return { supported, isFullscreen, toggle };
}
