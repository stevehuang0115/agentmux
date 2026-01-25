/**
 * Tests for Factory Utilities.
 *
 * Tests helper functions for factory visualization including
 * animal type assignment, time checks, and camera math.
 */

import { describe, it, expect } from 'vitest';
import {
  getAnimalTypeForProject,
  isNightTime,
  createInitialCameraState,
  easeInOutCubic,
  calculateZonePosition,
  calculateWorkstationPositions,
} from './factory.utils';
import { FACTORY_CONSTANTS } from '../types/factory.types';

describe('Factory Utils', () => {
  describe('getAnimalTypeForProject', () => {
    it('should return consistent animal type for same project name', () => {
      const animal1 = getAnimalTypeForProject('MyProject', 0);
      const animal2 = getAnimalTypeForProject('MyProject', 0);
      expect(animal1).toBe(animal2);
    });

    it('should return different animal types for different indices', () => {
      // With 5 animals, different indices should give different animals for most projects
      const animals = new Set<string>();
      for (let i = 0; i < 5; i++) {
        animals.add(getAnimalTypeForProject('TestProject', i));
      }
      // Should have at least 2 different animals across 5 indices
      expect(animals.size).toBeGreaterThanOrEqual(2);
    });

    it('should return different animal types for different project names', () => {
      const animal1 = getAnimalTypeForProject('ProjectA', 0);
      const animal2 = getAnimalTypeForProject('ProjectB', 0);
      const animal3 = getAnimalTypeForProject('ProjectC', 0);
      // At least 2 of 3 should be different
      const animals = new Set([animal1, animal2, animal3]);
      expect(animals.size).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty project name', () => {
      const animal = getAnimalTypeForProject('', 0);
      expect(['cow', 'horse', 'dragon', 'tiger', 'rabbit']).toContain(animal);
    });

    it('should handle special characters in project name', () => {
      const animal = getAnimalTypeForProject('Project-With_Special.Chars!', 0);
      expect(['cow', 'horse', 'dragon', 'tiger', 'rabbit']).toContain(animal);
    });

    it('should handle unicode characters in project name', () => {
      const animal = getAnimalTypeForProject('项目名称', 0);
      expect(['cow', 'horse', 'dragon', 'tiger', 'rabbit']).toContain(animal);
    });

    it('should handle very long project names', () => {
      const longName = 'A'.repeat(1000);
      const animal = getAnimalTypeForProject(longName, 0);
      expect(['cow', 'horse', 'dragon', 'tiger', 'rabbit']).toContain(animal);
    });

    it('should return valid animal type for all possible inputs', () => {
      const validAnimals = ['cow', 'horse', 'dragon', 'tiger', 'rabbit'];
      // Test 100 random-ish project names
      for (let i = 0; i < 100; i++) {
        const projectName = `Project${i}Test${i * 17}`;
        const animal = getAnimalTypeForProject(projectName, i % 10);
        expect(validAnimals).toContain(animal);
      }
    });

    it('should distribute animals across all 5 types', () => {
      const animalCounts: Record<string, number> = {};
      // Test many project names to verify distribution
      for (let i = 0; i < 500; i++) {
        const animal = getAnimalTypeForProject(`UniqueProject${i}`, 0);
        animalCounts[animal] = (animalCounts[animal] || 0) + 1;
      }
      // Each animal type should appear at least once
      expect(Object.keys(animalCounts)).toHaveLength(5);
      // Each animal should have at least 20 occurrences (roughly uniform)
      Object.values(animalCounts).forEach((count) => {
        expect(count).toBeGreaterThan(20);
      });
    });
  });

  describe('isNightTime', () => {
    it('should return true for hour 18 (6 PM)', () => {
      expect(isNightTime(18)).toBe(true);
    });

    it('should return false for hour 17 (5 PM)', () => {
      expect(isNightTime(17)).toBe(false);
    });

    it('should return true for hour 23 (11 PM)', () => {
      expect(isNightTime(23)).toBe(true);
    });

    it('should return true for hour 0 (midnight)', () => {
      expect(isNightTime(0)).toBe(true);
    });

    it('should return true for hour 5 (5 AM)', () => {
      expect(isNightTime(5)).toBe(true);
    });

    it('should return false for hour 6 (6 AM)', () => {
      expect(isNightTime(6)).toBe(false);
    });

    it('should return false for hour 12 (noon)', () => {
      expect(isNightTime(12)).toBe(false);
    });

    it('should handle all 24 hours correctly', () => {
      const nightHours = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
      const dayHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

      nightHours.forEach((hour) => {
        expect(isNightTime(hour)).toBe(true);
      });

      dayHours.forEach((hour) => {
        expect(isNightTime(hour)).toBe(false);
      });
    });
  });

  describe('createInitialCameraState', () => {
    it('should create camera state with default position', () => {
      const state = createInitialCameraState();
      const { DEFAULT_POSITION } = FACTORY_CONSTANTS.CAMERA;

      expect(state.position.x).toBe(DEFAULT_POSITION.x);
      expect(state.position.y).toBe(DEFAULT_POSITION.y);
      expect(state.position.z).toBe(DEFAULT_POSITION.z);
    });

    it('should create camera state with target at origin+y', () => {
      const state = createInitialCameraState();

      expect(state.target.x).toBe(0);
      expect(state.target.y).toBe(1);
      expect(state.target.z).toBe(0);
    });

    it('should set isAnimating to false', () => {
      const state = createInitialCameraState();
      expect(state.isAnimating).toBe(false);
    });

    it('should calculate valid yaw value', () => {
      const state = createInitialCameraState();
      // Yaw should be between -PI and PI
      expect(state.yaw).toBeGreaterThanOrEqual(-Math.PI);
      expect(state.yaw).toBeLessThanOrEqual(Math.PI);
    });

    it('should calculate valid pitch value', () => {
      const state = createInitialCameraState();
      // Pitch should be between -PI/2 and PI/2
      expect(state.pitch).toBeGreaterThanOrEqual(-Math.PI / 2);
      expect(state.pitch).toBeLessThanOrEqual(Math.PI / 2);
    });

    it('should have position and target as THREE.Vector3 instances', () => {
      const state = createInitialCameraState();
      expect(state.position).toHaveProperty('x');
      expect(state.position).toHaveProperty('y');
      expect(state.position).toHaveProperty('z');
      expect(state.target).toHaveProperty('x');
      expect(state.target).toHaveProperty('y');
      expect(state.target).toHaveProperty('z');
    });
  });

  describe('easeInOutCubic', () => {
    it('should return 0 at t=0', () => {
      expect(easeInOutCubic(0)).toBe(0);
    });

    it('should return 1 at t=1', () => {
      expect(easeInOutCubic(1)).toBe(1);
    });

    it('should return 0.5 at t=0.5', () => {
      expect(easeInOutCubic(0.5)).toBe(0.5);
    });

    it('should be less than 0.5 at t=0.25 (ease-in)', () => {
      const result = easeInOutCubic(0.25);
      expect(result).toBeLessThan(0.25);
    });

    it('should be greater than 0.5 at t=0.75 (ease-out)', () => {
      const result = easeInOutCubic(0.75);
      expect(result).toBeGreaterThan(0.75);
    });

    it('should be monotonically increasing', () => {
      let prev = 0;
      for (let t = 0; t <= 1; t += 0.1) {
        const current = easeInOutCubic(t);
        expect(current).toBeGreaterThanOrEqual(prev);
        prev = current;
      }
    });

    it('should have smooth acceleration and deceleration', () => {
      // First quarter should accelerate
      const q1 = easeInOutCubic(0.25);
      const q2 = easeInOutCubic(0.5);
      const q3 = easeInOutCubic(0.75);

      // q2 - q1 should be greater than q1 - 0 (accelerating)
      expect(q2 - q1).toBeGreaterThan(q1);
      // 1 - q3 should be less than q3 - q2 (decelerating)
      expect(1 - q3).toBeLessThan(q3 - q2);
    });
  });

  describe('calculateZonePosition', () => {
    it('should calculate correct position for first zone', () => {
      const pos = calculateZonePosition(0);
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.z).toBe('number');
      expect(pos.z).toBe(0); // First row
    });

    it('should place zones in rows based on zonesPerRow', () => {
      const zonesPerRow = 3;
      const pos0 = calculateZonePosition(0, zonesPerRow);
      const pos1 = calculateZonePosition(1, zonesPerRow);
      const pos2 = calculateZonePosition(2, zonesPerRow);
      const pos3 = calculateZonePosition(3, zonesPerRow); // Second row

      // First 3 should be on same row (z=0)
      expect(pos0.z).toBe(0);
      expect(pos1.z).toBe(0);
      expect(pos2.z).toBe(0);

      // Fourth should be on second row
      expect(pos3.z).toBeGreaterThan(0);
    });

    it('should space zones by width plus gap', () => {
      const width = 10;
      const gap = 2;
      const pos0 = calculateZonePosition(0, 3, width, 7, gap);
      const pos1 = calculateZonePosition(1, 3, width, 7, gap);

      expect(pos1.x - pos0.x).toBe(width + gap);
    });

    it('should center zones around x=0', () => {
      const pos = calculateZonePosition(1, 3); // Middle of 3 zones
      // Middle zone should be close to center
      expect(Math.abs(pos.x)).toBeLessThan(1);
    });
  });

  describe('calculateWorkstationPositions', () => {
    it('should return 4 workstation positions', () => {
      const positions = calculateWorkstationPositions(0, 0);
      expect(positions).toHaveLength(4);
    });

    it('should offset positions from zone center', () => {
      const zoneX = 10;
      const zoneZ = 20;
      const positions = calculateWorkstationPositions(zoneX, zoneZ);

      positions.forEach((pos) => {
        expect(pos.x).not.toBe(zoneX);
        expect(pos.z).not.toBe(zoneZ);
      });
    });

    it('should return positions with x and z properties', () => {
      const positions = calculateWorkstationPositions(0, 0);

      positions.forEach((pos) => {
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.z).toBe('number');
      });
    });

    it('should respect FACTORY_CONSTANTS workstation positions', () => {
      const zoneX = 5;
      const zoneZ = 10;
      const positions = calculateWorkstationPositions(zoneX, zoneZ);
      const expected = FACTORY_CONSTANTS.WORKSTATION_POSITIONS;

      positions.forEach((pos, i) => {
        expect(pos.x).toBe(zoneX + expected[i].x);
        expect(pos.z).toBe(zoneZ + expected[i].z);
      });
    });
  });
});
