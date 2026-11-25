// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBusinessSync } from '../../src/hooks/useBusinessSync';
import { BUSINESS_MUTATION } from '../../src/services/businessEvents';
import { api } from '../../src/services/api';
vi.mock('../../src/services/api', () => ({ api: { getPlants: vi.fn(), getOrders: vi.fn(), getCashRegister: vi.fn(), getDeliveries: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
const apply = vi.fn();
function Probe({ enabled = true }: { enabled?: boolean }) { useBusinessSync(enabled, apply); return null; }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.mocked(api.getPlants).mockResolvedValue([]);
  vi.mocked(api.getOrders).mockResolvedValue([]);
  vi.mocked(api.getDeliveries).mockResolvedValue([]);
  vi.mocked(api.getCashRegister).mockResolvedValue({ balance: 0, totalSales: 0, salesHistory: [] });
  apply.mockClear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('não publica estado parcial quando uma das quatro leituras falha', async () => {
  vi.mocked(api.getCashRegister).mockRejectedValueOnce(new Error('sem rede'));
  await act(async () => root.render(createElement(Probe)));
  expect(apply).not.toHaveBeenCalled();
});
it('descarta resposta iniciada antes da escrita e publica a consulta posterior inteira', async () => {
  let release!: (value: any) => void;
  vi.mocked(api.getPlants).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  await act(async () => root.render(createElement(Probe)));
  const current = [{ id: 'atual', name: 'Atualizada', stock: 4 }] as any;
  vi.mocked(api.getPlants).mockResolvedValue(current);
  vi.mocked(api.getCashRegister).mockResolvedValue({ balance: 20, totalSales: 20, salesHistory: [] });
  await act(async () => {
    window.dispatchEvent(new CustomEvent(BUSINESS_MUTATION, { detail: 'start' }));
    window.dispatchEvent(new CustomEvent(BUSINESS_MUTATION, { detail: 'end' }));
    release([{ id: 'antigo', stock: 5 }]);
  });
  expect(apply).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith({ plants: current, orders: [], deliveries: [], cash: { balance: 20, totalSales: 20, salesHistory: [] } });
});
it('resposta atrasada após sair da sessão não volta a publicar dados', async () => {
  let release!: (value: any) => void;
  vi.mocked(api.getPlants).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  await act(async () => root.render(createElement(Probe)));
  await act(async () => root.render(createElement(Probe, { enabled: false })));
  await act(async () => release([{ id: 'anterior' }]));
  expect(apply).not.toHaveBeenCalled();
});
it('desmontar a tela cancela publicação e não agenda outra consulta atrasada', async () => {
  let release!: (value: any) => void;
  vi.mocked(api.getPlants).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  await act(async () => root.render(createElement(Probe)));
  await act(async () => root.unmount());
  await act(async () => release([{ id: 'atrasado' }]));
  expect(apply).not.toHaveBeenCalled();
  expect(api.getPlants).toHaveBeenCalledTimes(1);
});
