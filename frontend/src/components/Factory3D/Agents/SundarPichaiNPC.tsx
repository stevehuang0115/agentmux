/**
 * SundarPichaiNPC - Sundar Pichai NPC character that wanders around the factory.
 *
 * This NPC walks around talking to agents, giving presentations,
 * and generally managing the factory floor.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFactory } from '../../../contexts/FactoryContext';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';

// Preload the Sundar Pichai model
useGLTF.preload(MODEL_PATHS.SUNDAR_PICHAI);

/**
 * NPC behavior states
 */
type NPCState = 'wandering' | 'talking_to_agent' | 'presenting' | 'walking_circle' | 'walking_to_target';

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
  type: 'agent' | 'stage' | 'center' | 'random';
  duration?: number;
}

/**
 * SundarPichaiNPC - Wandering NPC that manages the factory.
 */
export const SundarPichaiNPC: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

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
    console.log('[SundarPichaiNPC] Available animations:', animationNames.join(', '));

    // Start with Talking as idle animation to avoid T-pose
    const idleAction = actions?.[SUNDAR_ANIMATIONS.TALKING];
    if (idleAction) {
      idleAction.reset().play();
    }
  }, [actions]);

  // Get factory context
  const { agents } = useFactory();

  // Get useful positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;

  // Helper to find a random agent to talk to
  const findAgentToTalkTo = useMemo(() => {
    return () => {
      const agentList = Array.from(agents.values());
      if (agentList.length === 0) return null;
      const randomAgent = agentList[Math.floor(Math.random() * agentList.length)];
      return {
        x: randomAgent.basePosition.x + 1.5,
        z: randomAgent.basePosition.z + 1.5,
        type: 'agent' as const,
        duration: 5 + Math.random() * 5,
      };
    };
  }, [agents]);

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
      npcState.currentPos = { x: 10, z: 0 };
      groupRef.current.position.set(10, 0, 0);
      npcState.initialized = true;
      npcState.lastDecisionTime = currentTime;
    }

    // Make decisions every few seconds
    const decisionInterval = 6;
    if (currentTime - npcState.lastDecisionTime > decisionInterval && !npcState.target) {
      npcState.lastDecisionTime = currentTime;

      const rand = Math.random();

      if (rand < 0.40) {
        // 40% - Talk to an agent
        const agentTarget = findAgentToTalkTo();
        if (agentTarget) {
          npcState.target = agentTarget;
          npcState.currentState = 'walking_to_target';
        }
      } else if (rand < 0.55) {
        // 15% - Go to stage area for presentation
        npcState.target = {
          x: stagePos.x - 2,
          z: stagePos.z,
          type: 'stage',
          duration: 8 + Math.random() * 5,
        };
        npcState.currentState = 'walking_to_target';
      } else if (rand < 0.70) {
        // 15% - Walk in circle at center
        npcState.target = {
          x: 0,
          z: 0,
          type: 'center',
          duration: 10 + Math.random() * 5,
        };
        npcState.currentState = 'walking_to_target';
      } else {
        // 30% - Random wander
        const wanderRange = 20;
        npcState.target = {
          x: (Math.random() - 0.5) * wanderRange * 2,
          z: (Math.random() - 0.5) * wanderRange * 2,
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

    // Apply position
    const yOffset = 2.0;
    groupRef.current.position.x = npcState.currentPos.x;
    groupRef.current.position.y = yOffset;
    groupRef.current.position.z = npcState.currentPos.z;
  });

  return (
    <group ref={groupRef} position={[10, 2.0, 0]}>
      <primitive object={clonedScene} scale={modelScale} />
    </group>
  );
};

export default SundarPichaiNPC;
