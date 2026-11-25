import Phaser from 'phaser';
import { SCENE_KEYS } from '../sceneKeys';
import { InputState } from '../input/InputState';
import { GOAL_UI, PLATFORM, PLATFORM_SPAWN, PLATFORM_GOAL, getGaps } from '../config/platformConfig';
import { hasFallenOffLevel, isSafeCheckpoint } from '../logic/fall';
import {
  BERNARDO_ANIMS,
  BERNARDO_BODY_OFFSET,
  BERNARDO_BODY_SOURCE,
  BERNARDO_ORIGIN,
  BERNARDO_SPRITE,
  BERNARDO_TEXTURES,
} from '../config/spriteConfig';
import { Facing, nextFacing, selectAnimation, selectJumpFrame } from '../logic/animation';
import { createBernardoPlatformAnimations, preloadBernardoPlatformSprites } from '../bernardoPlatformSprites';
import { AdventureBridge, type AdventureOrder } from '../bridge/adventureBridge';
import { selectPlatformRoute, PLATFORM_ROUTES } from '../config/platformRoutes';
import { cartPosition, DEFAULT_PLATFORM_ZOOM, PLATFORM_ZOOM_LEVELS, platformAdventure } from '../config/platformAdventure';
import { setWorldReturnPoint } from '../transition/transitionStore';
import { generatePlatformRoute, type GeneratedPlatformRoute } from '../config/proceduralPlatform';
import { drawPlatformScenery, preloadPlatformScenery, PLATFORM_HOUSE, drawRaisedParkPlatform } from '../world/platformScenery';
import { generateJumpPark, jumpParkAdventure, jumpParkPads } from '../config/jumpPark';

const LEVEL_WIDTH = PLATFORM.levelWidth;
const LEVEL_HEIGHT = PLATFORM.levelHeight;
const GROUND_Y = PLATFORM.groundY;
const PLAYER_SPEED = PLATFORM.playerSpeed;
const JUMP_VELOCITY = PLATFORM.jumpVelocity;
const GRAVITY_Y = PLATFORM.gravityY;
const SPAWN_POINT = PLATFORM_SPAWN;
const GOAL_RADIUS = PLATFORM.goalRadius;
const RETURN_INPUT_DELAY_MS = PLATFORM.returnInputDelayMs;

export class PlatformScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private inputState!: InputState;
  private lastSafeGround = { ...SPAWN_POINT };
  private goalPosition = { x: 0, y: 0 };
  private goalReached = false;
  private confirmReadyAt = 0;
  private jumpWasDown = true;
  private returnToWorld: (() => void) | null = null;
  private fallRespawns = 0;
  private facing: Facing = 'right';
  private currentAnim = '';
  private returning = false;
  private confirmationVisible = false;
  /** Câmera do HUD, sem zoom — texto/botão ficam no tamanho e posição corretos mesmo com a câmera principal "chapada". */
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private instructions?: Phaser.GameObjects.Text;
  private route: GeneratedPlatformRoute = generatePlatformRoute(PLATFORM_ROUTES[0], 0);
  private routeOrder: AdventureOrder | null = null;
  private routeBusy = false;
  private visit = 0;
  private adventure = platformAdventure(PLATFORM_ROUTES[0]);
  private flowers: Array<{ x: number; y: number; collected: boolean; art: Phaser.GameObjects.Shape[] }> = [];
  private checkpointFlags: Array<{ x: number; y: number; flag: Phaser.GameObjects.Rectangle; active: boolean }> = [];
  private rescuePoint = { x: SPAWN_POINT.x, y: GROUND_Y - PLATFORM.playerHeight / 2 };
  private cart!: Phaser.GameObjects.Rectangle;
  private wheels: Phaser.GameObjects.Arc[] = [];
  private elapsed = 0;
  private rescuedAt = -2000;
  private obstacleHits = 0;
  private goalUi: Phaser.GameObjects.Text[] = [];
  private bouncePads: Array<{x:number;y:number}> = [];
  private springBounces = 0;
  private goalHouse?: Phaser.GameObjects.Image;


  constructor() {
    super(SCENE_KEYS.Platform);
  }

  preload() {
    preloadBernardoPlatformSprites(this);
    preloadPlatformScenery(this);
  }

  create(data: { space?: 'park' | 'delivery' } = {}) {
    this.visit++;
    this.routeBusy = false;
    this.elapsed = 0;
    this.rescuedAt = -2000;
    this.obstacleHits = 0;
    this.flowers = [];
    this.checkpointFlags = [];
    this.goalUi = [];
    this.rescuePoint = { x: SPAWN_POINT.x, y: GROUND_Y - PLATFORM.playerHeight / 2 };
    const snapshot = (this.registry.get('bridge') as AdventureBridge).getSnapshot();
    const order = snapshot.activeOrder;
    this.springBounces = 0;
    this.routeOrder = data.space !== 'park' && order?.status === 'pronto' && order.deliverable ? { ...order } : null;
    const template = selectPlatformRoute(snapshot.worldStage.environmentalNeighbors, Boolean(this.routeOrder));
    const previousSeed = this.registry.get('lastPlatformSeed') as number | undefined;
    let seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    if (seed === previousSeed) seed = (seed + 1) >>> 0;
    this.registry.set('lastPlatformSeed', seed);
    this.route = data.space === 'park' ? generateJumpPark(seed) : generatePlatformRoute(template, seed);
    this.adventure = this.route.space === 'park' ? jumpParkAdventure(this.route) : platformAdventure(this.route, seed);
    this.bouncePads = this.route.space === 'park' ? jumpParkPads(this.route) : [];
    this.goalReached = false;
    this.facing = 'right';
    this.currentAnim = '';
    this.returnToWorld = null;
    this.returning = false;
    this.confirmationVisible = false;
    this.fallRespawns = 0;
    this.lastSafeGround = { ...SPAWN_POINT };
    this.inputState = this.registry.get('inputState');
    this.registry.set('activeScene', 'platform');
    const exit = () => this.exitToWorld();
    this.game.events.on('platform-exit', exit);
    this.events.once('shutdown', () => this.game.events.off('platform-exit', exit));
    this.worldObjects = [];

    // Reentrada na cena (World <-> Platform): remove a câmera de HUD da visita anterior antes de criar outra.
    if (this.uiCamera) {
      this.cameras.remove(this.uiCamera);
      this.uiCamera = undefined;
    }

    this.physics.world.gravity.y = GRAVITY_Y;
    this.physics.world.setBounds(0, 0, this.route.levelWidth, LEVEL_HEIGHT);
    this.cameras.main.setBounds(0, 0, this.route.levelWidth, LEVEL_HEIGHT);
    const zoom = this.registry.get('platformZoom') ?? DEFAULT_PLATFORM_ZOOM;
    this.cameras.main.setZoom(PLATFORM_ZOOM_LEVELS.includes(zoom) ? zoom : DEFAULT_PLATFORM_ZOOM);
    const changeZoom = (value: number) => {
      if (!PLATFORM_ZOOM_LEVELS.includes(value as 0.75 | 1 | 1.5)) return;
      this.registry.set('platformZoom', value);
      this.cameras.main.setZoom(value);
    };
    this.game.events.on('platform-zoom', changeZoom);
    this.events.once('shutdown', () => this.game.events.off('platform-zoom', changeZoom));
    this.cameras.main.fadeIn(200, 0, 0, 0);

    this.worldObjects.push(...drawPlatformScenery(this, this.route));

    const ground = this.physics.add.staticGroup();

    // Segmentos de chão com valas — exigem um salto, com folga (ver config/platformConfig.ts)
    const groundSegments = this.route.segments;
    groundSegments.forEach((seg) => {
      const block = this.add.rectangle(seg.x + seg.width / 2, GROUND_Y + 40, seg.width, 80, this.route.ground).setVisible(false);
      ground.add(block);
      this.worldObjects.push(block);
    });

    getGaps(groundSegments).forEach(gap => {
      this.worldObjects.push(this.add.text(gap.start - 65, GROUND_Y - 52, '↑ Salte', { fontSize: '12px', color: '#fff7ed', backgroundColor: '#1c1917', padding: { x: 4, y: 3 } }).setDepth(2));
    });

    createBernardoPlatformAnimations(this);
    this.player = this.physics.add.sprite(SPAWN_POINT.x, SPAWN_POINT.y, BERNARDO_TEXTURES.idleRight, 0);
    // Só o VISUAL é grande: o collider continua 28x44 (mundo) e o centro do body = posição do sprite.
    this.player.setScale(BERNARDO_SPRITE.scale);
    this.player.setOrigin(BERNARDO_ORIGIN.x, BERNARDO_ORIGIN.y);
    (this.player.body as Phaser.Physics.Arcade.Body)
      .setSize(BERNARDO_BODY_SOURCE.width, BERNARDO_BODY_SOURCE.height, false)
      .setOffset(BERNARDO_BODY_OFFSET.x, BERNARDO_BODY_OFFSET.y);
    this.player.setCollideWorldBounds(false);
    this.player.setDepth(10); // à frente da Casa do Cliente e do cenário
    this.worldObjects.push(this.player);

    this.physics.add.collider(this.player, ground, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      // Só grava checkpoint de pé no chão, com folga das bordas (não em colisão lateral na vala)
      if ((body.blocked.down || body.touching.down) && isSafeCheckpoint(this.player.x, this.player.y, this.route.segments)) {
        this.lastSafeGround = { x: this.player.x, y: this.player.y };
      }
    });

    this.createAdventure();
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setFollowOffset(0, 40);

    // Marcador do fim do percurso; a chegada é resolvida pela casa oficial no bairro.
    const goalX = this.route.levelWidth - 220;
    this.goalPosition = { x: goalX, y: PLATFORM_GOAL.y };
    const goalHouse = this.add.image(goalX, GROUND_Y, PLATFORM_HOUSE, 'facade').setOrigin(.5, 1).setDepth(3);
    this.goalHouse = goalHouse;
    goalHouse.setScale(175 / goalHouse.frame.height);
    this.worldObjects.push(goalHouse);
    this.worldObjects.push(
      this.add
        .text(goalX, GROUND_Y - 200, this.routeOrder ? `Casa de ${this.routeOrder.customerName}` : this.route.space === 'park' ? 'Chegada do parque' : 'Fim do treino', {
          fontSize: '14px',
          color: '#fff7ed',
          backgroundColor: '#1c1917',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
    );

    const instructions = this.add
      .text(12, 12, this.instructionsText(), {
        fontSize: '12px',
        color: '#fafaf9',
        backgroundColor: '#1c1917cc',
        padding: { x: 8, y: 6 },
        wordWrap: { width: Math.max(120, this.cameras.main.width - 48) },
      })
      .setScrollFactor(0);
    this.instructions = instructions;

    // Câmera de HUD: renderiza só o que está FORA de worldObjects (texto/botões), sem o zoom da câmera principal.
    this.cameras.main.ignore(instructions);
    this.uiCamera = this.cameras.add(0, 0, this.cameras.main.width, this.cameras.main.height);
    this.uiCamera.ignore(this.worldObjects);

    const handleResize = (size: Phaser.Structs.Size) => {
      this.uiCamera?.setSize(size.width, size.height);
      this.layoutUi();
    };
    this.layoutUi();
    this.scale.on('resize', handleResize);
    this.events.once('shutdown', () => this.scale.off('resize', handleResize));
  }

  private instructionsText() {
    if (this.route.space === 'park') return `Parque dos Saltos • Flores ${this.flowers.filter(f => f.collected).length}/${this.flowers.length}\nExplore os caminhos altos. Amarelo: trampolim • Bandeiras: pontos seguros`;
    return `${this.route.name} • Novo percurso • Flores ${this.flowers.filter(f => f.collected).length}/${this.flowers.length}\nSalte o carrinho. Caminho alto opcional • Bandeiras: pontos seguros`;
  }

  private layoutUi() {
    const w = this.scale.width, h = this.scale.height;
    this.instructions?.setWordWrapWidth(Math.max(120, w - 24));
    const [title, hint, button] = this.goalUi;
    if (!title) return;
    title.setFontSize(h < 320 ? 20 : 28).setPosition(w / 2, h < 320 ? 28 : h * .2);
    hint.setWordWrapWidth(Math.max(120, w - 40)).setPosition(w / 2, h < 320 ? 76 : h * .2 + 58);
    button.setFontSize(h < 320 ? 16 : 20).setPosition(w / 2, h < 320 ? 128 : h * .2 + 120);
  }

  private createAdventure() {
    const ledges = this.physics.add.staticGroup();
    for (const ledge of this.adventure.ledges) {
      const top = this.add.rectangle(ledge.x + ledge.width / 2, ledge.y + 8, ledge.width, 16, 0x96704b).setStrokeStyle(3, 0x4a3326);
      ledges.add(top); this.worldObjects.push(top);
      if (this.route.space === 'park') {
        top.setVisible(false);
        this.worldObjects.push(...drawRaisedParkPlatform(this, ledge));
      } else for (const x of [ledge.x + 12, ledge.x + ledge.width - 12]) {
        this.worldObjects.push(this.add.rectangle(x, (ledge.y + GROUND_Y) / 2, 8, GROUND_Y - ledge.y, 0x635044).setDepth(-1));
      }
    }
    // Plataformas atravessáveis por baixo: nunca prendem Bernardo numa parede lateral.
    this.physics.add.collider(this.player, ledges, undefined, (player, platform) => {
      const body = (player as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      const top = (platform as Phaser.GameObjects.Rectangle).y - 8;
      return body.velocity.y >= 0 && body.prev.y + body.height <= top + 5;
    });
    this.flowers = this.adventure.flowers.map(point => {
      const petals = this.add.star(point.x, point.y, 6, 5, 13, 0xfb7185).setStrokeStyle(2, 0xffe4e6).setDepth(3);
      const center = this.add.circle(point.x, point.y, 4, 0xfde047).setDepth(4);
      this.worldObjects.push(petals, center);
      return { ...point, collected: false, art: [petals, center] };
    });
    this.checkpointFlags = this.adventure.checkpoints.map((point, index) => {
      const pole = this.add.rectangle(point.x, point.y - 24, 4, 48, 0xf5deb3);
      const flag = this.add.rectangle(point.x + 13, point.y - 40, 24, 16, index === 0 ? 0x34d399 : 0xfbbf24).setStrokeStyle(2, 0x134e4a);
      this.worldObjects.push(pole, flag);
      return { ...point, flag, active: index === 0 };
    });
    for (const pad of this.bouncePads) {
      const coil = this.add.graphics().setDepth(4).lineStyle(3,0x64776b);
      coil.lineBetween(pad.x-15,pad.y-3,pad.x+15,pad.y-7);coil.lineBetween(pad.x+15,pad.y-7,pad.x-15,pad.y-12);
      this.worldObjects.push(coil,this.add.rectangle(pad.x,pad.y-15,40,8,0xf3c75c).setStrokeStyle(2,0x8b713b).setDepth(4));
    }
    const cart = this.adventure.cart;
    this.cart = this.add.rectangle(cart.center, cart.y, 34, 26, 0x38bdf8).setStrokeStyle(3, 0x164e63).setDepth(4);
    this.wheels = [-11, 11].map(offset => this.add.circle(cart.center + offset, GROUND_Y - 3, 5, 0x292524).setDepth(4));
    this.worldObjects.push(this.cart, ...this.wheels);
  }

  private updateAdventure(delta: number) {
    this.elapsed += Math.min(Math.max(delta, 0), 80);
    const cart = this.adventure.cart;
    const x = cartPosition(cart.center, cart.range, cart.speed, this.elapsed);
    this.cart.setX(x);
    this.wheels.forEach((wheel, index) => wheel.setX(x + (index === 0 ? -11 : 11)));
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if ((body.blocked.down || body.touching.down) && body.velocity.y >= 0 && this.bouncePads.some(pad => Math.abs(this.player.x-pad.x)<24 && Math.abs(this.player.y+22-pad.y)<5)) {
      body.setVelocityY(-720); this.springBounces++;
    }
    if (this.elapsed - this.rescuedAt < 1200) this.player.setAlpha(Math.floor(this.elapsed / 100) % 2 ? .55 : 1);
    else this.player.setAlpha(1);
    if (this.elapsed - this.rescuedAt >= 1200 && Math.abs(this.player.x - x) < 30 && this.player.y + PLATFORM.playerHeight / 2 > GROUND_Y - 27 && this.player.y - PLATFORM.playerHeight / 2 < GROUND_Y) {
      this.obstacleHits++;
      this.rescuedAt = this.elapsed;
      body.reset(this.rescuePoint.x, this.rescuePoint.y);
    }
    for (const flag of this.checkpointFlags) {
      if (!flag.active && Math.abs(this.player.x - flag.x) < 44 && body.blocked.down && Math.abs(this.player.y + PLATFORM.playerHeight / 2 - GROUND_Y) < 4) {
        flag.active = true; flag.flag.setFillStyle(0x34d399);
        this.rescuePoint = { x: flag.x, y: GROUND_Y - PLATFORM.playerHeight / 2 };
      }
    }
    for (const flower of this.flowers) {
      if (!flower.collected && Math.hypot(this.player.x - flower.x, this.player.y - flower.y) < 30) {
        flower.collected = true;
        flower.art.forEach(art => art.setVisible(false));
        this.instructions?.setText(this.instructionsText());
      }
    }
  }

  /** Estado exposto à interface de diagnóstico (só consumida em dev/teste). */
  getDebugState() {
    return {
      player: this.player ? { x: this.player.x, y: this.player.y } : null,
      transitioning: false,
      camera: { scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY, width: this.cameras.main.width, height: this.cameras.main.height, zoom: this.cameras.main.zoom, bounds: {x:0,y:0,width:this.route.levelWidth,height:LEVEL_HEIGHT}, world: {width:this.route.levelWidth,height:LEVEL_HEIGHT} },
      goalReached: this.goalReached,
      platform: { routeId: this.route.id, routeName: this.route.name, seed: this.route.seed, generatorVersion: this.route.generatorVersion, segments: this.route.segments, scenery: 'open-meadow', space: this.route.space, levelWidth: this.route.levelWidth, goal: this.goalPosition, bouncePads: this.bouncePads, springBounces: this.springBounces, goalHouse: { texture: this.goalHouse?.texture.key, baseline: this.goalHouse?.getBounds().bottom, rotation: this.goalHouse?.rotation }, gaps: getGaps(this.route.segments), confirmationReady: this.goalReached && this.time.now >= this.confirmReadyAt, confirmationVisible: this.confirmationVisible,
        zoom: this.cameras.main.zoom, grounded: (this.player.body as Phaser.Physics.Arcade.Body).blocked.down || (this.player.body as Phaser.Physics.Arcade.Body).touching.down, visit: this.visit, flowers: this.flowers.filter(f => f.collected).length,
        ledges: this.adventure.ledges, flowerPoints: this.flowers.map(f => ({ x: f.x, y: f.y, collected: f.collected })),
        cart: { x: this.cart.x, y: this.cart.y }, obstacleHits: this.obstacleHits,
        checkpoint: { ...this.rescuePoint }, checkpoints: this.checkpointFlags.map(f => ({ x: f.x, y: f.y, active: f.active })),
      },
      entranceArmed: false,
      fallRespawns: this.fallRespawns,
      lastSafeGround: { ...this.lastSafeGround },
      sprite: this.player
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
    };
  }

  teleportPlayer(x: number, y: number) {
    (this.player.body as Phaser.Physics.Arcade.Body).reset(x, y);
  }

  /** Escolhe a animação do Bernardo (puramente visual; não toca na física). */
  private updateAnimation(moveX: -1 | 0 | 1, grounded: boolean, vy: number) {
    this.facing = nextFacing(this.facing, moveX);
    const name = selectAnimation({ grounded, moveX, facing: this.facing, goalReached: this.goalReached });

    if (name === 'jump') {
      // No ar: frame estático pela velocidade vertical; andar nunca sobrescreve o pulo.
      if (this.currentAnim !== 'jump') this.player.anims.stop();
      this.currentAnim = 'jump';
      this.player.setTexture(BERNARDO_TEXTURES.jump, selectJumpFrame(vy));
      this.player.setFlipX(this.facing === 'left'); // jump.png só existe virado para a direita
      return;
    }

    this.player.setFlipX(false);
    if (name === this.currentAnim) return;
    this.currentAnim = name;
    const def = {
      'idle-right': BERNARDO_ANIMS.idleRight,
      'idle-left': BERNARDO_ANIMS.idleLeft,
      'walk-right': BERNARDO_ANIMS.walkRight,
      'walk-left': BERNARDO_ANIMS.walkLeft,
      'thumbs-up': BERNARDO_ANIMS.thumbsUp,
    }[name];
    this.player.play(def.key);
  }

  update(_time: number, delta: number) {
    if (this.returning) return;
    if (this.goalReached) {
      // Espaço é lido pelo InputState (que dá preventDefault, então o Phaser não emite 'keydown-SPACE').
      // Só vale um NOVO aperto, depois do atraso — Espaço segurado do último pulo não confirma.
      const jumpDown = this.inputState.snapshot.jump;
      if (this.returnToWorld && this.time.now >= this.confirmReadyAt && jumpDown && !this.jumpWasDown) {
        this.returnToWorld();
      }
      this.jumpWasDown = jumpDown;
      return;
    }

    this.updateAdventure(delta);
    const input = this.inputState.snapshot;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    let vx = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    body.setVelocityX(vx * PLAYER_SPEED);

    const onGround = body.blocked.down || body.touching.down;
    if (input.jump && onGround && body.velocity.y >= 0) {
      body.setVelocityY(JUMP_VELOCITY);
    }
    // grounded só se não estiver subindo (no quadro do pulo onGround ainda é true, mas vy já é negativo)
    this.updateAnimation(vx as -1 | 0 | 1, onGround && body.velocity.y >= 0, body.velocity.y);

    // Caiu na vala: reposiciona no último ponto seguro — sem Game Over
    if (hasFallenOffLevel(this.player.y)) {
      this.fallRespawns++;
      // body.reset (e não setPosition): zera também a posição anterior do corpo. Com setPosition o
      // Arcade enxerga um "deslocamento" de centenas de px e deixa Bernardo atravessar o chão.
      body.reset(this.lastSafeGround.x, this.lastSafeGround.y);
    }

    const distanceToGoal = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.goalPosition.x,
      this.goalPosition.y
    );
    if (distanceToGoal < GOAL_RADIUS) {
      this.handleGoalReached();
    }
  }

  private handleGoalReached() {
    if (this.goalReached) return;
    this.goalReached = true;
    this.instructions?.setVisible(false);
    this.player.clearTint().setAlpha(1);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.moves = false;

    // Visual: de frente, comemoração uma única vez e fica no último frame (sem loop)
    this.updateAnimation(0, true, 0);

    const titleY = this.cameras.main.height * GOAL_UI.titleYRatio;
    const title = this.add
      .text(this.cameras.main.width / 2, titleY, this.routeOrder ? 'Você chegou!' : 'Percurso concluído!', {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#065f46',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const hint = this.add
      .text(this.cameras.main.width / 2, titleY + GOAL_UI.hintOffsetY, this.routeOrder ? `Flores ${this.flowers.filter(f => f.collected).length}/${this.flowers.length}. Chegamos à casa de ${this.routeOrder.customerName}. Continue para entregar a planta.` : `Flores ${this.flowers.filter(f => f.collected).length}/${this.flowers.length}. Treino concluído. Nenhuma venda registrada.`, {
        fontSize: '13px',
        color: '#fafaf9',
        backgroundColor: '#1c1917cc',
        padding: { x: 10, y: 6 },
        wordWrap: { width: Math.max(120, this.cameras.main.width - 48) },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const button = this.add
      .text(this.cameras.main.width / 2, titleY + GOAL_UI.buttonOffsetY, this.routeOrder ? '▶ Ir até o cliente' : '▶ Voltar ao bairro', {
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#c2410c',
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => returnToWorld());

    this.cameras.main.ignore([title, hint, button]);

    // A confirmação aparece DEPOIS da comemoração (que fica visível, sem texto por cima).
    // Espaço/Enter já valem desde confirmReadyAt, independentemente de estar visível.
    const confirmationUi = [title, hint, button];
    this.goalUi = confirmationUi;
    this.layoutUi();
    confirmationUi.forEach((o) => o.setVisible(false));
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      this.confirmationVisible = true;
      confirmationUi.forEach((o) => o.setVisible(true));
    };
    this.player.once('animationcomplete', reveal);
    this.time.delayedCall(GOAL_UI.revealFallbackMs, reveal);

    const returnToWorld = () => {
      if (this.time.now < this.confirmReadyAt) return;
      if (!this.routeOrder) { this.exitToWorld(); return; }
      if (this.routeBusy) return;
      this.routeBusy = true;
      hint.setText('Conferindo seu pedido…');
      const visit = this.visit;
      const bridge = this.registry.get('bridge') as AdventureBridge;
      const accepted = bridge.emitIntent({ type: 'completePlatform', orderId: this.routeOrder.id, destinationId: this.routeOrder.destinationId, done: result => {
        if (!this.sys.isActive() || this.returning || visit !== this.visit) return;
        this.routeBusy = false;
        if (result.point) { setWorldReturnPoint(result.point); this.exitToWorld(); }
        else { hint.setText(result.error || 'Confira sua entrega no bairro.'); }
      } });
      if (!accepted) { this.routeBusy = false; hint.setText('Aguarde a confirmação do pedido ou volte ao bairro.'); }
    };

    // Pequeno atraso para o Espaço segurado durante o salto não pular o aviso
    this.confirmReadyAt = this.time.now + RETURN_INPUT_DELAY_MS;
    this.jumpWasDown = this.inputState.snapshot.jump;
    this.returnToWorld = returnToWorld;
    const confirmEnter = (event: KeyboardEvent) => {
      event.preventDefault(); // Enter confirma a chegada sem acionar o botão de zoom que ficou focado.
      if (!event.repeat) returnToWorld();
    };
    this.input.keyboard?.on('keydown-ENTER', confirmEnter);
    this.events.once('shutdown', () => this.input.keyboard?.off('keydown-ENTER', confirmEnter));
  }

  private exitToWorld() {
    if (this.returning) return;
    this.returning = true;
    this.inputState.setSuspended(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.inputState.setSuspended(false);
      this.scene.start(SCENE_KEYS.World);
    });
    this.events.once('shutdown', () => this.inputState.setSuspended(false));
  }
}
