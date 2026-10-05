// Motor de jogo 2D desacoplado do mini-jogo de entregas do Novo Hiper

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  PlayerState, 
  DeliveryMission, 
  GameParticle, 
  MissionState, 
  InteractiveZonePrompt,
  Direction
} from './types';
import { 
  NOVO_HIPER_SHOP, 
  PLAYER_SPAWN_POSITION, 
  MAP_STATIC_OBSTACLES 
} from './mapData';
import { moveWithCollisionSlide } from './collisionSystem';
import { 
  getStoredActiveMission, 
  saveActiveMission, 
  getStoredPlayerPosition, 
  savePlayerPosition 
} from '../services/gameStorage';
import { sounds } from '../services/sound';

export interface UseGameEngineProps {
  initialMission?: DeliveryMission | null;
  onMissionCompleted: (mission: DeliveryMission) => void;
}

const PLAYER_BASE_SPEED = 3.6;

export function useGameEngine({ initialMission, onMissionCompleted }: UseGameEngineProps) {
  // 1. Estado da Missão Atual
  const [mission, setMission] = useState<DeliveryMission | null>(() => {
    return initialMission || getStoredActiveMission();
  });

  // Guard para evitar qualquer duplicação de entrega
  const isDeliveringRef = useRef(false);

  // 2. Estado do Jogador Bernardo
  const savedPos = getStoredPlayerPosition();
  const [player, setPlayer] = useState<PlayerState>(() => ({
    x: savedPos?.x ?? PLAYER_SPAWN_POSITION.x,
    y: savedPos?.y ?? PLAYER_SPAWN_POSITION.y,
    vx: 0,
    vy: 0,
    speed: PLAYER_BASE_SPEED,
    facing: 'down',
    isMoving: false,
    carryingPlant: mission
      ? mission.state === 'PLANTA_RETIRADA' ||
        mission.state === 'INDO_PARA_CLIENTE' ||
        mission.state === 'PRONTO_PARA_ENTREGA'
      : false,
    walkCycle: 0,
    stepTime: 0,
  }));

  // Vetores de entrada e teclado
  const inputVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Partículas
  const particlesRef = useRef<GameParticle[]>([]);

  // Notificação / Prompt de Interação no raio de ação
  const [interactionPrompt, setInteractionPrompt] = useState<InteractiveZonePrompt>({
    canInteract: false,
    action: null,
    label: '',
    distance: 0,
  });

  // Sincronizar quando a prop de missão externa for alterada
  useEffect(() => {
    if (initialMission) {
      setMission(initialMission);
      const isCarrying =
        initialMission.state === 'PLANTA_RETIRADA' ||
        initialMission.state === 'INDO_PARA_CLIENTE' ||
        initialMission.state === 'PRONTO_PARA_ENTREGA';
      setPlayer((prev) => ({ ...prev, carryingPlant: isCarrying }));
    }
  }, [initialMission]);

  // Controles de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        e.preventDefault();
      }

      keysRef.current[key] = true;

      // Botão de interação rápida (Espaço ou E / Enter)
      if (key === ' ' || key === 'e' || key === 'enter') {
        executeInteraction();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [interactionPrompt]);

  // Entrada pelo Joystick / D-Pad virtual
  const setInputDirection = useCallback((x: number, y: number) => {
    inputVectorRef.current = { x, y };
  }, []);

  // Disparo da Ação Interativa (Pegar Planta ou Entregar ao Cliente)
  const executeInteraction = useCallback(() => {
    if (!interactionPrompt.canInteract || !interactionPrompt.action) return;

    if (interactionPrompt.action === 'pickup') {
      if (!mission) return;

      // Efeito sonoro
      sounds.playPreparePlant();

      // Partículas botânicas de folhas verdes em espiral
      for (let i = 0; i < 18; i++) {
        particlesRef.current.push({
          id: Math.random(),
          x: player.x,
          y: player.y - 16,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3.5 - 1.2,
          life: 40,
          maxLife: 40,
          size: 7,
          color: '#10b981',
          type: 'leaf',
        });
      }

      // Bernardo passa a carregar a planta em mãos
      setPlayer((prev) => ({ ...prev, carryingPlant: true }));

      const updatedMission: DeliveryMission = {
        ...mission,
        state: 'PLANTA_RETIRADA',
      };
      setMission(updatedMission);
      saveActiveMission(updatedMission);
    } else if (interactionPrompt.action === 'deliver') {
      if (!mission || isDeliveringRef.current) return;
      isDeliveringRef.current = true;

      // Efeito sonoro de entrega e celebração
      sounds.playBellRing();

      // Chuva festiva de corações e estrelas douradas
      for (let i = 0; i < 24; i++) {
        particlesRef.current.push({
          id: Math.random(),
          x: mission.destination.mapX,
          y: mission.destination.mapY - 26,
          vx: (Math.random() - 0.5) * 5,
          vy: -Math.random() * 4.5 - 2,
          life: 50,
          maxLife: 50,
          size: 9,
          color: Math.random() > 0.5 ? '#ef4444' : '#f59e0b',
          type: Math.random() > 0.4 ? 'heart' : 'sparkle',
        });
      }

      setPlayer((prev) => ({ ...prev, carryingPlant: false }));

      const completedMission: DeliveryMission = {
        ...mission,
        state: 'ENTREGA_CONCLUIDA',
        completedAt: Date.now(),
      };

      setMission(completedMission);
      saveActiveMission(completedMission);

      // Notificar o orquestrador do Novo Hiper para decrementar estoque e creditar o caixa
      onMissionCompleted(completedMission);

      setTimeout(() => {
        isDeliveringRef.current = false;
      }, 1000);
    }
  }, [interactionPrompt, mission, player.x, player.y, onMissionCompleted]);

  // Loop de Física e Animação
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // 1. Coleta de Input
      let dirX = inputVectorRef.current.x;
      let dirY = inputVectorRef.current.y;

      const k = keysRef.current;
      if (k['w'] || k['arrowup']) dirY -= 1;
      if (k['s'] || k['arrowdown']) dirY += 1;
      if (k['a'] || k['arrowleft']) dirX -= 1;
      if (k['d'] || k['arrowright']) dirX += 1;

      const mag = Math.hypot(dirX, dirY);
      let isMoving = false;
      let speedX = 0;
      let speedY = 0;

      if (mag > 0.08) {
        speedX = (dirX / Math.max(1, mag)) * player.speed;
        speedY = (dirY / Math.max(1, mag)) * player.speed;
        isMoving = true;
      }

      // 2. Determinação do Rumo (Facing)
      let facing: Direction = player.facing;
      if (Math.abs(speedX) > Math.abs(speedY)) {
        if (speedX > 0.1) facing = 'right';
        else if (speedX < -0.1) facing = 'left';
      } else if (Math.abs(speedY) > 0.1) {
        if (speedY > 0.1) facing = 'down';
        else if (speedY < -0.1) facing = 'up';
      }

      // 3. Colisão com Deslizamento
      const nextPos = moveWithCollisionSlide(
        player.x,
        player.y,
        speedX,
        speedY,
        MAP_STATIC_OBSTACLES
      );

      // 4. Animação de Passos e Ciclo de Caminhada
      let walkCycle = player.walkCycle;
      if (isMoving) {
        walkCycle = (walkCycle + dt * 3.8) % 1;

        // Partículas suaves de poeira nos passos
        if (Math.random() < 0.16) {
          particlesRef.current.push({
            id: Math.random(),
            x: nextPos.x + (Math.random() - 0.5) * 6,
            y: nextPos.y + 4,
            vx: -speedX * 0.15 + (Math.random() - 0.5) * 0.5,
            vy: -0.6,
            life: 18,
            maxLife: 18,
            size: 2.2,
            color: '#cbd5e1',
            type: 'dust',
          });
        }
      } else {
        walkCycle = 0;
      }

      // 5. Atualizar e Limpar Partículas
      particlesRef.current = particlesRef.current
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          life: p.life - 1,
        }))
        .filter((p) => p.life > 0);

      // 6. Atualizar Posição do Jogador
      setPlayer((prev) => ({
        ...prev,
        x: nextPos.x,
        y: nextPos.y,
        vx: speedX,
        vy: speedY,
        facing,
        isMoving,
        walkCycle,
      }));

      // Salvar posição com taxa controlada
      if (isMoving && Math.random() < 0.04) {
        savePlayerPosition({ x: nextPos.x, y: nextPos.y });
      }

      // 7. Checagem de Zonas Interativas
      evaluateProximityInteractions(nextPos.x, nextPos.y);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [player.x, player.y, player.facing, player.speed, player.walkCycle, mission]);

  // Avaliação de Proximidade para Botões e HUD
  const evaluateProximityInteractions = (px: number, py: number) => {
    // Caso 1: Buscar muda na Loja Novo Hiper
    const distShop = Math.hypot(px - NOVO_HIPER_SHOP.pickupX, py - NOVO_HIPER_SHOP.pickupY);
    const shopMeters = Math.round(distShop * 0.35);

    if (
      mission &&
      (mission.state === 'INDO_PARA_RETIRADA' || mission.state === 'AGUARDANDO_INICIO')
    ) {
      if (distShop < 55) {
        setInteractionPrompt({
          canInteract: true,
          action: 'pickup',
          label: `Pegar Muda de ${mission.plant.name.split(' ')[0]} 🌿`,
          distance: shopMeters,
        });
        return;
      }
    }

    // Caso 2: Entregar na Residência do Cliente
    if (
      mission &&
      (mission.state === 'PLANTA_RETIRADA' ||
        mission.state === 'INDO_PARA_CLIENTE' ||
        mission.state === 'PRONTO_PARA_ENTREGA')
    ) {
      const distCustomer = Math.hypot(
        px - mission.destination.mapX,
        py - mission.destination.mapY
      );
      const customerMeters = Math.round(distCustomer * 0.35);

      if (distCustomer < 65) {
        // Atualiza o estado da missão para pronto para entrega se ainda não estiver
        if (mission.state !== 'PRONTO_PARA_ENTREGA') {
          setMission((prev) => (prev ? { ...prev, state: 'PRONTO_PARA_ENTREGA' } : null));
        }

        setInteractionPrompt({
          canInteract: true,
          action: 'deliver',
          label: `Entregar para ${mission.customer.name.split(' ')[0]} 🎁`,
          distance: customerMeters,
        });
        return;
      } else {
        if (mission.state === 'PRONTO_PARA_ENTREGA') {
          setMission((prev) => (prev ? { ...prev, state: 'INDO_PARA_CLIENTE' } : null));
        }
      }
    }

    // Nenhuma ação no momento
    setInteractionPrompt({
      canInteract: false,
      action: null,
      label: '',
      distance: shopMeters,
    });
  };

  // Informações para a Bússola e HUD
  const getCompass = () => {
    if (!mission) {
      return {
        targetName: 'Loja Novo Hiper',
        angleDeg: 0,
        distanceMeters: 0,
        instruction: 'Selecione um pedido para iniciar a entrega',
        state: 'AGUARDANDO_INICIO' as MissionState,
      };
    }

    let targetX = NOVO_HIPER_SHOP.pickupX;
    let targetY = NOVO_HIPER_SHOP.pickupY;
    let targetName = 'Loja Novo Hiper (Balcão de Retirada)';
    let instruction = `1. Vá até a Loja Novo Hiper retirar a muda de ${mission.plant.name}.`;

    if (
      mission.state === 'PLANTA_RETIRADA' ||
      mission.state === 'INDO_PARA_CLIENTE' ||
      mission.state === 'PRONTO_PARA_ENTREGA'
    ) {
      targetX = mission.destination.mapX;
      targetY = mission.destination.mapY;
      targetName = `${mission.customer.name} (${mission.destination.name})`;
      instruction = `2. Leve a ${mission.plant.name} até ${mission.customer.name} no destino!`;
    } else if (mission.state === 'ENTREGA_CONCLUIDA' || mission.state === 'FINALIZADA') {
      instruction = `🎉 Entrega realizada com sucesso! Parabéns!`;
    }

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distanceMeters = Math.max(1, Math.round(Math.hypot(dx, dy) * 0.35));
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    return {
      targetName,
      angleDeg,
      distanceMeters,
      instruction,
      state: mission.state,
    };
  };

  return {
    player,
    mission,
    setMission,
    particles: particlesRef.current,
    interactionPrompt,
    setInputDirection,
    executeInteraction,
    getCompass,
  };
}
