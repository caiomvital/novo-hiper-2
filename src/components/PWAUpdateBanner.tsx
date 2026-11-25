import { useEffect, useState } from 'react';
import { PWA_UPDATE_READY, updateApp, updateReady } from '../services/pwaUpdate';
export function PWAUpdateBanner() {
  const [ready, setReady] = useState(updateReady);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => { const show = () => setReady(true); window.addEventListener(PWA_UPDATE_READY, show); return () => window.removeEventListener(PWA_UPDATE_READY, show); }, []);
  useEffect(() => {
    if (!ready) return;
    const check = () => setEditing(Boolean(document.querySelector('[aria-modal="true"]')));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-modal'] });
    return () => observer.disconnect();
  }, [ready]);
  if (!ready || editing) return null;
  return <div role="status" className="fixed bottom-3 inset-x-3 z-[100] rounded-xl bg-emerald-950 p-3 text-white shadow-xl text-sm">
    <p>Nova versão disponível. Salve sua edição antes de atualizar.</p>
    {error && <p>Não foi possível atualizar. Tente novamente.</p>}
    <button id="btn-pwa-update" disabled={busy} className="mt-2 min-h-11 rounded-lg bg-white px-4 text-emerald-950 font-bold" onClick={async () => { setBusy(true); setError(false); try { await updateApp(true); } catch { setError(true); setBusy(false); } }}>{busy ? 'Atualizando…' : 'Atualizar aplicativo'}</button>
  </div>;
}
