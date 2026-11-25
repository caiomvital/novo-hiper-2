// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TouchControls } from '../../src/phaser-game/ui/TouchControls';
import { InputState } from '../../src/phaser-game/input/InputState';
let host: HTMLDivElement, root: Root, input: InputState;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); host=document.createElement('div');document.body.append(host);root=createRoot(host);input=new InputState(); });
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const render = async(mode:'world'|'platform'|'interior') => act(async()=>root.render(React.createElement(TouchControls,{mode,inputState:input})));
function touch(target: Element, type: string, points: {identifier:number;clientX:number;clientY:number}[], changed=points){
 const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{touches:{value:points},changedTouches:{value:changed}});act(()=>target.dispatchEvent(event));
}
it('arrastar o mesmo dedo muda de direção, permite diagonal e soltar cancela todos os eixos',async()=>{
 await render('world');
 const pad=host.querySelector('#adventure-dpad')!;
 Object.defineProperty(pad,'getBoundingClientRect',{value:()=>new DOMRect(0,0,132,132)});
 const button=host.querySelector('[aria-label="Andar para a direita"]')!;
 touch(button,'touchstart',[{identifier:1,clientX:110,clientY:66}]);
 expect(input.snapshot.right).toBe(true);expect(input.snapshot.up).toBe(false);
 touch(button,'touchmove',[{identifier:1,clientX:110,clientY:22}]);
 expect(input.snapshot.right&&input.snapshot.up).toBe(true);expect(input.snapshot.left).toBe(false);
 touch(button,'touchmove',[{identifier:1,clientX:22,clientY:22}]);
 expect(input.snapshot.left&&input.snapshot.up).toBe(true);expect(input.snapshot.right).toBe(false);
 touch(button,'touchend',[],[{identifier:1,clientX:22,clientY:22}]);
 expect(Object.values(input.snapshot).some(Boolean)).toBe(false);
});
it('cancelar o toque e trocar de cena não deixam movimento preso',async()=>{
 await render('world');const button=host.querySelector('[aria-label="Andar para a direita"]')!;
 touch(button,'touchstart',[]);expect(input.snapshot.right).toBe(true);
 touch(button,'touchcancel',[]);expect(input.snapshot.right).toBe(false);
 touch(button,'touchstart',[]);await render('interior');expect(input.snapshot.right).toBe(false);
});
it('dois dedos mantêm andar e pular independentes na plataforma',async()=>{
 await render('platform');const right=host.querySelector('[aria-label="Andar para a direita"]')!,jump=host.querySelector('[aria-label="Pular"]')!;
 touch(right,'touchstart',[]);touch(jump,'touchstart',[]);expect(input.snapshot.right&&input.snapshot.jump).toBe(true);
 touch(jump,'touchend',[]);expect(input.snapshot.right).toBe(true);expect(input.snapshot.jump).toBe(false);
 touch(right,'touchend',[]);expect(input.snapshot.right).toBe(false);
});
