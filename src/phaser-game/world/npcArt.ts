import Phaser from 'phaser';
import { ROSTER } from '../../shared/roster';
import type { Facing } from '../config/topdownSpriteConfig';

export const NPC_TEXTURE = 'moradores-v1';
const imageUrl = new URL('../../../final-assets/runtime/residents.webp', import.meta.url).href;
const atlasUrl = new URL('../../../final-assets/npcs/moradores-v1-atlas.json', import.meta.url).href;
const SCALE = 0.36;

export function preloadNpcArt(scene: Phaser.Scene) {
  if (!scene.textures.exists(NPC_TEXTURE)) scene.load.atlas(NPC_TEXTURE, imageUrl, atlasUrl);
  if (!scene.textures.exists(NPC_WALK_TEXTURE)) scene.load.atlas(NPC_WALK_TEXTURE, walkImageUrl, walkAtlasUrl);
}

/** Clientes personalizados recebem uma aparência estável, preservando seu nome e destino reais. */
export function npcIdentity(customerId: string): string {
  if (ROSTER.some(r => r.id === customerId)) return customerId;
  let hash = 0;
  for (const c of customerId) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return ROSTER[hash % ROSTER.length].id;
}

export function applyNpcAppearance(image: Phaser.GameObjects.Image, customerId: string, facing: Facing = 'down') {
  const frame = `${npcIdentity(customerId)}-${facing}`;
  if (image.texture.key !== NPC_TEXTURE || image.frame.name !== frame) image.setTexture(NPC_TEXTURE, frame);
  const height = image.frame.realHeight;
  // O ponto do NPC continua sendo o centro usado na interação; pés 22px abaixo, como Bernardo.
  image.setScale(SCALE).setOrigin(0.5, (height - 3 - 22 / SCALE) / height).clearTint();
}

export const NPC_WALK_TEXTURE = 'moradores-walk-v1';
const walkImageUrl = new URL('../../../final-assets/runtime/residents-walk.webp', import.meta.url).href;
const walkAtlasUrl = new URL('../../../final-assets/npcs/moradores-walk-v1-atlas.json', import.meta.url).href;

export function applyNpcWalkAppearance(image: Phaser.GameObjects.Image, id: string, facing: Facing, stride: number) {
  const key = `${id}-${facing}-${stride}`;
  if (image.texture.key !== NPC_WALK_TEXTURE || image.frame.name !== key) image.setTexture(NPC_WALK_TEXTURE, key);
  const idleHeight = image.scene.textures.getFrame(NPC_TEXTURE, `${id}-${facing}`).realHeight;
  const height = image.frame.realHeight;
  const scale = idleHeight * SCALE / height;
  image.setScale(scale).setOrigin(0.5, (height - 2 - 22 / scale) / height).clearTint();
}
