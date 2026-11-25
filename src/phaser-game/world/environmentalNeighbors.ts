import Phaser from 'phaser';
import { NPC_TEXTURE, applyNpcAppearance, applyNpcWalkAppearance, npcIdentity } from './npcArt';
import { worldDepthAt } from '../logic/worldDepth';
import { createNeighborWalk, NEIGHBOR_ROUTES, updateNeighborWalk } from '../logic/neighborWalk';

export interface EnvironmentalNeighborsController {
  setPopulation(n: number, customerId: string | null): void;
  update(delta: number, player: { x: number; y: number }, paused: boolean): void;
  getState(): Array<{ id: string; x: number; y: number; visible: boolean; moving: boolean; attentive: boolean; facing: string; frame: string; texture: string; depth: number }>;
}

/** Passeios decorativos em calçadas: sem corpos físicos ou interação financeira. */
export function createEnvironmentalNeighbors(scene: Phaser.Scene): EnvironmentalNeighborsController {
  const neighbors = NEIGHBOR_ROUTES.map(route => {
    const walk = createNeighborWalk(route.points[0]);
    const image = scene.add.image(walk.x, walk.y, NPC_TEXTURE, `${route.id}-down`).setVisible(false);
    applyNpcAppearance(image, route.id);
    return { route, walk, image };
  });
  return {
    setPopulation(n, customerId) {
      const count = Math.max(0, Math.min(n, neighbors.length));
      const customer = customerId ? npcIdentity(customerId) : null;
      // Um morador que está esperando uma entrega fica apenas na sua casa.
      neighbors.forEach(({ route, image }, i) => image.setVisible(i < count && route.id !== customer));
    },
    update(delta, player, paused) {
      for (const { route, walk, image } of neighbors) {
        if (!image.visible) continue;
        updateNeighborWalk(walk, route.points, player, delta, paused, route.wait);
        image.setPosition(walk.x, walk.y).setDepth(worldDepthAt(walk.y + 22));
        const step = [0, -1, 1, -1][Math.floor(walk.stride / 160) % 4];
        if (walk.moving && step >= 0) applyNpcWalkAppearance(image, route.id, walk.facing, step);
        else applyNpcAppearance(image, route.id, walk.facing);
      }
    },
    getState: () => neighbors.map(({ route, walk, image }) => ({ id: route.id, x: walk.x, y: walk.y, visible: image.visible, moving: walk.moving, attentive: walk.attentive, facing: walk.facing, frame: String(image.frame.name), texture: image.texture.key, depth: image.depth })),
  };
}
