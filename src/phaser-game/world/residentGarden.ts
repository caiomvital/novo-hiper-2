import Phaser from 'phaser';
import type { ResidentStory } from '../../shared/residentStory';
import { MARIA_CUSTOMER_ID } from '../../shared/residentStory';
import { ROSTER } from '../../shared/roster';
import { resolveDestination } from '../config/houseCatalog';
import { NPC_TEXTURE, applyNpcAppearance } from './npcArt';
import { createHeldPlantImage } from './heldPlant';
import { worldDepthAt } from '../logic/worldDepth';

/** Decoração e conversa: sem colisão nova, alteração de pedido ou efeito financeiro. */
export function createResidentGarden(scene: Phaser.Scene) {
  const soil = scene.add.graphics();
  const pot = createHeldPlantImage(scene, 1);
  const label = scene.add.text(0, 0, '', { fontSize: '11px', color: '#ecfccb', backgroundColor: '#1a2e05dd', padding: { x: 5, y: 3 }, wordWrap: { width: 120 }, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
  const maria = scene.add.image(0, 0, NPC_TEXTURE, `${MARIA_CUSTOMER_ID}-down`);
  applyNpcAppearance(maria, MARIA_CUSTOMER_ID);
  const name = scene.add.text(0, 0, 'Dona Maria · conversar', { fontSize: '11px', color: '#fff7ed', backgroundColor: '#292524dd', padding: { x: 5, y: 3 } }).setOrigin(0.5, 1);
  let state = { planted: false, plantName: null as string | null, x: 0, y: 0, npcVisible: false, destinationId: '' };
  return {
    apply(story: ResidentStory | undefined, activeCustomerId: string | null) {
      const destination = resolveDestination(story?.destinationId ?? ROSTER.find(r => r.id === MARIA_CUSTOMER_ID)!.destinationId);
      const visible = destination.status === 'house';
      soil.setVisible(visible); label.setVisible(visible); maria.setVisible(visible && activeCustomerId !== MARIA_CUSTOMER_ID); name.setVisible(maria.visible);
      if (destination.status !== 'house') { pot.setVisible(false); return; }
      const house = destination.house, x = house.rect.x + 34, y = house.deliveryPoint.y;
      const planted = story?.status === 'completed';
      soil.clear().setDepth(worldDepthAt(y - 28));
      soil.fillStyle(planted ? 0x627a36 : 0x8c7658).fillRoundedRect(x - 38, y - 22, 76, 44, 8);
      soil.lineStyle(3, planted ? 0xb4cc72 : 0xbba17c).strokeRoundedRect(x - 38, y - 22, 76, 44, 8);
      if (planted) {
        soil.fillStyle(0xfef3c7); for (const offset of [-28, 28]) { soil.fillCircle(x + offset, y - 9, 3); soil.fillCircle(x + offset, y + 9, 3); }
      }
      pot.setPosition(x, y - 7).setScale(1.5).setDepth(worldDepthAt(y + 18)).setVisible(planted);
      label.setPosition(x, y + 25).setText(planted ? story.plantName || 'Planta da Novo Hiper' : 'O cantinho de Dona Maria').setDepth(worldDepthAt(y + 20) + 0.01);
      maria.setPosition(house.deliveryPoint.x, y).setDepth(worldDepthAt(y + 22));
      name.setPosition(house.deliveryPoint.x, y - 44).setDepth(worldDepthAt(y + 22) + 0.01);
      state = { planted, plantName: story?.plantName ?? null, x: house.deliveryPoint.x, y, npcVisible: maria.visible, destinationId: house.destinationId };
    },
    near(player: { x: number; y: number }) { return state.destinationId !== '' && Math.hypot(player.x - state.x, player.y - state.y) < 92; },
    getState: () => state,
  };
}
