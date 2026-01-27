/**
 * SundarPichaiNPC - Sundar Pichai NPC character that wanders around the factory.
 *
 * This NPC walks around talking to agents, giving presentations,
 * and generally managing the factory floor.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { ThinkingBubble, SUNDAR_PICHAI_THOUGHTS } from './ThinkingBubble';
import { SpeechBubble } from './SpeechBubble';
import { useEntityInteraction } from './useEntityInteraction';
import {
  STATIC_OBSTACLES,
  getWorkstationObstacles,
  getSafePosition,
  getRandomClearPosition,
  isPositionClear,
  Obstacle,
} from '../../../utils/factoryCollision';
import {
  cloneAndFixMaterials,
  removeRootMotion,
  disposeScene,
  getCircleIndicatorStyle,
  rotateTowards,
} from '../../../utils/threeHelpers';

// Preload the Sundar Pichai model
useGLTF.preload(MODEL_PATHS.SUNDAR_PICHAI);

/** Fixed scale for NPC models */
const NPC_MODEL_SCALE = 3.6;

/**
 * NPC behavior states
 */
type NPCState = 'wandering' | 'talking_to_agent' | 'presenting' | 'walking_circle' | 'visiting_kitchen' | 'walking_to_target';

/**
 * Animation names available in the Sundar Pichai model
 */
const SUNDAR_ANIMATIONS = {
  WALKING: 'Walking',
  TALKING: 'Talking',
  WALK_IN_CIRCLE: 'Walk In Circle',
} as const;

/**
 * Target location types for the NPC
 */
interface NPCTarget {
  x: number;
  z: number;
  type: 'agent' | 'stage' | 'center' | 'kitchen' | 'random';
  duration?: number;
}

/**
 * SundarPichaiNPC - Wandering NPC that manages the factory.
 */
export const SundarPichaiNPC: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  // Track display state for thinking bubble (only re-renders when state changes)
  const [displayState, setDisplayState] = useState<NPCState>('wandering');
  const lastDisplayStateRef = useRef<NPCState>('wandering');

  // NPC state
  const stateRef = useRef<{
    currentState: NPCState;
    target: NPCTarget | null;
    stateStartTime: number;
    stateDuration: number;
    currentPos: { x: number; z: number };
    initialized: boolean;
    lastDecisionTime: number;
  }>({
    currentState: 'wandering',
    target: null,
    stateStartTime: 0,
    stateDuration: 0,
    currentPos: { x: 10, z: 0 },
    initialized: false,
    lastDecisionTime: 0,
  });

  // Load Sundar Pichai model
  const gltf = useGLTF(MODEL_PATHS.SUNDAR_PICHAI);

  // Clone scene with fixed materials
  const clonedScene = useMemo(() => cloneAndFixMaterials(gltf.scene), [gltf.scene]);

  // Remove root motion to prevent world-space drift
  const processedAnimations = useMemo(
    () => removeRootMotion(gltf.animations),
    [gltf.animations]
  );

  // Setup animations
  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Start with idle animation to avoid T-pose
  useEffect(() => {
    const idleAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
    if (idleAction) {
      idleAction.reset().play();
    }
  }, [actions]);

  // Get factory context
  const {
    agents,
    zones,
    updateNpcPosition,
    entityConversations,
  } = useFactory();

  const NPC_ID = FACTORY_CONSTANTS.NPC_IDS.SUNDAR_PICHAI;
  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(NPC_ID);

  // Compute all obstacles (static + workstations)
  const allObstacles = useMemo<Obstacle[]>(() => {
    return [...STATIC_OBSTACLES, ...getWorkstationObstacles(zones)];
  }, [zones]);

  // Get useful positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;

  // Helper to find a random agent to talk to (stand outside workstation area)
  const findAgentToTalkTo = useMemo(() => {
    return () => {
      const agentList = Array.from(agents.values());
      if (agentList.length === 0) return null;
      const randomAgent = agentList[Math.floor(Math.random() * agentList.length)];
      // Stand 3 units away from the agent (outside workstation obstacle)
      const targetX = randomAgent.basePosition.x + 3.0;
      const targetZ = randomAgent.basePosition.z + 3.0;
      // Validate target is clear; if not, try alternate offset
      if (isPositionClear(targetX, targetZ, allObstacles)) {
        return { x: targetX, z: targetZ, type: 'agent' as const, duration: 5 + Math.random() * 5 };
      }
      const altX = randomAgent.basePosition.x - 3.0;
      const altZ = randomAgent.basePosition.z + 3.0;
      if (isPositionClear(altX, altZ, allObstacles)) {
        return { x: altX, z: altZ, type: 'agent' as const, duration: 5 + Math.random() * 5 };
      }
      // Fallback: stand further away
      return {
        x: randomAgent.basePosition.x,
        z: randomAgent.basePosition.z + 4.0,
        type: 'agent' as const,
        duration: 5 + Math.random() * 5,
      };
    };
  }, [agents, allObstacles]);

  // Circle indicator styling from shared utility
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, 0x44aa44);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeScene(clonedScene);
  }, [clonedScene]);

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Update animation mixer
    mixer?.update(delta);

    const npcState = stateRef.current;
    const currentTime = state.clock.elapsedTime;

    // Pause on hover - freeze movement and play idle animation
    if (isHovered) {
      const idleAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
      if (idleAction && !idleAction.isRunning()) {
        Object.values(actions).forEach(action => action?.fadeOut(0.3));
        idleAction.reset().fadeIn(0.3).play();
      }
      // Still apply position and report
      groupRef.current.position.x = npcState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = npcState.currentPos.z;
      updateNpcPosition('sundar-pichai-npc', groupRef.current.position);
      return;
    }

    // Initialize position at a clear spot
    if (!npcState.initialized) {
      const start = getRandomClearPosition(allObstacles, 10, 10, 10, 0);
      npcState.currentPos = { x: start.x, z: start.z };
      groupRef.current.position.set(start.x, 0, start.z);
      npcState.initialized = true;
      npcState.lastDecisionTime = currentTime;
    }

    // Make decisions every few seconds
    const decisionInterval = 6;
    if (currentTime - npcState.lastDecisionTime > decisionInterval && !npcState.target) {
      npcState.lastDecisionTime = currentTime;

      const rand = Math.random();

      if (rand < 0.35) {
        // 35% - Talk to an agent
        const agentTarget = findAgentToTalkTo();
        if (agentTarget) {
          npcState.target = agentTarget;
          npcState.currentState = 'walking_to_target';
        }
      } else if (rand < 0.47) {
        // 12% - Go to stage area for presentation
        npcState.target = {
          x: stagePos.x - 2,
          z: stagePos.z,
          type: 'stage',
          duration: 8 + Math.random() * 5,
        };
        npcState.currentState = 'walking_to_target';
      } else if (rand < 0.59) {
        // 12% - Walk in circle at center
        npcState.target = {
          x: 0,
          z: 0,
          type: 'center',
          duration: 10 + Math.random() * 5,
        };
        npcState.currentState = 'walking_to_target';
      } else if (rand < 0.74) {
        // 15% - Visit the kitchen for a snack/coffee
        const seatPositions = FACTORY_CONSTANTS.KITCHEN.SEAT_POSITIONS;
        const spot = seatPositions[Math.floor(Math.random() * seatPositions.length)];
        npcState.target = {
          x: kitchenPos.x + spot.x,
          z: kitchenPos.z + spot.z,
          type: 'kitchen',
          duration: 6 + Math.random() * 8,
        };
        npcState.currentState = 'walking_to_target';
      } else {
        // 26% - Random wander to a clear position
        const wanderTarget = getRandomClearPosition(allObstacles);
        npcState.target = {
          x: wanderTarget.x,
          z: wanderTarget.z,
          type: 'random',
          duration: 3 + Math.random() * 3,
        };
        npcState.currentState = 'walking_to_target';
      }
    }

    // Handle walking to target
    if (npcState.target) {
      const dx = npcState.target.x - npcState.currentPos.x;
      const dz = npcState.target.z - npcState.currentPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 0.5) {
        // Walking to target
        const speed = 2.0;
        const moveAmount = Math.min(speed * delta, distance);
        const newX = npcState.currentPos.x + (dx / distance) * moveAmount;
        const newZ = npcState.currentPos.z + (dz / distance) * moveAmount;

        // Collision check - avoid obstacles and walls
        const oldX = npcState.currentPos.x;
        const oldZ = npcState.currentPos.z;
        const safe = getSafePosition(newX, newZ, oldX, oldZ, allObstacles);
        npcState.currentPos.x = safe.x;
        npcState.currentPos.z = safe.z;

        // If stuck (position barely changed), abandon target and pick a new one
        if (Math.abs(safe.x - oldX) < 0.01 &&
            Math.abs(safe.z - oldZ) < 0.01 &&
            distance > 2) {
          npcState.target = null;
          npcState.lastDecisionTime = 0;
        }

        // Face movement direction
        rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

        // Play walking animation
        const walkAction = actions?.[SUNDAR_ANIMATIONS.WALKING];
        if (walkAction && !walkAction.isRunning()) {
          Object.values(actions).forEach(action => action?.fadeOut(0.3));
          walkAction.reset().fadeIn(0.3).play();
        }
      } else {
        // Arrived at target
        const targetType = npcState.target.type;
        const duration = npcState.target.duration || 5;

        if (targetType === 'agent') {
          // Talk to agent
          const talkAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
          if (talkAction && !talkAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            talkAction.reset().fadeIn(0.3).play();
          }
          npcState.currentState = 'talking_to_agent';
        } else if (targetType === 'kitchen') {
          // Visiting kitchen - talking animation (chatting while getting food)
          const talkAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
          if (talkAction && !talkAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            talkAction.reset().fadeIn(0.3).play();
          }
          // Face the counter
          const toCounter = Math.atan2(kitchenPos.x - npcState.currentPos.x, kitchenPos.z - npcState.currentPos.z);
          groupRef.current.rotation.y = toCounter;
          npcState.currentState = 'visiting_kitchen';
        } else if (targetType === 'stage') {
          // Present at stage
          const talkAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
          if (talkAction && !talkAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            talkAction.reset().fadeIn(0.3).play();
          }
          // Face the audience
          groupRef.current.rotation.y = -Math.PI / 2;
          npcState.currentState = 'presenting';
        } else if (targetType === 'center') {
          // Walk in circle
          const circleAction = actions?.[SUNDAR_ANIMATIONS.WALK_IN_CIRCLE];
          if (circleAction && !circleAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            circleAction.reset().fadeIn(0.3).play();
          }
          npcState.currentState = 'walking_circle';
        } else {
          // Random wander stop - talk animation as idle
          const talkAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
          if (talkAction && !talkAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            talkAction.reset().fadeIn(0.3).play();
          }
          npcState.currentState = 'wandering';
        }

        npcState.stateStartTime = currentTime;
        npcState.stateDuration = duration;
        npcState.target = null;
      }
    }

    // Check if current activity duration has elapsed
    if (!npcState.target && npcState.currentState !== 'walking_to_target') {
      if (currentTime - npcState.stateStartTime > npcState.stateDuration) {
        npcState.lastDecisionTime = 0;
      }
    }

    // Apply position - keep feet on ground (y=0)
    groupRef.current.position.x = npcState.currentPos.x;
    groupRef.current.position.y = 0;
    groupRef.current.position.z = npcState.currentPos.z;

    // Report position to context for boss mode tracking
    updateNpcPosition('sundar-pichai-npc', groupRef.current.position);

    // Update display state for thinking bubble (only when state changes)
    if (npcState.currentState !== lastDisplayStateRef.current) {
      lastDisplayStateRef.current = npcState.currentState;
      setDisplayState(npcState.currentState);
    }
  });

  // Get thoughts based on current NPC state
  const currentThoughts = useMemo(() => {
    return SUNDAR_PICHAI_THOUGHTS[displayState] || SUNDAR_PICHAI_THOUGHTS.wandering;
  }, [displayState]);

  return (
    <group
      ref={groupRef}
      position={[10, 0, 0]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under NPC - glows on hover/select */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FACTORY_CONSTANTS.CIRCLE_INDICATOR.Y_OFFSET, 0]}>
        <circleGeometry args={[
          isHovered || isSelected
            ? FACTORY_CONSTANTS.CIRCLE_INDICATOR.RADIUS_ACTIVE
            : FACTORY_CONSTANTS.CIRCLE_INDICATOR.RADIUS_DEFAULT,
          FACTORY_CONSTANTS.CIRCLE_INDICATOR.SEGMENTS,
        ]} />
        <meshStandardMaterial
          color={circleStyle.color}
          emissive={circleStyle.emissive}
          emissiveIntensity={circleStyle.emissiveIntensity}
          transparent
          opacity={circleStyle.opacity}
        />
      </mesh>

      <primitive object={clonedScene} scale={NPC_MODEL_SCALE} />

      {/* Conversation speech bubble - highest priority */}
      {(() => {
        const convo = entityConversations.get(NPC_ID);
        if (convo?.currentLine) {
          return <SpeechBubble text={convo.currentLine} yOffset={6.0} variant="conversation" />;
        }
        return null;
      })()}

      {/* Thinking bubble - shown on hover/selection, only if not in conversation */}
      {!entityConversations.has(NPC_ID) && (isHovered || isSelected) && (
        <ThinkingBubble thoughts={currentThoughts} yOffset={6.0} />
      )}
    </group>
  );
};

export default SundarPichaiNPC;
