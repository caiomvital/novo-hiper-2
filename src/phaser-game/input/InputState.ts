export type InputAction = 'up' | 'down' | 'left' | 'right' | 'jump' | 'interact';

type InputSnapshot = Record<InputAction, boolean>;

const KEY_CODE_TO_ACTION: Record<string, InputAction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'jump',
  // NÃO mapear Enter aqui: o preventDefault abaixo faria o Phaser ignorar 'keydown-ENTER' (bug já corrigido na confirmação da plataforma)
  KeyE: 'interact',
};

function createEmptySnapshot(): InputSnapshot {
  return { up: false, down: false, left: false, right: false, jump: false, interact: false };
}

/**
 * Estado de input compartilhado entre teclado e controles touch.
 * As cenas do Phaser leem `snapshot` a cada frame; nada aqui depende do React.
 */
export class InputState {
  private state: InputSnapshot = createEmptySnapshot();
  /** Aperto "travado" até ser consumido: um toque rápido não se perde entre dois quadros do jogo (importante com FPS baixo). */
  private latched: Partial<Record<InputAction, boolean>> = {};

  /** Painel React aberto (loja): o jogo não consome teclado/touch e NÃO dá preventDefault (a interface HTML usa as teclas). */
  private suspended = false;

  setSuspended(value: boolean) {
    this.suspended = value;
    if (value) {
      this.state = createEmptySnapshot();
      this.latched = {};
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.suspended) return;
    const action = KEY_CODE_TO_ACTION[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) this.latched[action] = true;
    this.state[action] = true;
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (this.suspended) return;
    const action = KEY_CODE_TO_ACTION[event.code];
    if (!action) return;
    event.preventDefault();
    this.state[action] = false;
  };

  attachKeyboard() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detachKeyboard() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.state = createEmptySnapshot();
    this.latched = {};
  }

  setTouch(action: InputAction, pressed: boolean) {
    if (this.suspended) return;
    if (pressed && !this.state[action]) this.latched[action] = true;
    this.state[action] = pressed;
  }

  /** true se a ação foi pressionada desde a última consulta (e limpa o aperto). */
  consumePress(action: InputAction): boolean {
    const was = Boolean(this.latched[action]);
    this.latched[action] = false;
    return was;
  }

  get snapshot(): Readonly<InputSnapshot> {
    return this.state;
  }
}
