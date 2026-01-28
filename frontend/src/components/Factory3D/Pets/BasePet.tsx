/**
 * BasePet - Base component for pet animals (dogs) in the factory.
 *
 * Pets wander around the factory, following agents or exploring on their own.
 * Supports both skeletal animations (if available) and procedural animation
 * as a fallback for static models.
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

import { PetType, PetConfig, WanderBounds, FACTORY_CONSTANTS } from '../../../types/factory.types';
import { cloneAndFixMaterials, rotateTowards } from '../../../utils/threeHelpers';
import {
  WALL_BOUNDS,
  STATIC_OBSTACLES,
  isInsideObstacle,
  clampToWalls,
} from '../../../utils/factoryCollision';

// Re-export types for convenience
export type { PetConfig, WanderBounds };

// ====== TIMING CONSTANTS ======

const { INITIAL_IDLE_DURATION, IDLE_DURATION, WALK_DURATION } = FACTORY_CONSTANTS.PET.TIMING;
const { STUCK_CHECK_ATTEMPTS } = FACTORY_CONSTANTS.PET.MOVEMENT;

// ====== TYPES ======

/**
 * Props for BasePet component
 */
export interface BasePetProps {
  /** Unique identifier for this pet */
  id: string;
  /** Pet type */
  petType: PetType;
  /** Configuration for this pet */
  config: PetConfig;
  /** Initial position */
  initialPosition?: [number, number, number];
  /** Optional agent ID to follow */
  followAgentId?: string;
  /** Agent positions map for following */
  agentPositions?: Map<string, THREE.Vector3>;
}

// ====== COMPONENT ======

/**
 * BasePet - Renders a pet with movement and animation.
 */
export const BasePet: React.FC<BasePetProps> = ({
  id,
  petType,
  config,
  initialPosition = [0, 0, 0],
  followAgentId,
  agentPositions,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);

  // Load model
  const { scene, animations } = useGLTF(config.modelPath);

  // Clone scene for this instance
  const clonedScene = useMemo(() => {
    return cloneAndFixMaterials(scene);
  }, [scene]);

  // Set up animations if available
  const { actions, mixer } = useAnimations(animations, clonedScene);
  const hasAnimations = animations.length > 0;

  // Movement state
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const walkingTimeRef = useRef<number>(0); // Track walking duration
  const isFirstIdleRef = useRef<boolean>(true); // Track if first idle

  // Procedural animation state
  const proceduralState = useRef({
    bobPhase: Math.random() * Math.PI * 2,
    wobblePhase: Math.random() * Math.PI * 2,
  });

  // Reusable Vector3 objects to avoid allocation in useFrame
  const reusableVectors = useRef({
    direction: new THREE.Vector3(),
    wanderTarget: new THREE.Vector3(),
    offset: new THREE.Vector3(),
  });

  // Initialize position only once on mount
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        initialPosition[0],
        config.groundOffset,
        initialPosition[2]
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - don't reset position on re-renders

  // Play idle animation on mount
  useEffect(() => {
    if (hasAnimations && config.animations?.idle && actions[config.animations.idle]) {
      actions[config.animations.idle]?.reset().fadeIn(0.3).play();
    }
  }, [hasAnimations, actions, config.animations?.idle]);

  // Generate random wander target - reuses Vector3 to avoid allocation
  const generateWanderTarget = (): THREE.Vector3 => {
    let attempts = 0;
    let x: number, z: number;

    do {
      x = WALL_BOUNDS.minX + Math.random() * (WALL_BOUNDS.maxX - WALL_BOUNDS.minX);
      z = WALL_BOUNDS.minZ + Math.random() * (WALL_BOUNDS.maxZ - WALL_BOUNDS.minZ);
      attempts++;
    } while (isInsideObstacle(x, z, STATIC_OBSTACLES) && attempts < STUCK_CHECK_ATTEMPTS);

    const clamped = clampToWalls(x, z);
    return reusableVectors.current.wanderTarget.set(clamped.x, config.groundOffset, clamped.z);
  };

  // Schedule next movement after idle period
  const scheduleNextMove = () => {
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
    }

    // Use 2s for first idle, 1.5s for subsequent idles
    const idleDuration = isFirstIdleRef.current ? INITIAL_IDLE_DURATION : IDLE_DURATION;
    isFirstIdleRef.current = false; // After first idle, use shorter duration

    moveTimeoutRef.current = setTimeout(() => {
      // If following an agent, try to move toward them
      if (followAgentId && agentPositions?.has(followAgentId)) {
        const agentPos = agentPositions.get(followAgentId)!;
        // Stay a bit behind the agent - reuse offset vector
        const offset = reusableVectors.current.offset.set(
          (Math.random() - 0.5) * 2,
          0,
          -1 - Math.random()
        );
        // Clone agentPos since we need to store it in state
        setTargetPosition(agentPos.clone().add(offset));
      } else {
        // Only randomize the target position - clone since generateWanderTarget reuses vector
        const target = generateWanderTarget();
        setTargetPosition(target.clone());
      }
      walkingTimeRef.current = 0; // Reset walking timer
      setIsMoving(true);
    }, idleDuration * 1000);
  };

  // Start wandering on mount
  useEffect(() => {
    scheduleNextMove();
    return () => {
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
    };
  }, []);

  // Animation frame
  useFrame((_, delta) => {
    if (!groupRef.current || !modelRef.current) return;

    const group = groupRef.current;
    const model = modelRef.current;

    // Update animation mixer
    if (mixer) {
      mixer.update(delta);
    }

    if (isMoving && targetPosition) {
      // Track walking time
      walkingTimeRef.current += delta;

      // Check if walking duration exceeded (fixed 4 seconds)
      if (walkingTimeRef.current >= WALK_DURATION) {
        // Stop walking after 4 seconds
        setIsMoving(false);
        setTargetPosition(null);

        // Stop all animations and optionally play idle
        Object.values(actions).forEach((action) => action?.fadeOut(0.3));
        if (hasAnimations && config.animations?.idle && actions[config.animations.idle]) {
          actions[config.animations.idle]?.reset().fadeIn(0.3).play();
        }

        scheduleNextMove();
      } else {
        // Move toward target - reuse direction vector to avoid allocation
        const currentPos = group.position;
        const direction = reusableVectors.current.direction
          .subVectors(targetPosition, currentPos)
          .setY(0);
        const distance = direction.length();

        // If reached target but still have walking time, pick a new target
        if (distance < 0.5) {
          const newTarget = generateWanderTarget();
          setTargetPosition(newTarget.clone());
        } else {
          // Move toward target
          direction.normalize();
          const speed = config.walkSpeed;
          const moveX = direction.x * speed * delta;
          const moveZ = direction.z * speed * delta;

          // Move to new position
          const newX = currentPos.x + moveX;
          const newZ = currentPos.z + moveZ;
          const clamped = clampToWalls(newX, newZ);

          group.position.x = clamped.x;
          group.position.z = clamped.z;

          // Calculate target rotation and rotate toward it
          const targetRotation = Math.atan2(
            targetPosition.x - currentPos.x,
            targetPosition.z - currentPos.z
          );
          rotateTowards(group, targetRotation, delta, 5);
        }

        // Play walk animation (always during walking phase)
        const animName = config.animations?.walk;
        const hasWalkAnimation = animName && actions[animName];

        if (hasWalkAnimation) {
          // Use skeletal walk animation
          if (!actions[animName]?.isRunning()) {
            Object.values(actions).forEach((action) => action?.fadeOut(0.2));
            actions[animName]?.reset().fadeIn(0.2).play();
          }
        } else {
          // Procedural animation - bobbing and leg simulation
          const speed = config.walkSpeed;
          proceduralState.current.bobPhase += delta * speed * 8;
          proceduralState.current.wobblePhase += delta * speed * 4;

          // Bob up and down
          model.position.y = Math.sin(proceduralState.current.bobPhase) * 0.03;

          // Slight roll wobble
          model.rotation.z = Math.sin(proceduralState.current.wobblePhase) * 0.03;

          // Slight pitch for running feel
          model.rotation.x = Math.sin(proceduralState.current.bobPhase * 0.5) * 0.02;
        }
      }
    } else {
      // Idle state - use idle animation if available, otherwise procedural
      const hasIdleAnimation = config.animations?.idle && actions[config.animations.idle];
      if (!hasIdleAnimation) {
        // Procedural idle animation - gentle breathing
        proceduralState.current.bobPhase += delta * 2;
        model.position.y = Math.sin(proceduralState.current.bobPhase) * 0.01;
        model.rotation.z = 0;
        model.rotation.x = 0;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={modelRef}>
        <primitive
          object={clonedScene}
          scale={config.scale}
          rotation={config.modelRotation ?? [0, 0, 0]}
        />
      </group>
    </group>
  );
};

export default BasePet;
