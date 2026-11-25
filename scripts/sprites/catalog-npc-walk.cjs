// Somente leitura de pixels: registra os recortes e os pés dos 24 passos.
const fs = require('node:fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async data => {
      const image = new Image(); image.src = data; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      const w = image.width, h = image.height;
      const { data: pixels } = ctx.getImageData(0, 0, image.width, image.height);
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
      if (transparent < image.width * image.height * .25 || components.length !== 24) throw new Error(`Esperados 24 personagens transparentes, encontrados ${components.length}`);
      const bounds = Array(24);
      for (const b of components) {
        const row = Math.floor((b.y + b.h / 2) / image.height * 3);
        const col = Math.floor((b.x + b.w / 2) / image.width * 8);
        if (bounds[row * 8 + col]) throw new Error('Poses duplicadas');
        bounds[row * 8 + col] = { x: b.x - 2, y: b.y - 2, w: b.w + 4, h: b.h + 4 };
      }
      if (bounds.filter(Boolean).length !== 24) throw new Error('Poses ausentes');
      return { width: image.width, height: image.height, transparent, bounds };
    }, 'data:image/png;base64,' + fs.readFileSync('final-assets/npcs/moradores-walk-v1.png').toString('base64'));
    const frames = {}, ids = ['cust_ana', 'cust_carlos', 'cust_bia'], directions = ['left', 'right', 'down', 'up'];
    result.bounds.forEach((b, i) => {
      const key = `${ids[Math.floor(i / 8)]}-${directions[Math.floor(i % 8 / 2)]}-${i % 2}`;
      frames[key] = { frame: b, rotated: false, trimmed: false, sourceSize: { w: b.w, h: b.h }, spriteSourceSize: { x: 0, y: 0, w: b.w, h: b.h } };
    });
    fs.writeFileSync('final-assets/npcs/moradores-walk-v1-atlas.json', JSON.stringify({ frames, meta: { image: 'moradores-walk-v1.png', size: { w: result.width, h: result.height }, scale: '1' } }, null, 2) + '\n');
    console.log(JSON.stringify({ frames: Object.keys(frames).length, transparent: result.transparent, width: result.width, height: result.height }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
