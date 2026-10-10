import Phaser from 'phaser';
import { WORLD_MAP } from '../config/worldMap';
import { rectCenter } from '../logic/worldGeometry';
import type { ObraLesteStage } from '../../services/api';

const GATE_ID = 'obras_leste';

export interface ObraLesteController {
  setStage(stage: ObraLesteStage): void;
}

/**
 * Decorações da obra leste (Progressão 2B — "o bairro reage"): cones/máquina/operário no estágio `ativa`,
 * visual "quase pronta" em `quase_pronta`, e um aviso diegético (placa) nos dois. A BARREIRA em si (listras
 * amarelo/preto + rótulo "EM OBRAS") é estática e nunca muda nos três estágios — ver `drawWorld.ts`; aqui só
 * se desenha o que fica NA FRENTE dela, do lado por onde Bernardo se aproxima (oeste).
 */
export function createObraLeste(scene: Phaser.Scene): ObraLesteController {
  const gate = WORLD_MAP.gates.find((g) => g.id === GATE_ID)!;
  const c = rectCenter(gate.rect);
  const left = gate.rect.x - 56;

  const g = scene.add.graphics().setDepth(1.5);
  const sign = scene.add
    .text(left - 10, c.y, '', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#1c1917',
      backgroundColor: '#fde68a',
      padding: { x: 8, y: 5 },
      wordWrap: { width: 130 },
      align: 'center',
    })
    .setOrigin(1, 0.5)
    .setDepth(2)
    .setVisible(false);

  let last: ObraLesteStage | null = null;

  function drawAtiva() {
    g.clear();
    for (const dx of [-40, -24, -8]) {
      g.fillStyle(0xea580c, 1);
      g.fillTriangle(left + dx, c.y + 20, left + dx - 7, c.y + 36, left + dx + 7, c.y + 36);
      g.fillStyle(0xfafaf9, 1);
      g.fillRect(left + dx - 4, c.y + 26, 8, 3);
    }
    g.fillStyle(0xca8a04, 1);
    g.fillRect(left - 64, c.y - 50, 34, 22);
    g.fillStyle(0x1c1917, 1);
    g.fillRect(left - 60, c.y - 46, 10, 10);
    g.fillStyle(0x1d4ed8, 1);
    g.fillRoundedRect(left - 20, c.y - 44, 16, 24, 4);
    g.fillStyle(0xfcd9b6, 1);
    g.fillCircle(left - 12, c.y - 52, 6);
    g.fillStyle(0xea580c, 1);
    g.fillCircle(left - 12, c.y - 56, 7);
  }

  function drawQuasePronta() {
    g.clear();
    g.fillStyle(0xd6d3d1, 1);
    g.fillRect(left - 70, c.y - 50, 96, 70);
    g.lineStyle(3, 0x78716c, 1);
    g.strokeRect(left - 70, c.y - 50, 96, 70);
  }

  return {
    setStage(stage) {
      if (stage === last) return;
      last = stage;
      if (stage === 'ativa') {
        drawAtiva();
        sign.setText('Obra avançando.\nFalta pouco!').setVisible(true);
      } else if (stage === 'quase_pronta') {
        drawQuasePronta();
        sign.setText('Quase pronta!').setVisible(true);
      } else {
        g.clear();
        sign.setVisible(false);
      }
    },
  };
}
