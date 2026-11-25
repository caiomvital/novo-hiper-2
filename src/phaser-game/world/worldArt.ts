import Phaser from 'phaser';
import runtimeArt from '../../../final-assets/runtime/world-art.json';
import { GROUND_CELL, GROUND_PATTERN_CELLS, GROUND_PATTERNS, TERRAIN_FRAMES, type GroundTile } from '../config/terrainArt';
export type { GroundTile } from '../config/terrainArt';
import type { Rect } from '../logic/worldGeometry';

const terrainUrl = new URL('../../../final-assets/runtime/terrain.webp', import.meta.url).href;
const TERRAIN = 'bairro-terrain';
export const SHOP_ART = 'bairro-novo-hiper';
const shopUrl = new URL('../../../final-assets/runtime/shop.webp', import.meta.url).href;
export const PILOT_HOUSE_ART = 'bairro-casa-piloto';
const pilotHouseUrl = new URL('../../../final-assets/runtime/house.webp', import.meta.url).href;
/** Centro da soleira nas imagens-fonte; a parede lateral desloca o centro da silhueta. */
export const PILOT_BUILDING_ANCHORS = {
  shop: { x: 690, y: 1015 },
  house: { x: 600, y: 1062 },
} as const;
export const HOUSE_ART = 'bairro-houses';
export const NORTH_HOUSE_ART = 'bairro-houses-north';
export const URBAN_ART = 'bairro-urban';
const housesUrl = new URL('../../../final-assets/runtime/houses.webp', import.meta.url).href;
const northHousesUrl = new URL('../../../final-assets/runtime/houses-north.webp', import.meta.url).href;
const urbanUrl = new URL('../../../final-assets/runtime/urban.webp', import.meta.url).href;

export function preloadWorldArt(scene: Phaser.Scene) {
  if (!scene.textures.exists(TERRAIN)) scene.load.image(TERRAIN, terrainUrl);
  if (!scene.textures.exists(SHOP_ART)) scene.load.image(SHOP_ART, shopUrl);
  if (!scene.textures.exists(PILOT_HOUSE_ART)) scene.load.image(PILOT_HOUSE_ART, pilotHouseUrl);
  if (!scene.textures.exists(HOUSE_ART)) scene.load.image(HOUSE_ART, housesUrl);
  if (!scene.textures.exists(NORTH_HOUSE_ART)) scene.load.image(NORTH_HOUSE_ART, northHousesUrl);
  if (!scene.textures.exists(URBAN_ART)) scene.load.image(URBAN_ART, urbanUrl);
}

export function prepareWorldArt(scene: Phaser.Scene) {
  for (const [key, catalog] of [[HOUSE_ART, runtimeArt.houses], [NORTH_HOUSE_ART, runtimeArt['houses-north']], [URBAN_ART, runtimeArt.urban], [SHOP_ART, runtimeArt.shop], [PILOT_HOUSE_ART, runtimeArt.house]] as const) {
    const texture = scene.textures.get(key);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const [name, bounds] of Object.entries(catalog.frames)) {
      if (!texture.has(name)) { const [x, y, w, h] = bounds; texture.add(name, 0, x, y, w, h); }
    }
  }
  const texture = scene.textures.get(TERRAIN);
  if (texture.key === '__MISSING') return;
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const scale = texture.getSourceImage().width / 2048;
  for (const [name, [x, y, width, height]] of Object.entries(TERRAIN_FRAMES)) {
    if (!texture.has(name)) texture.add(name, 0, Math.round(x * scale), Math.round(y * scale), Math.round(width * scale), Math.round(height * scale));
  }
  // Um mosaico pequeno por material, reutilizado por todos os quarteirões.
  // Não cria um GameObject por ladrilho: mantém o custo baixo no celular.
  for (const [material, variants] of Object.entries(GROUND_PATTERNS)) {
    const key = `bairro-ground-${material}`;
    if (scene.textures.exists(key)) continue;
    const size = GROUND_CELL * GROUND_PATTERN_CELLS;
    const pattern = scene.textures.createCanvas(key, size, size)!;
    const context = pattern.getContext();
    context.imageSmoothingEnabled = false;
    const source = texture.getSourceImage() as HTMLImageElement;
    for (let row = 0; row < GROUND_PATTERN_CELLS; row++) for (let col = 0; col < GROUND_PATTERN_CELLS; col++) {
      const hash = ((col + 11) * 374761393 ^ (row + 7) * 668265263) >>> 0;
      const variant = material === 'paving' || material === 'asphalt' ? (hash % 19 === 0 ? 1 : 0) : hash % variants.length;
      const frame = texture.get(variants[variant]);
      // A folha contém linhas de registro nas bordas de algumas peças.
      // Recorte interno evita trazer essas linhas para cada repetição do chão.
      const inset = material === 'grass' || material === 'flowers' ? Math.round(8 * scale) : Math.round(3 * scale);
      context.drawImage(source, frame.cutX + inset, frame.cutY + inset, frame.cutWidth - inset * 2, frame.cutHeight - inset * 2, col * GROUND_CELL, row * GROUND_CELL, GROUND_CELL, GROUND_CELL);
      if (material === 'paving') {
        context.strokeStyle = 'rgba(112, 97, 76, 0.14)';
        context.strokeRect(col * GROUND_CELL + .5, row * GROUND_CELL + .5, GROUND_CELL - 1, GROUND_CELL - 1);
      }
    }
    pattern.refresh();
    pattern.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

export function drawGround(scene: Phaser.Scene, rect: Rect, tile: GroundTile, depth = -1) {
  return scene.add.tileSprite(rect.x, rect.y, rect.w, rect.h, `bairro-ground-${tile}`)
    .setOrigin(0).setTilePosition(rect.x, rect.y).setDepth(depth);
}
