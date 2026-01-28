/**
 * SteveJobsNPC - Steve Jobs NPC character that wanders around the factory.
 *
 * This NPC walks around checking on agents' work, watches performers on stage,
 * visits the kitchen, sits on the couch, and occasionally wanders randomly.
 * Uses the plan-based multi-step behavior system with conversation interrupts
 * and stage reaction support.
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
import { ThinkingBubble, STEVE_JOBS_THOUGHTS } from './ThinkingBubble';
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
import { STEVE_JOBS_WEIGHTS, PlanStep, PlanStepType, OUTDOOR_STEP_TYPES } from './agentPlanTypes';
import { getRandomDuration } from './planGenerator';

// Preload the Steve Jobs model
useGLTF.preload(MODEL_PATHS.STEVE_JOBS);

/** Fixed scale for NPC models */
const NPC_MODEL_SCALE = 3.6;

/**
 * Animation names available in the Steve Jobs model
 */
const STEVE_ANIMATIONS = {
  WALKING: 'Walking',
  CLAPPING: 'Clapping',
  STANDING_CLAP: 'Standing Clap',
} as const;

/**
 * Map from PlanStepType to Steve Jobs ThinkingBubble thought category key.
 * These keys correspond to the STEVE_JOBS_THOUGHTS record in ThinkingBubble.
 */
const STEP_TYPE_TO_THOUGHT_KEY: Partial<Record<PlanStepType, string>> = {
  wander: 'wandering',
  go_to_couch: 'resting',
  go_to_kitchen: 'visiting_kitchen',
  go_to_break_room: 'visiting_kitchen',
  go_to_poker_table: 'wandering',
  watch_stage: 'watching_stage',
  check_agent: 'checking_agent',
  go_to_pickleball: 'wandering',
  go_to_golf: 'wandering',
  sit_outdoor: 'resting',
};

/**
 * Walking state tracking for NPC movement management
 */
interface NPCWalkingState {
  /** Current position in world space */
  currentPos: { x: number; z: number };
  /** Whether position has been initialized */
  initialized: boolean;
  /** Whether the NPC has arrived at the current step's target */
  arrived: boolean;
  /** Seat area key for the current seat claim (for releasing on step change) */
  claimedSeatArea: string | null;
  /** Couch rotation saved from the claimed couch seat */
  couchRotation: number;
  /** The last stage performer ID we reacted to (to avoid repeated reactions) */
  lastStagePerformerId: string | null;
}

/**
 * Fade out all animations and play the target animation with crossfade.
 *
 * @param actions - All animation actions from useAnimations
 * @param targetAnim - The animation name to transition to
 * @param fadeOutDuration - Duration for fading out current animations
 * @param fadeInDuration - Duration for fading in the target animation
 */
function crossfadeToAnimation(
  actions: Record<string, THREE.AnimationAction | null> | undefined,
  targetAnim: string,
  fadeOutDuration: number = 0.3,
  fadeInDuration: number = 0.3
): void {
  if (!actions) return;
  const targetAction = actions[targetAnim];
  if (!targetAction) return;
  if (targetAction.isRunning()) return;

  Object.values(actions).forEach(action => action?.fadeOut(fadeOutDuration));
  targetAction.reset().fadeIn(fadeInDuration).play();
}

/**
 * SteveJobsNPC - Wandering NPC that supervises the factory.
 *
 * Uses the plan-based behavior system to generate multi-step plans
 * (check agents, visit kitchen, sit on couch, watch stage, wander).
 * Supports conversation interrupts and stage performance reactions.
 */
export const SteveJobsNPC: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  // Walking state - persists across frames without causing re-renders
  const walkStateRef = useRef<NPCWalkingState>({
    currentPos: { x: 0, z: 0 },
    initialized: false,
    arrived: false,
    claimedSeatArea: null,
    couchRotation: 0,
    lastStagePerformerId: null,
  });

  // Track whether plan was paused by a conversation
  const wasPausedRef = useRef(false);

  // Track seated state for stool rendering (only triggers re-render on change)
  const [isSeated, setIsSeated] = useState(false);

  // Load Steve Jobs model
  const gltf = useGLTF(MODEL_PATHS.STEVE_JOBS);

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
    const idleAction = actions?.[STEVE_ANIMATIONS.STANDING_CLAP];
    if (idleAction) {
      idleAction.reset().play();
    }
  }, [actions, gltf.animations]);

  // Get factory context - use new seat/stage API
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

  const NPC_ID = FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS;
  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(NPC_ID);

  // Plan-based behavior system
  const plan = useAgentPlan(NPC_ID, STEVE_JOBS_WEIGHTS);

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
  const breakRoomPos = FACTORY_CONSTANTS.BREAK_ROOM.POSITION;
  const pokerTablePos = FACTORY_CONSTANTS.POKER_TABLE.POSITION;
  const pickleballPos = FACTORY_CONSTANTS.PICKLEBALL.POSITION;
  const golfPos = FACTORY_CONSTANTS.GOLF.POSITION;
  const outdoorBenchPositions = FACTORY_CONSTANTS.OUTDOOR_BENCH.POSITIONS;

  // Circle indicator styling from shared utility
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, 0x44aa44);

  // Cleanup on unmount - release any seats
  useEffect(() => {
    return () => {
      disposeScene(clonedScene);
      const ws = walkStateRef.current;
      if (ws.claimedSeatArea) {
        releaseSeat(ws.claimedSeatArea, NPC_ID);
      }
    };
  }, [clonedScene, NPC_ID, releaseSeat]);

  /**
   * Compute target position for a plan step.
   * Claims seats as needed and returns the target coordinates plus arrival info.
   *
   * @param step - The current plan step to compute a target for
   * @param walkState - Mutable walking state for tracking claims
   * @returns Target position and arrival metadata, or null if step cannot be executed
   */
  const computeStepTarget = (
    step: PlanStep,
    walkState: NPCWalkingState
  ): { x: number; z: number; arrivalY: number; arrivalAnim: string; arrivalRot?: number } | null => {
    switch (step.type) {
      case 'check_agent': {
        // Pick a random active agent to check on
        const agentList = Array.from(agents.values());
        const activeAgents = agentList.filter(a => a.status === 'active');
        if (activeAgents.length === 0) return null;

        const randomAgent = activeAgents[Math.floor(Math.random() * activeAgents.length)];
        // Stand 3 units away from the agent (outside workstation obstacle)
        const targetX = randomAgent.basePosition.x + 3.0;
        const targetZ = randomAgent.basePosition.z + 3.0;

        // Validate target is clear; if not, use safe position fallback
        const safe = getSafePosition(targetX, targetZ, walkState.currentPos.x, walkState.currentPos.z, allObstacles);
        return {
          x: safe.x,
          z: safe.z,
          arrivalY: 0,
          arrivalAnim: STEVE_ANIMATIONS.CLAPPING,
        };
      }

      case 'watch_stage': {
        const positions = audiencePositions;
        const pos = positions[Math.floor(Math.random() * positions.length)];
        const toStage = Math.atan2(stagePos.x - pos.x, stagePos.z - pos.z);
        return {
          x: pos.x,
          z: pos.z,
          arrivalY: 0,
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
          arrivalRot: toStage,
        };
      }

      case 'go_to_kitchen': {
        const seatIdx = claimSeat('kitchen', NPC_ID);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'kitchen';
        const seatPositions = FACTORY_CONSTANTS.KITCHEN.SEAT_POSITIONS;
        const seat = seatPositions[seatIdx % seatPositions.length];
        const toCounter = Math.atan2(
          kitchenPos.x - (kitchenPos.x + seat.x),
          kitchenPos.z - (kitchenPos.z + seat.z)
        );
        return {
          x: kitchenPos.x + seat.x,
          z: kitchenPos.z + seat.z,
          arrivalY: 0,
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
          arrivalRot: toCounter,
        };
      }

      case 'go_to_couch': {
        const seatIdx = claimSeat('couch', NPC_ID);
        if (seatIdx < 0 || !couchPositions[seatIdx]) return null;
        walkState.claimedSeatArea = 'couch';
        const couch = couchPositions[seatIdx];
        walkState.couchRotation = couch.rotation;
        return {
          x: loungePos.x + couch.x,
          z: loungePos.z + couch.z,
          arrivalY: FACTORY_CONSTANTS.MOVEMENT.COUCH_SEAT_HEIGHT,
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
          arrivalRot: couch.rotation,
        };
      }

      case 'go_to_break_room': {
        const seatIdx = claimSeat('break_room', NPC_ID);
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
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
          arrivalRot: faceAngle,
        };
      }

      case 'go_to_poker_table': {
        const seatIdx = claimSeat('poker_table', NPC_ID);
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
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
          arrivalRot: faceAngle,
        };
      }

      case 'go_to_pickleball': {
        const px = pickleballPos.x + (Math.random() - 0.5) * 6;
        const pz = pickleballPos.z + (Math.random() - 0.5) * 8;
        return { x: px, z: pz, arrivalY: 0, arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP };
      }

      case 'go_to_golf': {
        const gx = golfPos.x + (Math.random() - 0.5) * 6;
        const gz = golfPos.z + (Math.random() - 0.5) * 6;
        return { x: gx, z: gz, arrivalY: 0, arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP };
      }

      case 'sit_outdoor': {
        const bench = outdoorBenchPositions[Math.floor(Math.random() * outdoorBenchPositions.length)];
        return {
          x: bench.x,
          z: bench.z,
          arrivalY: 0,
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
          arrivalRot: bench.rotation,
        };
      }

      case 'wander':
      default: {
        const wanderTarget = getRandomClearPosition(allObstacles);
        return {
          x: wanderTarget.x,
          z: wanderTarget.z,
          arrivalY: 0,
          arrivalAnim: STEVE_ANIMATIONS.STANDING_CLAP,
        };
      }
    }
  };

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Update animation mixer
    mixer?.update(delta);

    const walkState = walkStateRef.current;
    const elapsed = state.clock.elapsedTime;

    // Pause on hover - freeze movement and play idle animation (skip if selected in boss mode)
    if (isHovered && !isSelected) {
      crossfadeToAnimation(actions, STEVE_ANIMATIONS.STANDING_CLAP);
      // Still apply position and report
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(NPC_ID, groupRef.current.position);
      return;
    }

    // Initialize position at a clear spot
    if (!walkState.initialized) {
      const start = getRandomClearPosition(allObstacles, 10, 10, 0, 5);
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
      crossfadeToAnimation(actions, STEVE_ANIMATIONS.STANDING_CLAP);
    } else if (!inConversation && wasPausedRef.current) {
      plan.resume();
      wasPausedRef.current = false;
      walkState.arrived = false; // Re-approach target after conversation
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

    // --- Stage reaction: 60% chance to insert watch_stage when performer appears ---
    const currentPerformer = stagePerformerRef.current;
    if (currentPerformer && currentPerformer !== walkState.lastStagePerformerId) {
      walkState.lastStagePerformerId = currentPerformer;
      if (!isCommanded && Math.random() < 0.6) {
        // Release any current seat claim before interrupting
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, NPC_ID);
          walkState.claimedSeatArea = null;
        }
        plan.interruptForStage();
        walkState.arrived = false;
      }
    } else if (!currentPerformer) {
      walkState.lastStagePerformerId = null;
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

    // --- Compute target if not set ---
    if (!step.target) {
      const target = computeStepTarget(step, walkState);
      if (!target) {
        // Cannot execute this step (e.g., area full) - skip it
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
      step.arrivalY = target.arrivalY;
      step.arrivalAnimation = target.arrivalAnim;
      step.arrivalRotation = target.arrivalRot;
    }

    // --- Move toward target ---
    const dx = step.target.x - walkState.currentPos.x;
    const dz = step.target.z - walkState.currentPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (!walkState.arrived && distance > 0.5) {
      // Walking to target
      setIsSeated(false);
      const speed = 2.5;
      const moveAmount = Math.min(speed * delta, distance);
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

      // If stuck (position barely changed), abandon step and advance
      if (Math.abs(safeX - oldX) < 0.01 &&
          Math.abs(safeZ - oldZ) < 0.01 &&
          distance > 2) {
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
      crossfadeToAnimation(actions, STEVE_ANIMATIONS.WALKING);
    } else if (!walkState.arrived) {
      // Just arrived at target
      walkState.arrived = true;
      setIsSeated(true);
      plan.markArrival(elapsed);

      // Play arrival animation
      if (step.arrivalAnimation) {
        crossfadeToAnimation(actions, step.arrivalAnimation);
      }
      // Set arrival rotation
      if (step.arrivalRotation !== undefined) {
        groupRef.current.rotation.y = step.arrivalRotation;
      }
      // Set arrival Y (e.g., couch seat height)
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
        // Release seat claim
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, NPC_ID);
          walkState.claimedSeatArea = null;
        }

        // Reset Y to ground before moving to next step
        groupRef.current.position.y = 0;
        setIsSeated(false);

        plan.advanceStep();
        walkState.arrived = false;
      }
    }

    // Apply position
    groupRef.current.position.x = walkState.currentPos.x;
    if (walkState.arrived && step.arrivalY !== undefined) {
      groupRef.current.position.y = step.arrivalY;
    }
    groupRef.current.position.z = walkState.currentPos.z;

    // Report position to context for boss mode tracking
    updateNpcPosition(NPC_ID, groupRef.current.position);
  });

  // Get thoughts based on current plan step type
  const thoughtKey = plan.displayStepType
    ? STEP_TYPE_TO_THOUGHT_KEY[plan.displayStepType] ?? 'wandering'
    : 'wandering';

  const currentThoughts = useMemo(() => {
    return STEVE_JOBS_THOUGHTS[thoughtKey] || STEVE_JOBS_THOUGHTS.wandering;
  }, [thoughtKey]);

  // Show stool when seated at locations without existing furniture
  const FURNITURE_STEPS = new Set(['go_to_couch', 'go_to_break_room', 'go_to_poker_table']);
  const showStool = isSeated && plan.displayStepType && !FURNITURE_STEPS.has(plan.displayStepType);

  return (
    <group
      ref={groupRef}
      position={[0, 0, 5]}
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

      {/* Portable stool - appears under Steve when idle at locations without furniture */}
      {showStool && (
        <group position={[0, 0, 0]}>
          {/* Seat cushion */}
          <mesh position={[0, 1.2, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.08, 16]} />
            <meshStandardMaterial color={0x333333} roughness={0.7} />
          </mesh>
          {/* Cushion top */}
          <mesh position={[0, 1.25, 0]}>
            <cylinderGeometry args={[0.38, 0.38, 0.04, 16]} />
            <meshStandardMaterial color={0x1a1a1a} roughness={0.8} />
          </mesh>
          {/* Center pole */}
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 1.15, 8]} />
            <meshStandardMaterial color={0x888888} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Base ring */}
          <mesh position={[0, 0.04, 0]}>
            <torusGeometry args={[0.35, 0.03, 8, 16]} />
            <meshStandardMaterial color={0x888888} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Footrest ring */}
          <mesh position={[0, 0.5, 0]}>
            <torusGeometry args={[0.28, 0.025, 8, 16]} />
            <meshStandardMaterial color={0x888888} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

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
