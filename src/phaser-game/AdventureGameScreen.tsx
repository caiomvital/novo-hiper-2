import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gamepad2 } from 'lucide-react';
import { createGameConfig } from './phaserConfig';
import { createGameWithCleanup } from './phaserGlobals';
import { InputState } from './input/InputState';
import { installDiagnostics } from './debug/diagnostics';
import { TouchControls } from './ui/TouchControls';
import { AdventureBridge } from './bridge/adventureBridge';
import { useDeliveryFlow } from './useDeliveryFlow';

interface AdventureGameScreenProps {
  onExit: () => void;
  /** Chamado depois de uma entrega concluída, para o App recarregar pedidos, estoque e caixa. */
  onDataChanged?: () => void | Promise<void>;
}

type SceneMode = 'world' | 'platform';

export const AdventureGameScreen: React.FC<AdventureGameScreenProps> = ({ onExit, onDataChanged }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputStateRef = useRef<InputState>(new InputState());
  const bridgeRef = useRef<AdventureBridge>(new AdventureBridge());
  useDeliveryFlow(bridgeRef.current, onDataChanged);
  const [activeMode, setActiveMode] = useState<SceneMode>('world');
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  );

  // Monta o Phaser.Game no mount e destrói corretamente no unmount (sem canvas
  // duplicado nem listeners globais vazando para as telas React).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const inputState = inputStateRef.current;
    inputState.attachKeyboard();

    const game = createGameWithCleanup(createGameConfig(container));
    game.registry.set('inputState', inputState);
    game.registry.set('bridge', bridgeRef.current);
    const removeDiagnostics = installDiagnostics(game, inputState, container);

    const handleActiveSceneChange = (_parent: unknown, value: SceneMode) => {
      setActiveMode(value);
    };
    game.registry.events.on('changedata-activeScene', handleActiveSceneChange);

    return () => {
      game.registry.events.off('changedata-activeScene', handleActiveSceneChange);
      removeDiagnostics();
      inputState.detachKeyboard();
      game.destroy(true);
    };
  }, []);

  return (
    <div className="relative w-full h-[82vh] sm:h-[85vh] max-h-[920px] rounded-3xl overflow-hidden border border-stone-800 bg-stone-950 shadow-2xl flex flex-col select-none">
      {/* Barra Superior */}
      <div className="relative z-20 px-3 sm:px-5 py-2.5 sm:py-3 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Voltar para a loja"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-display font-bold text-white truncate">Aventura 2D</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Protótipo / Beta
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-stone-400 truncate">
              {activeMode === 'world'
                ? 'Mapa do bairro — explore no seu ritmo'
                : 'Trecho de plataforma — atravesse até o destino'}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-stone-400">
          <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Setas / WASD para andar • Espaço para pular na plataforma</span>
        </div>
      </div>

      {/* Área do Jogo (Phaser monta o canvas aqui dentro) */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-stone-900">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {isTouchDevice && <TouchControls mode={activeMode} inputState={inputStateRef.current} />}
      </div>
    </div>
  );
};
