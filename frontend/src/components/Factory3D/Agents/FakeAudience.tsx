/**
 * FakeAudience - Decorative audience agents that watch the stage or wander.
 *
 * When a performer is on stage, these characters gather at audience positions
 * and play idle animations. When no performer is present, they wander around
 * the factory floor randomly.
 */

import React, { useRef, useMemo, useState } from 'react';
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
  Obstacle,
} from '../../../utils/factoryCollision';
import {
  cloneAndFixMaterials,
  removeRootMotion,
  disposeScene,
  getCircleIndicatorStyle,
  rotateTowards,
} from '../../../utils/threeHelpers';

const { STAGE } = FACTORY_CONSTANTS;

// Preload models
useGLTF.preload(MODEL_PATHS.COW);
useGLTF.preload(MODEL_PATHS.HORSE);

/**
 * Behavior state for a fake audience member
 */
type AudienceState = 'wandering' | 'walking_to_stage' | 'watching' | 'walking_to_kitchen' | 'at_kitchen';

/**
 * Thoughts for fake audience members
 */
const AUDIENCE_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'Just looking around',
    'Nice office!',
    'Where is everyone?',
    'Taking a stroll',
    'Exploring the factory',
  ],
  walking_to_stage: [
    'Show is starting!',
    'Let me get a seat',
    'This looks fun',
    'Coming!',
  ],
  watching: [
    'Great show!',
    'Amazing!',
    'Encore!',
    'Love it!',
    'Bravo!',
  ],
  walking_to_kitchen: [
    'Snack time!',
    'I smell coffee!',
    'Getting hungry...',
    'Kitchen break!',
  ],
  at_kitchen: [
    'Mmm, pizza!',
    'This coffee is great',
    'Love the donuts!',
    'Grabbing a snack',
    'Yum!',
  ],
};

interface FakeAudienceMemberProps {
  audiencePosition: { x: number; z: number };
  modelPath: string;
  index: number;
  hasPerformer: boolean;
  allObstacles: Obstacle[];
}

/**
 * Single fake audience member with wandering and gathering behavior
 */
const FakeAudienceMember: React.FC<FakeAudienceMemberProps> = ({
  audiencePosition,
  modelPath,
  index,
  hasPerformer,
  allObstacles,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [displayState, setDisplayState] = useState<AudienceState>('wandering');
  const lastDisplayStateRef = useRef<AudienceState>('wandering');
  const gltf = useGLTF(modelPath);

  // Hover/select state from context
  const { updateNpcPosition, entityConversations } = useFactory();
  const entityId = `fake-audience-${index}`;
  const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
    useEntityInteraction(entityId);

  // Circle indicator styling from shared utility
  const circleStyle = getCircleIndicatorStyle(isSelected, isHovered, 0x808080);

  // Kitchen position for kitchen visits
  const kitchenPos = FACTORY_CONSTANTS.KITCHEN.POSITION;

  // Movement state
  const stateRef = useRef<{
    currentState: AudienceState;
    currentPos: { x: number; z: number };
    targetPos: { x: number; z: number };
    initialized: boolean;
    lastDecisionTime: number;
    stateDuration: number;
    stateStartTime: number;
    kitchenDuration: number;
    kitchenStartTime: number;
  }>({
    currentState: 'wandering',
    currentPos: { x: audiencePosition.x - 10 + index * 3, z: audiencePosition.z + index * 2 },
    targetPos: { x: 0, z: 0 },
    initialized: false,
    lastDecisionTime: 0,
    stateDuration: 0,
    stateStartTime: 0,
    kitchenDuration: 0,
    kitchenStartTime: 0,
  });

  // Clone scene with fixed materials
  const clonedScene = useMemo(() => cloneAndFixMaterials(gltf.scene), [gltf.scene]);
  const modelScale = 2.0;

  // Remove root motion to prevent world-space drift
  const processedAnimations = useMemo(
    () => removeRootMotion(gltf.animations),
    [gltf.animations]
  );

  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => disposeScene(clonedScene);
  }, [clonedScene]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    mixer?.update(delta);

    const s = stateRef.current;
    const currentTime = state.clock.elapsedTime;

    // Pause on hover - freeze movement and play idle animation
    if (isHovered) {
      const idleAction = actions?.['Breathing idle'] || actions?.['Idle'];
      if (idleAction && !idleAction.isRunning()) {
        Object.values(actions).forEach(action => action?.fadeOut(0.3));
        idleAction.reset().fadeIn(0.3).play();
      }
      // Still apply position
      groupRef.current.position.x = s.currentPos.x;
      groupRef.current.position.y = 0;
      groupRef.current.position.z = s.currentPos.z;
      return;
    }

    // Initialize position at a clear spot
    if (!s.initialized) {
      const start = getRandomClearPosition(allObstacles);
      s.currentPos = { x: start.x, z: start.z };
      groupRef.current.position.set(start.x, 0, start.z);
      s.initialized = true;
      s.lastDecisionTime = currentTime;
    }

    // Decide behavior based on performer presence
    if (hasPerformer) {
      // Performer on stage - walk to audience position
      if (s.currentState !== 'walking_to_stage' && s.currentState !== 'watching') {
        s.currentState = 'walking_to_stage';
        s.targetPos.x = audiencePosition.x;
        s.targetPos.z = audiencePosition.z;
      }

      const dx = audiencePosition.x - s.currentPos.x;
      const dz = audiencePosition.z - s.currentPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance > 0.5) {
        // Walking to audience position
        s.currentState = 'walking_to_stage';
        const speed = 2.5;
        const moveAmount = Math.min(speed * delta, distance);
        const newX = s.currentPos.x + (dx / distance) * moveAmount;
        const newZ = s.currentPos.z + (dz / distance) * moveAmount;

        const oldX = s.currentPos.x;
        const oldZ = s.currentPos.z;
        const safe = getSafePosition(newX, newZ, oldX, oldZ, allObstacles);
        s.currentPos.x = safe.x;
        s.currentPos.z = safe.z;

        // Face movement direction
        rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

        // Walking animation
        const walkAction = actions?.['Walking'];
        if (walkAction && !walkAction.isRunning()) {
          Object.values(actions).forEach(action => action?.fadeOut(0.3));
          walkAction.reset().fadeIn(0.3).play();
        }
      } else {
        // Arrived - watch the stage
        s.currentState = 'watching';
        // Face the stage
        groupRef.current.rotation.y = Math.PI / 2;

        // Idle animation while watching
        const idleAction = actions?.['Breathing idle'] || actions?.['Idle'];
        if (idleAction && !idleAction.isRunning()) {
          Object.values(actions).forEach(action => action?.fadeOut(0.3));
          idleAction.reset().fadeIn(0.3).play();
        }
      }
    } else {
      // No performer - wander around or visit kitchen
      if (s.currentState === 'at_kitchen') {
        // Currently at kitchen - wait for duration then leave
        if (currentTime - s.kitchenStartTime > s.kitchenDuration) {
          s.currentState = 'wandering';
          s.lastDecisionTime = 0; // Force new wander target
        } else {
          // Idle at kitchen
          const idleAction = actions?.['Breathing idle'] || actions?.['Idle'];
          if (idleAction && !idleAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            idleAction.reset().fadeIn(0.3).play();
          }
        }
      } else if (s.currentState === 'walking_to_kitchen') {
        // Walking to kitchen target
        const dx = s.targetPos.x - s.currentPos.x;
        const dz = s.targetPos.z - s.currentPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.5) {
          const speed = 1.5;
          const moveAmount = Math.min(speed * delta, distance);
          const newX = s.currentPos.x + (dx / distance) * moveAmount;
          const newZ = s.currentPos.z + (dz / distance) * moveAmount;

          const oldX = s.currentPos.x;
          const oldZ = s.currentPos.z;
          const safe = getSafePosition(newX, newZ, oldX, oldZ, allObstacles);
          s.currentPos.x = safe.x;
          s.currentPos.z = safe.z;

          if (Math.abs(safe.x - oldX) < 0.01 &&
              Math.abs(safe.z - oldZ) < 0.01 &&
              distance > 2) {
            s.currentState = 'wandering';
            s.lastDecisionTime = 0;
          }

          rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

          const walkAction = actions?.['Walking'];
          if (walkAction && !walkAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            walkAction.reset().fadeIn(0.3).play();
          }
        } else {
          // Arrived at kitchen
          s.currentState = 'at_kitchen';
          s.kitchenStartTime = currentTime;
          s.kitchenDuration = 5 + Math.random() * 8;
          // Face counter
          const toCounter = Math.atan2(kitchenPos.x - s.currentPos.x, kitchenPos.z - s.currentPos.z);
          groupRef.current.rotation.y = toCounter;

          const idleAction = actions?.['Breathing idle'] || actions?.['Idle'];
          if (idleAction && !idleAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            idleAction.reset().fadeIn(0.3).play();
          }
        }
      } else {
        // Wandering state
        s.currentState = 'wandering';
        const decisionInterval = 4 + index; // Stagger decisions

        if (currentTime - s.lastDecisionTime > decisionInterval) {
          s.lastDecisionTime = currentTime;

          // 25% chance to visit kitchen, 75% random wander
          if (Math.random() < 0.25) {
            const seatPositions = FACTORY_CONSTANTS.KITCHEN.SEAT_POSITIONS;
            const spot = seatPositions[Math.floor(Math.random() * seatPositions.length)];
            s.targetPos.x = kitchenPos.x + spot.x;
            s.targetPos.z = kitchenPos.z + spot.z;
            s.currentState = 'walking_to_kitchen';
          } else {
            const target = getRandomClearPosition(allObstacles);
            s.targetPos.x = target.x;
            s.targetPos.z = target.z;
          }
        }

        const dx = s.targetPos.x - s.currentPos.x;
        const dz = s.targetPos.z - s.currentPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.5) {
          // Walking to wander target
          const speed = 1.5;
          const moveAmount = Math.min(speed * delta, distance);
          const newX = s.currentPos.x + (dx / distance) * moveAmount;
          const newZ = s.currentPos.z + (dz / distance) * moveAmount;

          const oldX = s.currentPos.x;
          const oldZ = s.currentPos.z;
          const safe = getSafePosition(newX, newZ, oldX, oldZ, allObstacles);
          s.currentPos.x = safe.x;
          s.currentPos.z = safe.z;

          // Stuck detection
          if (Math.abs(safe.x - oldX) < 0.01 &&
              Math.abs(safe.z - oldZ) < 0.01 &&
              distance > 2) {
            s.lastDecisionTime = 0; // Force new target
          }

          // Face movement direction
          rotateTowards(groupRef.current, Math.atan2(dx, dz), delta, 5);

          // Walking animation
          const walkAction = actions?.['Walking'];
          if (walkAction && !walkAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            walkAction.reset().fadeIn(0.3).play();
          }
        } else {
          // Arrived at wander target - idle
          const idleAction = actions?.['Breathing idle'] || actions?.['Idle'];
          if (idleAction && !idleAction.isRunning()) {
            Object.values(actions).forEach(action => action?.fadeOut(0.3));
            idleAction.reset().fadeIn(0.3).play();
          }
          // Subtle swaying
          const swayAmount = 0.02;
          groupRef.current.rotation.z = Math.sin(currentTime * 0.5 + index) * swayAmount;
        }
      }
    }

    // Apply position
    groupRef.current.position.x = s.currentPos.x;
    groupRef.current.position.y = 0;
    groupRef.current.position.z = s.currentPos.z;

    // Report position for proximity conversation detection
    updateNpcPosition(entityId, groupRef.current.position);

    // Update display state for thinking bubble
    if (s.currentState !== lastDisplayStateRef.current) {
      lastDisplayStateRef.current = s.currentState;
      setDisplayState(s.currentState);
    }
  });

  // Get thoughts for current state
  const currentThoughts = useMemo(() => {
    return AUDIENCE_THOUGHTS[displayState] || AUDIENCE_THOUGHTS.wandering;
  }, [displayState]);

  return (
    <group
      ref={groupRef}
      position={[0, 0, 0]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {/* Circle indicator under fake audience member - glows on hover/select */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
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
      <primitive object={clonedScene} scale={modelScale} />

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
 * When a performer is on stage, they gather to watch.
 * When no performer, they wander around the factory.
 */
/** Distance from stage center to consider an NPC "on stage" */
const NPC_STAGE_THRESHOLD = 4.0;

export const FakeAudience: React.FC = () => {
  const { idleDestinations, zones, npcPositions } = useFactory();

  const stagePos = FACTORY_CONSTANTS.STAGE.POSITION;

  // Check if there's an active performer: either an agent on stage or an NPC near the stage
  const hasPerformer = useMemo(() => {
    if (idleDestinations.stagePerformerId) return true;
    // Check if any NPC is near the stage (e.g., Sundar presenting)
    for (const [, pos] of npcPositions) {
      const dx = pos.x - stagePos.x;
      const dz = pos.z - stagePos.z;
      if (Math.sqrt(dx * dx + dz * dz) < NPC_STAGE_THRESHOLD) return true;
    }
    return false;
  }, [idleDestinations.stagePerformerId, npcPositions, stagePos]);

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
        <FakeAudienceMember
          key={`fake-audience-${index}`}
          audiencePosition={pos}
          modelPath={models[index % models.length]}
          index={index}
          hasPerformer={hasPerformer}
          allObstacles={allObstacles}
        />
      ))}
    </group>
  );
};

export default FakeAudience;
