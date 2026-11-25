// Normaliza a folha aprovada para a grade e a âncora usadas pelo Phaser.
// A arte original é preservada; Chromium faz apenas recorte, espelhamento e redução.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const blond = process.argv.includes('--blond');
  const root = blond ? 'final-assets/bernardo/blond-v2' : 'final-assets/bernardo';
  fs.mkdirSync(path.join(root, 'platform'), { recursive: true });
  const jobs = [
    { source: `${root}/walk-master.png`, output: `${root}/bernardo-topdown.png`, columns: 5, rows: 4, frameWidth: 72, frameHeight: 80, feetY: 72, maxWidth: 64, maxHeight: 68, strip: false, flips: [9, 11] },
    { source: `${root}/platform/jump-master.png`, output: `${root}/platform/jump.png`, columns: 4, rows: 3, frameWidth: 160, frameHeight: 180, feetY: 160, maxWidth: 136, maxHeight: 136, strip: true, flips: [] },
    { source: `${root}/platform/celebration-master.png`, output: `${root}/platform/thumbs-up-front.png`, columns: 6, rows: 1, frameWidth: 160, frameHeight: 180, feetY: 160, maxWidth: 136, maxHeight: 136, strip: true, flips: [] },
    { source: 'final-assets/npcs/npc-template-v2-master.png', output: 'final-assets/npcs/npc-template.png', columns: 4, rows: 2, frameWidth: 72, frameHeight: 96, feetY: 88, maxWidth: 64, maxHeight: 84, strip: false, flips: [], optional: true },
  ];
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    for (const job of jobs) {
    if (job.optional && (blond || !fs.existsSync(job.source))) continue;
    if (!fs.existsSync(job.source)) throw new Error(`Arte ausente: ${job.source}`);
    const result = await page.evaluate(async ({ data, job }) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const cells = [];
      for (let row = 0; row < job.rows; row++) for (let col = 0; col < job.columns; col++) {
        const left = Math.round(col * image.width / job.columns);
        const top = Math.round(row * image.height / job.rows);
        const w = Math.round((col + 1) * image.width / job.columns) - left;
        const h = Math.round((row + 1) * image.height / job.rows) - top;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const context = canvas.getContext('2d');
        context.drawImage(image, left, top, w, h, 0, 0, w, h);
        const pixels = context.getImageData(0, 0, w, h);
        const seen = new Uint8Array(w * h);
        const components = [];
        for (let i = 0; i < seen.length; i++) {
          if (seen[i] || pixels.data[i * 4 + 3] < 200) continue;
          const queue = [i]; seen[i] = 1;
          for (let j = 0; j < queue.length; j++) {
            const p = queue[j], x = p % w, y = Math.floor(p / w);
            for (const n of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
              if (n >= 0 && !seen[n] && pixels.data[n * 4 + 3] >= 200) { seen[n] = 1; queue.push(n); }
            }
          }
          components.push(queue);
        }
        components.sort((a, b) => b.length - a.length);
        if (!components[0] || components[0].length < 100) throw new Error(`Frame vazio: ${row},${col}`);
        const keep = new Uint8Array(w * h);
        const bounds = { x: w, y: h, right: 0, bottom: 0 };
        for (const component of components.filter(c => c.length >= components[0].length * 0.015)) for (const p of component) {
          keep[p] = 1;
          const x = p % w, y = Math.floor(p / w);
          bounds.x = Math.min(bounds.x, x); bounds.y = Math.min(bounds.y, y);
          bounds.right = Math.max(bounds.right, x); bounds.bottom = Math.max(bounds.bottom, y);
        }
        for (let p = 0; p < keep.length; p++) pixels.data[p * 4 + 3] = keep[p] ? 255 : 0;
        context.putImageData(pixels, 0, 0);
        cells.push({ canvas, bounds, row, col });
      }
      const scale = Math.min(...cells.map(({ bounds: b }) => Math.min(job.maxWidth / (b.right - b.x + 1), job.maxHeight / (b.bottom - b.y + 1))));
      const sheet = document.createElement('canvas');
      sheet.width = job.frameWidth * job.columns * (job.strip ? job.rows : 1);
      sheet.height = job.frameHeight * (job.strip ? 1 : job.rows);
      const ctx = sheet.getContext('2d'); ctx.imageSmoothingEnabled = false;
      for (const { canvas, bounds: b, row, col } of cells) {
        const width = b.right - b.x + 1, height = b.bottom - b.y + 1;
        const dw = Math.round(width * scale), dh = Math.round(height * scale);
        ctx.save();
        // A referência mantém dois quadros invertidos mesmo após o passe de arte.
        const flip = job.flips.includes(row * job.columns + col);
        const outCol = job.strip ? row * job.columns + col : col;
        const outRow = job.strip ? 0 : row;
        ctx.translate(outCol * job.frameWidth + job.frameWidth / 2, outRow * job.frameHeight + job.feetY);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(canvas, b.x, b.y, width, height, -Math.round(dw / 2), -dh, dw, dh);
        ctx.restore();
      }
      return { png: sheet.toDataURL('image/png').split(',')[1], scale, frames: cells.length };
    }, { data: `data:image/png;base64,${fs.readFileSync(job.source).toString('base64')}`, job });
    fs.writeFileSync(job.output, Buffer.from(result.png, 'base64'));
    console.log(JSON.stringify({ output: job.output, frames: result.frames, scale: result.scale }));
    }
    const platformWalk = await page.evaluate(async (data) => {
      const image = new Image(); image.src = data; await image.decode();
      const outputs = {};
      for (const [direction, row] of [['left', 1], ['right', 2]]) for (const action of ['idle', 'walk']) {
        const count = action === 'idle' ? 4 : 8;
        const canvas = document.createElement('canvas'); canvas.width = count * 160; canvas.height = 180;
        const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
        for (let index = 0; index < count; index++) {
          const column = action === 'idle' ? 0 : index % 4 + 1;
          ctx.drawImage(image, column * 72, row * 80, 72, 80, index * 160 + 8, 16, 144, 160);
        }
        outputs[`${action}-${direction}.png`] = canvas.toDataURL('image/png').split(',')[1];
      }
      return outputs;
    }, `data:image/png;base64,${fs.readFileSync(`${root}/bernardo-topdown.png`).toString('base64')}`);
    for (const [name, data] of Object.entries(platformWalk)) fs.writeFileSync(path.join(root, 'platform', name), Buffer.from(data, 'base64'));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
