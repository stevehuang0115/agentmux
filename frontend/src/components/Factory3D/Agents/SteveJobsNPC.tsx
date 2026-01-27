/**
 * SteveJobsNPC - Steve Jobs NPC character that wanders around the factory.
 *
 * This NPC walks around checking on agents' work, watches performers on stage,
 * and occasionally sits on the couch to rest.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFactory } from '../../../contexts/FactoryContext';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';

// Preload the Steve Jobs model
useGLTF.preload(MODEL_PATHS.STEVE_JOBS);

/**
 * NPC behavior states
 */
type NPCState = 'wandering' | 'checking_agent' | 'watching_stage' | 'resting' | 'walking_to_target';

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
  type: 'agent' | 'stage' | 'couch' | 'random';
  duration?: number; // How long to stay at this target (in seconds)
}

/**
 * SteveJobsNPC - Wandering NPC that supervises the factory.
 */
export const SteveJobsNPC: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

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
  }>({
    currentState: 'wandering',
    target: null,
    stateStartTime: 0,
    stateDuration: 0,
    currentPos: { x: 0, z: 0 },
    initialized: false,
    lastAgentCheckTime: 0,
    lastDecisionTime: 0,
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
    const scale = 2.0;

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
  const { agents, zones, isStagePerformer, updateNpcPosition } = useFactory();

  // Get useful positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;
  const audiencePositions = FACTORY_CONSTANTS.STAGE.AUDIENCE_POSITIONS;

  // Helper to find a random active agent to check on
  const findAgentToCheck = useMemo(() => {
    return () => {
      const agentList = Array.from(agents.values());
      const activeAgents = agentList.filter(a => a.status === 'active');
      if (activeAgents.length === 0) return null;
      const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
      return {
        x: randomAgent.basePosition.x + 2, // Stand beside the agent
        z: randomAgent.basePosition.z + 2,
        type: 'agent' as const,
        duration: 3 + Math.random() * 4, // Watch for 3-7 seconds
      };
    };
  }, [agents]);

  // Helper to check if someone is performing on stage
  const hasPerformer = useMemo(() => {
    return Array.from(agents.values()).some(a => a.status === 'idle' && isStagePerformer(a.id));
  }, [agents, isStagePerformer]);

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

    // Initialize position
    if (!npcState.initialized) {
      // Start near the center of the factory
      npcState.currentPos = { x: 0, z: 5 };
      groupRef.current.position.set(0, 0, 5);
      npcState.initialized = true;
      npcState.lastDecisionTime = currentTime;
    }

    // Make decisions every few seconds
    const decisionInterval = 5; // seconds
    if (currentTime - npcState.lastDecisionTime > decisionInterval && !npcState.target) {
      npcState.lastDecisionTime = currentTime;

      // Decide what to do next based on probabilities
      const rand = Math.random();

      if (rand < 0.35) {
        // 35% - Check on an active agent
        const agentTarget = findAgentToCheck();
        if (agentTarget) {
          npcState.target = agentTarget;
          npcState.currentState = 'walking_to_target';
        }
      } else if (rand < 0.55 && hasPerformer) {
        // 20% - Watch the stage (if someone is performing)
        const audienceSpot = audiencePositions[Math.floor(Math.random() * audiencePositions.length)];
        npcState.target = {
          x: audienceSpot.x,
          z: audienceSpot.z,
          type: 'stage',
          duration: 8 + Math.random() * 7, // Watch for 8-15 seconds
        };
        npcState.currentState = 'walking_to_target';
      } else if (rand < 0.70) {
        // 15% - Sit on the couch
        const couchSpot = couchPositions[Math.floor(Math.random() * couchPositions.length)];
        npcState.target = {
          x: loungePos.x + couchSpot.x,
          z: loungePos.z + couchSpot.z,
          type: 'couch',
          duration: 10 + Math.random() * 10, // Rest for 10-20 seconds
        };
        npcState.currentState = 'walking_to_target';
      } else {
        // 30% - Random wander
        const wanderRange = 25;
        npcState.target = {
          x: (Math.random() - 0.5) * wanderRange * 2,
          z: (Math.random() - 0.5) * wanderRange * 2,
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
        npcState.currentPos.x += (dx / distance) * moveAmount;
        npcState.currentPos.z += (dz / distance) * moveAmount;

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
          npcState.currentState = 'resting';
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

    // Apply position - keep feet on ground (y=0)
    groupRef.current.position.x = npcState.currentPos.x;
    groupRef.current.position.y = 0;
    groupRef.current.position.z = npcState.currentPos.z;

    // Report position to context for boss mode tracking
    updateNpcPosition('steve-jobs-npc', groupRef.current.position);
  });

  return (
    <group ref={groupRef} position={[0, 0, 5]}>
      {/* Green circle indicator under NPC */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color={0x44aa44} transparent opacity={0.6} />
      </mesh>

      <primitive object={clonedScene} scale={modelScale} />
    </group>
  );
};

export default SteveJobsNPC;
