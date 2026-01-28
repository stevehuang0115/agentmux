/**
 * SundarPichaiNPC - Sundar Pichai NPC character that wanders around the factory.
 *
 * This NPC walks around talking to agents, giving presentations,
 * and generally managing the factory floor. Uses the plan-based
 * behavior system for multi-step decision making with conversation
 * interrupts and stage reaction support.
 */

import React, { useRef, useEffect, useMemo } from 'react';
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
import { SUNDAR_PICHAI_WEIGHTS, PlanStep, PlanStepType, OUTDOOR_STEP_TYPES } from './agentPlanTypes';
import { getRandomDuration } from './planGenerator';

// Preload the Sundar Pichai model
useGLTF.preload(MODEL_PATHS.SUNDAR_PICHAI);

/** Fixed scale for NPC models */
const NPC_MODEL_SCALE = 3.6;

/**
 * Animation names available in the Sundar Pichai model
 */
const SUNDAR_ANIMATIONS = {
  WALKING: 'Walking',
  TALKING: 'Talking',
  WALK_IN_CIRCLE: 'Walk In Circle',
} as const;

/** Walking speed for the NPC (units per second) */
const NPC_WALK_SPEED = 2.0;

/** Distance threshold to consider the NPC "arrived" at its target */
const ARRIVAL_THRESHOLD = 0.5;

/** Animation crossfade duration in seconds */
const CROSSFADE_DURATION = 0.3;

/** Probability that the NPC will interrupt its plan to watch a stage performer */
const STAGE_REACTION_PROBABILITY = 0.6;

/**
 * Maps plan step types to ThinkingBubble thought category keys.
 * These keys correspond to entries in SUNDAR_PICHAI_THOUGHTS.
 */
const STEP_TYPE_TO_THOUGHT_KEY: Partial<Record<PlanStepType, string>> = {
  wander: 'wandering',
  check_agent: 'talking_to_agent',
  present: 'presenting',
  walk_circle: 'walking_circle',
  go_to_kitchen: 'visiting_kitchen',
  go_to_couch: 'wandering',
  go_to_break_room: 'wandering',
  go_to_poker_table: 'wandering',
  watch_stage: 'wandering',
  go_to_pickleball: 'wandering',
  go_to_golf: 'wandering',
  sit_outdoor: 'wandering',
};

/**
 * Internal walking state tracked across frames via ref (no re-renders).
 */
interface NPCWalkingState {
  /** Current world position of the NPC */
  currentPos: { x: number; z: number };
  /** Whether the NPC has been positioned on first frame */
  initialized: boolean;
  /** Whether the NPC has arrived at the current step's target */
  arrived: boolean;
  /** Name of the currently playing animation (avoids redundant transitions) */
  currentAnim: string;
  /** The seat area key for the current claimed seat, if any */
  claimedSeatArea: string | null;
  /** ID of the last stage performer seen (to detect changes) */
  lastStagePerformerId: string | null;
}

/**
 * Crossfade to a target animation, fading out all others.
 * No-op if the target animation is already playing.
 *
 * @param actions - Animation actions map from useAnimations
 * @param targetAnim - Name of the animation to transition to
 * @param walkState - Walking state ref (tracks current animation name)
 */
function transitionToAnimation(
  actions: Record<string, THREE.AnimationAction | null> | undefined,
  targetAnim: string,
  walkState: NPCWalkingState
): void {
  if (!actions || walkState.currentAnim === targetAnim) return;
  const targetAction = actions[targetAnim];
  if (!targetAction) return;
  Object.values(actions).forEach((action) => action?.fadeOut(CROSSFADE_DURATION));
  targetAction.reset().fadeIn(CROSSFADE_DURATION).play();
  walkState.currentAnim = targetAnim;
}

/**
 * SundarPichaiNPC - Wandering NPC that manages the factory using
 * a plan-based multi-step behavior system.
 *
 * Behavior is driven by SUNDAR_PICHAI_WEIGHTS personality profile,
 * which favors check_agent and wander steps with occasional presentations
 * and kitchen visits. Conversations pause the plan, and stage events
 * may trigger a watch_stage interrupt.
 */
export const SundarPichaiNPC: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  // Walking state ref - persists across frames without re-renders
  const walkingStateRef = useRef<NPCWalkingState>({
    currentPos: { x: 10, z: 0 },
    initialized: false,
    arrived: false,
    currentAnim: '',
    claimedSeatArea: null,
    lastStagePerformerId: null,
  });

  // Track whether plan was paused by a conversation
  const wasPausedRef = useRef(false);

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
    npcPositions,
    updateNpcPosition,
    entityConversations,
    claimSeat,
    releaseSeat,
    getSeatOccupancy,
    isStageOccupied,
    stagePerformerRef,
    consumeEntityCommand,
  } = useFactory();

  const NPC_ID = FACTORY_CONSTANTS.NPC_IDS.SUNDAR_PICHAI;
  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(NPC_ID);

  // Plan-based behavior system
  const plan = useAgentPlan(NPC_ID, SUNDAR_PICHAI_WEIGHTS);

  // Compute all obstacles (static + workstations)
  const allObstacles = useMemo<Obstacle[]>(() => {
    return [...STATIC_OBSTACLES, ...getWorkstationObstacles(zones)];
  }, [zones]);

  // Get useful positions from constants
  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;
  const pickleballPos = FACTORY_CONSTANTS.PICKLEBALL.POSITION;
  const golfPos = FACTORY_CONSTANTS.GOLF.POSITION;
  const outdoorBenchPositions = FACTORY_CONSTANTS.OUTDOOR_BENCH.POSITIONS;

  // Circle indicator styling from shared utility
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, 0x44aa44);

  // Cleanup on unmount - release any seats
  useEffect(() => {
    return () => {
      disposeScene(clonedScene);
      const ws = walkingStateRef.current;
      if (ws.claimedSeatArea) {
        releaseSeat(ws.claimedSeatArea, NPC_ID);
      }
    };
  }, [clonedScene, NPC_ID, releaseSeat]);

  /**
   * Compute target position for a given plan step.
   * Claims seats for seated areas and returns position/animation/rotation data.
   *
   * @param step - The plan step to compute a target for
   * @param walkState - Current walking state (for seat tracking)
   * @returns Target info or null if step cannot be executed
   */
  const computeStepTarget = (
    step: PlanStep,
    walkState: NPCWalkingState
  ): { x: number; z: number; arrivalAnim: string; arrivalRot?: number } | null => {
    switch (step.type) {
      case 'check_agent': {
        // Pick a random agent and stand near their workstation
        const agentList = Array.from(agents.values());
        if (agentList.length === 0) return null;
        const randomAgent = agentList[Math.floor(Math.random() * agentList.length)];
        const targetX = randomAgent.basePosition.x + 3.0;
        const targetZ = randomAgent.basePosition.z + 3.0;
        const safe = getSafePosition(targetX, targetZ, walkState.currentPos.x, walkState.currentPos.z, allObstacles);
        return {
          x: safe.x,
          z: safe.z,
          arrivalAnim: SUNDAR_ANIMATIONS.TALKING,
        };
      }

      case 'present': {
        // Go to the stage area for a presentation
        return {
          x: stagePos.x - 2,
          z: stagePos.z,
          arrivalAnim: SUNDAR_ANIMATIONS.TALKING,
          arrivalRot: -Math.PI / 2,
        };
      }

      case 'walk_circle': {
        // Walk to center of factory for the walking circle animation
        return {
          x: 0,
          z: 0,
          arrivalAnim: SUNDAR_ANIMATIONS.WALK_IN_CIRCLE,
        };
      }

      case 'go_to_kitchen': {
        // Claim a kitchen seat
        const seatIdx = claimSeat('kitchen', NPC_ID);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'kitchen';
        const seatPositions = FACTORY_CONSTANTS.KITCHEN.SEAT_POSITIONS;
        const seat = seatPositions[seatIdx % seatPositions.length];
        return {
          x: kitchenPos.x + seat.x,
          z: kitchenPos.z + seat.z,
          arrivalAnim: SUNDAR_ANIMATIONS.TALKING,
          arrivalRot: seat.rotation,
        };
      }

      case 'watch_stage': {
        // Go to an audience position facing the stage
        const positions = FACTORY_CONSTANTS.STAGE.AUDIENCE_POSITIONS;
        const pos = positions[Math.floor(Math.random() * positions.length)];
        return {
          x: pos.x,
          z: pos.z,
          arrivalAnim: SUNDAR_ANIMATIONS.TALKING,
          arrivalRot: Math.PI / 2,
        };
      }

      case 'go_to_pickleball': {
        const px = pickleballPos.x + (Math.random() - 0.5) * 6;
        const pz = pickleballPos.z + (Math.random() - 0.5) * 8;
        return { x: px, z: pz, arrivalAnim: SUNDAR_ANIMATIONS.TALKING };
      }

      case 'go_to_golf': {
        const gx = golfPos.x + (Math.random() - 0.5) * 6;
        const gz = golfPos.z + (Math.random() - 0.5) * 6;
        return { x: gx, z: gz, arrivalAnim: SUNDAR_ANIMATIONS.TALKING };
      }

      case 'sit_outdoor': {
        const bench = outdoorBenchPositions[Math.floor(Math.random() * outdoorBenchPositions.length)];
        return {
          x: bench.x,
          z: bench.z,
          arrivalAnim: SUNDAR_ANIMATIONS.TALKING,
          arrivalRot: bench.rotation,
        };
      }

      case 'wander':
      default: {
        // Random wander to a clear position
        const wanderTarget = getRandomClearPosition(allObstacles);
        return {
          x: wanderTarget.x,
          z: wanderTarget.z,
          arrivalAnim: SUNDAR_ANIMATIONS.TALKING,
        };
      }
    }
  };

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Update animation mixer
    mixer?.update(delta);

    const walkState = walkingStateRef.current;
    const elapsed = state.clock.elapsedTime;

    // Pause on hover - freeze movement and play idle animation (skip if selected in boss mode)
    if (isHovered && !isSelected) {
      transitionToAnimation(actions, SUNDAR_ANIMATIONS.TALKING, walkState);
      // Still apply position and report
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(NPC_ID, groupRef.current.position);
      return;
    }

    // Initialize position at a clear spot
    if (!walkState.initialized) {
      const start = getRandomClearPosition(allObstacles, 10, 10, 10, 0);
      walkState.currentPos = { x: start.x, z: start.z };
      groupRef.current.position.set(start.x, 0, start.z);
      walkState.initialized = true;
    }

    // --- Check for external commands from EntityActionPanel ---
    const command = consumeEntityCommand(NPC_ID);
    if (command) {
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, NPC_ID);
        walkState.claimedSeatArea = null;
      }
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

    // Check commanded status once, used by stage reaction and conversation handlers
    const isCommanded = plan.planRef.current?.commanded ?? false;

    // --- Conversation interrupt handling ---
    const inConversation = entityConversations.has(NPC_ID);
    if (inConversation && !plan.isPaused() && !isCommanded) {
      plan.pause();
      wasPausedRef.current = true;
      transitionToAnimation(actions, SUNDAR_ANIMATIONS.TALKING, walkState);
    } else if (!inConversation && wasPausedRef.current) {
      plan.resume();
      wasPausedRef.current = false;
      walkState.arrived = false;
    }

    // If paused (in conversation), idle, face partner, and report position
    if (plan.isPaused()) {
      const convo = entityConversations.get(NPC_ID);
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
      updateNpcPosition(NPC_ID, groupRef.current.position);
      return;
    }

    // --- Stage reaction: interrupt plan when a new performer appears ---
    const currentPerformer = stagePerformerRef.current;
    if (
      currentPerformer !== null &&
      currentPerformer !== walkState.lastStagePerformerId &&
      currentPerformer !== NPC_ID
    ) {
      walkState.lastStagePerformerId = currentPerformer;
      if (!isCommanded && Math.random() < STAGE_REACTION_PROBABILITY) {
        // Release any current seat before interrupting
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, NPC_ID);
          walkState.claimedSeatArea = null;
        }
        plan.interruptForStage();
        walkState.arrived = false;
      }
    } else if (currentPerformer === null && walkState.lastStagePerformerId !== null) {
      // Performer left stage - restore saved plan if watching
      walkState.lastStagePerformerId = null;
      const currentStep = plan.getCurrentStep();
      if (!isCommanded && currentStep?.type === 'watch_stage') {
        // Restore previously saved plan or generate new one
        if (plan.savedPlanRef.current) {
          plan.planRef.current = plan.savedPlanRef.current;
          plan.savedPlanRef.current = null;
        } else {
          plan.newPlan({
            stageOccupied: isStageOccupied(),
            seatOccupancy: getSeatOccupancy(),
          });
        }
        walkState.arrived = false;
      }
    }

    // --- Initialize plan if needed ---
    if (!plan.planRef.current) {
      plan.newPlan({
        stageOccupied: isStageOccupied(),
        seatOccupancy: getSeatOccupancy(),
      });
      walkState.arrived = false;
    }

    // --- Get current step ---
    const step = plan.getCurrentStep();
    if (!step) {
      // Plan exhausted or empty - generate new one
      plan.newPlan({
        stageOccupied: isStageOccupied(),
        seatOccupancy: getSeatOccupancy(),
      });
      walkState.arrived = false;
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(NPC_ID, groupRef.current.position);
      return;
    }

    // --- Compute target if not yet set ---
    if (!step.target) {
      const target = computeStepTarget(step, walkState);
      if (!target) {
        // Cannot execute step (e.g., area full) - skip it
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, NPC_ID);
          walkState.claimedSeatArea = null;
        }
        plan.advanceStep();
        walkState.arrived = false;
        groupRef.current.position.x = walkState.currentPos.x;
        groupRef.current.position.y = 0;
        groupRef.current.position.z = walkState.currentPos.z;
        updateNpcPosition(NPC_ID, groupRef.current.position);
        return;
      }
      step.target = { x: target.x, z: target.z };
      step.arrivalAnimation = target.arrivalAnim;
      step.arrivalRotation = target.arrivalRot;
    }

    // --- Move toward target ---
    const dx = step.target.x - walkState.currentPos.x;
    const dz = step.target.z - walkState.currentPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (!walkState.arrived && distance > ARRIVAL_THRESHOLD) {
      // Walking to target
      const moveAmount = Math.min(NPC_WALK_SPEED * delta, distance);
      const newX = walkState.currentPos.x + (dx / distance) * moveAmount;
      const newZ = walkState.currentPos.z + (dz / distance) * moveAmount;

      // Collision check - skip wall clamping for outdoor step types
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
      walkState.currentPos.x = safeX;
      walkState.currentPos.z = safeZ;

      // If stuck (position barely changed), skip to next step
      if (
        Math.abs(safeX - oldX) < 0.01 &&
        Math.abs(safeZ - oldZ) < 0.01 &&
        distance > 2
      ) {
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, NPC_ID);
          walkState.claimedSeatArea = null;
        }
        plan.advanceStep();
        walkState.arrived = false;
      }

      // Face movement direction
      rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

      // Play walking animation
      transitionToAnimation(actions, SUNDAR_ANIMATIONS.WALKING, walkState);
    } else if (!walkState.arrived) {
      // Just arrived at target
      walkState.arrived = true;
      plan.markArrival(elapsed);

      // Play arrival animation
      if (step.arrivalAnimation) {
        transitionToAnimation(actions, step.arrivalAnimation, walkState);
      }
      // Apply arrival rotation
      if (step.arrivalRotation !== undefined) {
        groupRef.current.rotation.y = step.arrivalRotation;
      }
    } else {
      // At destination, waiting for duration to elapse
      if (step.arrivalRotation !== undefined) {
        rotateTowards(groupRef.current, step.arrivalRotation, delta, 3);
      }

      if (plan.isDurationElapsed(elapsed)) {
        // Release seat before advancing
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, NPC_ID);
          walkState.claimedSeatArea = null;
        }

        plan.advanceStep();
        walkState.arrived = false;
      }
    }

    // Apply position - keep feet on ground (y=0)
    groupRef.current.position.x = walkState.currentPos.x;
    groupRef.current.position.y = 0;
    groupRef.current.position.z = walkState.currentPos.z;

    // Report position to context for boss mode tracking
    updateNpcPosition(NPC_ID, groupRef.current.position);
  });

  // Get thought key for ThinkingBubble based on current plan step type
  const thoughtKey = plan.displayStepType
    ? STEP_TYPE_TO_THOUGHT_KEY[plan.displayStepType] ?? 'wandering'
    : 'wandering';

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
        <ThinkingBubble
          thoughts={SUNDAR_PICHAI_THOUGHTS[thoughtKey] || SUNDAR_PICHAI_THOUGHTS.wandering}
          yOffset={6.0}
        />
      )}
    </group>
  );
};

export default SundarPichaiNPC;
