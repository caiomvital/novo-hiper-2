import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  PackageCheck, 
  Sprout, 
  Sparkles, 
  Compass, 
  Gamepad2 
} from 'lucide-react';

interface VirtualControlsProps {
  canInteract: boolean;
  action: 'pickup' | 'deliver' | 'PICKUP' | 'DELIVER' | null;
  interactionLabel: string;
  onInteract: () => void;
  onDirectionChange: (x: number, y: number) => void;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({
  canInteract,
  action,
  interactionLabel,
  onInteract,
  onDirectionChange,
}) => {
  const [controlMode, setControlMode] = useState<'joystick' | 'dpad'>('joystick');
  
  // Joystick states
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  // Manipulação de toque no joystick
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!joystickBaseRef.current) return;
    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsDragging(true);
    updateJoystickPos(touch.clientX, touch.clientY);
  };

  const updateJoystickPos = useCallback((clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2 - 12;

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    setStickPos({ x: clampedX, y: clampedY });

    // Normalizar para valores entre -1 e 1
    const normX = clampedX / maxRadius;
    const normY = clampedY / maxRadius;
    onDirectionChange(normX, normY);
  }, [onDirectionChange]);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          updateJoystickPos(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging || touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          setIsDragging(false);
          setStickPos({ x: 0, y: 0 });
          onDirectionChange(0, 0);
          break;
        }
      }
    };

    if (isDragging) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
      window.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, updateJoystickPos, onDirectionChange]);

  // Controles do D-Pad
  const dpadPressedRef = useRef<{ [key: string]: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const handleDpadPress = (dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) => {
    dpadPressedRef.current[dir] = pressed;
    let dx = 0;
    let dy = 0;
    if (dpadPressedRef.current.up) dy -= 1;
    if (dpadPressedRef.current.down) dy += 1;
    if (dpadPressedRef.current.left) dx -= 1;
    if (dpadPressedRef.current.right) dx += 1;
    onDirectionChange(dx, dy);
  };

  return (
    <div className="pointer-events-none select-none absolute inset-x-0 bottom-0 p-4 sm:p-6 flex items-end justify-between z-30">
      {/* Botão de alternar tipo de controle (Joystick vs D-Pad) */}
      <div className="pointer-events-auto absolute -top-12 left-4 sm:left-6 flex items-center gap-1.5 bg-stone-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-stone-700/60 text-white text-xs shadow-lg">
        <button
          type="button"
          onClick={() => setControlMode(controlMode === 'joystick' ? 'dpad' : 'joystick')}
          className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-pointer"
          title="Alternar entre Joystick analógico e botões direcionais D-Pad"
        >
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-[11px]">
            {controlMode === 'joystick' ? 'Usar Botões (D-Pad)' : 'Usar Joystick'}
          </span>
        </button>
      </div>

      {/* LADO ESQUERDO: Controles de Movimentação */}
      <div className="pointer-events-auto">
        {controlMode === 'joystick' ? (
          /* Joystick Virtual Tátil */
          <div
            ref={joystickBaseRef}
            onTouchStart={handleTouchStart}
            className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-stone-900/60 backdrop-blur-md border-2 border-stone-700/80 shadow-2xl flex items-center justify-center touch-none active:border-emerald-500/80 transition-colors"
          >
            {/* Grade interna do analógico */}
            <div className="w-16 h-16 rounded-full border border-stone-700/40 pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Compass className="w-6 h-6 text-stone-600/40" />
            </div>

            {/* Manete do Joystick */}
            <div
              style={{
                transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 border-2 border-white/80 shadow-lg flex items-center justify-center pointer-events-none"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-400/60 border border-white/40" />
            </div>
          </div>
        ) : (
          /* D-Pad Clássico com 4 Botões Grandes */
          <div className="relative w-36 h-36 grid grid-cols-3 grid-rows-3 gap-1 p-1 bg-stone-900/60 backdrop-blur-md rounded-2xl border border-stone-700/80 shadow-xl touch-none">
            {/* Cima */}
            <div className="col-start-2 row-start-1">
              <button
                type="button"
                onTouchStart={() => handleDpadPress('up', true)}
                onTouchEnd={() => handleDpadPress('up', false)}
                onMouseDown={() => handleDpadPress('up', true)}
                onMouseUp={() => handleDpadPress('up', false)}
                className="w-full h-full rounded-xl bg-stone-800 active:bg-emerald-700 text-white flex items-center justify-center border border-stone-700 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronUp className="w-6 h-6" />
              </button>
            </div>
            {/* Esquerda */}
            <div className="col-start-1 row-start-2">
              <button
                type="button"
                onTouchStart={() => handleDpadPress('left', true)}
                onTouchEnd={() => handleDpadPress('left', false)}
                onMouseDown={() => handleDpadPress('left', true)}
                onMouseUp={() => handleDpadPress('left', false)}
                className="w-full h-full rounded-xl bg-stone-800 active:bg-emerald-700 text-white flex items-center justify-center border border-stone-700 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>
            {/* Centro (Neutro) */}
            <div className="col-start-2 row-start-2 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-stone-600/60" />
            </div>
            {/* Direita */}
            <div className="col-start-3 row-start-2">
              <button
                type="button"
                onTouchStart={() => handleDpadPress('right', true)}
                onTouchEnd={() => handleDpadPress('right', false)}
                onMouseDown={() => handleDpadPress('right', true)}
                onMouseUp={() => handleDpadPress('right', false)}
                className="w-full h-full rounded-xl bg-stone-800 active:bg-emerald-700 text-white flex items-center justify-center border border-stone-700 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            {/* Baixo */}
            <div className="col-start-2 row-start-3">
              <button
                type="button"
                onTouchStart={() => handleDpadPress('down', true)}
                onTouchEnd={() => handleDpadPress('down', false)}
                onMouseDown={() => handleDpadPress('down', true)}
                onMouseUp={() => handleDpadPress('down', false)}
                className="w-full h-full rounded-xl bg-stone-800 active:bg-emerald-700 text-white flex items-center justify-center border border-stone-700 active:scale-95 transition-all cursor-pointer"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LADO DIREITO: Botão de Ação / Interação */}
      <div className="pointer-events-auto flex flex-col items-end gap-2">
        {/* Dica de teclado para computador */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-stone-900/70 backdrop-blur-md rounded-lg border border-stone-800 text-[10px] text-stone-300 font-mono">
          <span>Teclas: <strong>W, A, S, D</strong> ou <strong>Setas</strong> | <strong>Espaço</strong> p/ agir</span>
        </div>

        {/* Botão de Ação Principal */}
        <button
          id="btn-game-interact"
          type="button"
          disabled={!canInteract}
          onClick={onInteract}
          className={`relative min-w-[130px] sm:min-w-[160px] h-16 sm:h-18 px-4 rounded-2xl sm:rounded-3xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-2xl transition-all duration-200 cursor-pointer ${
            canInteract
              ? action?.toLowerCase() === 'pickup'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-2 border-emerald-300 shadow-emerald-900/50 scale-105 active:scale-95 animate-pulse'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-2 border-amber-200 shadow-amber-900/50 scale-105 active:scale-95 animate-bounce'
              : 'bg-stone-900/70 backdrop-blur-md border border-stone-800 text-stone-500 opacity-60 cursor-not-allowed'
          }`}
        >
          {canInteract ? (
            action?.toLowerCase() === 'pickup' ? (
              <>
                <Sprout className="w-6 h-6 text-emerald-200" />
                <span className="truncate">{interactionLabel || 'Pegar Muda'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6 text-amber-200" />
                <span className="truncate">{interactionLabel || 'Entregar!'}</span>
              </>
            )
          ) : (
            <>
              <PackageCheck className="w-5 h-5 text-stone-500" />
              <span className="text-xs">Aproxime-se</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
