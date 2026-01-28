/**
 * FakeAudience - Decorative audience agents that follow plan-based behavior.
 *
 * Each audience member uses the useAgentPlan hook to generate multi-step plans
 * (wander, kitchen, couch, break room, poker table, watch stage). When a
 * performer is detected on stage, members are interrupted with staggered
 * delays to gather at audience positions. When the performer leaves, the
 * saved plan is restored or a new one is generated.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { MODEL_PATHS, FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';
import { ThinkingBubble } from './ThinkingBubble';
import { SpeechBubble } from './SpeechBubble';
import { useEntityInteraction } from './useEntityInteraction';
import {
  STATIC_OBSTACLES,
  getWorkstationObstacles,
  getSafePosition,
  getRandomClearPosition,
  isBlockedByEntity,
  Obstacle,
} from '../../../utils/factoryCollision';
import {
  cloneAndFixMaterials,
  removeRootMotion,
  disposeScene,
  getCircleIndicatorStyle,
  rotateTowards,
} from '../../../utils/threeHelpers';
import { useAgentPlan } from './useAgentPlan';
import { FAKE_AUDIENCE_WEIGHTS, PlanStep, PlanStepType, OUTDOOR_STEP_TYPES, DEFAULT_STEP_THOUGHT_KEY } from './agentPlanTypes';
import { getRandomDuration } from './planGenerator';

const { STAGE } = FACTORY_CONSTANTS;

// Preload models
useGLTF.preload(MODEL_PATHS.COW);
useGLTF.preload(MODEL_PATHS.HORSE);

/** Distance from stage center to consider an NPC "on stage" */
const NPC_STAGE_THRESHOLD = 4.0;

/** Fixed scale for audience member models (matches BaseAgent MODEL_SCALE) */
const AUDIENCE_MODEL_SCALE = 2.0;

// Use the centralized step-to-thought-key mapping from agentPlanTypes
const STEP_TYPE_TO_THOUGHT_KEY = DEFAULT_STEP_THOUGHT_KEY;

/** Audience-specific thought categories (hoisted to module level to avoid re-creation) */
const AUDIENCE_THOUGHTS: Record<string, string[]> = {
  wander: [
    'Just looking around',
    'Nice office!',
    'Where is everyone?',
    'Taking a stroll',
    'Exploring the factory',
  ],
  conveyor: [
    'Wow, great production!',
    'Look at those deliveries!',
    'Shipping code so fast!',
    'Amazing output today!',
    'The factory is humming!',
    'Great momentum here!',
    'Tokens flying by!',
  ],
  couch: [
    'Time to relax...',
    'The couch looks comfy',
    'Need a quick rest',
  ],
  kitchen: [
    'Snack time!',
    'I smell coffee!',
    'Mmm, pizza!',
    'This coffee is great',
    'Love the donuts!',
  ],
  break_room: [
    'Coffee break!',
    'Need some caffeine',
    'Taking five minutes',
  ],
  poker_table: [
    'All in!',
    'Read my poker face',
    'Bluffing time!',
  ],
  stage: [
    'Great show!',
    'Amazing!',
    'Encore!',
    'Love it!',
    'Bravo!',
  ],
};

/**
 * Walking state for an audience member, persisted across frames via ref
 */
interface AudienceWalkingState {
  /** Current position */
  currentPos: { x: number; z: number };
  /** Whether initial position has been set */
  initialized: boolean;
  /** The seat area currently claimed by this member */
  claimedSeatArea: string | null;
  /** Whether the member has arrived at the current step target */
  arrived: boolean;
  /** Name of the currently playing animation */
  currentAnim: string;
}

/**
 * Props for the inner AudienceMember component
 */
interface AudienceMemberProps {
  /** Assigned audience position for stage watching (from AUDIENCE_POSITIONS by index) */
  audiencePosition: { x: number; z: number };
  /** Path to the GLB model file */
  modelPath: string;
  /** Index of this member in the audience list */
  index: number;
  /** Pre-computed obstacle list for collision avoidance */
  allObstacles: Obstacle[];
}

/**
 * Fade out all actions and fade in the target animation.
 * Falls back to 'Idle' if target not found.
 *
 * @param actions - Available animation actions from useAnimations
 * @param targetAnim - Name of the animation to transition to
 * @param walkState - Walking state ref for tracking current animation
 * @param fadeOutDuration - Duration to fade out current animations
 * @param fadeInDuration - Duration to fade in new animation
 */
function transitionToAnimation(
  actions: Record<string, THREE.AnimationAction | null> | undefined,
  targetAnim: string,
  walkState: AudienceWalkingState,
  fadeOutDuration: number = 0.3,
  fadeInDuration: number = 0.3
): void {
  if (!actions || walkState.currentAnim === targetAnim) return;

  let targetAction = actions[targetAnim];

  if (!targetAction && targetAnim !== 'Idle') {
    targetAction = actions['Idle'] ?? actions['Breathing idle'] ?? null;
  }

  if (!targetAction) return;

  Object.values(actions).forEach((action) => action?.fadeOut(fadeOutDuration));
  targetAction.reset().fadeIn(fadeInDuration).play();
  walkState.currentAnim = targetAnim;
}

/**
 * AudienceMember - A single audience member with plan-based behavior.
 *
 * Each instance owns its own useAgentPlan hook and manages its own
 * movement, animation, and stage-interrupt logic. When a performer
 * appears on stage, the plan is interrupted with a staggered delay
 * (member index * 1-3 seconds). When the performer leaves, the
 * saved plan is restored or a new plan is generated.
 *
 * @param audiencePosition - Fixed audience position for this member when watching stage
 * @param modelPath - Path to the 3D model (cow or horse)
 * @param index - Index in the audience list (used for staggered delays and entity ID)
 * @param allObstacles - Combined static + workstation obstacles for collision
 */
const AudienceMember: React.FC<AudienceMemberProps> = ({
  audiencePosition,
  modelPath,
  index,
  allObstacles,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelPath);

  const entityId = `fake-audience-${index}`;

  // Factory context
  const {
    agents,
    npcPositions,
    updateNpcPosition,
    entityConversations,
    stagePerformerRef,
    claimSeat,
    releaseSeat,
    getSeatOccupancy,
    isStageOccupied,
    consumeEntityCommand,
    entityPositionMapRef,
    freestyleMode,
    consumeFreestyleMoveTarget,
    selectedEntityId,
    clearActiveEntityAction,
  } = useFactory();

  // Hover/select interaction
  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(entityId);

  // Circle indicator styling
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, 0x808080);

  // Plan-based behavior system
  const plan = useAgentPlan(entityId, FAKE_AUDIENCE_WEIGHTS);

  // Walking state ref
  const walkStateRef = useRef<AudienceWalkingState>({
    currentPos: { x: audiencePosition.x - 10 + index * 3, z: audiencePosition.z + index * 2 },
    initialized: false,
    claimedSeatArea: null,
    arrived: false,
    currentAnim: '',
  });

  // Track conversation pause state
  const wasPausedRef = useRef(false);

  // Track performer state for detecting transitions (appear/disappear)
  const prevPerformerRef = useRef<string | null>(null);

  // Stagger delay ref: each member gets a random staggered delay before responding to stage
  const stageDelayRef = useRef<number>(0);
  const stageDelayStartRef = useRef<number>(0);
  /** Whether this member is waiting through the stagger delay before interrupting */
  const waitingForStageRef = useRef(false);

  // Positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;
  const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
  const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;
  const breakRoomPos = FACTORY_CONSTANTS.BREAK_ROOM.POSITION;
  const pokerTablePos = FACTORY_CONSTANTS.POKER_TABLE.POSITION;
  const pickleballPos = FACTORY_CONSTANTS.PICKLEBALL.POSITION;
  const golfPos = FACTORY_CONSTANTS.GOLF.POSITION;
  const outdoorBenchPositions = FACTORY_CONSTANTS.OUTDOOR_BENCH.POSITIONS;

  // Clone scene with fixed materials
  const clonedScene = useMemo(() => cloneAndFixMaterials(gltf.scene), [gltf.scene]);

  // Remove root motion to prevent world-space drift
  const processedAnimations = useMemo(
    () => removeRootMotion(gltf.animations),
    [gltf.animations]
  );

  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposeScene(clonedScene);
      const ws = walkStateRef.current;
      if (ws.claimedSeatArea) {
        releaseSeat(ws.claimedSeatArea, entityId);
      }
    };
  }, [clonedScene, entityId, releaseSeat]);

  /**
   * Compute target position for a plan step.
   * Claims seats as needed and returns position, arrival animation, and rotation.
   *
   * @param step - The current plan step to compute a target for
   * @param walkState - Walking state for tracking seat claims
   * @returns Target position info, or null if the step cannot be executed
   */
  const computeStepTarget = (
    step: PlanStep,
    walkState: AudienceWalkingState
  ): { x: number; z: number; arrivalY: number; arrivalAnim: string; arrivalRot?: number } | null => {
    switch (step.type) {
      case 'watch_stage': {
        // Each member goes to their assigned audience position by index
        return {
          x: audiencePosition.x,
          z: audiencePosition.z,
          arrivalY: 0,
          arrivalAnim: 'Breathing idle',
          arrivalRot: Math.PI / 2, // Face the stage
        };
      }

      case 'go_to_kitchen': {
        const seatIdx = claimSeat('kitchen', entityId);
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

      case 'go_to_couch': {
        const seatIdx = claimSeat('couch', entityId);
        if (seatIdx < 0 || !couchPositions[seatIdx]) return null;
        walkState.claimedSeatArea = 'couch';
        const couch = couchPositions[seatIdx];
        return {
          x: loungePos.x + couch.x,
          z: loungePos.z + couch.z,
          arrivalY: FACTORY_CONSTANTS.MOVEMENT.COUCH_SEAT_HEIGHT,
          arrivalAnim: 'Breathing idle',
          arrivalRot: couch.rotation,
        };
      }

      case 'go_to_break_room': {
        const seatIdx = claimSeat('break_room', entityId);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'break_room';
        const seatAngle = (seatIdx * Math.PI) / 2;
        const targetX = breakRoomPos.x + Math.sin(seatAngle) * 1.3;
        const targetZ = breakRoomPos.z + Math.cos(seatAngle) * 1.3;
        const faceAngle = Math.atan2(breakRoomPos.x - targetX, breakRoomPos.z - targetZ);
        return {
          x: targetX,
          z: targetZ,
          arrivalY: FACTORY_CONSTANTS.MOVEMENT.COUCH_SEAT_HEIGHT,
          arrivalAnim: 'Breathing idle',
          arrivalRot: faceAngle,
        };
      }

      case 'go_to_poker_table': {
        const seatIdx = claimSeat('poker_table', entityId);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'poker_table';
        const seatAngle = (seatIdx * Math.PI) / 2;
        const targetX = pokerTablePos.x + Math.sin(seatAngle) * 1.8;
        const targetZ = pokerTablePos.z + Math.cos(seatAngle) * 1.8;
        const faceAngle = Math.atan2(pokerTablePos.x - targetX, pokerTablePos.z - targetZ);
        return {
          x: targetX,
          z: targetZ,
          arrivalY: FACTORY_CONSTANTS.MOVEMENT.COUCH_SEAT_HEIGHT,
          arrivalAnim: 'Breathing idle',
          arrivalRot: faceAngle,
        };
      }

      case 'go_to_pickleball': {
        const px = pickleballPos.x + (Math.random() - 0.5) * 6;
        const pz = pickleballPos.z + (Math.random() - 0.5) * 8;
        return { x: px, z: pz, arrivalY: 0, arrivalAnim: 'Breathing idle' };
      }

      case 'go_to_golf': {
        const gx = golfPos.x + (Math.random() - 0.5) * 6;
        const gz = golfPos.z + (Math.random() - 0.5) * 6;
        return { x: gx, z: gz, arrivalY: 0, arrivalAnim: 'Breathing idle' };
      }

      case 'sit_outdoor': {
        const bench = outdoorBenchPositions[Math.floor(Math.random() * outdoorBenchPositions.length)];
        return {
          x: bench.x,
          z: bench.z,
          arrivalY: 0,
          arrivalAnim: 'Breathing idle',
          arrivalRot: bench.rotation,
        };
      }

      case 'wander':
      default: {
        const target = getRandomClearPosition(allObstacles);
        return {
          x: target.x,
          z: target.z,
          arrivalY: 0,
          arrivalAnim: 'Breathing idle',
        };
      }
    }
  };

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    mixer?.update(delta);

    const walkState = walkStateRef.current;
    const elapsed = state.clock.elapsedTime;

    // Pause on hover - freeze movement and play idle animation (skip if selected in boss mode)
    if (isHovered && !isSelected) {
      transitionToAnimation(actions, 'Breathing idle', walkState);
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
      return;
    }

    // Initialize position at a clear spot
    if (!walkState.initialized) {
      const start = getRandomClearPosition(allObstacles);
      walkState.currentPos = { x: start.x, z: start.z };
      groupRef.current.position.set(start.x, 0, start.z);
      walkState.initialized = true;
    }

    // Check for external commands from EntityActionPanel
    const command = consumeEntityCommand(entityId);
    if (command) {
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, entityId);
        walkState.claimedSeatArea = null;
      }
      waitingForStageRef.current = false;
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
      wasPausedRef.current = false;
      groupRef.current.position.y = 0;
    }

    // Check for freestyle movement target (double-click control)
    const isThisMemberSelected = selectedEntityId === entityId;
    const freestyleMoveTarget = isThisMemberSelected && freestyleMode ? consumeFreestyleMoveTarget() : null;
    if (freestyleMoveTarget) {
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, entityId);
        walkState.claimedSeatArea = null;
      }
      waitingForStageRef.current = false;
      plan.planRef.current = {
        steps: [{
          type: 'wander',
          duration: 999, // Stay indefinitely until another command
          target: { x: freestyleMoveTarget.x, z: freestyleMoveTarget.z },
          arrivalAnimation: 'Breathing idle',
        }],
        currentStepIndex: 0,
        paused: false,
        arrivalTime: null,
        commanded: true,
      };
      walkState.arrived = false;
      wasPausedRef.current = false;
      groupRef.current.position.y = 0;
    }

    // Check commanded status once, used by stage reaction and conversation handlers
    const isCommanded = plan.planRef.current?.commanded ?? false;

    // Detect performer transitions for stage interrupt logic
    const currentPerformer = stagePerformerRef.current;
    const prevPerformer = prevPerformerRef.current;

    if (currentPerformer && !prevPerformer && !isCommanded) {
      // Performer just appeared - start stagger delay
      stageDelayRef.current = index * (1.0 + Math.random() * 2.0);
      stageDelayStartRef.current = elapsed;
      waitingForStageRef.current = true;
    } else if (!currentPerformer && prevPerformer && !isCommanded) {
      // Performer just left - restore saved plan or generate new one
      waitingForStageRef.current = false;

      // Release any seat claim from the watch_stage step
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, entityId);
        walkState.claimedSeatArea = null;
      }

      if (plan.savedPlanRef.current) {
        plan.planRef.current = plan.savedPlanRef.current;
        plan.savedPlanRef.current = null;
        walkState.arrived = false;
      } else {
        plan.newPlan({
          stageOccupied: isStageOccupied(),
          seatOccupancy: getSeatOccupancy(),
        });
        walkState.arrived = false;
      }
    }

    prevPerformerRef.current = currentPerformer;

    // Process stagger delay - interrupt plan after delay elapses
    if (waitingForStageRef.current && !isCommanded) {
      if (elapsed - stageDelayStartRef.current >= stageDelayRef.current) {
        waitingForStageRef.current = false;

        // Release any current seat claim before interrupting
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, entityId);
          walkState.claimedSeatArea = null;
        }

        plan.interruptForStage();
        walkState.arrived = false;
      }
    }

    // Handle conversation interrupt (pause/resume plan)
    const inConversation = entityConversations.has(entityId);

    if (inConversation && !plan.isPaused() && !isCommanded) {
      plan.pause();
      wasPausedRef.current = true;
      transitionToAnimation(actions, 'Breathing idle', walkState);
    } else if (!inConversation && wasPausedRef.current) {
      plan.resume();
      wasPausedRef.current = false;
      walkState.arrived = false;
    }

    // If paused (in conversation), idle, face partner, and report position
    if (plan.isPaused()) {
      const convo = entityConversations.get(entityId);
      if (convo) {
        const partnerAgent = agents.get(convo.partnerId);
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
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(entityId, groupRef.current.position);
      return;
    }

    // Initialize plan if needed
    if (!plan.planRef.current) {
      plan.newPlan({
        stageOccupied: isStageOccupied(),
        seatOccupancy: getSeatOccupancy(),
      });
      walkState.arrived = false;
    }

    // Get current step
    const step = plan.getCurrentStep();
    if (!step) {
      plan.newPlan({
        stageOccupied: isStageOccupied(),
        seatOccupancy: getSeatOccupancy(),
      });
      walkState.arrived = false;
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(entityId, groupRef.current.position);
      return;
    }

    // Compute target if not set
    if (!step.target) {
      const target = computeStepTarget(step, walkState);
      if (!target) {
        // Cannot execute this step (area full) - skip it
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, entityId);
          walkState.claimedSeatArea = null;
        }
        plan.advanceStep();
        walkState.arrived = false;
        groupRef.current.position.x = walkState.currentPos.x;
        groupRef.current.position.y = 0;
        groupRef.current.position.z = walkState.currentPos.z;
        updateNpcPosition(entityId, groupRef.current.position);
        return;
      }
      step.target = { x: target.x, z: target.z };
      step.arrivalY = target.arrivalY;
      step.arrivalAnimation = target.arrivalAnim;
      step.arrivalRotation = target.arrivalRot;
    }

    // Move toward target
    const dx = step.target.x - walkState.currentPos.x;
    const dz = step.target.z - walkState.currentPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (!walkState.arrived && distance > 0.5) {
      // Walking to target
      const speed = step.type === 'watch_stage' ? 2.5 : 1.5;
      const moveAmount = Math.min(speed * delta, distance);
      const newX = walkState.currentPos.x + (dx / distance) * moveAmount;
      const newZ = walkState.currentPos.z + (dz / distance) * moveAmount;

      const oldX = walkState.currentPos.x;
      const oldZ = walkState.currentPos.z;
      const isOutdoorStep = OUTDOOR_STEP_TYPES.has(step.type);
      let safeX: number, safeZ: number;
      if (isOutdoorStep) {
        safeX = newX;
        safeZ = newZ;
      } else {
        const safe = getSafePosition(newX, newZ, oldX, oldZ, allObstacles);
        safeX = safe.x;
        safeZ = safe.z;
      }
      // Entity-to-entity collision: don't move into another entity's space
      if (isBlockedByEntity(safeX, safeZ, entityId, entityPositionMapRef.current)) {
        safeX = oldX;
        safeZ = oldZ;
      }

      walkState.currentPos.x = safeX;
      walkState.currentPos.z = safeZ;

      // Stuck detection - pick new target for wander steps, force new decision for others
      if (
        Math.abs(safeX - oldX) < 0.01 &&
        Math.abs(safeZ - oldZ) < 0.01 &&
        distance > 2
      ) {
        if (step.type === 'wander') {
          // Pick a new random target
          const newTarget = getRandomClearPosition(allObstacles);
          step.target = { x: newTarget.x, z: newTarget.z };
        } else {
          // Skip this step
          if (walkState.claimedSeatArea) {
            releaseSeat(walkState.claimedSeatArea, entityId);
            walkState.claimedSeatArea = null;
          }
          plan.advanceStep();
          walkState.arrived = false;
        }
      }

      // Face movement direction
      rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

      // Walking animation
      transitionToAnimation(actions, 'Walking', walkState);

      // Apply position while walking (Y stays at ground level)
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
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

      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.z = walkState.currentPos.z;
    } else {
      // At destination, waiting for duration
      if (step.arrivalRotation !== undefined) {
        rotateTowards(groupRef.current, step.arrivalRotation, delta, 3);
      }

      // Subtle swaying while idle
      const swayAmount = 0.02;
      groupRef.current.rotation.z = Math.sin(elapsed * 0.5 + index) * swayAmount;

      // Check if duration has elapsed (watch_stage has Infinity, so it never advances on its own)
      if (plan.isDurationElapsed(elapsed)) {
        // Release seat claim
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, entityId);
          walkState.claimedSeatArea = null;
        }

        // Reset Y to ground before moving to next step
        groupRef.current.position.y = 0;

        // Check if this was a commanded plan before advancing
        const wasCommanded = plan.planRef.current?.commanded ?? false;
        plan.advanceStep();
        // Clear active action UI state when commanded plan completes
        if (wasCommanded) {
          clearActiveEntityAction(entityId);
        }
        walkState.arrived = false;
      }

      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.z = walkState.currentPos.z;
    }

    // Report position for proximity conversation detection
    updateNpcPosition(entityId, groupRef.current.position);
  });

  // Get thought key for ThinkingBubble based on current plan step
  // Override with 'conveyor' if near the conveyor belt
  const baseThoughtKey = plan.displayStepType
    ? STEP_TYPE_TO_THOUGHT_KEY[plan.displayStepType] ?? 'wander'
    : 'wander';

  const isNearConveyor = Math.abs(walkStateRef.current.currentPos.z - FACTORY_CONSTANTS.CONVEYOR.BELT_Z) < FACTORY_CONSTANTS.CONVEYOR.PROXIMITY_THRESHOLD;
  const thoughtKey = isNearConveyor ? 'conveyor' : baseThoughtKey;

  // Select the matching thought category from the hoisted AUDIENCE_THOUGHTS constant
  const currentThoughts = AUDIENCE_THOUGHTS[thoughtKey] || AUDIENCE_THOUGHTS.wander;

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under fake audience member - glows on hover/select */}
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
      <primitive object={clonedScene} scale={AUDIENCE_MODEL_SCALE} />

      {/* Conversation speech bubble - highest priority */}
      {(() => {
        const convo = entityConversations.get(entityId);
        if (convo?.currentLine) {
          return <SpeechBubble text={convo.currentLine} yOffset={3.5} variant="conversation" />;
        }
        return null;
      })()}

      {/* Thinking bubble - shown on hover/selection, only if not in conversation */}
      {!entityConversations.has(entityId) && (isHovered || isSelected) && (
        <ThinkingBubble thoughts={currentThoughts} yOffset={3.5} />
      )}
    </group>
  );
};

/**
 * FakeAudience - Group of decorative audience members.
 *
 * Renders one AudienceMember per AUDIENCE_POSITIONS entry. Each member
 * independently manages its own plan-based behavior through the
 * useAgentPlan hook. Performer detection uses both the stagePerformerRef
 * (for agent performers) and NPC position proximity (for NPCs like Sundar
 * presenting on stage).
 */
export const FakeAudience: React.FC = () => {
  const { zones, npcPositions, stagePerformerRef } = useFactory();

  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;

  /**
   * Synchronize stagePerformerRef with NPC proximity detection.
   * If no agent performer is on stage but an NPC is near the stage,
   * set the stagePerformerRef so audience members react to it.
   * This runs every frame via a lightweight check.
   */
  const npcStageCheckRef = useRef<string | null>(null);

  useFrame(() => {
    // Only check NPC proximity if no agent is already performing
    if (stagePerformerRef.current) {
      npcStageCheckRef.current = null;
      return;
    }

    let npcPerformer: string | null = null;
    for (const [id, pos] of npcPositions) {
      const dx = pos.x - stagePos.x;
      const dz = pos.z - stagePos.z;
      if (Math.sqrt(dx * dx + dz * dz) < NPC_STAGE_THRESHOLD) {
        npcPerformer = id;
        break;
      }
    }

    // Update stagePerformerRef when NPC stage presence changes
    if (npcPerformer && !npcStageCheckRef.current) {
      stagePerformerRef.current = npcPerformer;
    } else if (!npcPerformer && npcStageCheckRef.current) {
      // Only clear if we were the ones who set it
      if (stagePerformerRef.current === npcStageCheckRef.current) {
        stagePerformerRef.current = null;
      }
    }
    npcStageCheckRef.current = npcPerformer;
  });

  // Compute all obstacles for collision
  const allObstacles = useMemo<Obstacle[]>(() => {
    return [...STATIC_OBSTACLES, ...getWorkstationObstacles(zones)];
  }, [zones]);

  // Audience positions from constants
  const audiencePositions = STAGE.AUDIENCE_POSITIONS;

  // Alternate between cow and horse models for variety
  const models = [MODEL_PATHS.COW, MODEL_PATHS.HORSE];

  return (
    <group>
      {audiencePositions.map((pos, index) => (
        <AudienceMember
          key={`fake-audience-${index}`}
          audiencePosition={pos}
          modelPath={models[index % models.length]}
          index={index}
          allObstacles={allObstacles}
        />
      ))}
    </group>
  );
};

export default FakeAudience;
