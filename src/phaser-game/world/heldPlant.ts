import Phaser from 'phaser';

const KEY = 'vaso-carregado';

/** Vaso provisório (placeholder, bem identificável): gerado uma vez, reaproveitado em todas as cenas. */
function ensureHeldPlantTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x92400e, 1);
  g.fillRoundedRect(2, 14, 20, 14, 3); // vaso de barro
  g.fillStyle(0x15803d, 1);
  g.fillCircle(12, 10, 10); // folhagem
  g.fillStyle(0x22c55e, 1);
  g.fillCircle(7, 6, 6);
  g.generateTexture(KEY, 24, 28);
  g.destroy();
}

/** Imagem do vaso "na mão" de Bernardo — criada invisível; a cena decide quando mostrar (pedido com status 'pronto'). */
export function createHeldPlantImage(scene: Phaser.Scene, depth: number): Phaser.GameObjects.Image {
  ensureHeldPlantTexture(scene);
  return scene.add.image(0, 0, KEY).setDepth(depth).setVisible(false);
}

/**
 * Arquitetura do item carregado: objeto visual SEPARADO do sprite do Bernardo (não desenhado nos quadros de
 * caminhada). Aqui, só um deslocamento simples conforme o lado que Bernardo está olhando — não tenta mapear
 * posição exata da mão por quadro de animação (fora de escopo deste marco).
 */
export function positionHeldPlant(img: Phaser.GameObjects.Image, player: { x: number; y: number }, facingLeft: boolean) {
  img.setPosition(player.x + (facingLeft ? -16 : 16), player.y - 4);
}
