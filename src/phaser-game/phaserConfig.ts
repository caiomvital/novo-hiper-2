import Phaser from 'phaser';
import { WorldScene } from './scenes/WorldScene';
import { PlatformScene } from './scenes/PlatformScene';

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#1c1917',
    // Pixel art: sem suavização (nearest-neighbor) e posições arredondadas
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [WorldScene, PlatformScene],
  };
}
