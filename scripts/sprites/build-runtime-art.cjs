// Derivados de distribuição: redimensionamento/encoding determinístico, sem alterar os originais.
const fs = require('node:fs');
const { chromium } = require('playwright');
const jobs = [
  { name: 'platform-house', path: 'buildings/platform-house-front-master.png', max: 512, names: ['facade'], columns: 1 },
  { name: 'houses', path: 'buildings/houses.png', max: 1024, names: ['cream', 'sage', 'blush', 'blue'], columns: 2 },
  { name: 'houses-north', path: 'buildings/houses-north-v2.png', max: 1024, names: ['cream', 'sage', 'blush', 'blue'], columns: 2 },
  { name: 'urban', path: 'urban/urban-kit.png', max: 768, names: ['tree-small', 'tree-medium', 'bench', 'flowers'], columns: 2 },
  { name: 'shop', path: 'buildings/novo-hiper-depth-v1.png', max: 1024, names: ['facade'], columns: 1 },
  { name: 'house', path: 'buildings/house-depth-v1.png', max: 768, names: ['house'], columns: 1 },
  { name: 'terrain', path: 'terrain/terrain-kit.jpg', max: 1408 },
  { name: 'residents', path: 'npcs/moradores-v1.png', max: 0 },
  { name: 'residents-walk', path: 'npcs/moradores-walk-v1.png', max: 0 },
];
async function main() {
 const out='final-assets/runtime'; fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const catalog={}; let before=0,after=0;
 try {
  const page=await browser.newPage();
  for (const job of jobs) {
   const bytes=fs.readFileSync('final-assets/'+job.path); before+=bytes.length;
   const result=await page.evaluate(async ({job,data})=>{
    const image=new Image();image.src=data;await image.decode();
    const ratio=job.max?Math.min(1,job.max/Math.max(image.width,image.height)):1;
    const c=document.createElement('canvas');c.width=Math.round(image.width*ratio);c.height=Math.round(image.height*ratio);
    const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,c.width,c.height);
    const frames={};
    if(job.names){
     const pixels=ctx.getImageData(0,0,c.width,c.height).data,rows=Math.ceil(job.names.length/job.columns);
     job.names.forEach((name,i)=>{
      const x0=Math.round(i%job.columns*c.width/job.columns), x1=Math.round((i%job.columns+1)*c.width/job.columns);
      const y0=Math.round(Math.floor(i/job.columns)*c.height/rows), y1=Math.round((Math.floor(i/job.columns)+1)*c.height/rows);
      let l=x1,t=y1,r=x0,b=y0;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*c.width+x)*4+3]>=200){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
      if(r<l||b<t)throw Error('Frame vazio: '+name);
      frames[name]=[l,t,r-l+1,b-t+1];
     });
    }
    return {width:c.width,height:c.height,sourceWidth:image.width,sourceHeight:image.height,frames,data:c.toDataURL('image/webp',.88).split(',')[1]};
   },{job,data:`data:${job.path.endsWith('.jpg')?'image/jpeg':'image/png'};base64,${bytes.toString('base64')}`});
   const output=Buffer.from(result.data,'base64'); fs.writeFileSync(`${out}/${job.name}.webp`,output);after+=output.length;
   delete result.data;catalog[job.name]=result;
  }
 }finally{await browser.close();}
 fs.writeFileSync(out+'/world-art.json',JSON.stringify(catalog,null,2)+'\n');
 console.log(JSON.stringify({originalBytes:before,runtimeBytes:after,reductionPercent:Math.round((1-after/before)*100)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
