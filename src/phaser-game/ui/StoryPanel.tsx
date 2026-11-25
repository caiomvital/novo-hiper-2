import { useEffect, useRef, useState } from 'react';
import type { AdventureBridge, AdventureSnapshot } from '../bridge/adventureBridge';
import type { InputState } from '../input/InputState';
import { api, type ShopSnapshot } from '../../services/api';
import { useModalFocus } from '../../hooks/useModalFocus';
import type { Plant } from '../../types';
import { shopJourney } from '../../logic/shopJourney';
import { formatPrice } from '../../services/storage';
import { MARIA_STORY_TITLE } from '../../shared/residentStory';

export function StoryPanel({ compact, shop, plants, bridge, input, mode, shopOpen, startRoute, navigate }: { compact: boolean; shop: ShopSnapshot | null; plants: Plant[]; bridge: AdventureBridge; input: InputState; mode: string; shopOpen: boolean; startRoute: () => void; navigate?: (tab: 'catalogo' | 'pedidos') => void }) {
  const [snap, setSnap] = useState(bridge.getSnapshot());
  const [receipt, setReceipt] = useState<AdventureSnapshot['lastDelivery']>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [compact, mode]);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  useEffect(() => bridge.subscribe(value => { setSnap(value); if (value.phase === 'done' && value.lastDelivery) setReceipt(value.lastDelivery); }), [bridge]);
  useEffect(() => { if (mode === 'interior') setReceipt(null); }, [mode]);
  const celebrating = Boolean(snap.worldStage.arcCompletedAt && !snap.worldStage.arcSeen && !dismissed && mode === 'world' && !shopOpen && snap.phase === 'idle');
  useEffect(() => {
    if (!celebrating) return;
    input.setSuspended(true); bridge.setSnapshot({ uiOpen: true });
    return () => { input.setSuspended(false); bridge.setSnapshot({ uiOpen: false }); };
  }, [celebrating, bridge, input]);
  useModalFocus(celebrating, 'story-celebration', 'Novo Hiper ganhou vida', () => { if (!busy) setDismissed(true); });
  if (celebrating) return <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-4">
    <div id="story-celebration" className="max-h-full overflow-auto w-full max-w-md rounded-2xl bg-emerald-950 p-5 text-white">
      <h2 className="text-2xl font-bold">A Novo Hiper ganhou vida!</h2>
      <p className="mt-3">Você levou plantas aos moradores e deixou sua loja mais bonita. Obrigado, Bernardo!</p>
      <p className="mt-2">Este é o fim da primeira aventura. Você pode continuar recebendo pedidos, entregando e cuidando da loja.</p>
      {error && <p role="alert" className="mt-3">Não foi possível guardar sua confirmação. Tente novamente ou feche o aviso.</p>}
      <button id="btn-story-continue" disabled={busy} className="mt-4 min-h-11 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-stone-950" onClick={async () => {
        if (locked.current) return; locked.current = true; setBusy(true); setError(false);
        try { await api.acknowledgeStory(); setDismissed(true); } catch { setError(true); }
        finally { locked.current = false; setBusy(false); }
      }}>{busy ? 'Confirmando…' : 'Continuar cuidando da loja'}</button>
      {error && <button className="mt-2 min-h-11 w-full" onClick={() => setDismissed(true)}>Fechar aviso</button>}
    </div>
  </div>;
  if (mode === 'platform' || !snap.loaded || snap.uiOpen) return null;
  const order = snap.activeOrder;
  const returning = Boolean(receipt && snap.navigationGoal === 'store');
  const journey = shopJourney({ plants, order, delivered: Boolean(snap.worldStage.firstDeliveryAt), returning: snap.phase === 'done' || returning });
  const storyOrder = order && order.id === snap.worldStage.residentStory?.orderId;
  const photo = returning ? receipt!.order.plantPhotoUrl : order?.plantPhotoUrl;
  let text = journey.description;
  if (mode === 'interior' && order?.status === 'pronto') text = 'A planta está com você. Saia pela porta de baixo; no bairro, escolha Partir para entrega ou siga a seta até o cliente.';
  else if (mode === 'interior' && order && order.deliverable !== false) text = 'Vá à bancada PREPARO, à direita, e aperte E ou o botão de interação para pegar a planta.';
  if (snap.pendingUpgrades.length && !order) text = 'Sua melhoria já é sua! Volte à Novo Hiper e instale no balcão.';
  if (snap.navigationGoal) text = snap.navigationGoal === 'store'
    ? (snap.pendingUpgrades.length ? 'Siga a seta até a Novo Hiper e instale sua melhoria no balcão.' : 'Siga a seta até a Novo Hiper. Confira o resultado e sua vitrine. Depois, visite a Loja de Utilidades para escolher uma melhoria.')
    : 'Siga a seta até a Loja de Utilidades. Compre uma melhoria e leve-a ao balcão da Novo Hiper para instalar.';
  const nextUpgrade = shop?.upgrades.find(upgrade => upgrade.state === 'pending') ?? shop?.upgrades.find(upgrade => upgrade.state === 'available');
  const buttonClass = 'min-h-11 shrink-0 rounded-xl bg-amber-400 px-3 font-bold text-stone-950';
  const actions = (<div className="flex shrink-0 flex-col gap-1">
      {snap.navigationGoal
        ? <button id="btn-cancel-shop-guide" className={buttonClass} onClick={() => bridge.setSnapshot({ navigationGoal: null })}>Cancelar orientação</button>
        : (journey.step === 'register' || journey.step === 'stock')
          ? <button className={buttonClass} onClick={() => navigate?.('catalogo')}>Abrir catálogo</button>
          : snap.pendingUpgrades.length > 0 && !order
            ? <button id="btn-guide-store" className={buttonClass} onClick={() => bridge.setSnapshot({ navigationGoal: 'store' })}>Instalar na Novo Hiper</button>
            : !order || snap.phase === 'done'
              ? <button id="btn-guide-utilities" className={buttonClass} onClick={() => bridge.setSnapshot({ navigationGoal: 'utilities' })}>Melhorar minha loja</button>
              : order.status === 'pronto' && snap.phase === 'idle' && mode === 'world'
                ? <button id="btn-start-delivery-route" onClick={startRoute} className={buttonClass}>Partir para entrega</button>
                : mode === 'world' && order.status !== 'pronto'
                  ? <button id="btn-guide-store" className={buttonClass} onClick={() => bridge.setSnapshot({ navigationGoal: 'store' })}>Encontrar minha loja</button>
                  : null}
      {snap.navigationGoal === 'store' && !snap.pendingUpgrades.length && (snap.phase === 'done' || !order || returning) && <button id="btn-guide-utilities" className={buttonClass} onClick={() => bridge.setSnapshot({ navigationGoal: 'utilities' })}>Melhorar minha loja</button>}
      </div>);
  return <div id="story-guidance" data-expanded={expanded} className="relative z-40 shrink-0 border-b border-emerald-700 bg-emerald-950 px-3 py-2 text-xs text-white">
    {compact && <div className="mission-summary flex items-center gap-2">
      <button id="btn-mission-details" type="button" aria-expanded={expanded} aria-controls="story-guidance-details" onClick={() => setExpanded(value => !value)} className="min-h-11 shrink-0 rounded-lg bg-emerald-800 px-3 font-bold">{expanded ? 'Fechar missão' : 'Missão'}</button>
      <p className="min-w-0 flex-1 truncate font-bold" title={journey.title}>{storyOrder ? MARIA_STORY_TITLE : journey.title}</p>
      {actions}
    </div>}
    {(!compact || expanded) && <div id="story-guidance-details" className="mission-details">
    <div className="flex items-center justify-between gap-2">
      {photo && <img id="adventure-order-photo" src={photo} alt={returning ? receipt!.order.plantName : order!.plantName} className="h-10 w-10 shrink-0 rounded-lg object-cover" />}
      <div className="min-w-0 flex-1">
        {storyOrder && <p id="resident-story-objective" className="text-[10px] font-bold text-amber-200">{MARIA_STORY_TITLE}</p>}
        <p className="text-[10px] font-bold uppercase text-emerald-300">{journey.index + 1}/5 · {journey.title}</p>
        <p className="mt-1">{text}</p>
        {returning ? <p id="delivery-receipt" className="mt-1 text-emerald-200">{receipt!.order.plantName} · {formatPrice(receipt!.reward)} registrados no caixa · estoque atualizado</p> : order && <p className="mt-1 text-emerald-200">Pedido #{order.orderNumber} · {order.quantity ?? 1} vaso(s) · {formatPrice(order.total)}</p>}
      </div>
      {!compact && actions}
    </div>
    {mode === 'interior' && <div id="store-vitrine" className="mt-2 border-t border-emerald-800 pt-2">
      <div className="flex items-center justify-between gap-2"><p className="font-bold text-emerald-200">Vitrine da sua loja · {plants.length} planta(s)</p><button type="button" onClick={() => navigate?.('catalogo')} className="min-h-11 underline">Editar catálogo</button></div>
      {plants.length ? <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Plantas cadastradas na vitrine">{plants.map(plant => <div key={plant.id} data-plant-id={plant.id} className="flex w-40 shrink-0 items-center gap-2 rounded-lg bg-emerald-900 p-2">
        <img src={plant.photoUrl} alt={plant.name} loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />
        <div className="min-w-0"><p className="truncate font-semibold">{plant.name}</p><p>{formatPrice(plant.price)}</p><p className="text-[10px] text-emerald-200">{plant.stock} vaso(s)</p></div>
      </div>)}</div> : <p>A primeira foto que você cadastrar aparecerá aqui.</p>}
    </div>}
    {snap.worldStage.residentStory?.status === 'completed' && shop && <details id="journey-next-goal" open={compact} className="mt-2 rounded-xl border border-emerald-700 bg-emerald-900 px-3" data-upgrade={nextUpgrade?.id ?? 'catalogo'}>
      <summary className="min-h-11 cursor-pointer py-3 font-bold text-amber-200">Próxima conquista: {nextUpgrade?.name ?? 'ampliar sua vitrine'}</summary>
      <p className="text-emerald-100">{nextUpgrade ? 'O cantinho de Dona Maria já mudou. Agora leve esse cuidado para a sua Novo Hiper.' : 'Sua loja já está equipada. Fotografe outra planta e coloque uma nova opção na vitrine para os moradores.'}</p>
      {nextUpgrade && (nextUpgrade.state === 'pending' ? <p className="mt-2">Você já comprou esta melhoria. Instale no balcão para ver a loja mudar.</p> : <p className="mt-2">Preço: {formatPrice(nextUpgrade.price)} · seu caixa: {formatPrice(shop.balance)}. {shop.balance >= nextUpgrade.price ? 'Você já pode comprar esta melhoria.' : `Faltam ${formatPrice(nextUpgrade.price - shop.balance)}. Continue atendendo os moradores para juntar esse valor.`}</p>)}
      <button id="btn-next-goal-guide" type="button" className="my-3 min-h-11 rounded-xl bg-amber-400 px-3 font-bold text-stone-950" onClick={() => { if (!nextUpgrade) navigate?.('catalogo'); else bridge.setSnapshot({ navigationGoal: nextUpgrade.state === 'pending' ? 'store' : 'utilities' }); setExpanded(false); }}>{!nextUpgrade ? 'Abrir catálogo e ampliar' : nextUpgrade.state === 'pending' ? 'Ir ao balcão instalar' : 'Conhecer a Loja de Utilidades'}</button>
    </details>}
    </div>}
  </div>;
}
