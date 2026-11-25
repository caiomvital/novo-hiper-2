import { useEffect, useRef, useState } from 'react';
import type { AdventureBridge } from '../bridge/adventureBridge';
import type { InputState } from '../input/InputState';
import { useModalFocus } from '../../hooks/useModalFocus';
import { api } from '../../services/api';
import { MARIA_STORY_TITLE } from '../../shared/residentStory';

export function ResidentStoryPanel({ bridge, input, open, onClose, navigate }: {
  bridge: AdventureBridge; input: InputState; open: boolean; onClose: () => void; navigate?: () => void;
}) {
  const [snap, setSnap] = useState(bridge.getSnapshot());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  useEffect(() => bridge.subscribe(setSnap), [bridge]);
  useEffect(() => {
    if (!open) return;
    input.setSuspended(true); bridge.setSnapshot({ uiOpen: true });
    return () => { input.setSuspended(false); bridge.setSnapshot({ uiOpen: false }); };
  }, [open, bridge, input]);
  useModalFocus(open, 'resident-story-modal', MARIA_STORY_TITLE, () => { if (!locked.current) onClose(); });
  if (!open) return null;
  const story = snap.worldStage.residentStory;
  const active = snap.activeOrder;
  const ownOrder = active && active.id === story?.orderId;
  const act = async (action: 'accept' | 'ack') => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      const updated = action === 'accept' ? await api.acceptResidentStory() : await api.acknowledgeResidentStory();
      bridge.setSnapshot({ worldStage: { ...bridge.getSnapshot().worldStage, residentStory: updated } });
      window.dispatchEvent(new Event('focus')); // confere o pedido oficial e o catálogo após aceitar
      if (action === 'ack') onClose();
    } catch { setError('Não foi possível confirmar a conversa. Confira a conexão e tente novamente.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-3">
    <div id="resident-story-modal" className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-emerald-700 bg-emerald-950 p-5 text-white">
      <button type="button" id="btn-resident-story-close-top" disabled={busy} onClick={onClose} aria-label="Fechar conversa" className="float-right ml-2 min-h-11 min-w-11 rounded-lg border border-emerald-700 text-xl">×</button>
      <p className="text-xs font-bold uppercase text-emerald-300">História do bairro · Dona Maria</p>
      <h2 className="mt-1 text-xl font-bold">{MARIA_STORY_TITLE}</h2>
      {!story ? <p className="mt-3" role="status">Conferindo a história…</p> : <>
        {story.status === 'available' && <>
          <p className="mt-3">“Bernardo, a entrada da minha casa está tão vazia… Quero começar um cantinho verde para receber quem vem me visitar. Você traz uma planta da sua loja?”</p>
          <p className="mt-3 text-sm text-emerald-200">Escolheremos uma planta disponível do seu catálogo, com o nome, a foto e o preço que você cadastrou. Ao entregá-la, o cantinho dela vai mudar no bairro.</p>
          {active && <p className="mt-2 text-sm text-amber-200">Você já está atendendo {active.customerName}. Termine essa entrega; a encomenda de Dona Maria será a próxima, conforme o estoque disponível.</p>}
          <button id="btn-accept-resident-story" disabled={busy} onClick={() => void act('accept')} className="mt-4 min-h-11 w-full rounded-xl bg-amber-400 px-4 font-bold text-stone-950">{busy ? 'Confirmando…' : 'Vou ajudar seu cantinho verde'}</button>
        </>}
        {story.status === 'waiting' && <>
          <p className="mt-3">“Obrigada por me ajudar! Já estou escolhendo o lugar do vaso.”</p>
          <p className="mt-3 text-sm text-emerald-200">{active ? `Conclua primeiro a encomenda de ${active.customerName}. O pedido de Dona Maria ocupa a próxima vaga.` : 'O pedido vai aparecer assim que houver uma planta com estoque disponível. Confira seu catálogo para continuar.'}</p>
          {!active && <button id="btn-story-catalog" className="mt-3 min-h-11 w-full rounded-xl bg-emerald-800" onClick={() => { onClose(); navigate?.(); }}>Conferir minhas plantas</button>}
          <button id="btn-retry-resident-story" disabled={busy} onClick={() => void act('accept')} className="mt-2 min-h-11 w-full rounded-xl bg-emerald-800">{busy ? 'Conferindo…' : 'Conferir encomenda'}</button>
        </>}
        {story.status === 'ordered' && <>
          <p className="mt-3">“{story.plantName} vai começar meu cantinho! Estou esperando você na entrada de casa.”</p>
          <p className="mt-3 text-sm text-emerald-200">{ownOrder && active.status === 'pronto' ? 'A planta está com Bernardo. Saia da Novo Hiper e use Partir para entrega para atravessar a plataforma até a casa de Dona Maria.' : 'Entre na Novo Hiper e retire a planta na bancada PREPARO. Depois, parta para a entrega pela plataforma ou pelo bairro.'}</p>
          <p className="mt-2 text-xs text-emerald-200">A história avança quando você confirmar a entrega com Dona Maria. A plataforma sozinha não conclui a encomenda.</p>
        </>}
        {story.status === 'completed' && <>
          <p className="mt-3">“Olha como ficou, Bernardo! {story.plantName} já está na entrada. Agora quem passa por aqui encontra um cantinho mais acolhedor. Foi a sua loja que começou esse jardim!”</p>
          <p className="mt-3 text-sm text-emerald-200">O vaso e a identificação da planta ficam no jardim de Dona Maria, mesmo depois de sair do jogo. Você pode voltar para conversar e rever esta história.</p>
        </>}
        {story.plantPhotoUrl && <div className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-900 p-3"><img id="resident-story-photo" src={story.plantPhotoUrl} alt={story.plantName || 'Planta do cantinho'} className="h-20 w-20 rounded-lg object-cover" /><div><p className="font-bold">{story.plantName}</p><p className="text-xs text-emerald-200">Da sua Novo Hiper para o cantinho de Dona Maria</p></div></div>}
        {story.status === 'completed' && <button id="btn-finish-resident-story" disabled={busy} onClick={() => void act('ack')} className="mt-4 min-h-11 w-full rounded-xl bg-amber-400 px-4 font-bold text-stone-950">{busy ? 'Guardando…' : 'Ver o cantinho no bairro'}</button>}
      </>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      <button id="btn-close-resident-story" disabled={busy} onClick={onClose} className="mt-2 min-h-11 w-full rounded-xl border border-emerald-700">Continuar no bairro</button>
    </div>
  </div>;
}
