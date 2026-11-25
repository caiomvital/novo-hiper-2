import Phaser from 'phaser';
import { PLATFORM } from '../config/platformConfig';
import type { GeneratedPlatformRoute } from '../config/proceduralPlatform';
import { seededRandom } from '../logic/seededRandom';
import runtimeArt from '../../../final-assets/runtime/world-art.json';

export const PLATFORM_HOUSE = 'platform-house-front';
const houseUrl = new URL('../../../final-assets/runtime/platform-house.webp', import.meta.url).href;
export function preloadPlatformScenery(scene: Phaser.Scene) {
  if (!scene.textures.exists(PLATFORM_HOUSE)) scene.load.image(PLATFORM_HOUSE, houseUrl);
}
function prepareArt(scene: Phaser.Scene) {
  const house = scene.textures.get(PLATFORM_HOUSE);
  if (!house.has('facade')) { const [x,y,w,h] = runtimeArt['platform-house'].frames.facade; house.add('facade',0,x,y,w,h); }
  house.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const texture = (name: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(name)) return;
    const canvas = scene.textures.createCanvas(name,w,h)!;
    draw(canvas.getContext());canvas.refresh();canvas.setFilter(Phaser.Textures.FilterMode.NEAREST);
  };
  texture('platform-meadow-sky',64,256,c => {
    const gradient=c.createLinearGradient(0,0,0,256);gradient.addColorStop(0,'#78bce1');gradient.addColorStop(1,'#e1f2d6');
    c.fillStyle=gradient;c.fillRect(0,0,64,256);
  });
  texture('platform-meadow-cloud',128,48,c => {
    c.fillStyle='#b9deeb';c.beginPath();c.ellipse(64,32,60,14,0,0,Math.PI*2);c.fill();
    c.fillStyle='#fff9e9';for(const [x,y,r] of [[29,25,18],[53,19,23],[80,24,20],[101,29,15]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
    c.fillRect(22,28,82,12);
  });
  texture('platform-meadow-hill',256,128,c => {
    c.fillStyle='#94bf8c';c.beginPath();c.ellipse(128,132,126,114,0,0,Math.PI*2);c.fill();
    c.fillStyle='#afd19b';c.beginPath();c.ellipse(112,136,104,107,0,0,Math.PI*2);c.fill();
    c.fillStyle='#d2e3ad';for(const x of [65,115,165])c.fillRect(x,80+(x%3)*5,4,14);
  });
  texture('platform-meadow-soil',64,64,c => {
    c.fillStyle='#b28250';c.fillRect(0,0,64,64);c.fillStyle='#9a6c46';
    for(let i=0;i<20;i++){const x=(i*23)%64,y=(i*17)%64;c.fillRect(x,y,7,3);}
    c.fillStyle='#d3a36a';for(let i=0;i<12;i++)c.fillRect((i*29)%64,(i*11+9)%64,4,2);
  });
  texture('platform-meadow-grass',64,16,c => {
    c.fillStyle='#4d914a';c.fillRect(0,0,64,14);c.fillStyle='#7fc053';c.fillRect(0,0,64,7);
    c.fillStyle='#a5d26c';for(let x=0;x<64;x+=8)c.fillRect(x,0,5,3);
    c.fillStyle='#b28250';for(let x=4;x<64;x+=13)c.fillRect(x,11,6,5);
  });
  texture('platform-meadow-flowers',64,32,c => {
    for(let i=0;i<5;i++){const x=6+i*12,y=9+(i%2)*5;c.fillStyle='#507e3f';c.fillRect(x,y,2,32-y);
      c.fillStyle=i%2?'#f5cc75':'#f2e9c6';c.fillRect(x-3,y-3,8,7);c.fillStyle='#cf9753';c.fillRect(x,y,2,2);}
  });
  texture('platform-meadow-fence',64,32,c => {
    c.fillStyle='#dfd4a6';c.fillRect(0,10,64,4);c.fillRect(0,23,64,3);
    c.fillStyle='#f2e7bd';for(let x=5;x<64;x+=22){c.fillRect(x,3,5,29);c.fillRect(x+1,0,3,4);}
  });
}
export function drawPlatformScenery(scene: Phaser.Scene, route: GeneratedPlatformRoute) {
  prepareArt(scene);
  scene.cameras.main.setBackgroundColor(0x91cce3);
  const objects: Phaser.GameObjects.GameObject[] = [];
  const random=seededRandom(route.seed ^ 0x6c81392), width=route.levelWidth;
  objects.push(scene.add.image(0,0,'platform-meadow-sky').setOrigin(0).setDisplaySize(width,PLATFORM.levelHeight).setScrollFactor(0).setDepth(-10));
  for(let x=-220;x<width+400;x+=400+random()*180) objects.push(scene.add.image(x,PLATFORM.groundY,'platform-meadow-hill').setOrigin(.5,1).setScale(.7+random()*.6).setScrollFactor(.25,1).setDepth(-8));
  for(let x=80;x<width+500;x+=280+random()*190) objects.push(scene.add.image(x,170+random()*180,'platform-meadow-cloud').setScale(.8+random()*.7).setScrollFactor(.12,.6).setDepth(-7).setAlpha(.9));
  if(route.space !== 'park') for(const x of [520,1190,1830]) objects.push(scene.add.image(x,PLATFORM.groundY-48,PLATFORM_HOUSE,'facade').setOrigin(.5,1).setScale(75 / runtimeArt['platform-house'].frames.facade[2]).setScrollFactor(.58,1).setAlpha(.6).setDepth(-5));
  for(const segment of route.segments){
    objects.push(scene.add.tileSprite(segment.x,PLATFORM.groundY+12,segment.width,PLATFORM.levelHeight-PLATFORM.groundY-12,'platform-meadow-soil').setOrigin(0).setDepth(0));
    objects.push(scene.add.tileSprite(segment.x,PLATFORM.groundY,segment.width,16,'platform-meadow-grass').setOrigin(0).setDepth(1));
    objects.push(scene.add.tileSprite(segment.x+20,PLATFORM.groundY-29,segment.width-40,32,'platform-meadow-fence').setOrigin(0).setDepth(-3).setAlpha(.7));
    for(let x=segment.x+200+random()*50;x<segment.x+segment.width-80;x+=180+random()*150) objects.push(scene.add.image(x,PLATFORM.groundY,'platform-meadow-flowers').setOrigin(.5,1).setScale(.65+random()*.35).setDepth(2));
  }
  if(route.space==='park') for(const [x,name] of [[180,'Campina'],[2700,'Pontes altas'],[5100,'Jardins do céu']] as const) objects.push(scene.add.text(x,PLATFORM.groundY-100,name,{fontSize:'15px',color:'#fff8dc',backgroundColor:'#546e45',padding:{x:8,y:5}}).setDepth(3));
  return objects;
}

/** Ilhas do parque: topo físico de 16 px, com solo desenhado abaixo dele. */
export function drawRaisedParkPlatform(scene: Phaser.Scene, ledge: {x:number;y:number;width:number}) {
  const shadow = scene.add.graphics().setDepth(1);
  shadow.fillStyle(0x8f6848).fillRoundedRect(ledge.x+6,ledge.y+8,ledge.width-12,30,5);
  shadow.fillStyle(0xd0a16b).fillRect(ledge.x+8,ledge.y+16,ledge.width-16,5);
  shadow.fillStyle(0x709744).fillRect(ledge.x+6,ledge.y+27,11,9).fillRect(ledge.x+ledge.width-21,ledge.y+23,10,9);
  return [shadow, scene.add.tileSprite(ledge.x,ledge.y,ledge.width,16,'platform-meadow-grass').setOrigin(0).setDepth(2)];
}
