import Phaser from 'phaser';
import { SCENE_KEYS } from '../sceneKeys';
import { InputState } from '../input/InputState';
import { WORLD, ENTRANCE_ZONE, CUSTOMER_SPOT } from '../config/worldConfig';
import { ShopUpgradeVisuals } from '../world/shopUpgrades';
import { resolveDestination, type DestinationHouse, type ResolvedDestination } from '../config/houseCatalog';
import { WORLD_MAP, PLAYABLE_RECT } from '../config/worldMap';
import { drawWorld } from '../world/drawWorld';
import { rectCenter } from '../logic/worldGeometry';
import {
  Facing,
  TOPDOWN_BODY,
  TOPDOWN_BODY_OFFSET,
  TOPDOWN_ORIGIN,
  TOPDOWN_SHADOW,
  TOPDOWN_SPRITE,
  frameIndex,
} from '../config/topdownSpriteConfig';
import { createBernardoTopdownAnimations, preloadBernardoTopdownSprites } from '../bernardoTopdownSprites';
import { facingFromMovement, selectTopdownAnimation } from '../logic/topdownAnimation';
import { isWithinRadius } from '../logic/proximity';
import { destinationIndicator, formatMeters } from '../logic/destination';
import { formatBRL } from '../logic/format';
import { emptyDeliveryMessage } from '../logic/emptyState';
import type { AdventureBridge, AdventureSnapshot } from '../bridge/adventureBridge';
import { REARM_DISTANCE, computeReturnPoint, distanceToEntrance, isInsideEntrance } from '../logic/worldEntrance';
import { consumeWorldReturnPoint, setWorldReturnPoint } from '../transition/transitionStore';

const PLAYER_SPEED = WORLD.playerSpeed;
const CUSTOMER_TEXTURE_KEY = 'cliente-provisorio';

let worldSceneInstances = 0; // contador (diagnóstico): detecta se a cena foi recriada

export class WorldScene extends Phaser.Scene {
  private instanceId = 0;
  private player!: Phaser.Physics.Arcade.Sprite;
  private inputState!: InputState;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private facing: Facing = 'down';
  private currentAnim = '';
  private playerShadow!: Phaser.GameObjects.Ellipse;
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
  private indicatorBg!: Phaser.GameObjects.Rectangle;
  private indicatorTitle!: Phaser.GameObjects.Text;
  private indicatorName!: Phaser.GameObjects.Text;
  private indicatorText!: Phaser.GameObjects.Text;
  private indicatorArrow!: Phaser.GameObjects.Triangle;
  private deliveryRing!: Phaser.GameObjects.Arc;
  private houseHighlight!: Phaser.GameObjects.Graphics;
  private markerTween: Phaser.Tweens.Tween | null = null;
  /** Destino do pedido ativo resolvido pelo catálogo (null = sem pedido). 'unknown' = não entrega em lugar nenhum. */
  private destination: ResolvedDestination | null = null;
  private placedFor: string | null = null;
  private indicatorIndicator: { meters: number; near: boolean; angle: number } | null = null;
  private nearCustomer = false;
  private nearUtilities = false;
  private nearShop = false;
  private shopVisuals: ShopUpgradeVisuals | null = null;
  private cashHud!: Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private feedbackPlayedFor: string | null = null;

  constructor() {
    super(SCENE_KEYS.World);
  }

  preload() {
    preloadBernardoTopdownSprites(this);
  }

  create() {
    this.instanceId = ++worldSceneInstances;
    this.isTransitioning = false;
    this.entranceArmed = true;
    this.snap = null;
    this.nearCustomer = false;
    this.nearUtilities = false;
    this.nearShop = false;
    this.feedbackPlayedFor = null;
    this.facing = 'down';
    this.currentAnim = '';
    this.inputState = this.registry.get('inputState');
    this.registry.set('activeScene', 'world');

    this.physics.world.gravity.y = 0;
    // Limites da câmera = mundo inteiro; limites da física = área jogável (a margem externa é só decoração).
    // Tudo (ruas, quarteirões, casas, praça, colisões) vem dos dados de WORLD_MAP.
    this.physics.world.setBounds(PLAYABLE_RECT.x, PLAYABLE_RECT.y, PLAYABLE_RECT.w, PLAYABLE_RECT.h);
    this.cameras.main.setBounds(0, 0, WORLD_MAP.width, WORLD_MAP.height);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    drawWorld(this, WORLD_MAP);

    // Colisões: um retângulo estático por elemento sólido (invisíveis; o desenho já está no mapa)
    this.solids = this.physics.add.staticGroup();
    for (const r of WORLD_MAP.solids) {
      const c = rectCenter(r);
      const body = this.add.rectangle(c.x, c.y, r.w, r.h).setVisible(false);
      this.physics.add.existing(body, true);
      this.solids.add(body);
    }

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

    // Jogador (Bernardo top-down). O body é o mesmo 32x44 centrado de antes; o desenho é maior que o body.
    createBernardoTopdownAnimations(this);
    const returnPoint = consumeWorldReturnPoint();
    const spawn = returnPoint ?? WORLD_MAP.spawn;
    // Voltando da plataforma: a entrada só rearma depois que Bernardo se afastar dela
    if (returnPoint) this.entranceArmed = false;
    this.playerShadow = this.add
      .ellipse(spawn.x, spawn.y + TOPDOWN_BODY.height / 2, TOPDOWN_SHADOW.width, TOPDOWN_SHADOW.height, 0x000000, TOPDOWN_SHADOW.alpha)
      .setDepth(0.5);
    this.player = this.physics.add.sprite(spawn.x, spawn.y, TOPDOWN_SPRITE.textureKey, frameIndex('down', 0));
    this.player.setOrigin(TOPDOWN_ORIGIN.x, TOPDOWN_ORIGIN.y).setDepth(1);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solids);
    (this.player.body as Phaser.Physics.Arcade.Body)
      .setSize(TOPDOWN_BODY.width, TOPDOWN_BODY.height, false)
      .setOffset(TOPDOWN_BODY_OFFSET.x, TOPDOWN_BODY_OFFSET.y);
    this.player.anims.play('td-idle-down');
    this.currentAnim = 'idle-down';

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.controlsHint = this.add
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
    this.shopVisuals = new ShopUpgradeVisuals(this);
    // Saldo REAL do caixa (valor vem do backend via snapshot; o Phaser só exibe)
    this.cashHud = this.add
      .text(0, 16, '', { fontSize: '13px', fontStyle: 'bold', color: '#bbf7d0', backgroundColor: '#1c1917cc', padding: { x: 8, y: 6 } })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(false);
    const layoutHud = () => {
      const w = this.scale.width;
      this.cashHud?.setPosition(w - 16, 16);
      // em telas estreitas a dica de teclado (inútil no celular) cede o espaço ao saldo
      this.controlsHint?.setVisible(w >= 560);
    };
    layoutHud();
    this.scale.on('resize', layoutHud);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', layoutHud));

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

    this.deliveryHud = this.add
      .text(16, 50, '', { fontSize: '13px', color: '#fafaf9', backgroundColor: '#1c1917cc', padding: { x: 8, y: 5 } })
      .setScrollFactor(0)
      .setVisible(false);
    // Indicador de destino (HUD): direção real + distância; sem rota nem minimapa
    const IX = 16;
    const IY = 84;
    this.indicatorBg = this.add.rectangle(IX, IY, 196, 76, 0x1c1917, 0.8).setOrigin(0, 0).setScrollFactor(0).setDepth(20).setVisible(false);
    this.indicatorTitle = this.add
      .text(IX + 10, IY + 6, 'ENTREGA', { fontSize: '11px', fontStyle: 'bold', color: '#fbbf24' })
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
    this.indicatorName = this.add
      .text(IX + 10, IY + 21, '', { fontSize: '14px', fontStyle: 'bold', color: '#fafaf9' })
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
    this.indicatorArrow = this.add
      .triangle(IX + 28, IY + 54, 0, 0, 22, 9, 0, 18, 0xfbbf24)
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
    this.indicatorText = this.add
      .text(IX + 52, IY + 45, '', { fontSize: '16px', fontStyle: 'bold', color: '#fde68a' })
      .setScrollFactor(0)
      .setDepth(21)
      .setVisible(false);
    // Marca no chão do ponto de entrega (na porta da casa)
    this.deliveryRing = this.add
      .circle(CUSTOMER_SPOT.x, CUSTOMER_SPOT.y + 6, 30, 0xfbbf24, 0.18)
      .setStrokeStyle(4, 0xfbbf24, 0.9)
      .setDepth(0.4)
      .setVisible(false);
    this.tweens.add({ targets: this.deliveryRing, scale: 1.2, yoyo: true, repeat: -1, duration: 650 });
    // Destaque da residência-destino (contorno + brilho na porta); redesenhado só quando o destino muda
    this.houseHighlight = this.add.graphics().setDepth(0.3).setVisible(false);
    this.tweens.add({ targets: this.houseHighlight, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 });

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
    this.cashHud.setVisible(snap.cashBalance !== null).setText(snap.cashBalance !== null ? `Caixa: ${formatBRL(snap.cashBalance)}` : '');
    this.shopVisuals?.apply(snap.installedUpgrades, snap.uiOpen);
    const order = snap.activeOrder;
    this.destination = order ? resolveDestination(order.destinationId) : null;
    const house = this.destination?.status === 'house' ? this.destination.house : null;
    this.placeDestination(house);
    const show = Boolean(order) && Boolean(house);
    this.customerSprite.setVisible(show);
    this.customerLabel.setVisible(show).setText(order ? order.customerName : '');
    this.customerMarker.setVisible(show && snap.phase === 'idle');
    this.deliveryRing.setVisible(show && snap.phase === 'idle');
    this.houseHighlight.setVisible(show);

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
    } else if (order && this.destination?.status === 'unknown') {
      text = `Pedido #${order.orderNumber}: endereço desconhecido (${this.destination.destinationId || 'vazio'}). Entrega indisponível.`;
      color = '#fca5a5';
    } else if (order) text = `Entrega #${order.orderNumber}: ${order.plantName} para ${order.customerName}`;
    else text = emptyDeliveryMessage(snap.stockHint);
    this.deliveryHud.setText(text).setColor(color).setVisible(text !== '');

    if (snap.phase === 'done' && snap.lastDelivery && this.feedbackPlayedFor !== snap.lastDelivery.order.id) {
      this.feedbackPlayedFor = snap.lastDelivery.order.id;
      this.playDeliveryFeedback(snap.lastDelivery.reward);
    }
  }

  /** Posiciona NPC, nome, "!", anel e destaque na residência resolvida (só refaz quando ela muda). */
  private placeDestination(house: DestinationHouse | null) {
    const key = house ? house.destinationId : null;
    if (key === this.placedFor) return;
    this.placedFor = key;
    this.houseHighlight.clear();
    this.markerTween?.stop();
    this.markerTween = null;
    if (!house) return;
    const { x, y } = house.deliveryPoint;
    this.customerSprite.setPosition(x, y);
    this.customerLabel.setPosition(x, y + 34);
    this.customerMarker.setPosition(x, y - 50);
    this.markerTween = this.tweens.add({ targets: this.customerMarker, y: y - 58, yoyo: true, repeat: -1, duration: 500 });
    this.deliveryRing.setPosition(x, y + 6);
    const r = house.rect;
    this.houseHighlight.fillStyle(0xfbbf24, 0.16).fillRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
    this.houseHighlight.lineStyle(5, 0xfbbf24, 0.95).strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
    this.houseHighlight.fillStyle(0xfde047, 0.9).fillRect(house.door.x - 20, house.door.y - 4, 40, 8);
  }

  /** Ponto de entrega do destino ativo (null = sem pedido ou endereço desconhecido). */
  private activeTarget(): { x: number; y: number; interactRadius: number } | null {
    return this.destination?.status === 'house' ? { ...this.destination.house.deliveryPoint, interactRadius: this.destination.house.interactRadius } : null;
  }

  /** Confirmação visual: o cliente reage (pulinho) e "+ R$ X,XX" sobe e some. */
  private playDeliveryFeedback(reward: number) {
    const spot = this.activeTarget() ?? CUSTOMER_SPOT;
    this.tweens.add({ targets: this.customerSprite, y: spot.y - 16, yoyo: true, repeat: 2, duration: 160 });
    const money = this.add
      .text(spot.x, spot.y - 40, `+ ${formatBRL(reward)}`, {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#bbf7d0',
        stroke: '#14532d',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);
    // sobe durante ~2,4 s e só começa a sumir na segunda metade (fica legível durante o feedback)
    this.tweens.add({ targets: money, y: spot.y - 120, duration: 2400, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: money, alpha: 0, delay: 1500, duration: 900, onComplete: () => money.destroy() });
  }

  private updateDelivery() {
    const snap = this.snap;
    const order = snap?.activeOrder ?? null;
    const target = this.activeTarget();
    const interactive = Boolean(snap) && snap!.phase === 'idle' && !snap!.uiOpen;
    const canDeliver = Boolean(snap && order && target && snap.phase === 'idle');
    this.nearCustomer = canDeliver && interactive && target !== null && isWithinRadius(this.player, target, target.interactRadius);
    const { utilities, shop } = WORLD_MAP;
    this.nearUtilities = interactive && isWithinRadius(this.player, utilities.interact, utilities.interactRadius);
    this.nearShop =
      interactive && (snap?.pendingUpgrades.length ?? 0) > 0 && isWithinRadius(this.player, shop.interact, shop.interactRadius);
    const showPrompt = this.nearCustomer || this.nearUtilities || this.nearShop;
    this.promptText.setVisible(showPrompt);
    if (showPrompt) {
      if (this.nearCustomer && order) this.promptText.setText(`E / ✋  Entregar ${order.plantName} para ${order.customerName}`);
      else if (this.nearUtilities) this.promptText.setText('E / ✋  Entrar na Loja de Utilidades');
      else this.promptText.setText('E / ✋  Instalar melhorias na Novo Hiper');
      this.promptText.setPosition(this.cameras.main.width / 2, this.cameras.main.height - 150);
    }
    // Indicador de destino: só com entrega ativa e ocioso
    const showIndicator = canDeliver && order !== null;
    this.indicatorBg.setVisible(showIndicator);
    this.indicatorTitle.setVisible(showIndicator);
    this.indicatorName.setVisible(showIndicator);
    if (showIndicator && order && target) {
      const ind = destinationIndicator(this.player, target);
      this.indicatorName.setText(order.customerName);
      this.indicatorArrow.setVisible(!ind.near).setRotation(ind.angle);
      this.indicatorText.setVisible(true).setText(ind.near ? 'Destino próximo' : formatMeters(ind.meters));
      this.indicatorIndicator = { meters: ind.meters, near: ind.near, angle: ind.angle };
    } else {
      this.indicatorArrow.setVisible(false);
      this.indicatorText.setVisible(false);
      this.indicatorIndicator = null;
    }
    const pressed = this.inputState.consumePress('interact');
    if (pressed && this.bridge) {
      // Só EMITE a intenção: o React valida e chama a API; o backend é a autoridade (entrega, compra e instalação).
      if (this.nearCustomer && order) this.bridge.emitIntent({ type: 'deliver', orderId: order.id });
      else if (this.nearUtilities) this.bridge.emitIntent({ type: 'openShop' });
      else if (this.nearShop) this.bridge.emitIntent({ type: 'openInstall' });
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
      instance: this.instanceId,
      // durante a troca de cena o sprite já pode ter sido destruído: só lê quando está ativo
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
        // durante a troca de cena a câmera já pode ter sido destruída
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
        activeOrderId: this.snap?.activeOrder?.id ?? null,
        customerName: this.snap?.activeOrder?.customerName ?? null,
        customerVisible: this.customerSprite?.visible ?? false,
        customer: this.activeTarget() ? { x: this.activeTarget()!.x, y: this.activeTarget()!.y } : { x: CUSTOMER_SPOT.x, y: CUSTOMER_SPOT.y },
        destination: this.destination
          ? {
              id: this.destination.destinationId,
              status: this.destination.status,
              houseId: this.destination.status === 'house' ? this.destination.house.houseId : null,
              legacy: this.destination.status === 'house' ? this.destination.legacy : false,
            }
          : null,
        highlightVisible: this.houseHighlight?.visible ?? false,
        near: this.nearCustomer,
        promptVisible: this.promptText?.visible ?? false,
        hud: this.deliveryHud?.text ?? '',
        indicator: this.indicatorIndicator
          ? { ...this.indicatorIndicator, text: this.indicatorText.text, arrowVisible: this.indicatorArrow.visible }
          : null,
        lastReward: this.snap?.lastDelivery?.reward ?? null,
        shop: {
          cashText: this.cashHud?.visible ? this.cashHud.text : null,
          cashBalance: this.snap?.cashBalance ?? null,
          installedUpgrades: this.snap?.installedUpgrades ?? [],
          pendingUpgrades: this.snap?.pendingUpgrades ?? [],
          uiOpen: this.snap?.uiOpen ?? false,
          nearUtilities: this.nearUtilities,
          nearShop: this.nearShop,
          placaVisible: this.shopVisuals?.isInstalled('placa_madeira') ?? false,
          visuals: this.shopVisuals?.visibleIds() ?? [],
        },
      },
    };
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
    this.updateDelivery();
    if (this.snap?.phase === 'delivering' || this.snap?.uiOpen) {
      body.setVelocity(0, 0); // parado enquanto o servidor confirma a entrega ou com um painel aberto
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

    if (!this.entranceArmed && distanceToEntrance(this.player) > REARM_DISTANCE) {
      this.entranceArmed = true;
    }
    if (this.entranceArmed && isInsideEntrance(this.player)) {
      this.handleEnterPlatform();
    }
  }

  /** Animação (andando/parado, 4 direções) e sombra. Só visual: não altera velocidade nem collider. */
  private updatePlayerVisual(dx: number, dy: number) {
    this.facing = facingFromMovement(this.facing, dx, dy);
    const name = selectTopdownAnimation(this.facing, dx !== 0 || dy !== 0);
    if (name !== this.currentAnim) {
      this.currentAnim = name;
      this.player.anims.play(`td-${name}`);
    }
    this.playerShadow.setPosition(this.player.x, this.player.y + TOPDOWN_BODY.height / 2);
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
