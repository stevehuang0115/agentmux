/**
 * SteveJobsNPC - Steve Jobs NPC character that wanders around the factory.
 *
 * This NPC walks around checking on agents' work, watches performers on stage,
 * and occasionally sits on the couch to rest.
 */

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFactory } from '../../../contexts/FactoryContext';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { ThinkingBubble, STEVE_JOBS_THOUGHTS } from './ThinkingBubble';
import { SpeechBubble } from './SpeechBubble';
import {
  STATIC_OBSTACLES,
  getWorkstationObstacles,
  getSafePosition,
  isPositionClear,
  getRandomClearPosition,
  Obstacle,
} from '../../../utils/factoryCollision';

// Preload the Steve Jobs model
useGLTF.preload(MODEL_PATHS.STEVE_JOBS);

/**
 * NPC behavior states
 */
type NPCState = 'wandering' | 'checking_agent' | 'watching_stage' | 'resting' | 'visiting_kitchen' | 'walking_to_target';

/**
 * Animation names available in the Steve Jobs model
 */
const STEVE_ANIMATIONS = {
  WALKING: 'Walking',
  CLAPPING: 'Clapping',
  STANDING_CLAP: 'Standing Clap',
} as const;

/**
 * Target location types for the NPC
 */
interface NPCTarget {
  x: number;
  z: number;
  type: 'agent' | 'stage' | 'couch' | 'kitchen' | 'random';
  duration?: number; // How long to stay at this target (in seconds)
}

/**
 * SteveJobsNPC - Wandering NPC that supervises the factory.
 */
export const SteveJobsNPC: React.FC = () => {
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
    lastAgentCheckTime: number;
    lastDecisionTime: number;
    couchRotation: number;
  }>({
    currentState: 'wandering',
    target: null,
    stateStartTime: 0,
    stateDuration: 0,
    currentPos: { x: 0, z: 0 },
    initialized: false,
    lastAgentCheckTime: 0,
    lastDecisionTime: 0,
    couchRotation: 0,
  });

  // Load Steve Jobs model
  const gltf = useGLTF(MODEL_PATHS.STEVE_JOBS);

  // Clone scene for this instance
  const { clonedScene, modelScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene);

    // Fix materials for better visibility
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          child.material = (child.material as THREE.Material).clone();
        }
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat && mat.isMeshStandardMaterial) {
          mat.metalnessMap = null;
          mat.roughnessMap = null;
          mat.metalness = 0.0;
          mat.roughness = 0.7;
          mat.needsUpdate = true;
        }
      }
    });

    // Scale for the model - adjust based on actual model size
    // Assuming Mixamo standard ~2.0 units, target ~4.0 units (human scale)
    const scale = 3.6; // 1.5x current size (was 2.4)

    return { clonedScene: clone, modelScale: scale };
  }, [gltf.scene]);

  // Remove root motion from animations
  const processedAnimations = useMemo(() => {
    return gltf.animations.map((clip) => {
      const tracks = clip.tracks.filter((track) => {
        const isRootPositionTrack = track.name.includes('Hips') && track.name.endsWith('.position');
        return !isRootPositionTrack;
      });
      return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
    });
  }, [gltf.animations]);

  // Setup animations
  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Log available animations on mount and start with idle animation
  useEffect(() => {
    const animationNames = Object.keys(actions);
    console.log('[SteveJobsNPC] Available animations:', animationNames.join(', '));
    console.log('[SteveJobsNPC] Animation count:', animationNames.length);
    // Also log the raw GLTF animation names
    console.log('[SteveJobsNPC] Raw GLTF animations:', gltf.animations.map(a => a.name).join(', '));

    // Start with Standing Clap as idle animation to avoid T-pose
    const idleAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
    if (idleAction) {
      idleAction.reset().play();
    }
  }, [actions, gltf.animations]);

  // Get factory context
  const {
    agents,
    zones,
    isStagePerformer,
    updateNpcPosition,
    hoveredEntityId,
    selectedEntityId,
    setHoveredEntity,
    selectEntity,
    entityConversations,
  } = useFactory();

  const NPC_ID = 'steve-jobs-npc';
  const isHovered = hoveredEntityId === NPC_ID;
  const isSelected = selectedEntityId === NPC_ID;

  // Compute all obstacles (static + workstations)
  const allObstacles = useMemo<Obstacle[]>(() => {
    return [...STATIC_OBSTACLES, ...getWorkstationObstacles(zones)];
  }, [zones]);

  // Get useful positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;
  const audiencePositions = FACTORY_CONSTANTS.STAGE.AUDIENCE_POSITIONS;
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;

  // Helper to find a random active agent to check on (stand outside workstation area)
  const findAgentToCheck = useMemo(() => {
    return () => {
      const agentList = Array.from(agents.values());
      const activeAgents = agentList.filter(a => a.status === 'active');
      if (activeAgents.length === 0) return null;
      const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
      // Stand 3 units away from the agent (outside workstation obstacle)
      const targetX = randomAgent.basePosition.x + 3.0;
      const targetZ = randomAgent.basePosition.z + 3.0;
      // Validate target is clear; if not, try alternate offset
      if (isPositionClear(targetX, targetZ, allObstacles)) {
        return { x: targetX, z: targetZ, type: 'agent' as const, duration: 3 + Math.random() * 4 };
      }
      const altX = randomAgent.basePosition.x - 3.0;
      const altZ = randomAgent.basePosition.z + 3.0;
      if (isPositionClear(altX, altZ, allObstacles)) {
        return { x: altX, z: altZ, type: 'agent' as const, duration: 3 + Math.random() * 4 };
      }
      // Fallback: stand further away
      return {
        x: randomAgent.basePosition.x,
        z: randomAgent.basePosition.z + 4.0,
        type: 'agent' as const,
        duration: 3 + Math.random() * 4,
      };
    };
  }, [agents, allObstacles]);

  // Helper to check if someone is performing on stage
  const hasPerformer = useMemo(() => {
    return Array.from(agents.values()).some(a => a.status === 'idle' && isStagePerformer(a.id));
  }, [agents, isStagePerformer]);

  // Pointer event handlers
  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredEntity(NPC_ID);
    document.body.style.cursor = 'pointer';
  }, [setHoveredEntity]);

  const handlePointerOut = useCallback(() => {
    setHoveredEntity(null);
    document.body.style.cursor = 'default';
  }, [setHoveredEntity]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectEntity(NPC_ID);
  }, [selectEntity]);

  // Circle indicator color based on hover/select state
  const circleColor = isSelected ? 0xffaa00 : isHovered ? 0x66ccff : 0x44aa44;
  const circleOpacity = isSelected ? 1.0 : isHovered ? 0.9 : 0.6;
  const circleEmissive = isSelected ? 0xffaa00 : isHovered ? 0x66ccff : 0x000000;
  const circleEmissiveIntensity = isSelected ? 0.8 : isHovered ? 0.5 : 0;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };
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
      const idleAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
      if (idleAction && !idleAction.isRunning()) {
        Object.values(actions).forEach(action => action?.fadeOut(0.3));
        idleAction.reset().fadeIn(0.3).play();
      }
      // Still apply position and report
      groupRef.current.position.x = npcState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = npcState.currentPos.z;
      updateNpcPosition('steve-jobs-npc', groupRef.current.position);
      return;
    }

    // Initialize position at a clear spot
    if (!npcState.initialized) {
      const start = getRandomClearPosition(allObstacles, 10, 10, 0, 5);
      npcState.currentPos = { x: start.x, z: start.z };
      groupRef.current.position.set(start.x, 0, start.z);
      npcState.initialized = true;
      npcState.lastDecisionTime = currentTime;
    }

    // Make decisions every few seconds
    const decisionInterval = 5; // seconds
    if (currentTime - npcState.lastDecisionTime > decisionInterval && !npcState.target) {
      npcState.lastDecisionTime = currentTime;

      // Decide what to do next based on probabilities
      const rand = Math.random();

      if (rand < 0.30) {
        // 30% - Check on an active agent
        const agentTarget = findAgentToCheck();
        if (agentTarget) {
          npcState.target = agentTarget;
          npcState.currentState = 'walking_to_target';
        }
      } else if (rand < 0.45 && hasPerformer) {
        // 15% - Watch the stage (if someone is performing)
        const audienceSpot = audiencePositions[Math.floor(Math.random() * audiencePositions.length)];
        npcState.target = {
          x: audienceSpot.x,
          z: audienceSpot.z,
          type: 'stage',
          duration: 8 + Math.random() * 7,
        };
        npcState.currentState = 'walking_to_target';
      } else if (rand < 0.57) {
        // 12% - Sit on the couch
        const couchSpot = couchPositions[Math.floor(Math.random() * couchPositions.length)];
        npcState.target = {
          x: loungePos.x + couchSpot.x,
          z: loungePos.z + couchSpot.z,
          type: 'couch',
          duration: 10 + Math.random() * 10,
        };
        npcState.couchRotation = couchSpot.rotation;
        npcState.currentState = 'walking_to_target';
      } else if (rand < 0.72) {
        // 15% - Visit the kitchen for a snack/coffee
        // Stand at one of the bar stool positions
        const kitchenOffsets = [
          { x: -1, z: 1.8 }, { x: 0, z: 1.8 }, { x: 1, z: 1.8 },
          { x: -0.5, z: -1.8 }, { x: 0.5, z: -1.8 },
        ];
        const spot = kitchenOffsets[Math.floor(Math.random() * kitchenOffsets.length)];
        npcState.target = {
          x: kitchenPos.x + spot.x,
          z: kitchenPos.z + spot.z,
          type: 'kitchen',
          duration: 6 + Math.random() * 8,
        };
        npcState.currentState = 'walking_to_target';
      } else {
        // 28% - Random wander to a clear position
        const wanderTarget = getRandomClearPosition(allObstacles);
        npcState.target = {
          x: wanderTarget.x,
          z: wanderTarget.z,
          type: 'random',
          duration: 2 + Math.random() * 3,
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
        const speed = 2.5;
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
        const targetRotation = Math.atan2(dx, dz);
        const currentRotation = groupRef.current.rotation.y;
        let rotationDiff = targetRotation - currentRotation;
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        groupRef.current.rotation.y += rotationDiff * Math.min(1, delta * 5);

        // Play walking animation
        const walkAction = actions?.[STEVE_ANIMATIONS.WALKING];
        if (walkAction && !walkAction.isRunning()) {
          Object.values(actions).forEach(action => action?.fadeOut(0.3));
          walkAction.reset().fadeIn(0.3).play();
        }
      } else {
        // Arrived at target
        const targetType = npcState.target.type;
        const duration = npcState.target.duration || 5;

        if (targetType === 'couch') {
          // Rest at couch - use standing clap (long idle-like animation)
          const restAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
          if (restAction && !restAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            restAction.reset().fadeIn(0.3).play();
          }
          // Face couch direction
          groupRef.current.rotation.y = npcState.couchRotation;
          npcState.currentState = 'resting';
        } else if (targetType === 'kitchen') {
          // Visiting kitchen - idle animation while getting food/coffee
          const idleAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
          if (idleAction && !idleAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            idleAction.reset().fadeIn(0.3).play();
          }
          // Face the counter
          const toCounter = Math.atan2(kitchenPos.x - npcState.currentPos.x, kitchenPos.z - npcState.currentPos.z);
          groupRef.current.rotation.y = toCounter;
          npcState.currentState = 'visiting_kitchen';
        } else if (targetType === 'stage') {
          // Watch stage and clap for the performer
          const clapAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
          if (clapAction && !clapAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            clapAction.reset().fadeIn(0.3).play();
          }
          // Face the stage
          const toStage = Math.atan2(stagePos.x - npcState.currentPos.x, stagePos.z - npcState.currentPos.z);
          groupRef.current.rotation.y = toStage;
          npcState.currentState = 'watching_stage';
        } else if (targetType === 'agent') {
          // Check on agent - use short clap animation
          const clapAction = actions?.[STEVE_ANIMATIONS.CLAPPING];
          if (clapAction && !clapAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            clapAction.reset().fadeIn(0.3).play();
          }
          npcState.currentState = 'checking_agent';
        } else {
          // Random wander stop - use standing clap as idle
          const idleAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
          if (idleAction && !idleAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            idleAction.reset().fadeIn(0.3).play();
          }
          npcState.currentState = 'wandering';
        }

        // Set timer for how long to stay
        npcState.stateStartTime = currentTime;
        npcState.stateDuration = duration;
        npcState.target = null; // Clear target, will pick new one after duration
      }
    }

    // Check if current activity duration has elapsed
    if (!npcState.target && npcState.currentState !== 'walking_to_target') {
      if (currentTime - npcState.stateStartTime > npcState.stateDuration) {
        // Time to do something new
        npcState.lastDecisionTime = 0; // Force new decision
      }
    }

    // Apply position - raise to couch seat height when resting
    groupRef.current.position.x = npcState.currentPos.x;
    groupRef.current.position.y = npcState.currentState === 'resting' ? 0.35 : 0;
    groupRef.current.position.z = npcState.currentPos.z;

    // Report position to context for boss mode tracking
    updateNpcPosition('steve-jobs-npc', groupRef.current.position);

    // Update display state for thinking bubble (only when state changes)
    if (npcState.currentState !== lastDisplayStateRef.current) {
      lastDisplayStateRef.current = npcState.currentState;
      setDisplayState(npcState.currentState);
    }
  });

  // Get thoughts based on current NPC state
  const currentThoughts = useMemo(() => {
    return STEVE_JOBS_THOUGHTS[displayState] || STEVE_JOBS_THOUGHTS.wandering;
  }, [displayState]);

  return (
    <group
      ref={groupRef}
      position={[0, 0, 5]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under NPC - glows on hover/select */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[isHovered || isSelected ? 0.85 : 0.7, 32]} />
        <meshStandardMaterial
          color={circleColor}
          emissive={circleEmissive}
          emissiveIntensity={circleEmissiveIntensity}
          transparent
          opacity={circleOpacity}
        />
      </mesh>

      <primitive object={clonedScene} scale={modelScale} />

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

export default SteveJobsNPC;
