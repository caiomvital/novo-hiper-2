import { expect, test, type Page } from '@playwright/test';
import { enterStore, leaveStore, login, openAdventure, state, teleport, waitForScene } from './helpers';

test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
async function canvasFits(page: Page, minHeight: number) {
  await expect.poll(() => page.evaluate(() => {
    const canvas = document.querySelector('#adventure-root canvas')!.getBoundingClientRect();
    const field = document.getElementById('adventure-playfield')!.getBoundingClientRect();
    return Math.abs(canvas.height-field.height) + Math.abs(canvas.width-field.width);
  })).toBeLessThan(3);
  const box = (await page.locator('#adventure-root canvas').boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(minHeight);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}
async function buttonsReachable(page: Page, names: string[]) {
  const buttons = await page.evaluate(labels => labels.map(name => {
    const el = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(button => button.getAttribute('aria-label') === name)!;
    const r = el.getBoundingClientRect();
    return { name, width: r.width, height: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, hit: el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) };
  }), names);
  for (const button of buttons) {
    expect(button.inside,button.name).toBe(true);expect(button.hit,button.name).toBe(true);
    expect(button.width,button.name).toBeGreaterThanOrEqual(44);expect(button.height,button.name).toBeGreaterThanOrEqual(44);
  }
}
test('bairro, interior, missão e conversa cabem no celular deitado sem fullscreen', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page);
  expect((await page.locator('.shop-header').boundingBox())!.height).toBeLessThanOrEqual(64);
  await openAdventure(page);
  const instance = (await state(page)).instance;
  await expect(page.locator('#adventure-root')).toHaveAttribute('data-compact','true');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await canvasFits(page, 280);
  await buttonsReachable(page,['Andar para cima','Andar para baixo','Andar para a esquerda','Andar para a direita','Interagir']);
  await page.screenshot({path:'docs/evidence/mobile-landscape/after-world.png'});
  // Um único dedo muda de direção e faz diagonal sem soltar o direcional.
  await teleport(page, 1790, 1100);
  const pad = (await page.locator('#adventure-dpad').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const origin = (await state(page)).player!;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:pad.x+pad.width*5/6,y:pad.y+pad.height/2}]});
  await page.waitForFunction(x => (window.__NH_ADVENTURE__?.getState().player?.x??0)>x+8, origin.x);
  const y = (await state(page)).player!.y;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:pad.x+pad.width*5/6,y:pad.y+pad.height/6}]});
  await expect(page.locator('#adventure-dpad')).toHaveAttribute('data-directions', /up/);
  await expect(page.locator('#adventure-dpad')).toHaveAttribute('data-directions', /right/);
  await page.waitForFunction(start => (window.__NH_ADVENTURE__?.getState().player?.y??9999)<start-5, y);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().sprite?.anim.startsWith('idle'));
  const stopped = (await state(page)).player!;
  await page.waitForTimeout(120);
  expect(Math.hypot((await state(page)).player!.x-stopped.x,(await state(page)).player!.y-stopped.y)).toBeLessThan(1);
  await page.locator('#btn-mission-details').click();
  await expect(page.locator('#story-guidance-details')).toBeVisible();
  await canvasFits(page, 280);
  await page.locator('#btn-mission-details').click();
  await page.locator('#btn-resident-story').click();
  await expect(page.locator('#resident-story-modal h2')).toBeInViewport({ratio:1});
  await page.locator('#btn-resident-story-close-top').click();
  expect((await state(page)).instance).toBe(instance);
  await enterStore(page);
  const interiorInstance = (await state(page)).instance;
  await canvasFits(page,280);
  await page.locator('#btn-mission-details').click();
  await expect(page.locator('#store-vitrine')).toBeVisible();
  await canvasFits(page,280);
  await page.screenshot({path:'docs/evidence/mobile-landscape/after-interior-details.png'});
  await page.locator('#btn-mission-details').click();
  await page.screenshot({path:'docs/evidence/mobile-landscape/after-interior.png'});
  await page.setViewportSize({width:568,height:320});
  await canvasFits(page,210);
  await buttonsReachable(page,['Andar para cima','Andar para baixo','Andar para a direita','Interagir']);
  await page.screenshot({path:'docs/evidence/mobile-landscape/after-small-landscape.png'});
  expect((await state(page)).instance).toBe(interiorInstance);
  expect(await page.evaluate(() => window.__NH_ADVENTURE__!.liveGames())).toBe(1);
  await page.getByTitle('Voltar para a loja',{exact:true}).click();
  await expect(page.locator('#shop-journey')).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  expect((await page.locator('.shop-header').boundingBox())!.height).toBeLessThanOrEqual(64);
  expect(errors).toEqual([]);
});

test('plataforma aceita andar e pular juntos e preserva mapa ao girar e ajustar zoom', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror',error=>errors.push(error.message));
  await login(page); await openAdventure(page);
  await page.locator('#btn-jump-park').click(); await waitForScene(page,'platform');
  await canvasFits(page,280);
  await page.waitForFunction(() => window.__NH_ADVENTURE__?.getState().platform?.grounded);
  const before = await state(page);
  await buttonsReachable(page,['Andar para a direita','Andar para a esquerda','Pular','Diminuir zoom','Restaurar zoom','Aumentar zoom']);
  const right=(await page.getByRole('button',{name:'Andar para a direita',exact:true}).boundingBox())!;
  const jump=(await page.getByRole('button',{name:'Pular',exact:true}).boundingBox())!;
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:right.x+right.width/2,y:right.y+right.height/2},{id:2,x:jump.x+jump.width/2,y:jump.y+jump.height/2}]});
  await page.waitForFunction(start=>{const p=window.__NH_ADVENTURE__?.getState().player;return p&&p.x>start.x+8&&p.y<start.y-20;},before.player!);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.locator('#btn-platform-zoom-out').click();
  await expect.poll(async()=>(await state(page)).platform?.zoom).toBe(1);
  for(const size of [{width:412,height:820},{width:844,height:390}]){
    await page.setViewportSize(size);
    await expect(page.locator('#adventure-root')).toHaveAttribute('data-compact',size.width>size.height?'true':'false');
    await canvasFits(page,280);
    expect((await state(page)).platform!.seed).toBe(before.platform!.seed);
    expect((await state(page)).platform!.visit).toBe(before.platform!.visit);
    expect(await page.evaluate(()=>window.__NH_ADVENTURE__!.liveGames())).toBe(1);
  }
  await page.screenshot({path:'docs/evidence/mobile-landscape/after-platform.png'});
  await page.locator('#btn-platform-exit').click();await waitForScene(page,'world');
  await canvasFits(page,280);
  expect(errors).toEqual([]);
});
