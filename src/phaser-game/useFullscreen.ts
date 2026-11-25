import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => Promise<void> };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };
const fsElement = () => (document as FsDocument).fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;

export function useFullscreen(target: RefObject<HTMLElement | null>, onChange?: () => void, preferLandscape = false) {
  const [supported] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || (document as FsDocument).webkitFullscreenEnabled));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const ownedLock = useRef(false);
  const lockRevision = useRef(0);
  const releaseOrientation = useCallback(() => {
    lockRevision.current++;
    if (ownedLock.current) {
      try { screen.orientation?.unlock?.(); } catch { /* A página pode já estar oculta. */ }
      ownedLock.current = false;
    }
  }, []);
  const lockLandscape = useCallback(async () => {
    if (ownedLock.current) return;
    const orientation = screen.orientation as LockableOrientation | undefined;
    const revision = ++lockRevision.current;
    try {
      if (orientation?.lock) {
        await orientation.lock('landscape');
        if (revision !== lockRevision.current) { if (!ownedLock.current) orientation.unlock?.(); return; }
        ownedLock.current = true;
      }
    } catch { /* Sem suporte/permissão: a interface orienta a girar o aparelho. */ }
  }, []);

  useEffect(() => {
    const sync = () => {
      const active = fsElement() !== null && fsElement() === target.current;
      setIsFullscreen(active);
      if (!active) releaseOrientation();
      onChange?.();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      releaseOrientation();
    };
  }, [target, onChange, releaseOrientation]);
  useEffect(() => {
    if (isFullscreen && preferLandscape) void lockLandscape();
    else releaseOrientation();
  }, [isFullscreen, preferLandscape, lockLandscape, releaseOrientation]);

  const enterLandscape = useCallback(async () => {
    const el = target.current as FsElement | null;
    if (!el) return;
    const alreadyFullscreen = fsElement() === el;
    try {
      if (!alreadyFullscreen) {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      }
    } catch { /* A rotação manual continua disponível. */ }
    // Uma entrada nova é tratada pelo efeito fullscreenchange: evita duas solicitações concorrentes.
    if (fsElement() === el && (alreadyFullscreen || !preferLandscape)) await lockLandscape();
  }, [target, lockLandscape, preferLandscape]);
  const toggle = useCallback(async () => {
    const el = target.current as FsElement | null;
    if (!el) return;
    try {
      if (fsElement()) {
        releaseOrientation();
        const d = document as FsDocument;
        if (d.exitFullscreen) await d.exitFullscreen(); else await d.webkitExitFullscreen?.();
      } else {
        if (el.requestFullscreen) await el.requestFullscreen(); else await el.webkitRequestFullscreen?.();
      }
    } catch { /* O navegador mantém o modo atual. */ }
  }, [target, releaseOrientation]);
  return { supported, isFullscreen, toggle, enterLandscape };
}
