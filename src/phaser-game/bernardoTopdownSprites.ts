import Phaser from 'phaser';
import { FACING_ROW, Facing, TOPDOWN_SPRITE, TOPDOWN_WALK_FPS, frameIndex } from './config/topdownSpriteConfig';

export function preloadBernardoTopdownSprites(scene: Phaser.Scene) {
  if (scene.textures.exists(TOPDOWN_SPRITE.textureKey)) return;
  scene.load.spritesheet(TOPDOWN_SPRITE.textureKey, TOPDOWN_SPRITE.path, {
    frameWidth: TOPDOWN_SPRITE.frameWidth,
    frameHeight: TOPDOWN_SPRITE.frameHeight,
  });
}

/** Cria as animações (uma vez por jogo): idle de 1 frame e caminhada de 4 frames para cada direção. */
export function createBernardoTopdownAnimations(scene: Phaser.Scene) {
  // O desenho é arte suavizada (não pixel art de grade): mantém o filtro do jogo, sem forçar NEAREST aqui
  (Object.keys(FACING_ROW) as Facing[]).forEach((facing) => {
    const idleKey = `idle-${facing}`;
    if (!scene.anims.exists(`td-${idleKey}`)) {
      scene.anims.create({ key: `td-${idleKey}`, frames: [{ key: TOPDOWN_SPRITE.textureKey, frame: frameIndex(facing, 0) }], frameRate: 1, repeat: -1 });
    }
    const walkKey = `walk-${facing}`;
    if (!scene.anims.exists(`td-${walkKey}`)) {
      scene.anims.create({
        key: `td-${walkKey}`,
        frames: [1, 2, 3, 4].map((c) => ({ key: TOPDOWN_SPRITE.textureKey, frame: frameIndex(facing, c) })),
        frameRate: TOPDOWN_WALK_FPS,
        repeat: -1,
      });
    }
  });
}
