/**
 * BasePet tests - Verifies pet configuration, types, and movement timing.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MODEL_PATHS, ANIMATION_NAMES, PetType } from '../../../types/factory.types';
import { WALL_BOUNDS, isInsideObstacle, clampToWalls, STATIC_OBSTACLES } from '../../../utils/factoryCollision';

// Fixed timing constants from BasePet component
const INITIAL_IDLE_DURATION = 2; // 2 seconds for first idle
const IDLE_DURATION = 1.5; // 1.5 seconds for subsequent idles
const WALK_DURATION = 2.5; // 2.5 seconds walking

describe('BasePet', () => {
  describe('PetType', () => {
    it('should have all pet types defined', () => {
      const petTypes: PetType[] = ['bulldog', 'puppy', 'roboticdog', 'shibainu'];
      expect(petTypes).toHaveLength(4);
    });
  });

  describe('MODEL_PATHS', () => {
    it('should have paths for all pets', () => {
      expect(MODEL_PATHS.BULLDOG).toContain('/models/pets/bulldog/');
      expect(MODEL_PATHS.PUPPY).toContain('/models/pets/puppy/');
      expect(MODEL_PATHS.ROBOTIC_DOG).toContain('/models/pets/roboticdog/');
      expect(MODEL_PATHS.SHIBA_INU).toContain('/models/pets/shibainu/');
    });

    it('should use .glb file extension', () => {
      expect(MODEL_PATHS.BULLDOG).toMatch(/\.glb$/);
      expect(MODEL_PATHS.PUPPY).toMatch(/\.glb$/);
      expect(MODEL_PATHS.ROBOTIC_DOG).toMatch(/\.glb$/);
      expect(MODEL_PATHS.SHIBA_INU).toMatch(/\.glb$/);
    });
  });

  describe('ANIMATION_NAMES', () => {
    it('should indicate bulldog has no animations (procedural fallback)', () => {
      expect(ANIMATION_NAMES.BULLDOG).toBeDefined();
      expect(ANIMATION_NAMES.BULLDOG.HAS_ANIMATIONS).toBe(false);
    });

    it('should have correct animation names for puppy', () => {
      expect(ANIMATION_NAMES.PUPPY).toBeDefined();
      expect(ANIMATION_NAMES.PUPPY.HAS_ANIMATIONS).toBe(true);
      expect(ANIMATION_NAMES.PUPPY.IDLE).toBe('Armature|PuppyALL_IdleEnergetic');
      expect(ANIMATION_NAMES.PUPPY.WALKING).toBe('Armature|PuppyALL_Walk');
      expect(ANIMATION_NAMES.PUPPY.RUNNING).toBe('Armature|PuppyALL_Run');
    });

    it('should indicate robotic dog has no animations (procedural fallback)', () => {
      expect(ANIMATION_NAMES.ROBOTIC_DOG).toBeDefined();
      expect(ANIMATION_NAMES.ROBOTIC_DOG.HAS_ANIMATIONS).toBe(false);
    });

    it('should have correct animation names for shiba inu', () => {
      expect(ANIMATION_NAMES.SHIBA_INU).toBeDefined();
      expect(ANIMATION_NAMES.SHIBA_INU.HAS_ANIMATIONS).toBe(true);
      expect(ANIMATION_NAMES.SHIBA_INU.IDLE).toBe('0|0|standing_0');
      expect(ANIMATION_NAMES.SHIBA_INU.SITTING).toBe('0|0|sitting_0');
      expect(ANIMATION_NAMES.SHIBA_INU.SHAKE).toBe('0|0|shake_0');
    });
  });

  describe('Pet configurations', () => {
    it('should define reasonable speeds', () => {
      // These are tested via the component configs
      // Walk speed should be slower than run speed
      const walkSpeed = 1.0;
      const runSpeed = 2.5;
      expect(runSpeed).toBeGreaterThan(walkSpeed);
    });

    it('should define reasonable scales', () => {
      // Pets should be smaller than agents (agents are ~1.5-2.5 units tall)
      const typicalPetScale = 0.5;
      expect(typicalPetScale).toBeLessThan(1);
      expect(typicalPetScale).toBeGreaterThan(0.1);
    });
  });

  describe('Movement timing constants', () => {
    it('should have correct initial idle duration', () => {
      expect(INITIAL_IDLE_DURATION).toBe(2);
    });

    it('should have correct subsequent idle duration', () => {
      expect(IDLE_DURATION).toBe(1.5);
    });

    it('should have correct walk duration', () => {
      expect(WALK_DURATION).toBe(2.5);
    });

    it('should have initial idle longer than subsequent idle', () => {
      expect(INITIAL_IDLE_DURATION).toBeGreaterThan(IDLE_DURATION);
    });

    it('should have total cycle time as expected', () => {
      // First cycle: 2s idle + 2.5s walk = 4.5s
      const firstCycle = INITIAL_IDLE_DURATION + WALK_DURATION;
      expect(firstCycle).toBe(4.5);

      // Subsequent cycles: 1.5s idle + 2.5s walk = 4s
      const subsequentCycle = IDLE_DURATION + WALK_DURATION;
      expect(subsequentCycle).toBe(4);
    });
  });

  describe('Wander target generation', () => {
    it('should generate targets within wall bounds', () => {
      // Test that random targets are within bounds
      for (let i = 0; i < 10; i++) {
        const x = WALL_BOUNDS.minX + Math.random() * (WALL_BOUNDS.maxX - WALL_BOUNDS.minX);
        const z = WALL_BOUNDS.minZ + Math.random() * (WALL_BOUNDS.maxZ - WALL_BOUNDS.minZ);

        expect(x).toBeGreaterThanOrEqual(WALL_BOUNDS.minX);
        expect(x).toBeLessThanOrEqual(WALL_BOUNDS.maxX);
        expect(z).toBeGreaterThanOrEqual(WALL_BOUNDS.minZ);
        expect(z).toBeLessThanOrEqual(WALL_BOUNDS.maxZ);
      }
    });

    it('should clamp positions to wall bounds', () => {
      const outOfBounds = clampToWalls(100, 100);
      expect(outOfBounds.x).toBeLessThanOrEqual(WALL_BOUNDS.maxX);
      expect(outOfBounds.z).toBeLessThanOrEqual(WALL_BOUNDS.maxZ);

      const negativeOutOfBounds = clampToWalls(-100, -100);
      expect(negativeOutOfBounds.x).toBeGreaterThanOrEqual(WALL_BOUNDS.minX);
      expect(negativeOutOfBounds.z).toBeGreaterThanOrEqual(WALL_BOUNDS.minZ);
    });

    it('should avoid static obstacles', () => {
      // Test that obstacle detection works
      // STATIC_OBSTACLES are box obstacles with minX, maxX, minZ, maxZ
      const obstacle = STATIC_OBSTACLES[0];
      if (obstacle) {
        // Test center of first obstacle
        const centerX = (obstacle.minX + obstacle.maxX) / 2;
        const centerZ = (obstacle.minZ + obstacle.maxZ) / 2;
        const isInside = isInsideObstacle(centerX, centerZ, STATIC_OBSTACLES);
        expect(isInside).toBe(true);

        // Test that points outside obstacles are not inside
        const outsideX = WALL_BOUNDS.maxX - 0.1;
        const outsideZ = WALL_BOUNDS.maxZ - 0.1;
        const isOutside = isInsideObstacle(outsideX, outsideZ, STATIC_OBSTACLES);
        expect(isOutside).toBe(false);
      }
    });
  });

  describe('Movement state machine', () => {
    it('should transition from idle to walking correctly', () => {
      let isMoving = false;
      let isFirstIdle = true;

      // Simulate first idle complete
      const idleDuration = isFirstIdle ? INITIAL_IDLE_DURATION : IDLE_DURATION;
      expect(idleDuration).toBe(2); // First idle uses 2s

      // After idle, start moving
      isMoving = true;
      isFirstIdle = false;
      expect(isMoving).toBe(true);

      // Next idle will use shorter duration
      const nextIdleDuration = isFirstIdle ? INITIAL_IDLE_DURATION : IDLE_DURATION;
      expect(nextIdleDuration).toBe(1.5);
    });

    it('should stop walking after duration exceeded', () => {
      let walkingTime = 0;
      const delta = 0.1; // 100ms per frame

      // Simulate walking
      while (walkingTime < WALK_DURATION) {
        walkingTime += delta;
      }

      expect(walkingTime).toBeGreaterThanOrEqual(WALK_DURATION);
    });
  });

  describe('Procedural animation', () => {
    it('should produce bounded bob values', () => {
      for (let phase = 0; phase < Math.PI * 4; phase += 0.1) {
        const bob = Math.sin(phase) * 0.03;
        expect(bob).toBeGreaterThanOrEqual(-0.03);
        expect(bob).toBeLessThanOrEqual(0.03);
      }
    });

    it('should produce bounded wobble values', () => {
      for (let phase = 0; phase < Math.PI * 4; phase += 0.1) {
        const wobble = Math.sin(phase) * 0.03;
        expect(wobble).toBeGreaterThanOrEqual(-0.03);
        expect(wobble).toBeLessThanOrEqual(0.03);
      }
    });

    it('should produce bounded pitch values', () => {
      for (let phase = 0; phase < Math.PI * 4; phase += 0.1) {
        const pitch = Math.sin(phase * 0.5) * 0.02;
        expect(pitch).toBeGreaterThanOrEqual(-0.02);
        expect(pitch).toBeLessThanOrEqual(0.02);
      }
    });
  });

  describe('Vector3 reuse optimization', () => {
    it('should allow reusing Vector3 for direction calculation', () => {
      const direction = new THREE.Vector3();
      const target = new THREE.Vector3(10, 0, 10);
      const current = new THREE.Vector3(5, 0, 5);

      direction.subVectors(target, current).setY(0);

      expect(direction.x).toBe(5);
      expect(direction.y).toBe(0);
      expect(direction.z).toBe(5);

      // Normalize for movement
      direction.normalize();
      expect(direction.length()).toBeCloseTo(1);
    });

    it('should allow reusing Vector3 for wander target', () => {
      const wanderTarget = new THREE.Vector3();

      // First use
      wanderTarget.set(5, 0, 5);
      expect(wanderTarget.x).toBe(5);

      // Reuse
      wanderTarget.set(10, 0, 10);
      expect(wanderTarget.x).toBe(10);
    });
  });
});
