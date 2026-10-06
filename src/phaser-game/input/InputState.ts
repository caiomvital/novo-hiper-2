export type InputAction = 'up' | 'down' | 'left' | 'right' | 'jump';

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
};

function createEmptySnapshot(): InputSnapshot {
  return { up: false, down: false, left: false, right: false, jump: false };
}

/**
 * Estado de input compartilhado entre teclado e controles touch.
 * As cenas do Phaser leem `snapshot` a cada frame; nada aqui depende do React.
 */
export class InputState {
  private state: InputSnapshot = createEmptySnapshot();

  private handleKeyDown = (event: KeyboardEvent) => {
    const action = KEY_CODE_TO_ACTION[event.code];
    if (!action) return;
    event.preventDefault();
    this.state[action] = true;
  };

  private handleKeyUp = (event: KeyboardEvent) => {
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
  }

  setTouch(action: InputAction, pressed: boolean) {
    this.state[action] = pressed;
  }

  get snapshot(): Readonly<InputSnapshot> {
    return this.state;
  }
}
