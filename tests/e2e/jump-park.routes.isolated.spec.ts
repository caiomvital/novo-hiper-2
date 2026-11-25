import { expect, test } from '@playwright/test';
import { login, openAdventure, state, teleport, waitForScene, runToGoal } from './helpers';
import { closeSuiteOrders, createSuiteOrder, suiteId } from './suiteData';
import { PLATFORM } from '../../src/phaser-game/config/platformConfig';

test.use({ hasTouch:true,viewport:{width:760,height:440} });
test('parque maior, caminho alto, trampolim, queda e saída preservam a entrega carregada',async({page})=>{
 test.setTimeout(360_000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await login(page);await closeSuiteOrders(page);
 const plant=await(await page.request.post('/api/plants',{data:{id:suiteId('park'),name:'Planta do parque',price:35,stock_quantity:5,image_path:'/pwa-192x192.png'}})).json();
 const order=await createSuiteOrder(page,{plantId:plant.id,destination:'bairro1/house_007'});
 expect((await page.request.post('/api/deliveries/start',{data:{order_id:order.id}})).ok()).toBe(true);
 const cash=await(await page.request.get('/api/cash')).json();
 await openAdventure(page);await expect(page.locator('#adventure-loading')).toBeHidden();
 await page.waitForFunction(id=>window.__NH_ADVENTURE__?.getState().delivery?.activeOrderId===id,order.id);
 await page.locator('#btn-adventure-fullscreen').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));
 await page.evaluate(()=>{
  const original=crypto.getRandomValues.bind(crypto);
  (crypto as any).getRandomValues=(array:any)=>{if(array instanceof Uint32Array&&array.length===1){(crypto as any).getRandomValues=original;array[0]=3946347154;return array;}return original(array);};
 });
 await page.locator('#btn-jump-park').click();await waitForScene(page,'platform');
 const initial=(await state(page)).platform!;
 expect(initial.seed).toBe(3946347154);expect(initial.space).toBe('park');expect(initial.levelWidth).toBe(7200);expect(initial.gaps).toHaveLength(8);expect(initial.ledges!.length).toBeGreaterThan(12);
 expect(initial.goalHouse!.baseline).toBeCloseTo(PLATFORM.groundY,0);expect(initial.goalHouse!.rotation).toBe(0);expect(initial.goalHouse!.texture).toBe('platform-house-front');
 await page.waitForFunction(()=>window.__NH_ADVENTURE__?.getState().platform?.grounded);
 async function settleCamera(){
  await page.evaluate(()=>{delete (window as any).__parkCamera;});
  await page.waitForFunction(()=>{const c=window.__NH_ADVENTURE__?.getState().camera;if(!c)return false;const previous=(window as any).__parkCamera;const stable=previous&&Math.abs(c.scrollX-previous.x)<.6&&Math.abs(c.scrollY-previous.y)<.6?previous.stable+1:0;(window as any).__parkCamera={x:c.scrollX,y:c.scrollY,stable};return stable>=5;});
 }
 await settleCamera();
 await page.screenshot({path:'docs/evidence/jump-park/entrada.png'});
 // Usa os mesmos eventos de teclado do jogador para subir três degraus, sem teletransportar para cima.
 const stepped=await page.evaluate(()=>new Promise<boolean>(resolve=>{
  const input=(code:string,down:boolean)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));
  const ledges=window.__NH_ADVENTURE__!.getState().platform!.ledges!.slice(0,3);
  let step=0,jumping=false,released=false;const started=performance.now();
  const finish=(ok:boolean)=>{input('Space',false);input('ArrowRight',false);resolve(ok);};
  const tick=()=>{
   const s=window.__NH_ADVENTURE__!.getState(),target=ledges[step],x=target.x+56;
   if(performance.now()-started>45000)return finish(false);
   if(!jumping&&s.platform?.grounded){input('Space',true);jumping=true;}
   if(jumping&&!s.platform?.grounded&&!released){input('Space',false);released=true;}
   input('ArrowRight',s.player!.x<x-2);
   if(released&&s.platform?.grounded&&Math.abs(s.player!.y-(target.y-22))<4){step++;jumping=false;released=false;if(step===ledges.length)return finish(true);}
   requestAnimationFrame(tick);
  };requestAnimationFrame(tick);
 }));
 expect(stepped).toBe(true);
 await page.screenshot({path:'docs/evidence/jump-park/caminho-alto.png'});
 const pad=initial.bouncePads![0];
 await teleport(page,pad.x,pad.y-22);
 await page.waitForFunction(()=> (window.__NH_ADVENTURE__?.getState().platform?.springBounces??0)>0);
 await page.waitForFunction(y=>(window.__NH_ADVENTURE__?.getState().player?.y??999)<y-130,pad.y-22);
 await page.screenshot({path:'docs/evidence/jump-park/trampolim.png'});
 const cp=initial.checkpoints![3];await teleport(page,cp.x+180,cp.y-22);
 await page.waitForFunction(x=>Math.abs((window.__NH_ADVENTURE__?.getState().lastSafeGround?.x??0)-x)<5,cp.x+180);
 await teleport(page,initial.gaps![3].start+20,950);await page.waitForFunction(()=>(window.__NH_ADVENTURE__?.getState().fallRespawns??0)>0);
 expect((await state(page)).player!.x).toBeCloseTo(cp.x+180,0);
 await teleport(page,initial.goal!.x-140,PLATFORM.groundY-22);
 await settleCamera();
 await page.screenshot({path:'docs/evidence/jump-park/casa-nivelada.png'});
 // Percorre o mapa inteiro com controles reais depois de testar os elementos opcionais.
 await teleport(page,120,PLATFORM.groundY-22);
 await page.setViewportSize({width:480,height:360});
 await runToGoal(page,150_000);
 await page.setViewportSize({width:760,height:440});
 await page.waitForFunction(()=>window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
 await settleCamera();
 await page.screenshot({path:'docs/evidence/jump-park/chegada.png'});

 await page.waitForFunction(()=>window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
 await page.keyboard.press('Enter');await waitForScene(page,'world');
 expect((await state(page)).delivery?.activeOrderId).toBe(order.id);
 expect((await(await page.request.get('/api/cash')).json()).balance).toBe(cash.balance);
 expect((await(await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(5);
 // O treino curto e a entrega continuam disponíveis, separados da exploração.
 await page.locator('#btn-start-delivery-route').click();await waitForScene(page,'platform');
 expect((await state(page)).platform?.space).toBe('delivery');expect((await state(page)).platform?.levelWidth).toBe(2400);
 await runToGoal(page,90_000);await page.waitForFunction(()=>window.__NH_ADVENTURE__?.getState().platform?.confirmationVisible);
 await page.keyboard.press('Enter');await waitForScene(page,'world');await page.waitForFunction(()=>window.__NH_ADVENTURE__?.getState().delivery?.near);
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__NH_ADVENTURE__?.getState().delivery?.phase==='done');
 const after=await(await page.request.get('/api/cash')).json();expect(after.balance).toBe(cash.balance+35);expect(after.transactions.filter((t:any)=>t.order_id===order.id)).toHaveLength(1);
 expect((await(await page.request.get(`/api/plants/${plant.id}`)).json()).stock_quantity).toBe(4);expect(errors).toEqual([]);
});
