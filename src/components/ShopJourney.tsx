import type { CashRegister, CustomerOrder, DeliveryRecord, Plant } from '../types';
import { JOURNEY_STEPS, shopJourney } from '../logic/shopJourney';
import { pickActiveOrder } from '../phaser-game/logic/activeOrder';
import { formatPrice } from '../services/storage';

export function ShopJourney({ plants, orders, deliveries, cash, connected, onAddPlant, onCatalog, onAdventure, onCash }: {
  plants: Plant[]; orders: CustomerOrder[]; deliveries: DeliveryRecord[]; cash: CashRegister; connected: boolean;
  onAddPlant: () => void; onCatalog: () => void; onAdventure: () => void; onCash: () => void;
}) {
  const order = pickActiveOrder(orders);
  const delivered = deliveries.length > 0 || orders.some(o => o.status === 'entregue');
  const journey = shopJourney({ plants, order, delivered });
  const lastSale = cash.salesHistory.reduce<CashRegister['salesHistory'][number] | null>((latest, sale) => !latest || sale.timestamp > latest.timestamp ? sale : latest, null);
  const plant = plants.find(p => p.id === order?.plantId) ?? plants[0];
  const photo = order?.plantPhotoUrl || plant?.photoUrl;
  const name = order?.plantName || plant?.name;
  const action = journey.step === 'register' ? onAddPlant : journey.step === 'stock' ? onCatalog : onAdventure;
  return <section id="shop-journey" aria-label="Da sua planta ao bairro" className="mb-6 overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-sm">
    <div className="p-4 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Da sua planta ao bairro</p>
      <h2 className="mt-1 text-xl font-bold text-stone-900">{connected ? journey.title : 'Conferindo sua loja…'}</h2>
      <p className="mt-2 max-w-2xl text-sm text-stone-600">{connected ? journey.description : 'Vamos consultar o catálogo, os pedidos e o caixa para mostrar seu próximo passo.'}</p>
      {connected && <>
        <ol aria-label="Etapas da jornada" className="my-4 flex flex-wrap gap-2 text-xs">
          {JOURNEY_STEPS.map((step, index) => <li key={step} aria-current={index === journey.index ? 'step' : undefined} className={`rounded-full px-3 py-2 ${index === journey.index ? 'bg-emerald-800 font-bold text-white' : 'bg-stone-100 text-stone-600'}`}>{index + 1}. {step}</li>)}
        </ol>
        {name && <div id="journey-product" className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3">
          {photo && <img src={photo} alt={name} className="h-16 w-16 rounded-xl object-cover" loading="lazy" />}
          <div className="min-w-0"><p className="text-xs text-emerald-800">{order ? `Pedido #${order.orderNumber} · ${order.customerName}` : 'Da sua vitrine para o jogo'}</p><p className="font-bold text-stone-900 break-words">{name}</p><p className="text-sm text-stone-600">{order ? `${order.quantity} vaso(s) · total ${formatPrice(order.totalPrice)}` : `${formatPrice(plant.price)} · ${plant.stock} vaso(s) disponíveis`}</p></div>
        </div>}
        {lastSale && <div id="journey-last-sale" className="mb-4 rounded-xl border border-emerald-100 p-3 text-sm text-stone-700"><p className="font-bold text-emerald-900">Sua última entrega ficou registrada</p><p>{lastSale.plantName} · {lastSale.customerName} · {formatPrice(lastSale.value)}</p>{plants.length === 1 && <p className="mt-2">Quer ampliar sua loja? Cadastre outra planta para os moradores conhecerem uma nova opção.</p>}<button id="btn-journey-cash" type="button" onClick={onCash} className="mt-2 min-h-11 underline">Conferir no caixa</button>{plants.length === 1 && <button type="button" onClick={onAddPlant} className="ml-3 min-h-11 underline">Cadastrar outra planta</button>}</div>}
        <div className="flex flex-wrap gap-2">
          <button id="btn-journey-next" type="button" onClick={action} className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white">{journey.step === 'register' ? 'Fotografar minha primeira planta' : journey.step === 'stock' ? 'Conferir meu estoque' : journey.step === 'grow' ? 'Continuar minha loja no bairro' : order ? 'Continuar este pedido no jogo' : 'Conhecer minha loja no jogo'}</button>
          {journey.step === 'grow' && <><button type="button" onClick={onCash} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm">Conferir caixa · {formatPrice(cash.balance)}</button><button type="button" onClick={onAddPlant} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm">Cadastrar outra planta</button></>}
        </div>
      </>}
    </div>
    <details id="journey-records" className="border-t border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-stone-700 sm:px-6">
      <summary className="cursor-pointer font-semibold min-h-6">Como o jogo usa minha loja?</summary>
      <p className="mt-2">As plantas, fotos, preços e quantidades vêm do seu cadastro. Os personagens do bairro podem gerar pedidos usando esse catálogo. Pegar a planta e jogar a plataforma não movimenta o caixa.</p>
      <p className="mt-2">Ao confirmar a entrega, o sistema registra uma venda, baixa o estoque e acrescenta o valor ao caixa deste mesmo painel. Esse saldo virtual é um registro interno do aplicativo. O jogo não recebe pagamentos nem comprova uma venda fora dele.</p>
    </details>
  </section>;
}
