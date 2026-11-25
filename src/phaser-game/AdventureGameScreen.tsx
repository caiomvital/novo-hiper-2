import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Gamepad2, Maximize2, Minimize2 } from 'lucide-react';
import { createGameConfig } from './phaserConfig';
import { createGameWithCleanup } from './phaserGlobals';
import { InputState } from './input/InputState';
import { installDiagnostics } from './debug/diagnostics';
import { TouchControls } from './ui/TouchControls';
import { AdventureBridge } from './bridge/adventureBridge';
import { useDeliveryFlow } from './useDeliveryFlow';
import { useShopFlow } from './useShopFlow';
import { useWorldProgress } from './useWorldProgress';
import { ShopPanel } from './ui/ShopPanel';
import { useFullscreen } from './useFullscreen';
import { DEFAULT_PLATFORM_ZOOM, PLATFORM_ZOOM_LEVELS } from './config/platformAdventure';
import type { Plant } from '../types';
import { useCompactLandscape } from './useCompactLandscape';
import { ResidentStoryPanel } from './ui/ResidentStoryPanel';
import { StoryPanel } from './ui/StoryPanel';

interface AdventureGameScreenProps {
  plants?: Plant[];
  onExit: () => void;
  /** Chamado depois de uma entrega concluída, para o App recarregar pedidos, estoque e caixa. */
  onDataChanged?: () => void | Promise<void>;
  /** Bernardo interagiu com um móvel do interior (balcão/prateleira/estoque): troca para a aba React correspondente. */
  onNavigateTab?: (tab: 'pedidos' | 'catalogo') => void;
}

type SceneMode = 'world' | 'platform' | 'interior';

const SCENE_SUBTITLE: Record<SceneMode, string> = {
  world: 'Sua loja, suas plantas e os moradores do bairro',
  platform: 'Percursos de saltos — explore e encontre a chegada',
  interior: 'Dentro da Novo Hiper — fale com o balcão, as prateleiras e o estoque',
};

export const AdventureGameScreen: React.FC<AdventureGameScreenProps> = ({ onExit, onDataChanged, onNavigateTab, plants = [] }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ scale: { refresh: () => void }; events: { emit: (event: string, ...args: unknown[]) => unknown } } | null>(null);
  const inputStateRef = useRef<InputState>(new InputState());
  const bridgeRef = useRef<AdventureBridge>(new AdventureBridge());
  useDeliveryFlow(bridgeRef.current, onDataChanged);
  const shopFlow = useShopFlow(bridgeRef.current, inputStateRef.current, onDataChanged);
  useWorldProgress(bridgeRef.current);
  const [activeMode, setActiveMode] = useState<SceneMode>('world');
  const [storyOpen, setStoryOpen] = useState(false);
  const shownEnding = useRef(false);
  useEffect(() => bridgeRef.current.subscribe(snap => {
    const story = snap.worldStage.residentStory;
    const arcWaiting = snap.worldStage.arcCompletedAt && !snap.worldStage.arcSeen;
    if (activeMode === 'world' && !arcWaiting && snap.phase === 'idle' && !snap.uiOpen && story?.status === 'completed' && !story.acknowledged && !shownEnding.current) {
      shownEnding.current = true;
      setStoryOpen(true);
    }
  }), [activeMode]);
  const [loadProgress, setLoadProgress] = useState(0);

  // Balcão/prateleira/estoque do interior pedem pra abrir uma tela React já existente (pedidos/catálogo).
  // O Phaser só EMITE a intenção; quem decide trocar de aba é o App (dono do estado de navegação).
  useEffect(() => {
    const off = bridgeRef.current.onIntent((intent) => {
      if (intent.type === 'navigate') onNavigateTab?.(intent.tab);
    });
    return off;
  }, [onNavigateTab]);
  // Ao entrar/sair da tela cheia o Phaser só recalcula o tamanho do canvas (Scale.RESIZE): sem recriar Game nem cena
  const refreshScale = useCallback(() => {
    requestAnimationFrame(() => gameRef.current?.scale.refresh());
  }, []);
  const fullscreen = useFullscreen(rootRef, refreshScale, activeMode === 'platform');
  const [platformZoom, setPlatformZoom] = useState<number>(DEFAULT_PLATFORM_ZOOM);
  const changeZoom = (zoom: number) => {
    setPlatformZoom(zoom);
    gameRef.current?.events.emit('platform-zoom', zoom);
  };
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  );

  const compactLandscape = useCompactLandscape(isTouchDevice);
  useEffect(() => { if (!compactLandscape) rootRef.current?.scrollIntoView({ block: 'start' }); }, [compactLandscape]);

  const stepZoom = (direction: -1 | 1) => {
    const index = PLATFORM_ZOOM_LEVELS.findIndex(value => value === platformZoom);
    changeZoom(PLATFORM_ZOOM_LEVELS[Math.max(0, Math.min(PLATFORM_ZOOM_LEVELS.length - 1, index + direction))]);
  };

  // Monta o Phaser.Game no mount e destrói corretamente no unmount (sem canvas
  // duplicado nem listeners globais vazando para as telas React).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    rootRef.current?.scrollIntoView({ block: 'start' });

    const inputState = inputStateRef.current;
    inputState.attachKeyboard();

    const game = createGameWithCleanup(createGameConfig(container));
    gameRef.current = game;
    game.registry.set('inputState', inputState);
    game.registry.set('touchDevice', isTouchDevice);
    game.registry.set('bridge', bridgeRef.current);
    const openStory = () => { const snap = bridgeRef.current.getSnapshot(); if (!snap.uiOpen && snap.phase === 'idle') setStoryOpen(true); };
    game.events.on('open-resident-story', openStory);
    let resizeFrame = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => { if (gameRef.current === game) game.scale.refresh(); });
    });
    resizeObserver.observe(container);
    const removeDiagnostics = installDiagnostics(game, inputState, container);

    const handleActiveSceneChange = (_parent: unknown, value: SceneMode) => {
      setActiveMode(value);
      requestAnimationFrame(() => { if (gameRef.current === game) game.scale.refresh(); });
    };
    const offLayout = bridgeRef.current.subscribe(() => requestAnimationFrame(() => { if (gameRef.current === game) game.scale.refresh(); }));
    game.registry.events.on('changedata-activeScene', handleActiveSceneChange);
    const progress = (value: number) => setLoadProgress(value);
    game.events.on('adventure-loading', progress);

    return () => {
      game.registry.events.off('changedata-activeScene', handleActiveSceneChange);
      game.events.off('adventure-loading', progress);
      offLayout();
      resizeObserver.disconnect();
      cancelAnimationFrame(resizeFrame);
      game.events.off('open-resident-story', openStory);
      removeDiagnostics();
      gameRef.current = null;
      inputState.detachKeyboard();
      game.destroy(true);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      id="adventure-root"
      data-mode={activeMode}
      data-touch={isTouchDevice}
      data-compact={compactLandscape}
      className={
        fullscreen.isFullscreen
          ? 'adventure-fullscreen relative w-screen h-[100dvh] overflow-hidden bg-stone-950 flex flex-col select-none'
          : 'relative w-full h-[82vh] sm:h-[85vh] max-h-[920px] rounded-3xl overflow-hidden border border-stone-800 bg-stone-950 shadow-2xl flex flex-col select-none'
      }
    >
      {/* Barra Superior */}
      <div className="adventure-header relative z-20 shrink-0 px-3 sm:px-5 py-2.5 sm:py-3 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => { onExit(); requestAnimationFrame(() => window.scrollTo({ top: 0 })); }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Voltar para a loja"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-display font-bold text-white truncate">Aventura 2D</span>
              <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                Protótipo / Beta
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-stone-400 truncate">{SCENE_SUBTITLE[activeMode]}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeMode === 'world' && <button type="button" id="btn-resident-story" aria-label="Ouvir história de Dona Maria" onClick={() => gameRef.current?.events.emit('open-resident-story')} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-stone-950">História</button>}
          {activeMode === 'world' && <button type="button" id="btn-jump-park" aria-label="Entrar no parque de saltos" onClick={() => gameRef.current?.events.emit('start-jump-park')} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs text-white">Parque</button>}
          {activeMode === 'platform' && <button type="button" id="btn-platform-exit" onClick={() => gameRef.current?.events.emit('platform-exit')} className="rounded-xl bg-stone-800 px-3 py-2 text-xs text-white">Voltar ao bairro</button>}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-stone-400">
            <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Setas / WASD para andar • E interage • Espaço pula na plataforma</span>
          </div>
          {fullscreen.supported && (
            <button
              type="button"
              id="btn-adventure-fullscreen"
              onClick={fullscreen.toggle}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={fullscreen.isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
              aria-label={fullscreen.isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {fullscreen.isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {activeMode === 'platform' && <div id="platform-tools" className="shrink-0 flex flex-wrap items-center justify-between gap-2 bg-stone-900 px-3 py-1 text-xs text-white border-b border-stone-700">
        {isTouchDevice && !compactLandscape ? <button id="btn-platform-landscape" type="button" onClick={() => void fullscreen.enterLandscape()} className="rounded-lg bg-emerald-800 px-3 min-h-11">Jogar na horizontal</button> : <span>Zoom do percurso</span>}
        <div className="flex items-center gap-1" role="group" aria-label="Zoom da plataforma">
          <button id="btn-platform-zoom-out" type="button" aria-label="Diminuir zoom" disabled={platformZoom === PLATFORM_ZOOM_LEVELS[0]} onClick={() => stepZoom(-1)} className="h-11 w-11 rounded-lg bg-stone-700 disabled:opacity-40 text-xl">−</button>
          <button id="btn-platform-zoom-reset" type="button" aria-label="Restaurar zoom" onClick={() => changeZoom(DEFAULT_PLATFORM_ZOOM)} className="h-11 min-w-14 rounded-lg bg-stone-800">{Math.round(platformZoom / DEFAULT_PLATFORM_ZOOM * 100)}%</button>
          <button id="btn-platform-zoom-in" type="button" aria-label="Aumentar zoom" disabled={platformZoom === PLATFORM_ZOOM_LEVELS.at(-1)} onClick={() => stepZoom(1)} className="h-11 w-11 rounded-lg bg-stone-700 disabled:opacity-40 text-xl">+</button>
        </div>
        {isTouchDevice && <span id="platform-rotate-hint" className="w-full text-center text-amber-200">Gire o celular para ver mais caminho. Use − para afastar a câmera.</span>}
      </div>}

      <ResidentStoryPanel bridge={bridgeRef.current} input={inputStateRef.current} open={storyOpen} onClose={() => setStoryOpen(false)} navigate={() => onNavigateTab?.('catalogo')} />
      {/* Área do Jogo (Phaser monta o canvas aqui dentro) */}
      <StoryPanel shop={shopFlow.shop} compact={compactLandscape} plants={plants} bridge={bridgeRef.current} input={inputStateRef.current} mode={activeMode} shopOpen={Boolean(shopFlow.panel)} startRoute={() => gameRef.current?.events.emit('start-delivery-route')} navigate={onNavigateTab} />
      <div id="adventure-playfield" className="relative flex-1 min-h-0 w-full overflow-hidden bg-stone-900">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
        {loadProgress < 100 && <div id="adventure-loading" role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-stone-900 text-stone-200"><span>Preparando o bairro… {loadProgress}%</span><progress max="100" value={loadProgress} className="w-48 h-2 accent-emerald-500" /></div>}
        {isTouchDevice && <TouchControls mode={activeMode} inputState={inputStateRef.current} />}
        {shopFlow.panel && (
          <ShopPanel
            mode={shopFlow.panel}
            shop={shopFlow.shop}
            busy={shopFlow.busy}
            message={shopFlow.message}
            onClose={shopFlow.close}
            onBuy={shopFlow.purchase}
            onInstall={shopFlow.install}
            onGuideToStore={() => { shopFlow.close(); bridgeRef.current.setSnapshot({ navigationGoal: 'store' }); }}
          />
        )}
      </div>
    </div>
  );
};
