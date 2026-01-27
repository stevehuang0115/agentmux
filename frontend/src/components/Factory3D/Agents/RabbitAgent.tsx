/**
 * RabbitAgent - Animated rabbit character model.
 *
 * Loads the rabbit GLB model with Mixamo animations and positions it based on agent status.
 * Uses React Three Fiber's useAnimations hook for animation playback.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFactory } from '../../../contexts/FactoryContext';
import {
  FactoryAgent,
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { SpeechBubble } from './SpeechBubble';
import { ZzzIndicator } from './ZzzIndicator';
import { useAgentAnimation, AGENT_ANIMATION_CONFIGS } from './useAgentAnimation';

// Preload the rabbit model
useGLTF.preload(MODEL_PATHS.RABBIT);

/**
 * Props for RabbitAgent component
 */
interface RabbitAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
}

/**
 * RabbitAgent - Individual rabbit agent with animations.
 *
 * @param agent - Agent data from context
 */
// Y offset - Mixamo models have origin at feet level, so no offset needed
const RABBIT_Y_OFFSET = 0;

export const RabbitAgent: React.FC<RabbitAgentProps> = ({ agent }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Walking state refs - persist across frames without causing re-renders
  const walkingStateRef = useRef({
    currentPos: { x: 0, z: 0 },
    targetPos: { x: 0, z: 0 },
    initialized: false,
    wasWorking: false,  // Track if agent was previously working
    wasOnStage: false,  // Track if agent was performing or in audience
    currentAnim: '',  // Track current animation to avoid redundant switches
  });

  // Load rabbit model with animations
  const gltf = useGLTF(MODEL_PATHS.RABBIT);

  // Clone scene for this instance
  // All Mixamo models are standardized to 2.0 units height, so use fixed scale
  const { clonedScene, modelScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene);

    // Fix materials for better visibility
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Clone the material to avoid shared reference issues that cause color accumulation
        if (child.material) {
          child.material = (child.material as THREE.Material).clone();
        }
        const mat = child.material as THREE.MeshStandardMaterial;

        // Fix material for better visibility in scene lighting
        if (mat && mat.isMeshStandardMaterial) {
          // Remove metallic-roughness texture which makes the model too dark
          mat.metalnessMap = null;
          mat.roughnessMap = null;
          // Set explicit values for a non-metallic look
          mat.metalness = 0.0;
          mat.roughness = 0.7;
          // Ensure the material responds to scene lighting
          mat.needsUpdate = true;
        }
      }
    });

    // Fixed scale: All Mixamo models are 2.0 units, target is 4.0 units
    // Scale = 4.0 / 2.0 = 2.0
    const scale = 2.0;

    return { clonedScene: clone, modelScale: scale };
  }, [gltf.scene, agent.id]);

  // Remove ALL position tracks from animations to disable root motion completely
  // This ensures the model only animates in place while we control movement via the group
  const processedAnimations = useMemo(() => {
    return gltf.animations.map((clip) => {
      const tracks = clip.tracks.filter((track) => {
        // Filter out all position tracks (Hips, Armature, Root, etc.)
        return !track.name.endsWith('.position');
      });
      return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
    });
  }, [gltf.animations]);

  // Setup animations with root motion disabled
  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Use the animation hook for dynamic animation management
  const { currentAnimation } = useAgentAnimation(agent, actions, AGENT_ANIMATION_CONFIGS.RABBIT);

  // Track if currently in a walking animation (checked each frame for real-time updates)
  const WALKING_ANIMS = ['Walking', 'Running', 'Jumping'];

  // Get workstation and idle destination state from context
  const { zones, getIdleActivity, isStagePerformer, getCouchPositionIndex } = useFactory();

  // Get this agent's idle activity destination
  const idleActivity = getIdleActivity(agent.id);
  const isOnStage = isStagePerformer(agent.id);
  const couchIndex = getCouchPositionIndex(agent.id);

  // Get stage and lounge positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;

  const zone = useMemo(() => {
    return zones.get(agent.projectName);
  }, [zones, agent.projectName]);

  const workstation = useMemo(() => {
    if (!zone) return null;
    return zone.workstations[agent.workstationIndex];
  }, [zone, agent.workstationIndex]);

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

  // Animation loop - position and animation updates
  useFrame((state, delta) => {
    if (!groupRef.current || !workstation) return;

    // Update animation mixer
    mixer?.update(delta);

    const walkState = walkingStateRef.current;
    // Consider agent "working" if status is active (regardless of cpuPercent which may not be set)
    const isActuallyWorking = agent.status === 'active';
    const isCoffeeBreak = false; // Disable coffee break for now - agents work when active
    const isIdle = agent.status === 'idle';

    // Handle idle destinations based on assigned activity
    if (isIdle) {
      // Stage performance - go dance on stage (Rabbit does 'Silly dancing')
      if (idleActivity === 'stage' && isOnStage) {
        walkState.wasOnStage = true;
        const targetX = stagePos.x;
        const targetZ = stagePos.z;

        const dx = targetX - groupRef.current.position.x;
        const dz = targetZ - groupRef.current.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.1) {
          const speed = 2.0;
          const moveAmount = Math.min(speed * delta, distance);
          groupRef.current.position.x += (dx / distance) * moveAmount;
          groupRef.current.position.z += (dz / distance) * moveAmount;
          const targetRotation = Math.atan2(dx, dz);
          groupRef.current.rotation.y += (targetRotation - groupRef.current.rotation.y) * Math.min(1, delta * 5);
        } else {
          const targetRotation = -Math.PI / 2; // Face audience
          groupRef.current.rotation.y += (targetRotation - groupRef.current.rotation.y) * Math.min(1, delta * 3);
        }

        groupRef.current.position.y = distance < 0.5 ? FACTORY_CONSTANTS.STAGE.HEIGHT + RABBIT_Y_OFFSET : RABBIT_Y_OFFSET;

        if (distance < 0.5 && actions?.['Silly dancing']) {
          const performAction = actions['Silly dancing'];
          if (!performAction?.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            performAction?.reset().fadeIn(0.3).play();
          }
        }
        return;
      }

      // Couch rest - go sit on couch in lounge
      if (idleActivity === 'couch' && couchIndex >= 0 && couchPositions[couchIndex]) {
        walkState.wasOnStage = true;
        const couch = couchPositions[couchIndex];
        const targetX = loungePos.x + couch.x;
        const targetZ = loungePos.z + couch.z;

        const dx = targetX - groupRef.current.position.x;
        const dz = targetZ - groupRef.current.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.1) {
          const speed = 1.5;
          const moveAmount = Math.min(speed * delta, distance);
          groupRef.current.position.x += (dx / distance) * moveAmount;
          groupRef.current.position.z += (dz / distance) * moveAmount;
          const targetRotation = Math.atan2(dx, dz);
          groupRef.current.rotation.y += (targetRotation - groupRef.current.rotation.y) * Math.min(1, delta * 5);
        } else {
          groupRef.current.rotation.y = couch.rotation;
        }

        groupRef.current.position.y = RABBIT_Y_OFFSET;

        if (distance < 0.5 && actions?.['Sitting']) {
          const sitAction = actions['Sitting'];
          if (!sitAction?.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            sitAction?.reset().fadeIn(0.3).play();
          }
        }
        return;
      }
    }

    // Sync position when returning from stage/couch to normal behavior
    if (walkState.wasOnStage) {
      walkState.currentPos.x = groupRef.current.position.x;
      walkState.currentPos.z = groupRef.current.position.z;
      walkState.wasOnStage = false;
      const wanderRadius = 2.0;
      walkState.targetPos.x = walkState.currentPos.x + (Math.random() - 0.5) * wanderRadius * 2;
      walkState.targetPos.z = walkState.currentPos.z + (Math.random() - 0.5) * wanderRadius;
    }

    // Normal behavior - Position the rabbit at workstation
    if (isActuallyWorking) {
      // At desk working - snap to position
      groupRef.current.position.x = workstation.position.x;
      groupRef.current.position.y = RABBIT_Y_OFFSET;
      groupRef.current.position.z = workstation.position.z + FACTORY_CONSTANTS.AGENT.WORKSTATION_OFFSET;
      groupRef.current.rotation.y = Math.PI;
      walkState.wasWorking = true;  // Mark that we were working
      // Sync walkState with actual position to prevent jumps when transitioning
      walkState.currentPos.x = groupRef.current.position.x;
      walkState.currentPos.z = groupRef.current.position.z;

      // Force typing animation when working (Rabbit uses 'Pilot flips switches')
      const typingAction = actions?.['Pilot flips switches'];
      if (typingAction && !typingAction.isRunning()) {
        Object.values(actions || {}).forEach(action => action?.fadeOut(0.3));
        typingAction.reset().fadeIn(0.3).play();
      }
    } else if (isCoffeeBreak || isIdle) {
      // Wander area: stay in the aisle IN FRONT of desks (positive z direction)
      const wanderRadiusX = isCoffeeBreak ? 2.0 : 3.0;
      const wanderMinZ = workstation.position.z + 2.5;
      const wanderMaxZ = workstation.position.z + 5.0;

      // Initialize only on first time
      if (!walkState.initialized) {
        walkState.currentPos.x = workstation.position.x;
        walkState.currentPos.z = wanderMinZ;
        walkState.targetPos.x = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
        walkState.targetPos.z = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
        walkState.initialized = true;
      }

      // When transitioning from working, sync position and pick new target
      if (walkState.wasWorking) {
        walkState.currentPos.x = workstation.position.x;
        walkState.currentPos.z = wanderMinZ;
        walkState.targetPos.x = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
        walkState.targetPos.z = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
        walkState.wasWorking = false;
      }

      // Calculate distance to target
      const dx = walkState.targetPos.x - walkState.currentPos.x;
      const dz = walkState.targetPos.z - walkState.currentPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Determine if we should be walking (have a target to reach)
      const shouldBeWalking = distance > 0.3;

      if (shouldBeWalking) {
        // Use Running for longer distances, Walking for shorter (rabbit hops quickly)
        const shouldRun = distance > 1.8;
        const speed = shouldRun ? 2.8 : 1.0;
        const animName = shouldRun ? 'Running' : 'Walking';
        const moveAction = actions?.[animName] || actions?.['Walking'];

        if (moveAction && walkState.currentAnim !== animName) {
          Object.values(actions || {}).forEach(action => action?.fadeOut(0.3));
          moveAction.reset().fadeIn(0.3).play();
          walkState.currentAnim = animName;
        }

        // Movement speed
        const moveAmount = Math.min(speed * delta, distance);
        walkState.currentPos.x += (dx / distance) * moveAmount;
        walkState.currentPos.z += (dz / distance) * moveAmount;

        // Face movement direction
        const targetRotation = Math.atan2(dx, dz);
        const currentRotation = groupRef.current.rotation.y;
        let rotationDiff = targetRotation - currentRotation;
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        groupRef.current.rotation.y += rotationDiff * Math.min(1, delta * 5);
      } else {
        // Reached target - pick new random target in the safe aisle area
        walkState.targetPos.x = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
        walkState.targetPos.z = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
      }

      // Apply position (always apply current position, even when not walking)
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = RABBIT_Y_OFFSET;
      groupRef.current.position.z = walkState.currentPos.z;
    }
  });

  // Always render the agent - don't return null for missing workstation
  // This prevents agents from disappearing during data updates

  return (
    <group
      ref={groupRef}
      position={[agent.basePosition.x, RABBIT_Y_OFFSET, agent.basePosition.z]}
      rotation={[0, Math.PI, 0]}
    >
      {/* Blue circle indicator under real agent - positioned at ground level */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -RABBIT_Y_OFFSET + 0.1, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color={0x4488FF} transparent opacity={0.6} />
      </mesh>
      {/* Rabbit model */}
      <primitive object={clonedScene} scale={modelScale} />

      {/* Speech bubble */}
      {agent.status === 'active' && agent.cpuPercent > 10 && agent.activity && (
        <SpeechBubble text={agent.activity} yOffset={3.2} />
      )}

      {/* Sleeping indicator - only when resting on couch */}
      {agent.status === 'idle' && idleActivity === 'couch' && <ZzzIndicator yOffset={4.0} />}
    </group>
  );
};
