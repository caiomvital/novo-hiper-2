import Phaser from 'phaser';

const TEXTURE_KEY = 'vizinho-ambiental';
const TINTS = [0x16a34a, 0x7c3aed, 0x0891b2] as const;
/** Calçada perto da Novo Hiper, fora do raio de entrada da loja (36px) e fora do retângulo da fachada. */
const SPOTS = [
  { x: 760, y: 1040 },
  { x: 900, y: 1075 },
  { x: 1170, y: 1040 },
] as const;

export interface EnvironmentalNeighborsController {
  setCount(n: number): void;
}

function ensureTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 8, 28, 38, 7);
  g.fillStyle(0xfcd9b6, 1);
  g.fillCircle(14, 10, 9);
  g.generateTexture(TEXTURE_KEY, 28, 46);
  g.destroy();
}

/**
 * Moradores "de ambiente" perto da Novo Hiper (Progressão 2B): decorativos — sem diálogo, sem IA, sem
 * interação. Só presença, crescendo conforme os marcos (`primeira_melhoria` → `vizinhos_2` → `vizinhos_3`)
 * são alcançados, para o bairro parecer mais vivo.
 */
export function createEnvironmentalNeighbors(scene: Phaser.Scene): EnvironmentalNeighborsController {
  ensureTexture(scene);
  const sprites = SPOTS.map((spot, i) =>
    scene.add.image(spot.x, spot.y, TEXTURE_KEY).setTint(TINTS[i % TINTS.length]).setDepth(5).setVisible(false)
  );
  let last = -1;
  return {
    setCount(n) {
      const count = Math.max(0, Math.min(n, sprites.length));
      if (count === last) return;
      last = count;
      sprites.forEach((s, i) => s.setVisible(i < count));
    },
  };
}
