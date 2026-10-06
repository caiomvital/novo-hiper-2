import Phaser from 'phaser';
import { SCENE_KEYS } from '../sceneKeys';
import { InputState } from '../input/InputState';
import { WORLD, ENTRANCE_ZONE } from '../config/worldConfig';
import { REARM_DISTANCE, computeReturnPoint, distanceToEntrance, isInsideEntrance } from '../logic/worldEntrance';
import { consumeWorldReturnPoint, setWorldReturnPoint } from '../transition/transitionStore';

const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
const PLAYER_SPEED = WORLD.playerSpeed;
const DEFAULT_SPAWN = WORLD.defaultSpawn;
const PLAYER_TEXTURE_KEY = 'bernardo-top';

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private inputState!: InputState;
  private entranceVisual!: Phaser.GameObjects.Arc;
  private isTransitioning = false;
  private entranceArmed = true;

  constructor() {
    super(SCENE_KEYS.World);
  }

  create() {
    this.isTransitioning = false;
    this.entranceArmed = true;
    this.inputState = this.registry.get('inputState');
    this.registry.set('activeScene', 'world');

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.fadeIn(200, 0, 0, 0);

    // Chão provisório do bairro (placeholder — sem assets definitivos)
    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x3f6212);

    // Ruas provisórias, só pra dar noção de bairro
    const streetColor = 0x57534e;
    for (let x = 200; x < WORLD_WIDTH; x += 400) {
      this.add.rectangle(x, WORLD_HEIGHT / 2, 60, WORLD_HEIGHT, streetColor);
    }
    for (let y = 200; y < WORLD_HEIGHT; y += 400) {
      this.add.rectangle(WORLD_WIDTH / 2, y, WORLD_WIDTH, 60, streetColor);
    }

    // Blocos decorativos representando futuras casas/estabelecimentos (sem colisão nesta etapa)
    const placeholderBuildings = [
      { x: 420, y: 320, color: 0xb45309 },
      { x: 980, y: 420, color: 0x7c2d12 },
      { x: 600, y: 860, color: 0x92400e },
    ];
    placeholderBuildings.forEach((b) => {
      this.add.rectangle(b.x, b.y, 120, 120, b.color).setStrokeStyle(4, 0x1c1917);
    });

    // Zona de entrada da área especial (trecho de plataforma)
    this.entranceVisual = this.add.circle(ENTRANCE_ZONE.x, ENTRANCE_ZONE.y, ENTRANCE_ZONE.radius, 0xf97316, 0.85);
    this.entranceVisual.setStrokeStyle(4, 0xfff7ed);
    this.add
      .text(ENTRANCE_ZONE.x, ENTRANCE_ZONE.y - ENTRANCE_ZONE.radius - 26, 'ENTRADA', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#1c1917',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: this.entranceVisual, scale: 1.15, yoyo: true, repeat: -1, duration: 700 });

    // Jogador (Bernardo) — placeholder retangular claramente identificável
    this.createPlayerTexture();
    const returnPoint = consumeWorldReturnPoint();
    const spawn = returnPoint ?? DEFAULT_SPAWN;
    // Voltando da plataforma: a entrada só rearma depois que Bernardo se afastar dela
    if (returnPoint) this.entranceArmed = false;
    this.player = this.physics.add.sprite(spawn.x, spawn.y, PLAYER_TEXTURE_KEY);
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(32, 44);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.add
      .text(16, 16, 'Setas / WASD para andar pelo bairro', {
        fontSize: '14px',
        color: '#fafaf9',
        backgroundColor: '#1c1917cc',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0);
  }

  /** Estado exposto à interface de diagnóstico (só consumida em dev/teste). */
  getDebugState() {
    return {
      player: this.player ? { x: this.player.x, y: this.player.y } : null,
      transitioning: this.isTransitioning,
      goalReached: false,
      entranceArmed: this.entranceArmed,
      fallRespawns: 0,
    };
  }

  teleportPlayer(x: number, y: number) {
    this.player.setPosition(x, y);
  }

  private createPlayerTexture() {
    if (this.textures.exists(PLAYER_TEXTURE_KEY)) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x059669, 1);
    g.fillRoundedRect(0, 0, 32, 44, 8);
    g.fillStyle(0xfacc15, 1);
    g.fillRect(8, 8, 16, 10);
    g.generateTexture(PLAYER_TEXTURE_KEY, 32, 44);
    g.destroy();
  }

  update() {
    if (this.isTransitioning) return;

    const input = this.inputState.snapshot;
    let vx = 0;
    let vy = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    if (input.up) vy -= 1;
    if (input.down) vy += 1;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      body.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);
    } else {
      body.setVelocity(0, 0);
    }

    if (!this.entranceArmed && distanceToEntrance(this.player) > REARM_DISTANCE) {
      this.entranceArmed = true;
    }
    if (this.entranceArmed && isInsideEntrance(this.player)) {
      this.handleEnterPlatform();
    }
  }

  private handleEnterPlatform() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // Guarda onde Bernardo deve reaparecer: no lado de onde ele veio, FORA da zona de entrada
    setWorldReturnPoint(computeReturnPoint(this.player));

    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.Platform);
    });
  }
}
