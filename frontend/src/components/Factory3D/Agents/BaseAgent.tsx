/**
 * BaseAgent - Generic animated character model component.
 *
 * Provides the common functionality for all agent types including:
 * - Model loading and cloning
 * - Animation management
 * - Movement and positioning
 * - Status-based behavior (working, idle, stage, lounge)
 *
 * Individual agent components (CowAgent, TigerAgent, etc.) use this
 * base component with their specific configurations.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFactory } from '../../../contexts/FactoryContext';
import { FactoryAgent, FACTORY_CONSTANTS } from '../../../types/factory.types';
import { SpeechBubble } from './SpeechBubble';
import { ZzzIndicator } from './ZzzIndicator';
import { useAgentAnimation, AnimationConfig } from './useAgentAnimation';

/**
 * Configuration for a specific agent type
 */
export interface AgentConfig {
  /** Path to the GLB model file */
  modelPath: string;
  /** Animation configuration for this agent type */
  animationConfig: AnimationConfig;
  /** Movement speed when running */
  runSpeed: number;
  /** Movement speed when walking */
  walkSpeed: number;
  /** Distance threshold for switching from walk to run */
  runThreshold: number;
  /** Dance animation name for stage performance */
  danceAnimation: string;
  /** Sit animation name for lounge */
  sitAnimation: string;
  /** Wander area X radius (side-to-side) */
  wanderRadiusX?: number;
  /** Minimum Z offset from workstation for wandering */
  wanderMinZ?: number;
  /** Maximum Z offset from workstation for wandering */
  wanderMaxZ?: number;
}

/** Default wander area configuration */
const DEFAULT_WANDER = {
  radiusX: 3.0,
  minZ: 2.5,
  maxZ: 5.0,
};

/**
 * Props for BaseAgent component
 */
interface BaseAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
  /** Configuration specific to this agent type */
  config: AgentConfig;
}

/**
 * Walking state tracking for movement management
 */
interface WalkingState {
  currentPos: { x: number; z: number };
  targetPos: { x: number; z: number };
  initialized: boolean;
  wasWorking: boolean;
  wasOnStage: boolean;
  currentAnim: string;
}

/**
 * Fade out all actions and fade in the target animation.
 * Falls back to 'Idle' animation if target not found.
 */
function transitionToAnimation(
  actions: Record<string, THREE.AnimationAction | null> | undefined,
  targetAnim: string,
  walkState: WalkingState,
  fadeOutDuration: number = 0.3,
  fadeInDuration: number = 0.3
): void {
  if (!actions || walkState.currentAnim === targetAnim) return;

  let targetAction = actions[targetAnim];

  // Fallback to Idle if target animation not found
  if (!targetAction && targetAnim !== 'Idle') {
    targetAction = actions['Idle'] ?? actions['Breathing idle'] ?? null;
  }

  if (!targetAction) return;

  Object.values(actions).forEach((action) => action?.fadeOut(fadeOutDuration));
  targetAction.reset().fadeIn(fadeInDuration).play();
  walkState.currentAnim = targetAnim;
}

/**
 * Normalize rotation difference to [-PI, PI] range
 */
function normalizeRotationDiff(diff: number): number {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Smoothly rotate towards a target rotation
 */
function rotateTowards(
  group: THREE.Group,
  targetRotation: number,
  delta: number,
  speed: number = 3
): void {
  const diff = normalizeRotationDiff(targetRotation - group.rotation.y);
  group.rotation.y += diff * Math.min(1, delta * speed);
}

/**
 * Calculate movement towards a target position
 */
interface MovementResult {
  dx: number;
  dz: number;
  distance: number;
  moveAmount: number;
  targetRotation: number;
}

function calculateMovement(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  speed: number,
  delta: number
): MovementResult {
  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const moveAmount = Math.min(speed * delta, distance);
  const targetRotation = Math.atan2(dx, dz);

  return { dx, dz, distance, moveAmount, targetRotation };
}

// Y offset - Mixamo models have origin at feet level, so no offset needed
const AGENT_Y_OFFSET = 0;

// Fixed scale: All Mixamo models are 2.0 units, target is 4.0 units
const MODEL_SCALE = 2.0;

// Workstation blocker radius - agents can't enter other agents' workstation areas
const WORKSTATION_BLOCKER_RADIUS = 2.0;

/**
 * Check if a position is blocked by another agent's workstation
 *
 * @param x - X position to check
 * @param z - Z position to check
 * @param ownWorkstationX - This agent's workstation X
 * @param ownWorkstationZ - This agent's workstation Z
 * @param allWorkstations - Array of all workstation positions
 * @returns true if position is blocked
 */
function isBlockedByWorkstation(
  x: number,
  z: number,
  ownWorkstationX: number,
  ownWorkstationZ: number,
  allWorkstations: Array<{ x: number; z: number }>
): boolean {
  for (const ws of allWorkstations) {
    // Skip own workstation
    if (Math.abs(ws.x - ownWorkstationX) < 0.1 && Math.abs(ws.z - ownWorkstationZ) < 0.1) {
      continue;
    }
    // Check distance to this workstation
    const dx = x - ws.x;
    const dz = z - ws.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < WORKSTATION_BLOCKER_RADIUS * WORKSTATION_BLOCKER_RADIUS) {
      return true;
    }
  }
  return false;
}

/**
 * Get a position that avoids blocked workstations
 * Tries the target position first, then adjusts if blocked
 */
function getUnblockedTarget(
  targetX: number,
  targetZ: number,
  currentX: number,
  currentZ: number,
  ownWorkstationX: number,
  ownWorkstationZ: number,
  allWorkstations: Array<{ x: number; z: number }>
): { x: number; z: number } {
  // If target is not blocked, use it
  if (!isBlockedByWorkstation(targetX, targetZ, ownWorkstationX, ownWorkstationZ, allWorkstations)) {
    return { x: targetX, z: targetZ };
  }

  // Target is blocked - try to find an alternative direction
  // Move perpendicular to the blocked direction
  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const angle = Math.atan2(dz, dx);

  // Try 90 degrees left and right
  const alternatives = [
    { x: currentX + Math.cos(angle + Math.PI / 2) * 2, z: currentZ + Math.sin(angle + Math.PI / 2) * 2 },
    { x: currentX + Math.cos(angle - Math.PI / 2) * 2, z: currentZ + Math.sin(angle - Math.PI / 2) * 2 },
    { x: currentX - dx * 0.5, z: currentZ - dz * 0.5 }, // Back up
  ];

  for (const alt of alternatives) {
    if (!isBlockedByWorkstation(alt.x, alt.z, ownWorkstationX, ownWorkstationZ, allWorkstations)) {
      return alt;
    }
  }

  // All blocked - stay in place
  return { x: currentX, z: currentZ };
}

/**
 * BaseAgent - Generic agent with animations and movement.
 *
 * @param agent - Agent data from context
 * @param config - Configuration for this specific agent type
 */
export const BaseAgent: React.FC<BaseAgentProps> = ({ agent, config }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Walking state refs - persist across frames without causing re-renders
  const walkingStateRef = useRef<WalkingState>({
    currentPos: { x: 0, z: 0 },
    targetPos: { x: 0, z: 0 },
    initialized: false,
    wasWorking: false,
    wasOnStage: false,
    currentAnim: '',
  });

  // Load model with animations
  const gltf = useGLTF(config.modelPath);

  // Clone scene for this instance
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene);

    // Fix materials for better visibility
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Clone the material to avoid shared reference issues
        if (child.material) {
          child.material = (child.material as THREE.Material).clone();
        }
        const mat = child.material as THREE.MeshStandardMaterial;

        // Fix material for better visibility in scene lighting
        if (mat && mat.isMeshStandardMaterial) {
          mat.metalnessMap = null;
          mat.roughnessMap = null;
          mat.metalness = 0.0;
          mat.roughness = 0.7;
          mat.needsUpdate = true;
        }
      }
    });

    return clone;
  }, [gltf.scene, agent.id]);

  // Remove ALL position tracks from animations to disable root motion
  const processedAnimations = useMemo(() => {
    return gltf.animations.map((clip) => {
      const tracks = clip.tracks.filter((track) => !track.name.endsWith('.position'));
      return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
    });
  }, [gltf.animations]);

  // Setup animations with root motion disabled
  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Use the animation hook for dynamic animation management
  useAgentAnimation(agent, actions, config.animationConfig);

  // Get workstation and idle destination state from context
  const { zones, getIdleActivity, isStagePerformer, getCouchPositionIndex, updateAgentPosition } = useFactory();

  // Get this agent's idle activity destination
  const idleActivity = getIdleActivity(agent.id);
  const isOnStage = isStagePerformer(agent.id);
  const couchIndex = getCouchPositionIndex(agent.id);

  // Get stage and lounge positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;

  const zone = useMemo(() => zones.get(agent.projectName), [zones, agent.projectName]);

  const workstation = useMemo(() => {
    if (!zone) return null;
    return zone.workstations[agent.workstationIndex];
  }, [zone, agent.workstationIndex]);

  // Collect all workstation positions for blocker logic
  const allWorkstations = useMemo(() => {
    const positions: Array<{ x: number; z: number }> = [];
    zones.forEach((z) => {
      z.workstations.forEach((ws) => {
        positions.push({ x: ws.position.x, z: ws.position.z });
      });
    });
    return positions;
  }, [zones]);

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
  useFrame((_, delta) => {
    if (!groupRef.current || !workstation) return;

    mixer?.update(delta);

    const walkState = walkingStateRef.current;
    const isActuallyWorking = agent.status === 'active';
    const isIdle = agent.status === 'idle';

    // Handle stage performance when idle
    if (isIdle && idleActivity === 'stage' && isOnStage) {
      walkState.wasOnStage = true;
      const dx = stagePos.x - groupRef.current.position.x;
      const dz = stagePos.z - groupRef.current.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 0.1) {
        const shouldRun = distance > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        const animName = shouldRun ? 'Running' : 'Walking';
        transitionToAnimation(actions, animName, walkState);

        const moveAmount = Math.min(speed * delta, distance);
        groupRef.current.position.x += (dx / distance) * moveAmount;
        groupRef.current.position.z += (dz / distance) * moveAmount;
        const targetRotation = Math.atan2(dx, dz);
        groupRef.current.rotation.y +=
          (targetRotation - groupRef.current.rotation.y) * Math.min(1, delta * 5);
      } else {
        rotateTowards(groupRef.current, -Math.PI / 2, delta); // Face audience
      }

      // Set Y position based on arrival
      groupRef.current.position.y =
        distance < 0.5 ? FACTORY_CONSTANTS.STAGE.HEIGHT + AGENT_Y_OFFSET : AGENT_Y_OFFSET;

      // Play dance animation when arrived
      if (distance < 0.5) {
        transitionToAnimation(actions, config.danceAnimation, walkState);
      }
      return;
    }

    // Handle lounge rest when idle
    if (isIdle && idleActivity === 'couch' && couchIndex >= 0 && couchPositions[couchIndex]) {
      walkState.wasOnStage = true;
      const couch = couchPositions[couchIndex];
      const targetX = loungePos.x + couch.x;
      const targetZ = loungePos.z + couch.z;

      const dx = targetX - groupRef.current.position.x;
      const dz = targetZ - groupRef.current.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 0.1) {
        const shouldRun = distance > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        const animName = shouldRun ? 'Running' : 'Walking';
        transitionToAnimation(actions, animName, walkState);

        const moveAmount = Math.min(speed * delta, distance);
        groupRef.current.position.x += (dx / distance) * moveAmount;
        groupRef.current.position.z += (dz / distance) * moveAmount;
        const targetRotation = Math.atan2(dx, dz);
        groupRef.current.rotation.y +=
          (targetRotation - groupRef.current.rotation.y) * Math.min(1, delta * 5);
      } else {
        groupRef.current.rotation.y = couch.rotation;
      }

      groupRef.current.position.y = AGENT_Y_OFFSET;

      if (distance < 0.5) {
        transitionToAnimation(actions, config.sitAnimation, walkState);
      }
      return;
    }

    // Sync position when returning from stage/couch
    if (walkState.wasOnStage) {
      walkState.currentPos.x = groupRef.current.position.x;
      walkState.currentPos.z = groupRef.current.position.z;
      walkState.wasOnStage = false;
      const wanderRadius = 2.0;
      walkState.targetPos.x = walkState.currentPos.x + (Math.random() - 0.5) * wanderRadius * 2;
      walkState.targetPos.z = walkState.currentPos.z + (Math.random() - 0.5) * wanderRadius;
    }

    // Working state - position at workstation
    if (isActuallyWorking) {
      groupRef.current.position.x = workstation.position.x;
      groupRef.current.position.y = AGENT_Y_OFFSET;
      groupRef.current.position.z =
        workstation.position.z + FACTORY_CONSTANTS.AGENT.WORKSTATION_OFFSET;
      groupRef.current.rotation.y = Math.PI;
      walkState.wasWorking = true;
      walkState.currentPos.x = groupRef.current.position.x;
      walkState.currentPos.z = groupRef.current.position.z;

      // Play working animation
      transitionToAnimation(actions, config.animationConfig.working, walkState);
      return;
    }

    // Idle wandering behavior
    if (isIdle) {
      const wanderRadiusX = config.wanderRadiusX ?? DEFAULT_WANDER.radiusX;
      const wanderMinZ = workstation.position.z + (config.wanderMinZ ?? DEFAULT_WANDER.minZ);
      const wanderMaxZ = workstation.position.z + (config.wanderMaxZ ?? DEFAULT_WANDER.maxZ);
      const ownWsX = workstation.position.x;
      const ownWsZ = workstation.position.z;

      // Helper to generate unblocked random target
      const generateUnblockedTarget = () => {
        const rawX = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
        const rawZ = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
        return getUnblockedTarget(rawX, rawZ, walkState.currentPos.x, walkState.currentPos.z, ownWsX, ownWsZ, allWorkstations);
      };

      if (!walkState.initialized) {
        walkState.currentPos.x = workstation.position.x;
        walkState.currentPos.z = wanderMinZ;
        const target = generateUnblockedTarget();
        walkState.targetPos.x = target.x;
        walkState.targetPos.z = target.z;
        walkState.initialized = true;
      }

      if (walkState.wasWorking) {
        walkState.currentPos.x = workstation.position.x;
        walkState.currentPos.z = wanderMinZ;
        const target = generateUnblockedTarget();
        walkState.targetPos.x = target.x;
        walkState.targetPos.z = target.z;
        walkState.wasWorking = false;
      }

      const dx = walkState.targetPos.x - walkState.currentPos.x;
      const dz = walkState.targetPos.z - walkState.currentPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 0.3) {
        const shouldRun = distance > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        const animName = shouldRun ? 'Running' : 'Walking';
        transitionToAnimation(actions, animName, walkState);

        const moveAmount = Math.min(speed * delta, distance);
        const nextX = walkState.currentPos.x + (dx / distance) * moveAmount;
        const nextZ = walkState.currentPos.z + (dz / distance) * moveAmount;

        // Check if next position would be blocked
        if (!isBlockedByWorkstation(nextX, nextZ, ownWsX, ownWsZ, allWorkstations)) {
          walkState.currentPos.x = nextX;
          walkState.currentPos.z = nextZ;
        } else {
          // Blocked - pick new target
          const target = generateUnblockedTarget();
          walkState.targetPos.x = target.x;
          walkState.targetPos.z = target.z;
        }

        const targetRotation = Math.atan2(dx, dz);
        const rotationDiff = normalizeRotationDiff(targetRotation - groupRef.current.rotation.y);
        groupRef.current.rotation.y += rotationDiff * Math.min(1, delta * 5);
      } else {
        // Arrived at target - pick new one
        const target = generateUnblockedTarget();
        walkState.targetPos.x = target.x;
        walkState.targetPos.z = target.z;
      }

      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = AGENT_Y_OFFSET;
      groupRef.current.position.z = walkState.currentPos.z;
    }

    // Report current position to context for boss mode tracking
    updateAgentPosition(agent.id, groupRef.current.position);
  });

  return (
    <group
      ref={groupRef}
      position={[agent.basePosition.x, AGENT_Y_OFFSET, agent.basePosition.z]}
      rotation={[0, Math.PI, 0]}
    >
      {/* Blue circle indicator under agent */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -AGENT_Y_OFFSET + 0.1, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color={0x4488ff} transparent opacity={0.6} />
      </mesh>

      {/* Agent model */}
      <primitive object={clonedScene} scale={MODEL_SCALE} />

      {/* Speech bubble */}
      {agent.status === 'active' && agent.cpuPercent > 10 && agent.activity && (
        <SpeechBubble text={agent.activity} yOffset={3.2} />
      )}

      {/* Sleeping indicator - only when resting on couch */}
      {agent.status === 'idle' && idleActivity === 'couch' && <ZzzIndicator yOffset={4.0} />}
    </group>
  );
};
