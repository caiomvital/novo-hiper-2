import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SHOP_UPGRADES } from '../../backend/shop/catalog';
import { ShopPanel } from '../../src/phaser-game/ui/ShopPanel';
import { BANCO_LAYOUT, ENTRANCE_LANE, JARDINEIRAS_LAYOUT } from '../../src/phaser-game/config/shopLayout';
import { WORLD_MAP } from '../../src/phaser-game/config/worldMap';
import { emptyDeliveryMessage, stockHintFor } from '../../src/phaser-game/logic/emptyState';
import { rectsOverlap } from '../../src/phaser-game/logic/worldGeometry';
import { ShopUpgradeVisuals } from '../../src/phaser-game/world/shopUpgrades';
import { BANCO, JARDINEIRAS, PLACA_MADEIRA } from '../../src/shared/shop';
import type { ShopSnapshot, ShopUpgradeView } from '../../src/services/api';

const view = (id: string, state: ShopUpgradeView['state']): ShopUpgradeView => {
  const def = SHOP_UPGRADES.find((u) => u.id === id)!;
  return { id, name: def.name, description: def.description, price: def.price, state, purchasedAt: null, installedAt: null };
};
const shop = (balance: number, states: Record<string, ShopUpgradeView['state']>): ShopSnapshot => ({
  balance,
  upgrades: SHOP_UPGRADES.map((u) => view(u.id, states[u.id] ?? 'available')),
});
const noop = () => undefined;
const render = (mode: 'shop' | 'install', data: ShopSnapshot) =>
  renderToStaticMarkup(React.createElement(ShopPanel, { mode, shop: data, busy: false, message: null, onClose: noop, onBuy: noop, onInstall: noop }));

describe('catálogo da Loja de Utilidades (3 melhorias, preços do backend)', () => {
  it('placa R$ 60, jardineiras R$ 90, banco R$ 120 — e mais nada (sem claraboia)', () => {
    expect(SHOP_UPGRADES.map((u) => [u.id, u.price])).toEqual([
      [PLACA_MADEIRA, 60],
      [JARDINEIRAS, 90],
      [BANCO, 120],
    ]);
  });
});

describe('painel da loja: os três estados de cada melhoria', () => {
  it('modo loja: disponível mostra preço e "Comprar"; faltando saldo mostra quanto falta', () => {
    const html = render('shop', shop(70, {}));
    for (const u of SHOP_UPGRADES) expect(html).toContain(`id="btn-shop-buy-${u.id}"`);
    expect(html).toMatch(/Comprar por R\$\s*60,00/);
    expect(html).toMatch(/Comprar por R\$\s*90,00/);
    expect(html).toMatch(/Comprar por R\$\s*120,00/);
    expect(html).toMatch(/Faltam R\$\s*20,00/); // 90 - 70
    expect(html).toMatch(/Faltam R\$\s*50,00/); // 120 - 70
    expect(html).not.toMatch(/Faltam R\$\s*[0-9,]+<\/span>[\s\S]*btn-shop-buy-placa_madeira/); // a placa (60) é pagável
  });

  it('modo loja: comprada = "aguardando instalação" (sem botão de compra); instalada = "Instalada"', () => {
    const html = render('shop', shop(0, { [PLACA_MADEIRA]: 'pending', [JARDINEIRAS]: 'installed' }));
    expect(html).not.toContain(`btn-shop-buy-${PLACA_MADEIRA}`);
    expect(html).not.toContain(`btn-shop-buy-${JARDINEIRAS}`);
    expect(html).toContain(`id="btn-shop-buy-${BANCO}"`);
    expect(html).toMatch(new RegExp(`shop-state-${PLACA_MADEIRA}[^>]*>[^<]*leve para a Novo Hiper`));
    expect(html).toMatch(new RegExp(`shop-state-${JARDINEIRAS}[\\s\\S]*?Instalada`));
  });

  it('modo instalação: só o que foi comprado; pendente tem "Instalar", instalada mostra "Instalada"; disponível nem aparece', () => {
    const html = render('install', shop(0, { [PLACA_MADEIRA]: 'pending', [BANCO]: 'installed' }));
    expect(html).toContain(`id="btn-shop-install-${PLACA_MADEIRA}"`);
    expect(html).not.toContain(`shop-item-${JARDINEIRAS}`); // ainda não comprada
    expect(html).toContain(`shop-item-${BANCO}`);
    expect(html).not.toContain(`btn-shop-install-${BANCO}`);
    expect(html).toMatch(/Minha loja/);
  });

  it('mostra o saldo vindo do backend', () => {
    expect(render('shop', shop(1234.5, {}))).toMatch(/R\$\s*1\.234,50/);
  });
});

describe('posição das melhorias decorativas (sem colisão, sem bloquear a entrada)', () => {
  const solids = WORLD_MAP.solids;

  it('jardineiras e banco não estão dentro de nenhum sólido nem do corredor da porta nem se sobrepõem', () => {
    const items = [...JARDINEIRAS_LAYOUT.map((r, i) => ({ name: `jardineira ${i}`, r })), { name: 'banco', r: BANCO_LAYOUT }];
    for (const { name, r } of items) {
      expect(rectsOverlap(r, ENTRANCE_LANE), `${name} × corredor da porta`).toBe(false);
      for (const s of solids) expect(rectsOverlap(r, s), `${name} × sólido`).toBe(false);
    }
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) expect(rectsOverlap(items[i].r, items[j].r), `${items[i].name} × ${items[j].name}`).toBe(false);
  });

  it('são duas jardineiras (uma de cada lado da porta) e o banco fica perto da fachada', () => {
    expect(JARDINEIRAS_LAYOUT).toHaveLength(2);
    const door = WORLD_MAP.shop.door.x;
    expect(JARDINEIRAS_LAYOUT[0].x + JARDINEIRAS_LAYOUT[0].w).toBeLessThan(door);
    expect(JARDINEIRAS_LAYOUT[1].x).toBeGreaterThan(door);
    expect(Math.abs(BANCO_LAYOUT.y - (WORLD_MAP.shop.rect.y + WORLD_MAP.shop.rect.h))).toBeLessThan(120);
  });
});

/** Cena falsa: qualquer chamada encadeia; guarda o que foi criado/destruído. */
function fakeScene() {
  const created: Array<{ kind: string; destroyed: boolean }> = [];
  const make = (kind: string) => {
    const rec = { kind, destroyed: false };
    created.push(rec);
    const obj: any = new Proxy(
      { alpha: 1 },
      {
        get(t: any, prop: string) {
          if (prop === 'destroy') return () => void (rec.destroyed = true);
          if (prop === 'alpha') return t.alpha;
          if (prop === 'setAlpha') return (a: number) => ((t.alpha = a), obj);
          return () => obj; // fillStyle, fillRect, setDepth, setOrigin…
        },
      }
    );
    return obj;
  };
  const scene: any = {
    add: { graphics: () => make('graphics'), text: () => make('text'), ellipse: () => make('ellipse') },
    tweens: { add: () => undefined },
  };
  const live = () => created.filter((c) => !c.destroyed).length;
  return { scene, created, live };
}

describe('ShopUpgradeVisuals (visual instalado)', () => {
  it('jardineiras e banco aparecem ao instalar e somem se deixarem de estar instalados; reaplicar é idempotente', () => {
    const f = fakeScene();
    const v = new ShopUpgradeVisuals(f.scene);
    v.apply([]);
    expect(f.live()).toBe(0);

    v.apply([JARDINEIRAS]);
    expect(v.visibleIds()).toEqual([JARDINEIRAS]);
    const afterJ = f.live();
    expect(afterJ).toBeGreaterThan(0);
    v.apply([JARDINEIRAS]); // idempotente: nada novo
    expect(f.live()).toBe(afterJ);

    v.apply([JARDINEIRAS, BANCO]);
    expect(v.visibleIds().sort()).toEqual([BANCO, JARDINEIRAS].sort());
    expect(f.live()).toBeGreaterThan(afterJ);

    v.apply([BANCO]);
    expect(v.visibleIds()).toEqual([BANCO]);
    v.apply([]);
    expect(f.live()).toBe(0);
  });

  it('restaura direto no estado correto (todas instaladas ao entrar na cena) e a placa continua independente', () => {
    const f = fakeScene();
    const v = new ShopUpgradeVisuals(f.scene);
    v.apply([PLACA_MADEIRA, JARDINEIRAS, BANCO]);
    expect(v.visibleIds().sort()).toEqual([BANCO, JARDINEIRAS, PLACA_MADEIRA].sort());
    expect(v.isInstalled(PLACA_MADEIRA)).toBe(true);
    v.destroy();
    expect(f.live()).toBe(0);
  });

  it('ids desconhecidos são ignorados (sem quebrar a cena)', () => {
    const f = fakeScene();
    const v = new ShopUpgradeVisuals(f.scene);
    v.apply(['claraboia', 'qualquer_coisa']);
    expect(v.visibleIds()).toEqual([]);
  });
});

describe('mensagens quando não há pedido', () => {
  it('sem plantas, sem estoque e sem pedido (estoque ok)', () => {
    expect(stockHintFor([])).toBe('no_plants');
    expect(stockHintFor([{ stock: 0 }, { stock: 0 }])).toBe('no_stock');
    expect(stockHintFor([{ stock: 0 }, { stock: 3 }])).toBe('ok');
    expect(emptyDeliveryMessage('no_plants')).toBe('Cadastre uma planta na Novo Hiper para começar.');
    expect(emptyDeliveryMessage('no_stock')).toMatch(/sem estoque.*Novo Hiper/i);
    expect(emptyDeliveryMessage('ok')).toBe('Sem entregas no momento');
    expect(emptyDeliveryMessage(null)).toBe('Sem entregas no momento');
  });
});
