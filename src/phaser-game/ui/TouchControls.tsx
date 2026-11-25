import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowUp, Hand } from 'lucide-react';
import { InputAction, InputState } from '../input/InputState';

interface TouchControlsProps {
  mode: 'world' | 'platform' | 'interior';
  inputState: InputState;
}

const buttonClass =
  'w-12 h-12 rounded-xl bg-stone-900/70 active:bg-emerald-700 text-white flex items-center justify-center border border-stone-700/80 active:scale-95 transition-all touch-none select-none';

export const TouchControls: React.FC<TouchControlsProps> = ({ mode, inputState }) => {
  const dpadTouch = useRef<number | null>(null);
  const [directions, setDirections] = useState('');
  const releaseDirections = () => {
    for (const action of ['up', 'down', 'left', 'right'] as const) inputState.setTouch(action, false);
    dpadTouch.current = null;
    setDirections('');
  };
  useEffect(() => {
    setDirections('');
    dpadTouch.current = null;
    return () => {
    for (const action of ['up', 'down', 'left', 'right', 'jump', 'interact'] as const) inputState.setTouch(action, false);
    dpadTouch.current = null;
    };
  }, [mode, inputState]);
  const moveDpad = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (dpadTouch.current === null && event.changedTouches?.length) dpadTouch.current = event.changedTouches[0].identifier;
    const touch = Array.from<Pick<Touch, 'identifier' | 'clientX' | 'clientY'>>(event.touches ?? []).find(point => point.identifier === dpadTouch.current);
    if (!touch || !Number.isFinite(touch.clientX) || !Number.isFinite(touch.clientY)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = (touch.clientX - bounds.x - bounds.width / 2) / bounds.width;
    const dy = (touch.clientY - bounds.y - bounds.height / 2) / bounds.height;
    const horizontal = Math.abs(dx) > 0.12 && Math.abs(dx) >= Math.abs(dy) * 0.45;
    const vertical = Math.abs(dy) > 0.12 && Math.abs(dy) >= Math.abs(dx) * 0.45;
    const pressed = { left: horizontal && dx < 0, right: horizontal && dx > 0, up: vertical && dy < 0, down: vertical && dy > 0 };
    for (const action of ['up', 'down', 'left', 'right'] as const) inputState.setTouch(action, pressed[action]);
    setDirections(Object.keys(pressed).filter(action => pressed[action as keyof typeof pressed]).join(' '));
  };
  const endDpad = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dpadTouch.current === null || Array.from<Pick<Touch, 'identifier' | 'clientX' | 'clientY'>>(event.changedTouches ?? []).some(touch => touch.identifier === dpadTouch.current)) releaseDirections();
  };
  const bind = (action: InputAction) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      inputState.setTouch(action, true);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      inputState.setTouch(action, false);
    },
    onTouchCancel: () => inputState.setTouch(action, false),
    onMouseDown: () => inputState.setTouch(action, true),
    onMouseUp: () => inputState.setTouch(action, false),
    onMouseLeave: () => inputState.setTouch(action, false),
  });

  return (
    <div className="adventure-touch-controls pointer-events-none select-none absolute inset-x-0 bottom-0 p-3 sm:p-4 flex items-end justify-between z-30">
      {mode === 'world' || mode === 'interior' ? (
        <div id="adventure-dpad" data-directions={directions} onTouchStart={moveDpad} onTouchMove={moveDpad} onTouchEnd={endDpad} onTouchCancel={releaseDirections} className="adventure-dpad pointer-events-auto touch-none grid grid-cols-3 grid-rows-3 gap-1 w-[150px] h-[150px]">
          <div className="col-start-2 row-start-1">
            <button type="button" {...bind('up')} className={buttonClass} aria-label="Andar para cima">
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>
          <div className="col-start-1 row-start-2">
            <button type="button" {...bind('left')} className={buttonClass} aria-label="Andar para a esquerda">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="col-start-3 row-start-2">
            <button type="button" {...bind('right')} className={buttonClass} aria-label="Andar para a direita">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="col-start-2 row-start-3">
            <button type="button" {...bind('down')} className={buttonClass} aria-label="Andar para baixo">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" {...bind('left')} className={buttonClass} aria-label="Andar para a esquerda">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" {...bind('right')} className={buttonClass} aria-label="Andar para a direita">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {(mode === 'world' || mode === 'interior') && (
        <div className="pointer-events-auto">
          <button
            type="button"
            {...bind('interact')}
            className="adventure-action w-16 h-16 rounded-full bg-amber-600/85 active:bg-amber-500 text-white flex items-center justify-center border-2 border-amber-300/70 active:scale-95 transition-all touch-none select-none shadow-xl"
            aria-label="Interagir"
          >
            <Hand className="w-6 h-6" />
          </button>
        </div>
      )}

      {mode === 'platform' && (
        <div className="pointer-events-auto">
          <button
            type="button"
            {...bind('jump')}
            className="adventure-action w-16 h-16 rounded-full bg-emerald-700/80 active:bg-emerald-600 text-white flex items-center justify-center border-2 border-emerald-300/60 active:scale-95 transition-all touch-none select-none shadow-xl"
            aria-label="Pular"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
};
