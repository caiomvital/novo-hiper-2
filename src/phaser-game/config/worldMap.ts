/**
 * Dados do mapa do WorldScene. A cena LÊ tudo daqui (limites da física e da câmera, fundo, ruas, prédios,
 * spawn, entrada da plataforma e cliente): trocar por um mapa maior é trocar estes dados, sem mexer na cena.
 * O viewport (janela, tela cheia, celular) é independente das dimensões do mundo.
 * O mapa atual (1600x1200) é apenas o primeiro bairro/protótipo — não é o tamanho definitivo do mundo.
 */
export interface WorldMapData {
  width: number;
  height: number;
  spawn: { x: number; y: number };
  groundColor: number;
  streetColor: number;
  /** Ruas em grade: `first` = posição da primeira, `step` = espaçamento, `width` = largura da rua. */
  streets: { first: number; step: number; width: number };
  buildings: Array<{ x: number; y: number; color: number }>;
  buildingSize: number;
  /** Zona que leva à PlatformScene. */
  entrance: { x: number; y: number; radius: number };
  /** Cliente PROVISÓRIO do vertical slice (qualquer pedido é entregue aqui). */
  customer: { x: number; y: number; interactRadius: number };
}

export const WORLD_MAP: WorldMapData = {
  width: 1600,
  height: 1200,
  spawn: { x: 200, y: 200 },
  groundColor: 0x3f6212,
  streetColor: 0x57534e,
  streets: { first: 200, step: 400, width: 60 },
  buildings: [
    { x: 420, y: 320, color: 0xb45309 },
    { x: 980, y: 420, color: 0x7c2d12 },
    { x: 600, y: 860, color: 0x92400e },
  ],
  buildingSize: 120,
  entrance: { x: 1300, y: 900, radius: 42 },
  customer: { x: 1000, y: 520, interactRadius: 80 },
};

/** Posições (eixo x ou y) das ruas de uma dimensão `size` do mapa. */
export function streetPositions(size: number, streets: WorldMapData['streets']): number[] {
  const out: number[] = [];
  for (let p = streets.first; p < size; p += streets.step) out.push(p);
  return out;
}
