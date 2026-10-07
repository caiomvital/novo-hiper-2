import Phaser from 'phaser';
import { WORLD_MAP } from '../config/worldMap';
import { PLACA_MADEIRA } from '../../shared/shop';

/**
 * Visual das melhorias INSTALADAS na Novo Hiper (só apresentação; o estado vem do backend via snapshot).
 * Cada melhoria é um conjunto de objetos do Phaser criado/destruído conforme o conjunto de ids instalados.
 * Decorativos: sem colisão. Posições derivam de WORLD_MAP.shop (nada de coordenadas no banco).
 */
type Builder = (scene: Phaser.Scene) => Phaser.GameObjects.GameObject[];

const DEPTH = 3; // acima do letreiro verde antigo (depth 2); o jogador (depth 1) nunca passa por aqui (é a fachada sólida)

/** Placa grande de madeira sobre o toldo: cobre o letreiro verde pequeno e é bem visível desde o spawn. */
const buildPlacaMadeira: Builder = (scene) => {
  const s = WORLD_MAP.shop.rect;
  const cx = WORLD_MAP.shop.door.x;
  const cy = s.y + s.h - 106; // acima do toldo listrado (que começa em s.y + s.h - 62)
  const W = 252;
  const H = 66;
  const left = cx - W / 2;
  const top = cy - H / 2;
  const objs: Phaser.GameObjects.GameObject[] = [];

  const glow = scene.add.ellipse(cx, cy, W + 52, H + 22, 0xfef08a, 0.18).setDepth(DEPTH - 0.5);
  objs.push(glow);

  const g = scene.add.graphics().setDepth(DEPTH);
  // sombra e correntes
  g.fillStyle(0x000000, 0.28).fillRect(left + 5, top + 7, W, H);
  g.lineStyle(3, 0x44403c, 1);
  for (const dx of [-96, 96]) g.lineBetween(cx + dx, top, cx + dx, top - 14);
  // tábua
  g.fillStyle(0x92400e, 1).fillRect(left, top, W, H);
  g.fillStyle(0xb45309, 1);
  for (let y = top + 4; y < top + H - 6; y += 16) g.fillRect(left + 4, y, W - 8, 7); // veios das tábuas
  g.lineStyle(5, 0x451a03, 1).strokeRect(left, top, W, H);
  g.lineStyle(2, 0xfbbf24, 1).strokeRect(left + 6, top + 6, W - 12, H - 12);
  g.fillStyle(0xfbbf24, 1);
  for (const [x, y] of [[left + 10, top + 10], [left + W - 10, top + 10], [left + 10, top + H - 10], [left + W - 10, top + H - 10]]) g.fillCircle(x, y, 3.5);
  // folhas nas laterais
  for (const side of [-1, 1]) {
    const x = cx + side * 112;
    g.fillStyle(0x15803d, 1).fillEllipse(x, cy - 6, 26, 12);
    g.fillStyle(0x22c55e, 1).fillEllipse(x + side * 6, cy + 6, 24, 11);
    g.fillStyle(0x166534, 1).fillRect(x - 1.5, cy - 4, 3, 22);
  }
  objs.push(g);

  objs.push(
    scene.add
      .text(cx, cy - 6, 'NOVO HIPER', { fontSize: '27px', fontStyle: 'bold', color: '#fef3c7', stroke: '#451a03', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(DEPTH + 0.1),
    scene.add
      .text(cx, cy + 18, 'PLANTAS & JARDINAGEM', { fontSize: '11px', fontStyle: 'bold', color: '#fde68a', stroke: '#451a03', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(DEPTH + 0.1)
  );
  return objs;
};

const BUILDERS: Record<string, Builder> = {
  [PLACA_MADEIRA]: buildPlacaMadeira,
};

export class ShopUpgradeVisuals {
  private built = new Map<string, Phaser.GameObjects.GameObject[]>();

  constructor(private scene: Phaser.Scene) {}

  /** Reconcilia o que está desenhado com os ids instalados. `animate`: fade-in (instalação ao vivo); sem ele, aparece direto (entrada na cena). */
  apply(installed: readonly string[], animate = false) {
    for (const id of Object.keys(BUILDERS)) {
      const want = installed.includes(id);
      const has = this.built.has(id);
      if (want && !has) {
        const objs = BUILDERS[id](this.scene);
        if (animate) {
          for (const o of objs) {
            const t = o as unknown as Phaser.GameObjects.Components.Alpha;
            const finalAlpha = t.alpha;
            t.setAlpha(0);
            this.scene.tweens.add({ targets: o, alpha: finalAlpha, duration: 450 });
          }
        }
        this.built.set(id, objs);
      } else if (!want && has) {
        this.built.get(id)!.forEach((o) => o.destroy());
        this.built.delete(id);
      }
    }
  }

  isInstalled(id: string) {
    return this.built.has(id);
  }

  destroy() {
    this.built.forEach((objs) => objs.forEach((o) => o.destroy()));
    this.built.clear();
  }
}
