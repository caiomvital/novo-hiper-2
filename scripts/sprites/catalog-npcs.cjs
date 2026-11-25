// Lê a transparência da folha sem alterar a imagem e registra os recortes reais.
const fs = require('node:fs');
const { chromium } = require('playwright');
const source = 'final-assets/npcs/moradores-v1-master.png';
const residents = [
  ['cust_dona_maria', 'Dona Maria'], ['cust_seu_joao', 'Seu João'], ['cust_ana', 'Ana'], ['cust_carlos', 'Carlos'],
  ['cust_dona_lucia', 'Dona Lúcia'], ['cust_floricultura', 'Representante da floricultura'], ['cust_seu_antonio', 'Seu Antônio'], ['cust_bia', 'Bia'],
];
const directions = ['down', 'left', 'right', 'up'];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const analysis = await page.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const w = image.width, h = image.height;
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, w, h).data;
      const seen = new Uint8Array(w * h), queue = new Int32Array(w * h), components = [];
      let transparent = 0;
      for (let i = 0; i < seen.length; i++) {
        if (pixels[i * 4 + 3] === 0) transparent++;
        if (seen[i] || pixels[i * 4 + 3] < 128) continue;
        let head = 0, tail = 1, left = w, top = h, right = 0, bottom = 0;
        queue[0] = i; seen[i] = 1;
        while (head < tail) {
          const p = queue[head++], x = p % w, y = Math.floor(p / w);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
          for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
            if (n >= 0 && !seen[n] && pixels[n * 4 + 3] >= 128) { seen[n] = 1; queue[tail++] = n; }
          }
        }
        if (tail > 500) components.push({ x: left, y: top, w: right - left + 1, h: bottom - top + 1, pixels: tail });
      }
      return { width: w, height: h, transparent, components };
    }, 'data:image/png;base64,' + fs.readFileSync(source).toString('base64'));
    if (analysis.transparent === 0 || analysis.components.length !== 32) throw new Error('Esperados 32 personagens separados e transparência: ' + JSON.stringify(analysis));
    const frames = {}, used = new Set();
    for (const b of analysis.components) {
      const row = Math.floor((b.y + b.h / 2) / analysis.height * 8);
      const col = Math.floor((b.x + b.w / 2) / analysis.width * 4);
      const key = residents[row][0] + '-' + directions[col];
      if (used.has(key)) throw new Error('Poses duplicadas: ' + key);
      used.add(key);
      const x = Math.max(0, b.x - 3), y = Math.max(0, b.y - 3);
      const w = Math.min(analysis.width - x, b.w + 6), h = Math.min(analysis.height - y, b.h + 6);
      frames[key] = { frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h }, pivot: { x: 0.5, y: (h - 3) / h } };
    }
    const atlas = { frames, meta: { image: 'moradores-v1.png', format: 'RGBA8888', size: { w: analysis.width, h: analysis.height }, scale: '1' } };
    fs.writeFileSync('final-assets/npcs/moradores-v1-atlas.json', JSON.stringify(atlas, null, 2) + '\n');
    fs.writeFileSync('final-assets/npcs/moradores-v1-catalog.json', JSON.stringify({ image: 'moradores-v1.png', atlas: 'moradores-v1-atlas.json', animation: 'standing-only', suggestedScale: 0.36, residents: residents.map(([id, name]) => ({ id, name, frames: Object.fromEntries(directions.map(d => [d, id + '-' + d])) })) }, null, 2) + '\n');
    console.log(JSON.stringify({ width: analysis.width, height: analysis.height, frames: used.size, transparentPixels: analysis.transparent }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
