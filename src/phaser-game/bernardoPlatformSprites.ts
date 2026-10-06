import Phaser from 'phaser';
import { BERNARDO_ANIMS, BERNARDO_SPRITE, BERNARDO_TEXTURES } from './config/spriteConfig';

const FILES: Record<keyof typeof BERNARDO_TEXTURES, string> = {
  idleRight: 'idle-right.png',
  idleLeft: 'idle-left.png',
  walkRight: 'walk-right.png',
  walkLeft: 'walk-left.png',
  jump: 'jump.png',
  thumbsUp: 'thumbs-up-front.png',
};

export function preloadBernardoPlatformSprites(scene: Phaser.Scene) {
  (Object.keys(FILES) as Array<keyof typeof FILES>).forEach((name) => {
    const key = BERNARDO_TEXTURES[name];
    if (scene.textures.exists(key)) return;
    scene.load.spritesheet(key, `${BERNARDO_SPRITE.basePath}/${FILES[name]}`, {
      frameWidth: BERNARDO_SPRITE.frameWidth,
      frameHeight: BERNARDO_SPRITE.frameHeight,
    });
  });
}

/** Cria as animações (uma vez por jogo) e força nearest-neighbor nas texturas. */
export function createBernardoPlatformAnimations(scene: Phaser.Scene) {
  Object.values(BERNARDO_TEXTURES).forEach((key) => scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST));
  Object.values(BERNARDO_ANIMS).forEach((def) => {
    if (scene.anims.exists(def.key)) return;
    scene.anims.create({
      key: def.key,
      frames: def.frames.map((frame) => ({ key: def.texture, frame })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  });
}
