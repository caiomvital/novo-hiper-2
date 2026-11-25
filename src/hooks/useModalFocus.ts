import { useEffect, useRef } from 'react';
export function useModalFocus(open: boolean, id: string, label: string, onClose: () => void) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const dialog = document.getElementById(id);
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', label);
    const backdrop = dialog.parentElement;
    const fixed = backdrop && getComputedStyle(backdrop).position === 'fixed';
    const viewport = window.visualViewport;
    const resize = () => {
      const height = fixed ? (viewport?.height ?? window.innerHeight) : (backdrop?.clientHeight || window.innerHeight);
      dialog.style.setProperty('--modal-viewport-height', `${height}px`);
      if (backdrop && fixed) { backdrop.style.height = `${height}px`; backdrop.style.top = `${viewport?.offsetTop ?? 0}px`; }
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length && el.getAttribute('type') !== 'hidden');
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = controls(); const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog.addEventListener('keydown', keyboard);
    return () => { dialog.removeEventListener('keydown', keyboard); viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); if (previous?.isConnected) previous.focus(); };
  }, [open, id, label]);
}
