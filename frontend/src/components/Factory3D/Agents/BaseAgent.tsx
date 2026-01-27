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
import { useFactory } from '../../../contexts/FactoryContext';
import { FactoryAgent, FACTORY_CONSTANTS } from '../../../types/factory.types';
import { SpeechBubble } from './SpeechBubble';
import { ThinkingBubble, AGENT_THOUGHTS } from './ThinkingBubble';
import { ZzzIndicator } from './ZzzIndicator';
import { useAgentAnimation, AnimationConfig } from './useAgentAnimation';
import { useEntityInteraction } from './useEntityInteraction';
import {
  STATIC_OBSTACLES,
  isInsideObstacle,
  clampToWalls,
  isPositionClear,
} from '../../../utils/factoryCollision';
import {
  cloneAndFixMaterials,
  removeRootMotion,
  disposeScene,
  normalizeRotationDiff,
  rotateTowards,
  getCircleIndicatorStyle,
} from '../../../utils/threeHelpers';

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

/** Default wander area configuration - wide area across the factory floor */
const DEFAULT_WANDER = {
  radiusX: 12.0,
  minZ: -3.0,
  maxZ: 8.0,
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

// normalizeRotationDiff and rotateTowards imported from threeHelpers

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

// Y offset when sitting on couch - raise agent to sit on top of couch
const COUCH_SEAT_HEIGHT = 0.35;

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

  // Clone scene for this instance with fixed materials
  const clonedScene = useMemo(
    () => cloneAndFixMaterials(gltf.scene),
    [gltf.scene, agent.id]
  );

  // Remove root motion to prevent world-space drift
  const processedAnimations = useMemo(
    () => removeRootMotion(gltf.animations),
    [gltf.animations]
  );

  // Setup animations with root motion disabled
  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Use the animation hook for dynamic animation management
  useAgentAnimation(agent, actions, config.animationConfig);

  // Get workstation and idle destination state from context
  const {
    zones,
    getIdleActivity,
    isStagePerformer,
    getCouchPositionIndex,
    getBreakRoomSeatIndex,
    getPokerSeatIndex,
    getKitchenSeatIndex,
    updateAgentPosition,
    entityConversations,
  } = useFactory();

  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(agent.id);

  // Get this agent's idle activity destination
  const idleActivity = getIdleActivity(agent.id);
  const isOnStage = isStagePerformer(agent.id);
  const couchIndex = getCouchPositionIndex(agent.id);
  const breakRoomSeatIndex = getBreakRoomSeatIndex(agent.id);
  const pokerSeatIndex = getPokerSeatIndex(agent.id);
  const kitchenSeatIndex = getKitchenSeatIndex(agent.id);

  // Get zone positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;
  const breakRoomPos = FACTORY_CONSTANTS.BREAK_ROOM.POSITION;
  const pokerTablePos = FACTORY_CONSTANTS.POKER_TABLE.POSITION;
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;

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

  // Circle indicator styling from shared utility
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, 0x4488ff);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeScene(clonedScene);
  }, [clonedScene]);

  // Animation loop - position and animation updates
  useFrame((_, delta) => {
    if (!groupRef.current || !workstation) return;

    mixer?.update(delta);

    const walkState = walkingStateRef.current;
    const isActuallyWorking = agent.status === 'active';
    const isIdle = agent.status === 'idle';

    // Pause on hover - freeze movement and play idle animation
    if (isHovered) {
      transitionToAnimation(actions, 'Breathing idle', walkState, 0.3, 0.3);
      updateAgentPosition(agent.id, groupRef.current.position);
      return;
    }

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
        // Walking to couch - stay on ground
        groupRef.current.position.y = AGENT_Y_OFFSET;
      } else {
        groupRef.current.rotation.y = couch.rotation;
        // Sitting on couch - raise to seat height
        groupRef.current.position.y = COUCH_SEAT_HEIGHT;
      }

      if (distance < 0.5) {
        transitionToAnimation(actions, config.sitAnimation, walkState);
      }
      return;
    }

    // Handle break room visit when idle
    if (isIdle && idleActivity === 'break_room' && breakRoomSeatIndex >= 0) {
      walkState.wasOnStage = true;
      // 4 seats at angles 0, 90, 180, 270 around center, distance 1.3
      const seatAngle = (breakRoomSeatIndex * Math.PI) / 2;
      const targetX = breakRoomPos.x + Math.sin(seatAngle) * 1.3;
      const targetZ = breakRoomPos.z + Math.cos(seatAngle) * 1.3;
      const brDx = targetX - groupRef.current.position.x;
      const brDz = targetZ - groupRef.current.position.z;
      const brDist = Math.sqrt(brDx * brDx + brDz * brDz);

      if (brDist > 0.5) {
        const shouldRun = brDist > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        transitionToAnimation(actions, shouldRun ? 'Running' : 'Walking', walkState);
        const moveAmount = Math.min(speed * delta, brDist);
        groupRef.current.position.x += (brDx / brDist) * moveAmount;
        groupRef.current.position.z += (brDz / brDist) * moveAmount;
        rotateTowards(groupRef.current, Math.atan2(brDx, brDz), delta, 5);
        groupRef.current.position.y = AGENT_Y_OFFSET;
      } else {
        const faceAngle = Math.atan2(breakRoomPos.x - targetX, breakRoomPos.z - targetZ);
        rotateTowards(groupRef.current, faceAngle, delta, 3);
        transitionToAnimation(actions, config.sitAnimation, walkState);
        groupRef.current.position.y = COUCH_SEAT_HEIGHT;
      }
      updateAgentPosition(agent.id, groupRef.current.position);
      return;
    }

    // Handle poker table visit when idle
    if (isIdle && idleActivity === 'poker_table' && pokerSeatIndex >= 0) {
      walkState.wasOnStage = true;
      // 4 seats at angles 0, 90, 180, 270 around center, distance 1.8
      const seatAngle = (pokerSeatIndex * Math.PI) / 2;
      const targetX = pokerTablePos.x + Math.sin(seatAngle) * 1.8;
      const targetZ = pokerTablePos.z + Math.cos(seatAngle) * 1.8;
      const ptDx = targetX - groupRef.current.position.x;
      const ptDz = targetZ - groupRef.current.position.z;
      const ptDist = Math.sqrt(ptDx * ptDx + ptDz * ptDz);

      if (ptDist > 0.5) {
        const shouldRun = ptDist > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        transitionToAnimation(actions, shouldRun ? 'Running' : 'Walking', walkState);
        const moveAmount = Math.min(speed * delta, ptDist);
        groupRef.current.position.x += (ptDx / ptDist) * moveAmount;
        groupRef.current.position.z += (ptDz / ptDist) * moveAmount;
        rotateTowards(groupRef.current, Math.atan2(ptDx, ptDz), delta, 5);
        groupRef.current.position.y = AGENT_Y_OFFSET;
      } else {
        const faceAngle = Math.atan2(pokerTablePos.x - targetX, pokerTablePos.z - targetZ);
        rotateTowards(groupRef.current, faceAngle, delta, 3);
        transitionToAnimation(actions, config.sitAnimation, walkState);
        groupRef.current.position.y = COUCH_SEAT_HEIGHT;
      }
      updateAgentPosition(agent.id, groupRef.current.position);
      return;
    }

    // Handle kitchen visit when idle
    if (isIdle && idleActivity === 'kitchen' && kitchenSeatIndex >= 0) {
      walkState.wasOnStage = true;
      // 5 bar stool positions: 3 front (z+1.8), 2 back (z-1.8)
      const kitchenSeats = [
        { x: -1, z: 1.8, rot: Math.PI },
        { x: 0, z: 1.8, rot: Math.PI },
        { x: 1, z: 1.8, rot: Math.PI },
        { x: -0.5, z: -1.8, rot: 0 },
        { x: 0.5, z: -1.8, rot: 0 },
      ];
      const seat = kitchenSeats[kitchenSeatIndex % kitchenSeats.length];
      const targetX = kitchenPos.x + seat.x;
      const targetZ = kitchenPos.z + seat.z;
      const kDx = targetX - groupRef.current.position.x;
      const kDz = targetZ - groupRef.current.position.z;
      const kDist = Math.sqrt(kDx * kDx + kDz * kDz);

      if (kDist > 0.5) {
        const shouldRun = kDist > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        transitionToAnimation(actions, shouldRun ? 'Running' : 'Walking', walkState);
        const moveAmount = Math.min(speed * delta, kDist);
        groupRef.current.position.x += (kDx / kDist) * moveAmount;
        groupRef.current.position.z += (kDz / kDist) * moveAmount;
        rotateTowards(groupRef.current, Math.atan2(kDx, kDz), delta, 5);
      } else {
        rotateTowards(groupRef.current, seat.rot, delta, 3);
        transitionToAnimation(actions, 'Breathing idle', walkState);
      }
      groupRef.current.position.y = AGENT_Y_OFFSET;
      updateAgentPosition(agent.id, groupRef.current.position);
      return;
    }

    // Sync position when returning from stage/couch/zone
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

      // Force typing animation - check if the action is actually running
      // (useAgentAnimation hook may override it, so we re-apply every frame if needed)
      const typingAnim = config.animationConfig.working;
      const typingAction = actions?.[typingAnim];
      if (typingAction && !typingAction.isRunning()) {
        Object.values(actions!).forEach((action) => action?.fadeOut(0.3));
        typingAction.reset().fadeIn(0.3).play();
      }
      walkState.currentAnim = typingAnim;
      return;
    }

    // Idle wandering behavior
    if (isIdle) {
      const wanderRadiusX = config.wanderRadiusX ?? DEFAULT_WANDER.radiusX;
      const wanderMinZ = workstation.position.z + (config.wanderMinZ ?? DEFAULT_WANDER.minZ);
      const wanderMaxZ = workstation.position.z + (config.wanderMaxZ ?? DEFAULT_WANDER.maxZ);
      const ownWsX = workstation.position.x;
      const ownWsZ = workstation.position.z;

      // Helper to generate unblocked random target (checks workstations, static obstacles, and walls)
      const generateUnblockedTarget = () => {
        for (let attempt = 0; attempt < 10; attempt++) {
          const rawX = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
          const rawZ = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
          const candidate = getUnblockedTarget(rawX, rawZ, walkState.currentPos.x, walkState.currentPos.z, ownWsX, ownWsZ, allWorkstations);
          // Also check against static obstacles (conveyor belt) and walls
          if (isPositionClear(candidate.x, candidate.z, STATIC_OBSTACLES)) {
            return candidate;
          }
        }
        // Fallback: stay near own workstation
        return { x: ownWsX, z: wanderMinZ };
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

        // Check if next position would be blocked by workstations, conveyor belt, or walls
        const blockedByWs = isBlockedByWorkstation(nextX, nextZ, ownWsX, ownWsZ, allWorkstations);
        const blockedByObstacle = isInsideObstacle(nextX, nextZ, STATIC_OBSTACLES);
        const clamped = clampToWalls(nextX, nextZ);
        const outsideWalls = Math.abs(clamped.x - nextX) > 0.01 || Math.abs(clamped.z - nextZ) > 0.01;

        if (!blockedByWs && !blockedByObstacle && !outsideWalls) {
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
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under agent - glows on hover/select */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -AGENT_Y_OFFSET + FACTORY_CONSTANTS.CIRCLE_INDICATOR.Y_OFFSET, 0]}>
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

      {/* Agent model */}
      <primitive object={clonedScene} scale={MODEL_SCALE} />

      {/* Conversation speech bubble - highest priority */}
      {(() => {
        const convo = entityConversations.get(agent.id);
        if (convo?.currentLine) {
          return <SpeechBubble text={convo.currentLine} yOffset={3.5} variant="conversation" />;
        }
        return null;
      })()}

      {/* Speech bubble - shown when actively working (only if not in conversation) */}
      {!entityConversations.get(agent.id)?.currentLine &&
        agent.status === 'active' && agent.cpuPercent > 10 && agent.activity && (
        <SpeechBubble text={agent.activity} yOffset={3.2} />
      )}

      {/* Thinking bubble - shown on hover/selection, only if not in conversation */}
      {!entityConversations.has(agent.id) &&
        agent.status === 'idle' && (isHovered || isSelected) && (
        <ThinkingBubble
          thoughts={AGENT_THOUGHTS[idleActivity] || AGENT_THOUGHTS.wander}
          yOffset={3.5}
        />
      )}

      {/* Sleeping indicator - only when resting on couch */}
      {agent.status === 'idle' && idleActivity === 'couch' && <ZzzIndicator yOffset={4.0} />}
    </group>
  );
};
