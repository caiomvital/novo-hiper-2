// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorldProgress } from '../../src/phaser-game/useWorldProgress';
import { AdventureBridge } from '../../src/phaser-game/bridge/adventureBridge';
import { BUSINESS_CHANGED, BUSINESS_STORAGE_KEY } from '../../src/services/businessEvents';
import { api } from '../../src/services/api';
vi.mock('../../src/services/api', () => ({ api: { getWorldStage: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
let bridge: AdventureBridge;
const initial = { obraLeste: 'parada', environmentalNeighbors: 0 } as const;
const advanced = { obraLeste: 'ativa', environmentalNeighbors: 3 } as const;
function Probe() { useWorldProgress(bridge); return null; }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.mocked(api.getWorldStage).mockResolvedValue(initial);
  bridge = new AdventureBridge();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('instalação confirmada atualiza o bairro sem entrega nem recarga', async () => {
  await act(async () => root.render(createElement(Probe)));
  vi.mocked(api.getWorldStage).mockResolvedValue(advanced);
  await act(async () => window.dispatchEvent(new Event(BUSINESS_CHANGED)));
  expect(bridge.getSnapshot().worldStage).toEqual(advanced);
});
it('mudança em outra aba e reconexão consultam o servidor', async () => {
  await act(async () => root.render(createElement(Probe)));
  vi.mocked(api.getWorldStage).mockResolvedValue(advanced);
  await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: BUSINESS_STORAGE_KEY })));
  expect(bridge.getSnapshot().worldStage).toEqual(advanced);
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(api.getWorldStage).toHaveBeenCalledTimes(3);
});
it('uma resposta antiga não desfaz o estágio confirmado mais recente', async () => {
  let release!: (value: typeof initial) => void;
  vi.mocked(api.getWorldStage).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  await act(async () => root.render(createElement(Probe)));
  vi.mocked(api.getWorldStage).mockResolvedValue(advanced);
  await act(async () => window.dispatchEvent(new Event(BUSINESS_CHANGED)));
  await act(async () => release(initial));
  expect(bridge.getSnapshot().worldStage).toEqual(advanced);
});
it('falha conserva o estágio e desmontagem remove eventos e consultas periódicas', async () => {
  await act(async () => root.render(createElement(Probe)));
  vi.mocked(api.getWorldStage).mockRejectedValue(new Error('sem rede'));
  await act(async () => window.dispatchEvent(new Event(BUSINESS_CHANGED)));
  expect(bridge.getSnapshot().worldStage).toEqual(initial);
  await act(async () => root.unmount());
  await act(async () => window.dispatchEvent(new Event(BUSINESS_CHANGED)));
  expect(api.getWorldStage).toHaveBeenCalledTimes(2);
  expect(bridge.listenerCount()).toBe(0);
});
