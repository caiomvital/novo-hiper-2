import type Phaser from 'phaser';
import type { InputState } from '../input/InputState';

export interface AdventureDiagnostics {
  scene: 'world' | 'platform' | null;
  player: { x: number; y: number } | null;
  transitioning: boolean;
  goalReached: boolean;
  entranceArmed: boolean;
  fallRespawns: number;
  lastSafeGround?: { x: number; y: number } | null;
  sprite?: {
    anim: string;
    animPlaying: boolean;
    texture: string;
    frame: number;
    flipX: boolean;
    scale: number;
    body: { x: number; y: number; width: number; height: number };
  } | null;
  canvasCount: number;
  /** Só na WorldScene: número da instância da cena (muda se a cena for recriada). */
  instance?: number;
  /** Só na WorldScene: câmera e limites do mundo. */
  camera?: {
    scrollX: number;
    scrollY: number;
    width: number;
    height: number;
    zoom: number;
    bounds: { x: number; y: number; width: number; height: number } | null;
    world: { width: number; height: number };
  } | null;
  /** Só na WorldScene: estado da entrega (vertical slice). */
  delivery?: {
    loaded: boolean;
    phase: 'idle' | 'delivering' | 'done' | 'error';
    activeOrderId: string | null;
    customerName: string | null;
    customerVisible: boolean;
    customer: { x: number; y: number };
    destination: { id: string; status: 'house' | 'unknown'; houseId: string | null; legacy: boolean } | null;
    highlightVisible: boolean;
    near: boolean;
    promptVisible: boolean;
    hud: string;
    indicator: { meters: number; near: boolean; angle: number; text: string; arrowVisible: boolean } | null;
    lastReward: number | null;
  } | null;
}

export interface AdventureDebugApi {
  getState(): AdventureDiagnostics;
  /** Move o jogador (usado pelos testes para simular queda). */
  teleportPlayer(x: number, y: number): void;
  liveGames(): number;
}

declare global {
  interface Window {
    __NH_ADVENTURE__?: AdventureDebugApi;
  }
}

let liveGameCount = 0;

/**
 * Interface de diagnóstico para testes. Só existe em desenvolvimento/teste:
 * `import.meta.env.DEV` é substituído por `false` no build de produção e o bloco é removido.
 * Retorna a função de limpeza.
 */
export function installDiagnostics(game: Phaser.Game, _input: InputState, container: HTMLElement): () => void {
  if (!import.meta.env.DEV) return () => {};

  liveGameCount++;
  const activeScene = () => {
    const key = game.registry.get('activeScene') as 'world' | 'platform' | undefined;
    if (!key) return null;
    return game.scene.getScene(key === 'world' ? 'WorldScene' : 'PlatformScene') as unknown as {
      getDebugState(): Omit<AdventureDiagnostics, 'scene' | 'canvasCount'>;
      teleportPlayer(x: number, y: number): void;
    } | null;
  };

  const api: AdventureDebugApi = {
    getState() {
      const scene = activeScene();
      const base = scene?.getDebugState();
      return {
        scene: (game.registry.get('activeScene') as 'world' | 'platform' | undefined) ?? null,
        player: base?.player ?? null,
        transitioning: base?.transitioning ?? false,
        goalReached: base?.goalReached ?? false,
        entranceArmed: base?.entranceArmed ?? false,
        fallRespawns: base?.fallRespawns ?? 0,
        lastSafeGround: (base as { lastSafeGround?: { x: number; y: number } } | undefined)?.lastSafeGround ?? null,
        sprite: (base as Pick<AdventureDiagnostics, 'sprite'> | undefined)?.sprite ?? null,
        delivery: (base as Pick<AdventureDiagnostics, 'delivery'> | undefined)?.delivery ?? null,
        instance: (base as Pick<AdventureDiagnostics, 'instance'> | undefined)?.instance,
        camera: (base as Pick<AdventureDiagnostics, 'camera'> | undefined)?.camera ?? null,
        canvasCount: container.querySelectorAll('canvas').length,
      };
    },
    teleportPlayer(x, y) {
      activeScene()?.teleportPlayer(x, y);
    },
    liveGames: () => liveGameCount,
  };
  window.__NH_ADVENTURE__ = api;

  return () => {
    liveGameCount--;
    if (window.__NH_ADVENTURE__ === api) delete window.__NH_ADVENTURE__;
  };
}
