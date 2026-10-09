import Phaser from 'phaser';
import { SCENE_KEYS } from '../sceneKeys';
import { InputState } from '../input/InputState';
import {
  COUNTER,
  INTERIOR_EXIT,
  INTERIOR_EXIT_REARM_DISTANCE,
  INTERIOR_ROOM,
  INTERIOR_SOLIDS,
  INTERIOR_SPAWN,
  PREP_BENCH,
  SHELVES,
  STOCK,
} from '../config/interiorMap';
import { drawInteriorRoom } from '../world/drawInteriorRoom';
import { rectCenter } from '../logic/worldGeometry';
import { isWithinRadius } from '../logic/proximity';
import {
  Facing,
  PLAYER_SPEED,
  TOPDOWN_BODY,
  TOPDOWN_BODY_OFFSET,
  TOPDOWN_ORIGIN,
  TOPDOWN_SHADOW,
  TOPDOWN_SPRITE,
  frameIndex,
} from '../config/topdownSpriteConfig';
import { createBernardoTopdownAnimations, preloadBernardoTopdownSprites } from '../bernardoTopdownSprites';
import { facingFromMovement, selectTopdownAnimation } from '../logic/topdownAnimation';
import { createHeldPlantImage, positionHeldPlant } from '../world/heldPlant';
import { setStoreReturnPoint } from '../transition/transitionStore';
import { STORE_RETURN_POINT } from '../logic/storeEntrance';
import { formatBRL } from '../logic/format';
import type { AdventureBridge, AdventureSnapshot } from '../bridge/adventureBridge';

let interiorSceneInstances = 0; // contador (diagnóstico): detecta se a cena foi recriada

export class NovoHiperInteriorScene extends Phaser.Scene {
  private instanceId = 0;
  private player!: Phaser.Physics.Arcade.Sprite;
  private inputState!: InputState;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private facing: Facing = 'up';
  private currentAnim = '';
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private heldPlant!: Phaser.GameObjects.Image;
  private isTransitioning = false;
  private exitArmed = false; // Bernardo acabou de entrar perto da porta: só rearma depois de se afastar

  private bridge: AdventureBridge | null = null;
  private unsubscribeBridge: (() => void) | null = null;
  private snap: AdventureSnapshot | null = null;
  private promptText!: Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private cashHud!: Phaser.GameObjects.Text;

  private nearShelf = false;
  private nearStock = false;
  private nearCounter = false;
  private nearPrep = false;

  constructor() {
    super(SCENE_KEYS.Interior);
  }

  preload() {
    preloadBernardoTopdownSprites(this);
  }

  create() {
    this.instanceId = ++interiorSceneInstances;
    this.isTransitioning = false;
    this.exitArmed = false;
    this.snap = null;
    this.nearShelf = false;
    this.nearStock = false;
    this.nearCounter = false;
    this.nearPrep = false;
    this.facing = 'up';
    this.currentAnim = '';
    this.inputState = this.registry.get('inputState');
    this.registry.set('activeScene', 'interior');

    this.physics.world.gravity.y = 0;
    this.physics.world.setBounds(0, 0, INTERIOR_ROOM.width, INTERIOR_ROOM.height);
    this.cameras.main.setBounds(0, 0, INTERIOR_ROOM.width, INTERIOR_ROOM.height);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    drawInteriorRoom(this);

    this.solids = this.physics.add.staticGroup();
    for (const r of INTERIOR_SOLIDS) {
      const c = rectCenter(r);
      const body = this.add.rectangle(c.x, c.y, r.w, r.h).setVisible(false);
      this.physics.add.existing(body, true);
      this.solids.add(body);
    }

    createBernardoTopdownAnimations(this);
    const spawn = INTERIOR_SPAWN;
    this.playerShadow = this.add
      .ellipse(spawn.x, spawn.y + TOPDOWN_BODY.height / 2, TOPDOWN_SHADOW.width, TOPDOWN_SHADOW.height, 0x000000, TOPDOWN_SHADOW.alpha)
      .setDepth(0.5);
    this.player = this.physics.add.sprite(spawn.x, spawn.y, TOPDOWN_SPRITE.textureKey, frameIndex('up', 0));
    this.player.setOrigin(TOPDOWN_ORIGIN.x, TOPDOWN_ORIGIN.y).setDepth(1);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solids);
    (this.player.body as Phaser.Physics.Arcade.Body)
      .setSize(TOPDOWN_BODY.width, TOPDOWN_BODY.height, false)
      .setOffset(TOPDOWN_BODY_OFFSET.x, TOPDOWN_BODY_OFFSET.y);
    this.player.anims.play('td-idle-up');
    this.currentAnim = 'idle-up';

    this.heldPlant = createHeldPlantImage(this, 1.5);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.controlsHint = this.add
      .text(16, 16, 'Setas / WASD para andar • E interage • volte pela porta para sair', {
        fontSize: '13px',
        color: '#fafaf9',
        backgroundColor: '#1c1917cc',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0);

    this.cashHud = this.add
      .text(0, 16, '', { fontSize: '13px', fontStyle: 'bold', color: '#bbf7d0', backgroundColor: '#1c1917cc', padding: { x: 8, y: 6 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);
    const layoutHud = () => {
      const w = this.scale.width;
      this.cashHud?.setPosition(w - 16, 16);
      this.controlsHint?.setVisible(w >= 620);
    };
    layoutHud();
    this.scale.on('resize', layoutHud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', layoutHud));

    this.promptText = this.add
      .text(this.cameras.main.width / 2, this.cameras.main.height - 60, '', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#b45309',
        padding: { x: 12, y: 7 },
        align: 'center',
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);

    this.bridge = (this.registry.get('bridge') as AdventureBridge | undefined) ?? null;
    this.inputState.consumePress('interact'); // descarta aperto antigo (ex.: usado para atravessar a porta)
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

  private applySnapshot(snap: AdventureSnapshot) {
    this.snap = snap;
    this.cashHud.setVisible(snap.cashBalance !== null).setText(snap.cashBalance !== null ? `Caixa: ${formatBRL(snap.cashBalance)}` : '');
  }

  teleportPlayer(x: number, y: number) {
    this.player.setPosition(x, y);
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
    this.updateInteractions();
    if (this.snap?.uiOpen) {
      body.setVelocity(0, 0); // painel React aberto (ex.: instalar melhoria): mundo parado
      this.updatePlayerVisual(0, 0);
      return;
    }
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      body.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);
    } else {
      body.setVelocity(0, 0);
    }
    this.updatePlayerVisual(vx, vy);

    const distToExit = Math.hypot(this.player.x - INTERIOR_EXIT.x, this.player.y - INTERIOR_EXIT.y);
    if (!this.exitArmed && distToExit > INTERIOR_EXIT_REARM_DISTANCE) this.exitArmed = true;
    if (this.exitArmed && distToExit < INTERIOR_EXIT.radius) this.handleExitStore();
  }

  private updatePlayerVisual(dx: number, dy: number) {
    this.facing = facingFromMovement(this.facing, dx, dy);
    const name = selectTopdownAnimation(this.facing, dx !== 0 || dy !== 0);
    if (name !== this.currentAnim) {
      this.currentAnim = name;
      this.player.anims.play(`td-${name}`);
    }
    this.playerShadow.setPosition(this.player.x, this.player.y + TOPDOWN_BODY.height / 2);
    const carrying = this.snap?.activeOrder?.status === 'pronto';
    this.heldPlant.setVisible(carrying);
    if (carrying) positionHeldPlant(this.heldPlant, this.player, this.facing === 'left');
  }

  /** Proximidade dos móveis, texto do prompt e intenção emitida ao apertar interagir. */
  private updateInteractions() {
    const snap = this.snap;
    const interactive = Boolean(snap) && !snap!.uiOpen;
    const order = snap?.activeOrder ?? null;
    const carrying = order?.status === 'pronto';
    const pendingInstall = (snap?.pendingUpgrades.length ?? 0) > 0;

    this.nearCounter = interactive && isWithinRadius(this.player, COUNTER.interact, COUNTER.interactRadius);
    this.nearShelf = interactive && SHELVES.some((s) => isWithinRadius(this.player, s.interact, s.interactRadius));
    this.nearStock = interactive && isWithinRadius(this.player, STOCK.interact, STOCK.interactRadius);
    this.nearPrep = interactive && isWithinRadius(this.player, PREP_BENCH.interact, PREP_BENCH.interactRadius);

    const canPickup = Boolean(order) && !carrying && order!.deliverable !== false;

    let text = '';
    let action: (() => void) | null = null;
    if (this.nearPrep) {
      if (carrying) text = 'Você já está com a planta! Leve até o cliente.';
      else if (!order) text = 'Nenhum pedido para preparar no momento.';
      else if (order.deliverable === false) text = `Sem estoque de ${order.plantName}. Reponha na Novo Hiper para preparar!`;
      else {
        text = `E / ✋  Pegar ${order.plantName} para ${order.customerName}`;
        action = () => this.bridge?.emitIntent({ type: 'pickup', orderId: order.id });
      }
    } else if (this.nearCounter) {
      if (pendingInstall) {
        text = 'E / ✋  Instalar melhoria no balcão';
        action = () => this.bridge?.emitIntent({ type: 'openInstall' });
      } else {
        text = 'E / ✋  Ver pedidos no balcão';
        action = () => this.bridge?.emitIntent({ type: 'navigate', tab: 'pedidos' });
      }
    } else if (this.nearShelf) {
      text = 'E / ✋  Ver catálogo de plantas';
      action = () => this.bridge?.emitIntent({ type: 'navigate', tab: 'catalogo' });
    } else if (this.nearStock) {
      text = 'E / ✋  Gerenciar estoque';
      action = () => this.bridge?.emitIntent({ type: 'navigate', tab: 'catalogo' });
    }

    this.promptText.setVisible(text !== '').setText(text);

    const pressed = this.inputState.consumePress('interact');
    if (pressed && action) action();

    void canPickup; // calculado acima para clareza do texto; mantido para o diagnóstico abaixo
  }

  private handleExitStore() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    setStoreReturnPoint(STORE_RETURN_POINT);
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.World);
    });
  }

  /** Estado exposto à interface de diagnóstico (só consumida em dev/teste). */
  getDebugState() {
    const order = this.snap?.activeOrder ?? null;
    const carrying = order?.status === 'pronto';
    return {
      player: this.player ? { x: this.player.x, y: this.player.y } : null,
      transitioning: this.isTransitioning,
      goalReached: false,
      entranceArmed: this.exitArmed,
      fallRespawns: 0,
      instance: this.instanceId,
      sprite: this.player?.active
        ? {
            anim: this.currentAnim,
            animPlaying: this.player.anims.isPlaying,
            texture: this.player.texture.key,
            frame: Number(this.player.frame.name),
            flipX: this.player.flipX,
            scale: this.player.scaleX,
            body: {
              x: (this.player.body as Phaser.Physics.Arcade.Body).x,
              y: (this.player.body as Phaser.Physics.Arcade.Body).y,
              width: (this.player.body as Phaser.Physics.Arcade.Body).width,
              height: (this.player.body as Phaser.Physics.Arcade.Body).height,
            },
          }
        : null,
      camera: (() => {
        if (!this.cameras?.main || !this.physics?.world) return null;
        const c = this.cameras.main;
        return {
          scrollX: c.scrollX,
          scrollY: c.scrollY,
          width: c.width,
          height: c.height,
          zoom: c.zoom,
          bounds: c.getBounds ? { x: c.getBounds().x, y: c.getBounds().y, width: c.getBounds().width, height: c.getBounds().height } : null,
          world: { width: this.physics.world.bounds.width, height: this.physics.world.bounds.height },
        };
      })(),
      delivery: {
        loaded: this.snap?.loaded ?? false,
        phase: this.snap?.phase ?? 'idle',
        activeOrderId: order?.id ?? null,
        customerName: order?.customerName ?? null,
        customerVisible: false,
        customer: { x: 0, y: 0 },
        destination: null,
        highlightVisible: false,
        near: false,
        promptVisible: this.promptText?.visible ?? false,
        hud: this.promptText?.text ?? '',
        indicator: null,
        lastReward: this.snap?.lastDelivery?.reward ?? null,
        feedbackLine: null,
        deliverable: order ? order.deliverable : null,
        shop: {
          cashText: this.cashHud?.visible ? this.cashHud.text : null,
          cashBalance: this.snap?.cashBalance ?? null,
          installedUpgrades: this.snap?.installedUpgrades ?? [],
          pendingUpgrades: this.snap?.pendingUpgrades ?? [],
          uiOpen: this.snap?.uiOpen ?? false,
          nearUtilities: false,
          nearShop: this.nearCounter && (this.snap?.pendingUpgrades.length ?? 0) > 0,
          placaVisible: false,
          visuals: [],
        },
        interior: {
          nearShelf: this.nearShelf,
          nearStock: this.nearStock,
          nearCounter: this.nearCounter,
          nearPrep: this.nearPrep,
          canPickup: Boolean(order) && !carrying && order?.deliverable !== false,
          carrying,
          exitArmed: this.exitArmed,
        },
      },
    };
  }
}
