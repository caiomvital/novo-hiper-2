import Phaser from 'phaser';
import { SCENE_KEYS } from '../sceneKeys';
import { InputState } from '../input/InputState';
import { GOAL_UI, PLATFORM, PLATFORM_SPAWN, PLATFORM_GOAL, getGroundSegments } from '../config/platformConfig';
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

  constructor() {
    super(SCENE_KEYS.Platform);
  }

  preload() {
    preloadBernardoPlatformSprites(this);
  }

  create() {
    this.goalReached = false;
    this.facing = 'right';
    this.currentAnim = '';
    this.returnToWorld = null;
    this.fallRespawns = 0;
    this.lastSafeGround = { ...SPAWN_POINT };
    this.inputState = this.registry.get('inputState');
    this.registry.set('activeScene', 'platform');

    this.physics.world.gravity.y = GRAVITY_Y;
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    this.cameras.main.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    this.cameras.main.fadeIn(200, 0, 0, 0);

    this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x0c4a6e);

    const ground = this.physics.add.staticGroup();

    // Segmentos de chão com valas — exigem um salto, com folga (ver config/platformConfig.ts)
    const groundSegments = getGroundSegments();
    groundSegments.forEach((seg) => {
      const block = this.add.rectangle(seg.x + seg.width / 2, GROUND_Y + 40, seg.width, 80, 0x44403c);
      ground.add(block);
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

    this.physics.add.collider(this.player, ground, () => {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      // Só grava checkpoint de pé no chão, com folga das bordas (não em colisão lateral na vala)
      if ((body.blocked.down || body.touching.down) && isSafeCheckpoint(this.player.x, this.player.y)) {
        this.lastSafeGround = { x: this.player.x, y: this.player.y };
      }
    });

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    // Destino provisório — marcador tipo "casa do cliente"
    const goalX = PLATFORM_GOAL.x;
    this.goalPosition = { ...PLATFORM_GOAL };
    this.add.rectangle(goalX, GROUND_Y - 40, 140, 100, 0xfde68a).setStrokeStyle(4, 0x1c1917);
    this.add.triangle(goalX, GROUND_Y - 130, -80, 40, 80, 40, 0, -40, 0xb91c1c).setStrokeStyle(4, 0x1c1917);
    this.add
      .text(goalX, GROUND_Y - 200, 'Casa do Cliente', {
        fontSize: '14px',
        color: '#fff7ed',
        backgroundColor: '#1c1917',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5);

    this.add
      .text(16, 16, 'Esquerda/Direita para andar • Espaço para pular', {
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
      transitioning: false,
      goalReached: this.goalReached,
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

  update() {
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

    const input = this.inputState.snapshot;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    let vx = 0;
    if (input.left) vx -= 1;
    if (input.right) vx += 1;
    body.setVelocityX(vx * PLAYER_SPEED);

    const onGround = body.blocked.down || body.touching.down;
    if (input.jump && onGround) {
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

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.moves = false;

    // Visual: de frente, comemoração uma única vez e fica no último frame (sem loop)
    this.updateAnimation(0, true, 0);

    const titleY = this.cameras.main.height * GOAL_UI.titleYRatio;
    const title = this.add
      .text(this.cameras.main.width / 2, titleY, 'Destino encontrado!', {
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#fff7ed',
        backgroundColor: '#065f46',
        padding: { x: 20, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const hint = this.add
      .text(this.cameras.main.width / 2, titleY + GOAL_UI.hintOffsetY, 'Pressione Espaço ou Enter, ou toque no botão, para voltar ao mapa', {
        fontSize: '13px',
        color: '#fafaf9',
        backgroundColor: '#1c1917cc',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    const button = this.add
      .text(this.cameras.main.width / 2, titleY + GOAL_UI.buttonOffsetY, '▶ Voltar ao mapa', {
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

    // A confirmação aparece DEPOIS da comemoração (que fica visível, sem texto por cima).
    // Espaço/Enter já valem desde confirmReadyAt, independentemente de estar visível.
    const confirmationUi = [title, hint, button];
    confirmationUi.forEach((o) => o.setVisible(false));
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      confirmationUi.forEach((o) => o.setVisible(true));
    };
    this.player.once('animationcomplete', reveal);
    this.time.delayedCall(GOAL_UI.revealFallbackMs, reveal);

    let returning = false;
    const returnToWorld = () => {
      if (this.time.now < this.confirmReadyAt) return;
      if (returning) return;
      returning = true;
      // O ponto de retorno já foi guardado pela WorldScene ao entrar nesta fase
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start(SCENE_KEYS.World);
      });
    };

    // Pequeno atraso para o Espaço segurado durante o salto não pular o aviso
    this.confirmReadyAt = this.time.now + RETURN_INPUT_DELAY_MS;
    this.jumpWasDown = this.inputState.snapshot.jump;
    this.returnToWorld = returnToWorld;
    this.input.keyboard?.on('keydown-ENTER', returnToWorld);
  }
}
