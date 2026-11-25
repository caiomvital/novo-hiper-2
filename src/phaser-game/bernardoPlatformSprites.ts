import Phaser from 'phaser';
import { BERNARDO_ANIMS, BERNARDO_SPRITE, BERNARDO_TEXTURES } from './config/spriteConfig';

const FILES: Record<keyof typeof BERNARDO_TEXTURES, string> = {
  idleRight: new URL('../../final-assets/bernardo/blond-v2/platform/idle-right.png', import.meta.url).href,
  idleLeft: new URL('../../final-assets/bernardo/blond-v2/platform/idle-left.png', import.meta.url).href,
  walkRight: new URL('../../final-assets/bernardo/blond-v2/platform/walk-right.png', import.meta.url).href,
  walkLeft: new URL('../../final-assets/bernardo/blond-v2/platform/walk-left.png', import.meta.url).href,
  jump: new URL('../../final-assets/bernardo/blond-v2/platform/jump.png', import.meta.url).href,
  thumbsUp: new URL('../../final-assets/bernardo/blond-v2/platform/thumbs-up-front.png', import.meta.url).href,
};

export function preloadBernardoPlatformSprites(scene: Phaser.Scene) {
  (Object.keys(FILES) as Array<keyof typeof FILES>).forEach((name) => {
    const key = BERNARDO_TEXTURES[name];
    if (scene.textures.exists(key)) return;
    scene.load.spritesheet(key, FILES[name], {
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
