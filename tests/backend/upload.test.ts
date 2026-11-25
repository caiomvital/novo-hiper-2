import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestServer, TestServer } from './helpers/testServer';

let s: TestServer;
beforeAll(async () => { s = await startTestServer(); });
afterAll(async () => { await s.close(); });
const png = fs.readFileSync('public/pwa-192x192.png');

async function upload(bytes: Uint8Array, mime: string, name: string) {
  const body = new FormData();
  body.append('image', new Blob([new Uint8Array(bytes)], { type: mime }), name);
  return fetch(`${s.baseUrl}/api/upload`, { method: 'POST', headers: { Cookie: `nh_session=${s.cookie()}` }, body });
}

describe('fotografias persistidas', () => {
  it('PNG é salvo, servido com os mesmos bytes e continua após reiniciar o servidor', async () => {
    const response = await upload(png, 'image/png', 'foto.png');
    expect(response.status).toBe(201);
    const photo = await response.json();
    expect(photo.filePath).toMatch(/^\/uploads\/plants\/plant_.*\.png$/);
    expect(Buffer.from(await (await fetch(s.baseUrl + photo.filePath)).arrayBuffer())).toEqual(png);
    await s.restart();
    expect(Buffer.from(await (await fetch(s.baseUrl + photo.filePath)).arrayBuffer())).toEqual(png);
  });

  it('arquivo inválido, vazio ou MIME falsificado é recusado sem deixar arquivos salvos', async () => {
    const dir = path.join(s.dir, 'uploads', 'plants');
    const before = fs.readdirSync(dir);
    for (const [bytes, mime, name] of [
      [Buffer.from('texto'), 'text/plain', 'texto.txt'],
      [Buffer.from('texto'), 'image/png', 'falsa.png'],
      [Buffer.alloc(0), 'image/jpeg', 'vazia.jpg'],
      [png, 'image/jpeg', 'formato-errado.jpg'],
    ] as const) {
      expect((await upload(bytes, mime, name)).status).toBe(400);
    }
    expect(fs.readdirSync(dir)).toEqual(before);
  });

  it('mais de 5 MB é recusado com mensagem e sem arquivo parcial', async () => {
    const dir = path.join(s.dir, 'uploads', 'plants');
    const before = fs.readdirSync(dir);
    const result = await upload(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 'grande.png');
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain('5MB');
    expect(fs.readdirSync(dir)).toEqual(before);
  });
});
