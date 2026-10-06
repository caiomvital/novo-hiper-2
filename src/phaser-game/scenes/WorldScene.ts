import Phaser from 'phaser';
import { SCENE_KEYS } from '../sceneKeys';
import { InputState } from '../input/InputState';
import { WORLD, ENTRANCE_ZONE, CUSTOMER_SPOT } from '../config/worldConfig';
import { isWithinRadius } from '../logic/proximity';
import { formatBRL } from '../logic/format';
import type { AdventureBridge, AdventureSnapshot } from '../bridge/adventureBridge';
import { REARM_DISTANCE, computeReturnPoint, distanceToEntrance, isInsideEntrance } from '../logic/worldEntrance';
import { consumeWorldReturnPoint, setWorldReturnPoint } from '../transition/transitionStore';

const WORLD_WIDTH = WORLD.width;
const WORLD_HEIGHT = WORLD.height;
const PLAYER_SPEED = WORLD.playerSpeed;
const DEFAULT_SPAWN = WORLD.defaultSpawn;
const PLAYER_TEXTURE_KEY = 'bernardo-top';
const CUSTOMER_TEXTURE_KEY = 'cliente-provisorio';

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private inputState!: InputState;
  private entranceVisual!: Phaser.GameObjects.Arc;
  private isTransitioning = false;
  private entranceArmed = true;

  // ── Vertical slice de entrega (o Phaser só EMITE a intenção; React chama a API) ──
  private bridge: AdventureBridge | null = null;
  private unsubscribeBridge: (() => void) | null = null;
  private snap: AdventureSnapshot | null = null;
  private customerSprite!: Phaser.GameObjects.Image;
  private customerLabel!: Phaser.GameObjects.Text;
  private customerMarker!: Phaser.GameObjects.Text;
  private deliveryHud!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private nearCustomer = false;
  private feedbackPlayedFor: string | null = null;

  constructor() {
    super(SCENE_KEYS.World);
  }

  create() {
    this.isTransitioning = false;
    this.entranceArmed = true;
    this.snap = null;
    this.nearCustomer = false;
    this.feedbackPlayedFor = null;
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

    this.createDeliveryUi();
  }

  // ───────────────────────── entrega (vertical slice) ─────────────────────────
  private createDeliveryUi() {
    this.createCustomerTexture();
    this.customerSprite = this.add.image(CUSTOMER_SPOT.x, CUSTOMER_SPOT.y, CUSTOMER_TEXTURE_KEY).setVisible(false);
    this.customerLabel = this.add
      .text(CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 34, '', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#1c1917cc',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.customerMarker = this.add
      .text(CUSTOMER_SPOT.x, CUSTOMER_SPOT.y - 50, '!', { fontSize: '28px', fontStyle: 'bold', color: '#fbbf24', stroke: '#1c1917', strokeThickness: 5 })
      .setOrigin(0.5)
      .setVisible(false);
    this.tweens.add({ targets: this.customerMarker, y: CUSTOMER_SPOT.y - 58, yoyo: true, repeat: -1, duration: 500 });

    this.deliveryHud = this.add
      .text(16, 50, '', { fontSize: '13px', color: '#fafaf9', backgroundColor: '#1c1917cc', padding: { x: 8, y: 5 } })
      .setScrollFactor(0)
      .setVisible(false);
    this.promptText = this.add
      .text(this.cameras.main.width / 2, this.cameras.main.height - 150, '', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#b45309',
        padding: { x: 12, y: 7 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);

    // Ponte com o React: lê o snapshot e ouve as mudanças; limpa a assinatura ao sair da cena
    this.bridge = (this.registry.get('bridge') as AdventureBridge | undefined) ?? null;
    this.inputState.consumePress('interact'); // descarta aperto antigo
    if (this.bridge) {
      this.unsubscribeBridge = this.bridge.subscribe((snap) => this.applySnapshot(snap));
      this.applySnapshot(this.bridge.getSnapshot());
    }
    const cleanup = () => {
      this.unsubscribeBridge?.();
      this.unsubscribeBridge = null;
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private createCustomerTexture() {
    if (this.textures.exists(CUSTOMER_TEXTURE_KEY)) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xc2410c, 1);
    g.fillRoundedRect(0, 8, 32, 44, 8); // corpo
    g.fillStyle(0xfcd9b6, 1);
    g.fillCircle(16, 12, 11); // cabeça
    g.fillStyle(0x1c1917, 1);
    g.fillRect(10, 10, 4, 4);
    g.fillRect(19, 10, 4, 4);
    g.generateTexture(CUSTOMER_TEXTURE_KEY, 32, 52);
    g.destroy();
  }

  /** Reflete o snapshot do React no mundo. Toda a lógica de negócio fica no React/backend. */
  private applySnapshot(snap: AdventureSnapshot) {
    this.snap = snap;
    const order = snap.activeOrder;
    this.customerSprite.setVisible(Boolean(order));
    this.customerLabel.setVisible(Boolean(order)).setText(order ? order.customerName : '');
    this.customerMarker.setVisible(Boolean(order) && snap.phase === 'idle');

    let text = '';
    let color = '#fafaf9';
    if (!snap.loaded) text = '';
    else if (snap.phase === 'delivering') text = 'Entregando…';
    else if (snap.phase === 'done' && snap.lastDelivery) {
      text = `Entrega concluída! ${formatBRL(snap.lastDelivery.reward)} no caixa`;
      color = '#86efac';
    } else if (snap.phase === 'error') {
      text = snap.message || 'Não foi possível entregar agora.';
      color = '#fca5a5';
    } else if (order) text = `Entrega #${order.orderNumber}: ${order.plantName} para ${order.customerName}`;
    else text = 'Sem entregas no momento';
    this.deliveryHud.setText(text).setColor(color).setVisible(text !== '');

    if (snap.phase === 'done' && snap.lastDelivery && this.feedbackPlayedFor !== snap.lastDelivery.order.id) {
      this.feedbackPlayedFor = snap.lastDelivery.order.id;
      this.playDeliveryFeedback(snap.lastDelivery.reward);
    }
  }

  /** Confirmação visual: o cliente reage (pulinho) e "+ R$ X,XX" sobe e some. */
  private playDeliveryFeedback(reward: number) {
    this.tweens.add({ targets: this.customerSprite, y: CUSTOMER_SPOT.y - 16, yoyo: true, repeat: 2, duration: 160 });
    const money = this.add
      .text(CUSTOMER_SPOT.x, CUSTOMER_SPOT.y - 40, `+ ${formatBRL(reward)}`, {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#bbf7d0',
        stroke: '#14532d',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);
    // sobe durante ~2,4 s e só começa a sumir na segunda metade (fica legível durante o feedback)
    this.tweens.add({ targets: money, y: CUSTOMER_SPOT.y - 120, duration: 2400, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: money, alpha: 0, delay: 1500, duration: 900, onComplete: () => money.destroy() });
  }

  private updateDelivery() {
    const snap = this.snap;
    const order = snap?.activeOrder ?? null;
    const canDeliver = Boolean(snap && order && snap.phase === 'idle');
    this.nearCustomer = canDeliver && isWithinRadius(this.player, CUSTOMER_SPOT, CUSTOMER_SPOT.interactRadius);
    this.promptText.setVisible(this.nearCustomer);
    if (this.nearCustomer && order) {
      this.promptText.setText(`E / ✋  Entregar ${order.plantName} para ${order.customerName}`);
      this.promptText.setPosition(this.cameras.main.width / 2, this.cameras.main.height - 150);
    }
    const pressed = this.inputState.consumePress('interact');
    if (pressed && this.nearCustomer && order && this.bridge) {
      // Só EMITE a intenção: o React valida e chama start/finish; o backend é a autoridade.
      this.bridge.emitIntent({ type: 'deliver', orderId: order.id });
    }
  }

  /** Estado exposto à interface de diagnóstico (só consumida em dev/teste). */
  getDebugState() {
    return {
      player: this.player ? { x: this.player.x, y: this.player.y } : null,
      transitioning: this.isTransitioning,
      goalReached: false,
      entranceArmed: this.entranceArmed,
      fallRespawns: 0,
      delivery: {
        loaded: this.snap?.loaded ?? false,
        phase: this.snap?.phase ?? 'idle',
        activeOrderId: this.snap?.activeOrder?.id ?? null,
        customerName: this.snap?.activeOrder?.customerName ?? null,
        customerVisible: this.customerSprite?.visible ?? false,
        customer: { x: CUSTOMER_SPOT.x, y: CUSTOMER_SPOT.y },
        near: this.nearCustomer,
        promptVisible: this.promptText?.visible ?? false,
        hud: this.deliveryHud?.text ?? '',
        lastReward: this.snap?.lastDelivery?.reward ?? null,
      },
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
    this.updateDelivery();
    if (this.snap?.phase === 'delivering') {
      body.setVelocity(0, 0); // parado enquanto o servidor confirma a entrega
      return;
    }
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
