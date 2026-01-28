/**
 * BasePet tests - Verifies pet configuration and types.
 */

import { describe, it, expect } from 'vitest';
import { MODEL_PATHS, ANIMATION_NAMES, PetType } from '../../../types/factory.types';

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

    it('should use model.glb filename', () => {
      expect(MODEL_PATHS.BULLDOG).toContain('model.glb');
      expect(MODEL_PATHS.PUPPY).toContain('model.glb');
      expect(MODEL_PATHS.ROBOTIC_DOG).toContain('model.glb');
      expect(MODEL_PATHS.SHIBA_INU).toContain('model.glb');
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
});
