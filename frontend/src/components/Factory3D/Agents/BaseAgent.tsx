/**
 * BaseAgent - Generic animated character model component.
 *
 * Provides the common functionality for all agent types including:
 * - Model loading and cloning
 * - Animation management
 * - Plan-based multi-step behavior (kitchen, couch, stage, wander, etc.)
 * - Conversation interrupts (pause/resume plan)
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
  isBlockedByEntity,
} from '../../../utils/factoryCollision';
import {
  cloneAndFixMaterials,
  removeRootMotion,
  disposeScene,
  rotateTowards,
  getCircleIndicatorStyle,
} from '../../../utils/threeHelpers';
import { useAgentPlan } from './useAgentPlan';
import { WORKER_AGENT_WEIGHTS, PlanStep, PlanStepType, OUTDOOR_STEP_TYPES, DEFAULT_STEP_THOUGHT_KEY } from './agentPlanTypes';
import { getRandomDuration } from './planGenerator';

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
  initialized: boolean;
  wasWorking: boolean;
  currentAnim: string;
  /** The step type that owns the current seat claim (for releasing on step change) */
  claimedSeatArea: string | null;
  /** Whether we've arrived at the current step's target */
  arrived: boolean;
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

// Y offset when sitting on couch - raise agent to sit on top of couch
const COUCH_SEAT_HEIGHT = FACTORY_CONSTANTS.MOVEMENT.COUCH_SEAT_HEIGHT;

// Fixed scale: All Mixamo models are 2.0 units, target is 4.0 units
const MODEL_SCALE = 2.0;

// Workstation blocker radius - agents can't enter other agents' workstation areas
const WORKSTATION_BLOCKER_RADIUS = 2.0;

/**
 * Check if a position is blocked by another agent's workstation
 */
function isBlockedByWorkstation(
  x: number,
  z: number,
  ownWorkstationX: number,
  ownWorkstationZ: number,
  allWorkstations: Array<{ x: number; z: number }>
): boolean {
  for (const ws of allWorkstations) {
    if (Math.abs(ws.x - ownWorkstationX) < 0.1 && Math.abs(ws.z - ownWorkstationZ) < 0.1) {
      continue;
    }
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
  if (!isBlockedByWorkstation(targetX, targetZ, ownWorkstationX, ownWorkstationZ, allWorkstations)) {
    return { x: targetX, z: targetZ };
  }

  const dx = targetX - currentX;
  const dz = targetZ - currentZ;
  const angle = Math.atan2(dz, dx);

  const alternatives = [
    { x: currentX + Math.cos(angle + Math.PI / 2) * 2, z: currentZ + Math.sin(angle + Math.PI / 2) * 2 },
    { x: currentX + Math.cos(angle - Math.PI / 2) * 2, z: currentZ + Math.sin(angle - Math.PI / 2) * 2 },
    { x: currentX - dx * 0.5, z: currentZ - dz * 0.5 },
  ];

  for (const alt of alternatives) {
    if (!isBlockedByWorkstation(alt.x, alt.z, ownWorkstationX, ownWorkstationZ, allWorkstations)) {
      return alt;
    }
  }

  return { x: currentX, z: currentZ };
}

// Use the centralized step-to-thought-key mapping from agentPlanTypes
const STEP_TYPE_TO_THOUGHT_KEY = DEFAULT_STEP_THOUGHT_KEY;

/**
 * BaseAgent - Generic agent with plan-based behavior and animations.
 *
 * @param agent - Agent data from context
 * @param config - Configuration for this specific agent type
 */
export const BaseAgent: React.FC<BaseAgentProps> = ({ agent, config }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Walking state refs - persist across frames without causing re-renders
  const walkingStateRef = useRef<WalkingState>({
    currentPos: { x: 0, z: 0 },
    initialized: false,
    wasWorking: false,
    currentAnim: '',
    claimedSeatArea: null,
    arrived: false,
  });

  // Track whether the plan was paused by a conversation
  const wasPausedRef = useRef(false);

  // Load model with animations
  const gltf = useGLTF(config.modelPath);

  // Clone scene for this instance with fixed materials
  const clonedScene = useMemo(
    () => cloneAndFixMaterials(gltf.scene),
    [gltf.scene]
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

  // Get context functions
  const {
    agents: allAgents,
    zones,
    npcPositions,
    updateAgentPosition,
    entityConversations,
    claimSeat,
    releaseSeat,
    getSeatOccupancy,
    claimStage,
    releaseStage,
    isStageOccupied,
    stagePerformerRef,
    consumeEntityCommand,
    entityPositionMapRef,
  } = useFactory();

  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(agent.id);

  // Plan-based behavior system
  const plan = useAgentPlan(agent.id, WORKER_AGENT_WEIGHTS);

  // Get zone positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;
  const breakRoomPos = FACTORY_CONSTANTS.BREAK_ROOM.POSITION;
  const pokerTablePos = FACTORY_CONSTANTS.POKER_TABLE.POSITION;
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;
  const pickleballPos = FACTORY_CONSTANTS.PICKLEBALL.POSITION;
  const golfPos = FACTORY_CONSTANTS.GOLF.POSITION;
  const outdoorBenchPositions = FACTORY_CONSTANTS.OUTDOOR_BENCH.POSITIONS;

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

  // Cleanup on unmount - release any seats/stage claims
  useEffect(() => {
    return () => {
      disposeScene(clonedScene);
      const ws = walkingStateRef.current;
      if (ws.claimedSeatArea) {
        releaseSeat(ws.claimedSeatArea, agent.id);
      }
      releaseStage(agent.id);
    };
  }, [clonedScene, agent.id, releaseSeat, releaseStage]);

  /**
   * Compute target position for a plan step.
   * Claims seats as needed and sets step target/animation/rotation.
   */
  const computeStepTarget = (step: PlanStep, walkState: WalkingState): { x: number; z: number; arrivalY: number; arrivalAnim: string; arrivalRot?: number } | null => {
    if (!workstation) return null;

    const ownWsX = workstation.position.x;
    const ownWsZ = workstation.position.z;

    switch (step.type) {
      case 'go_to_workstation':
        return {
          x: workstation.position.x,
          z: workstation.position.z + FACTORY_CONSTANTS.AGENT.WORKSTATION_OFFSET,
          arrivalY: 0,
          arrivalAnim: 'Breathing idle',
          arrivalRot: Math.PI,
        };

      case 'go_to_stage': {
        // Try to claim stage
        if (!claimStage(agent.id)) {
          return null; // Stage occupied, skip this step
        }
        return {
          x: stagePos.x,
          z: stagePos.z,
          arrivalY: FACTORY_CONSTANTS.STAGE.HEIGHT,
          arrivalAnim: config.danceAnimation,
          arrivalRot: -Math.PI / 2,
        };
      }

      case 'go_to_couch': {
        const seatIdx = claimSeat('couch', agent.id);
        if (seatIdx < 0 || !couchPositions[seatIdx]) return null;
        walkState.claimedSeatArea = 'couch';
        const couch = couchPositions[seatIdx];
        return {
          x: loungePos.x + couch.x,
          z: loungePos.z + couch.z,
          arrivalY: COUCH_SEAT_HEIGHT,
          arrivalAnim: config.sitAnimation,
          arrivalRot: couch.rotation,
        };
      }

      case 'go_to_break_room': {
        const seatIdx = claimSeat('break_room', agent.id);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'break_room';
        const seatAngle = (seatIdx * Math.PI) / 2;
        const targetX = breakRoomPos.x + Math.sin(seatAngle) * 1.3;
        const targetZ = breakRoomPos.z + Math.cos(seatAngle) * 1.3;
        const faceAngle = Math.atan2(breakRoomPos.x - targetX, breakRoomPos.z - targetZ);
        return {
          x: targetX,
          z: targetZ,
          arrivalY: COUCH_SEAT_HEIGHT,
          arrivalAnim: config.sitAnimation,
          arrivalRot: faceAngle,
        };
      }

      case 'go_to_poker_table': {
        const seatIdx = claimSeat('poker_table', agent.id);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'poker_table';
        const seatAngle = (seatIdx * Math.PI) / 2;
        const targetX = pokerTablePos.x + Math.sin(seatAngle) * 1.8;
        const targetZ = pokerTablePos.z + Math.cos(seatAngle) * 1.8;
        const faceAngle = Math.atan2(pokerTablePos.x - targetX, pokerTablePos.z - targetZ);
        return {
          x: targetX,
          z: targetZ,
          arrivalY: COUCH_SEAT_HEIGHT,
          arrivalAnim: config.sitAnimation,
          arrivalRot: faceAngle,
        };
      }

      case 'go_to_kitchen': {
        const seatIdx = claimSeat('kitchen', agent.id);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'kitchen';
        const seatPositions = FACTORY_CONSTANTS.KITCHEN.SEAT_POSITIONS;
        const seat = seatPositions[seatIdx % seatPositions.length];
        return {
          x: kitchenPos.x + seat.x,
          z: kitchenPos.z + seat.z,
          arrivalY: 0,
          arrivalAnim: 'Breathing idle',
          arrivalRot: seat.rotation,
        };
      }

      case 'watch_stage': {
        const positions = FACTORY_CONSTANTS.STAGE.AUDIENCE_POSITIONS;
        const pos = positions[Math.floor(Math.random() * positions.length)];
        return {
          x: pos.x,
          z: pos.z,
          arrivalY: 0,
          arrivalAnim: 'Breathing idle',
          arrivalRot: Math.PI / 2,
        };
      }

      case 'go_to_pickleball': {
        // Walk to pickleball court with slight random offset
        const px = pickleballPos.x + (Math.random() - 0.5) * 6;
        const pz = pickleballPos.z + (Math.random() - 0.5) * 8;
        return { x: px, z: pz, arrivalY: 0, arrivalAnim: 'Breathing idle' };
      }

      case 'go_to_golf': {
        // Walk to golf putting green with slight random offset
        const gx = golfPos.x + (Math.random() - 0.5) * 6;
        const gz = golfPos.z + (Math.random() - 0.5) * 6;
        return { x: gx, z: gz, arrivalY: 0, arrivalAnim: 'Breathing idle' };
      }

      case 'sit_outdoor': {
        // Pick a random outdoor bench
        const bench = outdoorBenchPositions[Math.floor(Math.random() * outdoorBenchPositions.length)];
        return {
          x: bench.x,
          z: bench.z,
          arrivalY: 0,
          arrivalAnim: config.sitAnimation,
          arrivalRot: bench.rotation,
        };
      }

      case 'wander':
      default: {
        const wanderRadiusX = config.wanderRadiusX ?? DEFAULT_WANDER.radiusX;
        const wanderMinZ = workstation.position.z + (config.wanderMinZ ?? DEFAULT_WANDER.minZ);
        const wanderMaxZ = workstation.position.z + (config.wanderMaxZ ?? DEFAULT_WANDER.maxZ);

        for (let attempt = 0; attempt < 10; attempt++) {
          const rawX = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
          const rawZ = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
          const candidate = getUnblockedTarget(rawX, rawZ, walkState.currentPos.x, walkState.currentPos.z, ownWsX, ownWsZ, allWorkstations);
          if (isPositionClear(candidate.x, candidate.z, STATIC_OBSTACLES)) {
            return { x: candidate.x, z: candidate.z, arrivalY: 0, arrivalAnim: 'Breathing idle' };
          }
        }
        return { x: ownWsX, z: workstation.position.z + (config.wanderMinZ ?? DEFAULT_WANDER.minZ), arrivalY: 0, arrivalAnim: 'Breathing idle' };
      }
    }
  };

  // Animation loop - position and animation updates
  useFrame((state, delta) => {
    if (!groupRef.current || !workstation) return;

    mixer?.update(delta);

    const walkState = walkingStateRef.current;
    const isActuallyWorking = agent.status === 'active';
    const isIdle = agent.status === 'idle';
    const elapsed = state.clock.elapsedTime;

    // Pause on hover - freeze movement and play idle animation
    if (isHovered && !isSelected) {
      transitionToAnimation(actions, 'Breathing idle', walkState, 0.3, 0.3);
      updateAgentPosition(agent.id, groupRef.current.position);
      return;
    }

    // Check for external commands FIRST, regardless of status.
    // This ensures commands from EntityActionPanel override both idle and working states.
    const command = consumeEntityCommand(agent.id);
    let hasCommand = false;
    if (command) {
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, agent.id);
        walkState.claimedSeatArea = null;
      }
      releaseStage(agent.id);
      plan.planRef.current = {
        steps: [{
          type: command.stepType,
          duration: getRandomDuration(command.stepType),
        }],
        currentStepIndex: 0,
        paused: false,
        arrivalTime: null,
        commanded: true,
      };
      walkState.arrived = false;
      walkState.wasWorking = false;
      wasPausedRef.current = false;
      hasCommand = true;
    }

    // Check if there's an active commanded plan (persists across frames)
    const currentPlanIsCommanded = plan.planRef.current?.commanded ?? false;

    // Working state - position at workstation (skip if commanded)
    if (isActuallyWorking && !hasCommand && !currentPlanIsCommanded) {
      // Release any seats/stage when returning to work
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, agent.id);
        walkState.claimedSeatArea = null;
      }
      releaseStage(agent.id);

      groupRef.current.position.x = workstation.position.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z =
        workstation.position.z + FACTORY_CONSTANTS.AGENT.WORKSTATION_OFFSET;
      groupRef.current.rotation.y = Math.PI;
      walkState.wasWorking = true;
      walkState.arrived = false;
      walkState.currentPos.x = groupRef.current.position.x;
      walkState.currentPos.z = groupRef.current.position.z;

      const typingAnim = config.animationConfig.working;
      const typingAction = actions?.[typingAnim];
      if (typingAction && !typingAction.isRunning()) {
        Object.values(actions!).forEach((action) => action?.fadeOut(0.3));
        typingAction.reset().fadeIn(0.3).play();
      }
      walkState.currentAnim = typingAnim;
      return;
    }

    // Idle behavior (or commanded override) - plan-based system
    if (isIdle || hasCommand || currentPlanIsCommanded) {

      const inConversation = entityConversations.has(agent.id);
      const isCommanded = plan.planRef.current?.commanded ?? false;

      // Handle conversation interrupt (skip for commanded plans)
      if (inConversation && !plan.isPaused() && !isCommanded) {
        plan.pause();
        wasPausedRef.current = true;
        transitionToAnimation(actions, 'Breathing idle', walkState);
      } else if (!inConversation && wasPausedRef.current) {
        plan.resume();
        wasPausedRef.current = false;
        walkState.arrived = false; // Re-approach target after conversation
      }

      // If paused (in conversation), idle and face the partner
      if (plan.isPaused()) {
        const convo = entityConversations.get(agent.id);
        if (convo) {
          // Look up partner position
          const partnerAgent = allAgents.get(convo.partnerId);
          const partnerNpc = npcPositions.get(convo.partnerId);
          const partnerPos = partnerAgent?.currentPosition || partnerAgent?.basePosition || partnerNpc;
          if (partnerPos) {
            const toPartner = Math.atan2(
              partnerPos.x - walkState.currentPos.x,
              partnerPos.z - walkState.currentPos.z
            );
            rotateTowards(groupRef.current, toPartner, delta, 5);
          }
        }
        updateAgentPosition(agent.id, groupRef.current.position);
        return;
      }

      // Initialize plan if needed (first idle frame or after working)
      if (!plan.planRef.current) {
        plan.newPlan({
          stageOccupied: isStageOccupied(),
          seatOccupancy: getSeatOccupancy(),
        });
        walkState.wasWorking = false;
        walkState.arrived = false;
      }

      // Get current step
      const step = plan.getCurrentStep();
      if (!step) {
        // Plan exhausted or empty - generate new one
        plan.newPlan({
          stageOccupied: isStageOccupied(),
          seatOccupancy: getSeatOccupancy(),
        });
        walkState.arrived = false;
        updateAgentPosition(agent.id, groupRef.current.position);
        return;
      }

      // Compute target if not set
      if (!step.target) {
        const target = computeStepTarget(step, walkState);
        if (!target) {
          // Can't execute this step (e.g., area full) - skip it
          if (walkState.claimedSeatArea) {
            releaseSeat(walkState.claimedSeatArea, agent.id);
            walkState.claimedSeatArea = null;
          }
          releaseStage(agent.id);
          plan.advanceStep();
          walkState.arrived = false;
          updateAgentPosition(agent.id, groupRef.current.position);
          return;
        }
        step.target = { x: target.x, z: target.z };
        step.arrivalY = target.arrivalY;
        step.arrivalAnimation = target.arrivalAnim;
        step.arrivalRotation = target.arrivalRot;
      }

      // Move toward target
      const dx = step.target.x - groupRef.current.position.x;
      const dz = step.target.z - groupRef.current.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (!walkState.arrived && distance > 0.5) {
        // Walking to target
        groupRef.current.position.y = 0;
        const shouldRun = distance > config.runThreshold;
        const speed = shouldRun ? config.runSpeed : config.walkSpeed;
        const animName = shouldRun ? 'Running' : 'Walking';
        transitionToAnimation(actions, animName, walkState);

        const moveAmount = Math.min(speed * delta, distance);
        const nextX = groupRef.current.position.x + (dx / distance) * moveAmount;
        const nextZ = groupRef.current.position.z + (dz / distance) * moveAmount;

        // Collision check - skip wall clamping for outdoor step types
        const ownWsX = workstation.position.x;
        const ownWsZ = workstation.position.z;
        const isOutdoorStep = OUTDOOR_STEP_TYPES.has(step.type);
        const blockedByWs = isBlockedByWorkstation(nextX, nextZ, ownWsX, ownWsZ, allWorkstations);
        const blockedByObstacle = isInsideObstacle(nextX, nextZ, STATIC_OBSTACLES);
        const clamped = clampToWalls(nextX, nextZ);
        const outsideWalls = !isOutdoorStep && (Math.abs(clamped.x - nextX) > 0.01 || Math.abs(clamped.z - nextZ) > 0.01);
        const blockedByEntity = isBlockedByEntity(nextX, nextZ, agent.id, entityPositionMapRef.current);

        if (!blockedByWs && !blockedByObstacle && !outsideWalls && !blockedByEntity) {
          groupRef.current.position.x = nextX;
          groupRef.current.position.z = nextZ;
        } else if (step.type === 'wander') {
          // For wander steps, pick new target on collision
          const wanderRadiusX = config.wanderRadiusX ?? DEFAULT_WANDER.radiusX;
          const wanderMinZ = workstation.position.z + (config.wanderMinZ ?? DEFAULT_WANDER.minZ);
          const wanderMaxZ = workstation.position.z + (config.wanderMaxZ ?? DEFAULT_WANDER.maxZ);
          const rawX = workstation.position.x + (Math.random() - 0.5) * wanderRadiusX * 2;
          const rawZ = wanderMinZ + Math.random() * (wanderMaxZ - wanderMinZ);
          const newTarget = getUnblockedTarget(rawX, rawZ, groupRef.current.position.x, groupRef.current.position.z, ownWsX, ownWsZ, allWorkstations);
          step.target = { x: newTarget.x, z: newTarget.z };
        }
        // else: for destination steps, just keep trying to reach target

        rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

        walkState.currentPos.x = groupRef.current.position.x;
        walkState.currentPos.z = groupRef.current.position.z;
      } else if (!walkState.arrived) {
        // Just arrived at target
        walkState.arrived = true;
        plan.markArrival(elapsed);

        if (step.arrivalAnimation) {
          transitionToAnimation(actions, step.arrivalAnimation, walkState);
        }
        if (step.arrivalRotation !== undefined) {
          groupRef.current.rotation.y = step.arrivalRotation;
        }
        if (step.arrivalY !== undefined) {
          groupRef.current.position.y = step.arrivalY;
        }
      } else {
        // At destination, waiting for duration
        if (step.arrivalRotation !== undefined) {
          rotateTowards(groupRef.current, step.arrivalRotation, delta, 3);
        }

        // Check if duration has elapsed
        if (plan.isDurationElapsed(elapsed)) {
          // Release seat/stage
          if (walkState.claimedSeatArea) {
            releaseSeat(walkState.claimedSeatArea, agent.id);
            walkState.claimedSeatArea = null;
          }
          if (step.type === 'go_to_stage') {
            releaseStage(agent.id);
          }

          // Reset Y to ground before moving to next step
          groupRef.current.position.y = 0;

          plan.advanceStep();
          walkState.arrived = false;
        }
      }
    }

    // Report current position to context for boss mode tracking
    updateAgentPosition(agent.id, groupRef.current.position);
  });

  // Get thought key for ThinkingBubble based on current plan step
  const thoughtKey = plan.displayStepType
    ? STEP_TYPE_TO_THOUGHT_KEY[plan.displayStepType] ?? 'wander'
    : 'wander';

  return (
    <group
      ref={groupRef}
      position={[agent.basePosition.x, 0, agent.basePosition.z]}
      rotation={[0, Math.PI, 0]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under agent - glows on hover/select */}
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
          thoughts={AGENT_THOUGHTS[thoughtKey] || AGENT_THOUGHTS.wander}
          yOffset={3.5}
        />
      )}

      {/* Sleeping indicator - only when resting on couch */}
      {agent.status === 'idle' && plan.displayStepType === 'go_to_couch' && <ZzzIndicator yOffset={4.0} />}
    </group>
  );
};
