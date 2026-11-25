import { describe, expect, it } from 'vitest';
import { generateJumpPark, jumpParkAdventure, jumpParkPads, JUMP_PARK_WIDTH } from '../../src/phaser-game/config/jumpPark';
import { PLATFORM, getGaps } from '../../src/phaser-game/config/platformConfig';
import { isGapSafelyCrossable, jumpHeight } from '../../src/phaser-game/logic/jumpPhysics';
import { isSafeCheckpoint } from '../../src/phaser-game/logic/fall';
import { readFileSync, statSync } from 'node:fs';

describe('parque alternativo de saltos', () => {
 it('600 sementes preservam chão, saltos, chegada e trampolins seguros no mapa maior', () => {
  for(let seed=0;seed<600;seed++){
   const route=generateJumpPark(seed*10103), layout=jumpParkAdventure(route), pads=jumpParkPads(route);
   expect(route.levelWidth).toBe(JUMP_PARK_WIDTH);expect(route.space).toBe('park');
   expect(route.segments[0].x).toBe(0);expect(route.segments.at(-1)!.x+route.segments.at(-1)!.width).toBe(JUMP_PARK_WIDTH);
   expect(route.segments.every(s=>s.width>=500)).toBe(true);
   for(const gap of getGaps(route.segments))expect(isGapSafelyCrossable(gap.width)).toBe(true);
   expect(isSafeCheckpoint(JUMP_PARK_WIDTH-220,PLATFORM.groundY-22,route.segments)).toBe(true);
   for(const cp of layout.checkpoints)expect(isSafeCheckpoint(cp.x,cp.y-22,route.segments)).toBe(true);
   for(const pad of pads){expect(isSafeCheckpoint(pad.x,pad.y-22,route.segments)).toBe(true);expect(Math.abs(pad.x-layout.cart.center)).toBeGreaterThan(150);}
   expect(layout.ledges.length).toBeGreaterThan(12);expect(layout.flowers.length).toBeGreaterThan(10);
   for(let i=0;i<16;i+=4){let previousY:number=PLATFORM.groundY;for(const ledge of layout.ledges.slice(i,i+4)){expect(previousY-ledge.y).toBeLessThan(jumpHeight()-20);previousY=ledge.y;}}
   for(const ledge of layout.ledges){expect(ledge.x).toBeGreaterThan(0);expect(ledge.x+ledge.width).toBeLessThan(JUMP_PARK_WIDTH-300);}
  }
 });
 it('a semente reproduz a composição inteira',()=>{expect(jumpParkAdventure(generateJumpPark(1234))).toEqual(jumpParkAdventure(generateJumpPark(1234)));expect(generateJumpPark(1234)).not.toEqual(generateJumpPark(5678));});
});

describe('arte leve de distribuição',()=>{
 it('arquivos reduzem o download e preservam a geometria dos atlas de NPCs',()=>{
  const catalog=JSON.parse(readFileSync('final-assets/runtime/world-art.json','utf8'));
  const names=Object.keys(catalog);
  const total=names.reduce((sum,name)=>sum+statSync('final-assets/runtime/'+name+'.webp').size,0);
  expect(total).toBeLessThan(2_100_000);
  for(const name of ['residents','residents-walk']){expect(catalog[name].width).toBe(catalog[name].sourceWidth);expect(catalog[name].height).toBe(catalog[name].sourceHeight);}
  for(const data of Object.values(catalog) as any[])for(const [x,y,w,h]of Object.values(data.frames) as number[][]){expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);expect(x+w).toBeLessThanOrEqual(data.width);expect(y+h).toBeLessThanOrEqual(data.height);}
 });
});
