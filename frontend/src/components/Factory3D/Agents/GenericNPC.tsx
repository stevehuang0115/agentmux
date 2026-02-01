/**
 * GenericNPC - Shared configurable NPC component with plan-based behavior.
 *
 * Provides the full wandering NPC experience (walking, collision avoidance,
 * conversation interrupts, stage reactions, thinking/speech bubbles) driven
 * by configurable personality weights, animations, and thoughts.
 *
 * Used by all character-specific NPC wrapper components (ElonMuskNPC, etc.).
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
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
import { PersonalityWeights, PlanStep, PlanStepType, OUTDOOR_STEP_TYPES } from './agentPlanTypes';
import { getRandomDuration } from './planGenerator';

/** Fixed scale for NPC models */
const DEFAULT_NPC_SCALE = 3.6;

/** Walking speed for the NPC (units per second) */
const NPC_WALK_SPEED = 2.0;

/** Distance threshold to consider the NPC "arrived" at its target */
const ARRIVAL_THRESHOLD = 0.5;

/** Animation crossfade duration in seconds */
const CROSSFADE_DURATION = 0.3;

/** Probability that the NPC will interrupt its plan to watch a stage performer */
const STAGE_REACTION_PROBABILITY = 0.6;

/**
 * Standard mapping from plan step types to thought category keys.
 */
const STEP_TYPE_TO_THOUGHT_KEY: Partial<Record<PlanStepType, string>> = {
  wander: 'wandering',
  check_agent: 'talking_to_agent',
  present: 'presenting',
  go_to_kitchen: 'visiting_kitchen',
  go_to_couch: 'wandering',
  go_to_break_room: 'wandering',
  go_to_poker_table: 'wandering',
  watch_stage: 'watching_stage',
  go_to_pickleball: 'wandering',
  go_to_golf: 'playing_golf',
  sit_outdoor: 'wandering',
};

/**
 * Internal walking state tracked across frames via ref (no re-renders).
 */
interface NPCWalkingState {
  currentPos: { x: number; z: number };
  initialized: boolean;
  arrived: boolean;
  currentAnim: string;
  claimedSeatArea: string | null;
  lastStagePerformerId: string | null;
}

/**
 * Crossfade to a target animation, fading out all others.
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
 * Configuration props for the GenericNPC component
 */
export interface GenericNPCProps {
  /** Path to the GLB model */
  modelPath: string;
  /** Unique NPC entity ID (from FACTORY_CONSTANTS.NPC_IDS) */
  npcId: string;
  /** Name of the walking animation clip in the model */
  walkingAnimation: string;
  /** Name of the idle/arrival animation clip in the model */
  idleAnimation: string;
  /** Personality weights for plan generation */
  weights: PersonalityWeights;
  /** Thought categories for ThinkingBubble (keyed by thought category) */
  thoughts: Record<string, string[]>;
  /** Initial spawn position */
  initialPosition: { x: number; z: number };
  /** Circle indicator color (default: 0x44aa44) */
  circleColor?: number;
  /** Model scale (default: 3.6) */
  scale?: number;
  /** Y offset to raise the model so feet touch the ground (default: 0) */
  modelYOffset?: number;
  /** Speech/thinking bubble Y offset (default: 6.0) */
  bubbleYOffset?: number;
  /** Animation to play for the walk_circle step type (defaults to idleAnimation) */
  walkCircleAnimation?: string;
}

/**
 * GenericNPC - Configurable wandering NPC with plan-based multi-step behavior.
 *
 * Supports all standard NPC behaviors: walking to targets, checking agents,
 * visiting kitchen/lounge/break room, watching stage, outdoor activities,
 * conversation interrupts, and stage performance reactions.
 */
export const GenericNPC: React.FC<GenericNPCProps> = ({
  modelPath,
  npcId,
  walkingAnimation,
  idleAnimation,
  weights,
  thoughts,
  initialPosition,
  circleColor = 0x44aa44,
  scale = DEFAULT_NPC_SCALE,
  modelYOffset = 0,
  bubbleYOffset = 6.0,
  walkCircleAnimation,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const walkingStateRef = useRef<NPCWalkingState>({
    currentPos: { x: initialPosition.x, z: initialPosition.z },
    initialized: false,
    arrived: false,
    currentAnim: '',
    claimedSeatArea: null,
    lastStagePerformerId: null,
  });

  const wasPausedRef = useRef(false);

  // Load model
  const gltf = useGLTF(modelPath);

  // Clone scene with fixed materials
  const clonedScene = useMemo(() => cloneAndFixMaterials(gltf.scene), [gltf.scene]);

  // Remove root motion (Hips position) to prevent world-space drift
  const processedAnimations = useMemo(
    () => removeRootMotion(gltf.animations),
    [gltf.animations]
  );

  // Compute XZ offset to counteract Armature rotation mapping Hips rest position
  // into the XZ plane. Only needed for models whose origin is at the hips rather
  // than the feet (indicated by modelYOffset > 0). These models have a 90° X
  // Armature rotation (Blender Z-up → Three.js Y-up) that maps the Hips rest
  // position into the XZ plane, causing ~2 unit drift from the group origin.
  const primitiveOffset = useMemo(() => {
    // Only models with a Y offset need this compensation
    if (modelYOffset === 0) return [0, 0, 0] as [number, number, number];

    const armature = clonedScene.children[0];
    if (!armature) return [0, 0, 0] as [number, number, number];

    const hipsBone = armature.children.find(
      (c: THREE.Object3D) => c.name.includes('Hips')
    );
    if (!hipsBone) return [0, 0, 0] as [number, number, number];

    // Apply the Armature's rotation to the Hips rest position
    const rotatedHips = hipsBone.position.clone().applyQuaternion(armature.quaternion);
    // Negate the XZ components (scaled) to keep the model centered on the group origin
    return [
      -rotatedHips.x * scale,
      0,
      -rotatedHips.z * scale,
    ] as [number, number, number];
  }, [clonedScene, scale, modelYOffset]);

  // Setup animations
  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Start with idle animation to avoid T-pose
  useEffect(() => {
    const idleAction = actions?.[idleAnimation];
    if (idleAction) {
      idleAction.reset().play();
    }
  }, [actions, idleAnimation]);

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
    entityPositionMapRef,
  } = useFactory();

  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(npcId);

  // Plan-based behavior system
  const plan = useAgentPlan(npcId, weights);

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

  // Circle indicator styling
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, circleColor);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposeScene(clonedScene);
      const ws = walkingStateRef.current;
      if (ws.claimedSeatArea) {
        releaseSeat(ws.claimedSeatArea, npcId);
      }
    };
  }, [clonedScene, npcId, releaseSeat]);

  /**
   * Compute target position for a given plan step.
   */
  const computeStepTarget = (
    step: PlanStep,
    walkState: NPCWalkingState
  ): { x: number; z: number; arrivalAnim: string; arrivalRot?: number } | null => {
    switch (step.type) {
      case 'check_agent': {
        const agentList = Array.from(agents.values());
        if (agentList.length === 0) return null;
        const randomAgent = agentList[Math.floor(Math.random() * agentList.length)];
        const targetX = randomAgent.basePosition.x + 3.0;
        const targetZ = randomAgent.basePosition.z + 3.0;
        const safe = getSafePosition(targetX, targetZ, walkState.currentPos.x, walkState.currentPos.z, allObstacles);
        return { x: safe.x, z: safe.z, arrivalAnim: idleAnimation };
      }

      case 'present': {
        return {
          x: stagePos.x - 2,
          z: stagePos.z,
          arrivalAnim: idleAnimation,
          arrivalRot: -Math.PI / 2,
        };
      }

      case 'walk_circle': {
        return {
          x: 0,
          z: 0,
          arrivalAnim: walkCircleAnimation || idleAnimation,
        };
      }

      case 'go_to_kitchen': {
        const seatIdx = claimSeat('kitchen', npcId);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'kitchen';
        const seatPositions = FACTORY_CONSTANTS.KITCHEN.SEAT_POSITIONS;
        const seat = seatPositions[seatIdx % seatPositions.length];
        return {
          x: kitchenPos.x + seat.x,
          z: kitchenPos.z + seat.z,
          arrivalAnim: idleAnimation,
          arrivalRot: seat.rotation,
        };
      }

      case 'watch_stage': {
        const positions = FACTORY_CONSTANTS.STAGE.AUDIENCE_POSITIONS;
        const pos = positions[Math.floor(Math.random() * positions.length)];
        return {
          x: pos.x,
          z: pos.z,
          arrivalAnim: idleAnimation,
          arrivalRot: Math.PI / 2,
        };
      }

      case 'go_to_pickleball': {
        const px = pickleballPos.x + (Math.random() - 0.5) * 6;
        const pz = pickleballPos.z + (Math.random() - 0.5) * 8;
        return { x: px, z: pz, arrivalAnim: idleAnimation };
      }

      case 'go_to_golf': {
        const gx = golfPos.x + (Math.random() - 0.5) * 6;
        const gz = golfPos.z + (Math.random() - 0.5) * 6;
        return { x: gx, z: gz, arrivalAnim: idleAnimation };
      }

      case 'sit_outdoor': {
        const bench = outdoorBenchPositions[Math.floor(Math.random() * outdoorBenchPositions.length)];
        return {
          x: bench.x,
          z: bench.z,
          arrivalAnim: idleAnimation,
          arrivalRot: bench.rotation,
        };
      }

      case 'go_to_couch': {
        const seatIdx = claimSeat('couch', npcId);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'couch';
        const couchPositions = FACTORY_CONSTANTS.LOUNGE.COUCH_POSITIONS;
        const couch = couchPositions[seatIdx % couchPositions.length];
        const loungePos = FACTORY_CONSTANTS.LOUNGE.POSITION;
        return {
          x: loungePos.x + couch.x,
          z: loungePos.z + couch.z,
          arrivalAnim: idleAnimation,
          arrivalRot: couch.rotation,
        };
      }

      case 'go_to_break_room': {
        const seatIdx = claimSeat('break_room', npcId);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'break_room';
        const breakRoomPos = FACTORY_CONSTANTS.BREAK_ROOM.POSITION;
        const seatAngle = (seatIdx * Math.PI) / 2;
        const targetX = breakRoomPos.x + Math.sin(seatAngle) * 1.3;
        const targetZ = breakRoomPos.z + Math.cos(seatAngle) * 1.3;
        const faceAngle = Math.atan2(breakRoomPos.x - targetX, breakRoomPos.z - targetZ);
        return { x: targetX, z: targetZ, arrivalAnim: idleAnimation, arrivalRot: faceAngle };
      }

      case 'go_to_poker_table': {
        const seatIdx = claimSeat('poker_table', npcId);
        if (seatIdx < 0) return null;
        walkState.claimedSeatArea = 'poker_table';
        const pokerTablePos = FACTORY_CONSTANTS.POKER_TABLE.POSITION;
        const seatAngle = (seatIdx * Math.PI) / 2;
        const targetX = pokerTablePos.x + Math.sin(seatAngle) * 1.8;
        const targetZ = pokerTablePos.z + Math.cos(seatAngle) * 1.8;
        const faceAngle = Math.atan2(pokerTablePos.x - targetX, pokerTablePos.z - targetZ);
        return { x: targetX, z: targetZ, arrivalAnim: idleAnimation, arrivalRot: faceAngle };
      }

      // Note: go_to_stage is intentionally omitted — all NPC weight profiles set stage: 0.
      // BaseAgent handles stage claiming for worker agents.

      case 'wander':
      default: {
        const wanderTarget = getRandomClearPosition(allObstacles);
        return { x: wanderTarget.x, z: wanderTarget.z, arrivalAnim: idleAnimation };
      }
    }
  };

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    mixer?.update(delta);

    const walkState = walkingStateRef.current;
    const elapsed = state.clock.elapsedTime;

    // Pause on hover
    if (isHovered && !isSelected) {
      transitionToAnimation(actions, idleAnimation, walkState);
      groupRef.current.position.x = walkState.currentPos.x;
      groupRef.current.position.y = modelYOffset;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(npcId, groupRef.current.position);
      return;
    }

    // Initialize position at a clear spot
    if (!walkState.initialized) {
      walkState.currentPos = { x: initialPosition.x, z: initialPosition.z };
      groupRef.current.position.set(initialPosition.x, modelYOffset, initialPosition.z);
      walkState.initialized = true;
    }

    // Check for external commands from EntityActionPanel
    const command = consumeEntityCommand(npcId);
    if (command) {
      if (walkState.claimedSeatArea) {
        releaseSeat(walkState.claimedSeatArea, npcId);
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
      groupRef.current.position.y = modelYOffset;
    }

    const isCommanded = plan.planRef.current?.commanded ?? false;

    // Conversation interrupt handling
    const inConversation = entityConversations.has(npcId);
    if (inConversation && !plan.isPaused() && !isCommanded) {
      plan.pause();
      wasPausedRef.current = true;
      transitionToAnimation(actions, idleAnimation, walkState);
    } else if (!inConversation && wasPausedRef.current) {
      plan.resume();
      wasPausedRef.current = false;
      walkState.arrived = false;
    }

    // If paused (in conversation), idle and face partner
    if (plan.isPaused()) {
      const convo = entityConversations.get(npcId);
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
      groupRef.current.position.y = modelYOffset;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(npcId, groupRef.current.position);
      return;
    }

    // Stage reaction: interrupt plan when a new performer appears
    const currentPerformer = stagePerformerRef.current;
    if (
      currentPerformer !== null &&
      currentPerformer !== walkState.lastStagePerformerId &&
      currentPerformer !== npcId
    ) {
      walkState.lastStagePerformerId = currentPerformer;
      if (!isCommanded && Math.random() < STAGE_REACTION_PROBABILITY) {
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, npcId);
          walkState.claimedSeatArea = null;
        }
        plan.interruptForStage();
        walkState.arrived = false;
      }
    } else if (currentPerformer === null && walkState.lastStagePerformerId !== null) {
      walkState.lastStagePerformerId = null;
      const currentStep = plan.getCurrentStep();
      if (!isCommanded && currentStep?.type === 'watch_stage') {
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
      groupRef.current.position.y = modelYOffset;
      groupRef.current.position.z = walkState.currentPos.z;
      updateNpcPosition(npcId, groupRef.current.position);
      return;
    }

    // Compute target if not yet set
    if (!step.target) {
      const target = computeStepTarget(step, walkState);
      if (!target) {
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, npcId);
          walkState.claimedSeatArea = null;
        }
        plan.advanceStep();
        walkState.arrived = false;
        groupRef.current.position.x = walkState.currentPos.x;
        groupRef.current.position.y = modelYOffset;
        groupRef.current.position.z = walkState.currentPos.z;
        updateNpcPosition(npcId, groupRef.current.position);
        return;
      }
      step.target = { x: target.x, z: target.z };
      step.arrivalAnimation = target.arrivalAnim;
      step.arrivalRotation = target.arrivalRot;
    }

    // Move toward target
    const dx = step.target.x - walkState.currentPos.x;
    const dz = step.target.z - walkState.currentPos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (!walkState.arrived && distance > ARRIVAL_THRESHOLD) {
      const moveAmount = Math.min(NPC_WALK_SPEED * delta, distance);
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
      if (isBlockedByEntity(safeX, safeZ, npcId, entityPositionMapRef.current)) {
        safeX = oldX;
        safeZ = oldZ;
      }

      walkState.currentPos.x = safeX;
      walkState.currentPos.z = safeZ;

      // If stuck, skip to next step
      if (
        Math.abs(safeX - oldX) < 0.01 &&
        Math.abs(safeZ - oldZ) < 0.01 &&
        distance > 2
      ) {
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, npcId);
          walkState.claimedSeatArea = null;
        }
        plan.advanceStep();
        walkState.arrived = false;
      }

      // Face movement direction
      rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

      // Play walking animation
      transitionToAnimation(actions, walkingAnimation, walkState);
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
    } else {
      // At destination, waiting for duration
      if (step.arrivalRotation !== undefined) {
        rotateTowards(groupRef.current, step.arrivalRotation, delta, 3);
      }

      if (plan.isDurationElapsed(elapsed)) {
        if (walkState.claimedSeatArea) {
          releaseSeat(walkState.claimedSeatArea, npcId);
          walkState.claimedSeatArea = null;
        }
        plan.advanceStep();
        walkState.arrived = false;
      }
    }

    // Apply position
    groupRef.current.position.x = walkState.currentPos.x;
    groupRef.current.position.y = modelYOffset;
    groupRef.current.position.z = walkState.currentPos.z;

    updateNpcPosition(npcId, groupRef.current.position);
  });

  // Get thought key for ThinkingBubble
  const thoughtKey = plan.displayStepType
    ? STEP_TYPE_TO_THOUGHT_KEY[plan.displayStepType] ?? 'wandering'
    : 'wandering';

  return (
    <group
      ref={groupRef}
      position={[initialPosition.x, modelYOffset, initialPosition.z]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under NPC - offset down by modelYOffset to stay at ground level */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FACTORY_CONSTANTS.CIRCLE_INDICATOR.Y_OFFSET - modelYOffset, 0]}>
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

      <primitive object={clonedScene} scale={scale} position={primitiveOffset} />

      {/* Conversation speech bubble */}
      {(() => {
        const convo = entityConversations.get(npcId);
        if (convo?.currentLine) {
          return <SpeechBubble text={convo.currentLine} yOffset={bubbleYOffset} variant="conversation" />;
        }
        return null;
      })()}

      {/* Thinking bubble - shown on hover/selection */}
      {!entityConversations.has(npcId) && (isHovered || isSelected) && (
        <ThinkingBubble
          thoughts={thoughts[thoughtKey] || thoughts.wandering}
          yOffset={bubbleYOffset}
        />
      )}
    </group>
  );
};

export default GenericNPC;
