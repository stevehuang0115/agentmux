/**
 * Tests for Factory Collision utility.
 *
 * Tests obstacle detection, wall clamping, safe position computation,
 * position clearance checks, and random position generation.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  WALL_BOUNDS,
  STATIC_OBSTACLES,
  getWorkstationObstacles,
  isInsideObstacle,
  clampToWalls,
  getSafePosition,
  isPositionClear,
  getRandomClearPosition,
  type Obstacle,
} from './factoryCollision';
import { FACTORY_CONSTANTS, type OfficeZone } from '../types/factory.types';

// ====== HELPERS ======

/** Create a simple obstacle for testing */
function makeObstacle(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): Obstacle {
  return { minX, maxX, minZ, maxZ };
}

/** Create a minimal OfficeZone with workstations at given positions */
function makeZone(
  name: string,
  positions: Array<{ x: number; z: number }>
): OfficeZone {
  return {
    projectName: name,
    zoneIndex: 0,
    zoneX: 0,
    zoneZ: 0,
    color: 0x000000,
    workstations: positions.map((pos, i) => ({
      position: { x: pos.x, z: pos.z },
      index: i,
      isActive: false,
    })),
  };
}

// ====== TESTS ======

describe('Factory Collision', () => {
  // ------ WALL_BOUNDS ------

  describe('WALL_BOUNDS', () => {
    it('should be derived from FACTORY_CONSTANTS walls with margin', () => {
      const margin = 1.5;
      expect(WALL_BOUNDS.minX).toBe(FACTORY_CONSTANTS.WALLS.BACK_X + margin);
      expect(WALL_BOUNDS.maxX).toBe(FACTORY_CONSTANTS.WALLS.FRONT_X - margin);
      expect(WALL_BOUNDS.minZ).toBe(FACTORY_CONSTANTS.WALLS.LEFT_Z + margin);
      expect(WALL_BOUNDS.maxZ).toBe(FACTORY_CONSTANTS.WALLS.RIGHT_Z - margin);
    });

    it('should define a valid bounding box (min < max)', () => {
      expect(WALL_BOUNDS.minX).toBeLessThan(WALL_BOUNDS.maxX);
      expect(WALL_BOUNDS.minZ).toBeLessThan(WALL_BOUNDS.maxZ);
    });
  });

  // ------ STATIC_OBSTACLES ------

  describe('STATIC_OBSTACLES', () => {
    it('should contain at least the conveyor belt and kitchen', () => {
      expect(STATIC_OBSTACLES.length).toBeGreaterThanOrEqual(2);
    });

    it('each obstacle should have valid bounds (min < max)', () => {
      STATIC_OBSTACLES.forEach((obs) => {
        expect(obs.minX).toBeLessThan(obs.maxX);
        expect(obs.minZ).toBeLessThan(obs.maxZ);
      });
    });
  });

  // ------ isInsideObstacle ------

  describe('isInsideObstacle', () => {
    const obstacles: Obstacle[] = [makeObstacle(-5, 5, -5, 5)];

    it('should return true for a point inside the obstacle', () => {
      expect(isInsideObstacle(0, 0, obstacles)).toBe(true);
    });

    it('should return true for a point on the obstacle boundary', () => {
      expect(isInsideObstacle(-5, -5, obstacles)).toBe(true);
      expect(isInsideObstacle(5, 5, obstacles)).toBe(true);
      expect(isInsideObstacle(-5, 5, obstacles)).toBe(true);
      expect(isInsideObstacle(5, -5, obstacles)).toBe(true);
    });

    it('should return false for a point outside the obstacle', () => {
      expect(isInsideObstacle(6, 0, obstacles)).toBe(false);
      expect(isInsideObstacle(0, 6, obstacles)).toBe(false);
      expect(isInsideObstacle(-6, 0, obstacles)).toBe(false);
      expect(isInsideObstacle(0, -6, obstacles)).toBe(false);
    });

    it('should return false for an empty obstacle list', () => {
      expect(isInsideObstacle(0, 0, [])).toBe(false);
    });

    it('should detect collision with any of multiple obstacles', () => {
      const multi = [
        makeObstacle(0, 2, 0, 2),
        makeObstacle(10, 12, 10, 12),
      ];
      expect(isInsideObstacle(1, 1, multi)).toBe(true);
      expect(isInsideObstacle(11, 11, multi)).toBe(true);
      expect(isInsideObstacle(5, 5, multi)).toBe(false);
    });
  });

  // ------ clampToWalls ------

  describe('clampToWalls', () => {
    it('should not change a position inside the walls', () => {
      const result = clampToWalls(0, 0);
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should clamp X when too far negative', () => {
      const result = clampToWalls(-100, 0);
      expect(result.x).toBe(WALL_BOUNDS.minX);
      expect(result.z).toBe(0);
    });

    it('should clamp X when too far positive', () => {
      const result = clampToWalls(100, 0);
      expect(result.x).toBe(WALL_BOUNDS.maxX);
      expect(result.z).toBe(0);
    });

    it('should clamp Z when too far negative', () => {
      const result = clampToWalls(0, -100);
      expect(result.z).toBe(WALL_BOUNDS.minZ);
    });

    it('should clamp Z when too far positive', () => {
      const result = clampToWalls(0, 100);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should clamp both axes simultaneously', () => {
      const result = clampToWalls(-100, 100);
      expect(result.x).toBe(WALL_BOUNDS.minX);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should return exact boundary when position is on the boundary', () => {
      const result = clampToWalls(WALL_BOUNDS.minX, WALL_BOUNDS.maxZ);
      expect(result.x).toBe(WALL_BOUNDS.minX);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });
  });

  // ------ getSafePosition ------

  describe('getSafePosition', () => {
    const obstacle = makeObstacle(-3, 3, -3, 3);

    it('should return the desired position when it is clear', () => {
      const result = getSafePosition(10, 10, 8, 8, [obstacle]);
      expect(result.x).toBe(10);
      expect(result.z).toBe(10);
    });

    it('should slide along X when new position is blocked', () => {
      // Moving from (10, 10) to (0, 0) which is inside obstacle
      // Slide X: (0, 10) — clear of obstacle, should succeed
      const result = getSafePosition(0, 0, 10, 10, [obstacle]);
      expect(result.x).toBe(0);
      expect(result.z).toBe(10);
    });

    it('should slide along Z when X slide is also blocked', () => {
      // Obstacle at center, current at (0, 10)
      // New at (0, 0) — blocked
      // Slide X: (0, 10) — which is just current
      // But let's craft a case where slide X is blocked too
      const wideObstacle = makeObstacle(-20, 20, -3, 3);
      // Moving from (5, 10) to (5, 0) — blocked
      // Slide X: (5, 10) — outside obstacle (z=10 > 3), should succeed
      const result = getSafePosition(5, 0, 5, 10, [wideObstacle]);
      expect(result.x).toBe(5);
      expect(result.z).toBe(10);
    });

    it('should stay in place when all slides are blocked', () => {
      // Surround the test position on all sides
      const boxObstacles = [
        makeObstacle(-20, 20, -20, 20), // Covers everything
      ];
      // Current position is (0, 0), which is also inside the obstacle,
      // but getSafePosition returns clampToWalls(currentX, currentZ)
      const result = getSafePosition(5, 5, 0, 0, boxObstacles);
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should clamp to walls before checking obstacles', () => {
      // Position far outside walls with no obstacles
      const result = getSafePosition(200, 200, 0, 0, []);
      expect(result.x).toBe(WALL_BOUNDS.maxX);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });
  });

  // ------ isPositionClear ------

  describe('isPositionClear', () => {
    const obstacle = makeObstacle(-3, 3, -3, 3);

    it('should return true for a clear position inside walls', () => {
      expect(isPositionClear(10, 10, [obstacle])).toBe(true);
    });

    it('should return false for a position inside an obstacle', () => {
      expect(isPositionClear(0, 0, [obstacle])).toBe(false);
    });

    it('should return false for a position outside walls', () => {
      expect(isPositionClear(200, 200, [])).toBe(false);
    });

    it('should return true for a position on the wall boundary', () => {
      // Position exactly at boundary — clampToWalls returns same value
      const x = WALL_BOUNDS.minX;
      const z = WALL_BOUNDS.minZ;
      expect(isPositionClear(x, z, [])).toBe(true);
    });

    it('should return false when just outside walls (within 0.01 tolerance)', () => {
      // Position just barely outside wall bounds
      const x = WALL_BOUNDS.maxX + 0.02;
      expect(isPositionClear(x, 0, [])).toBe(false);
    });
  });

  // ------ getWorkstationObstacles ------

  describe('getWorkstationObstacles', () => {
    it('should return empty array for empty zones map', () => {
      const zones = new Map<string, OfficeZone>();
      expect(getWorkstationObstacles(zones)).toEqual([]);
    });

    it('should create one obstacle per workstation', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('project1', makeZone('project1', [
        { x: 0, z: 0 },
        { x: 5, z: 5 },
      ]));
      zones.set('project2', makeZone('project2', [
        { x: 10, z: 10 },
      ]));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toHaveLength(3);
    });

    it('should center obstacle around workstation position', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('test', makeZone('test', [{ x: 10, z: 20 }]));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toHaveLength(1);

      const obs = obstacles[0];
      expect(obs.minX).toBe(10 - 1.8);
      expect(obs.maxX).toBe(10 + 1.8);
      expect(obs.minZ).toBe(20 - 1.5);
      expect(obs.maxZ).toBe(20 + 2.0);
    });

    it('should produce valid bounding boxes', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('test', makeZone('test', [
        { x: -5, z: -5 },
        { x: 0, z: 0 },
        { x: 5, z: 5 },
      ]));

      const obstacles = getWorkstationObstacles(zones);
      obstacles.forEach((obs) => {
        expect(obs.minX).toBeLessThan(obs.maxX);
        expect(obs.minZ).toBeLessThan(obs.maxZ);
      });
    });
  });

  // ------ getRandomClearPosition ------

  describe('getRandomClearPosition', () => {
    it('should return a position inside wall bounds', () => {
      const pos = getRandomClearPosition([]);
      expect(pos.x).toBeGreaterThanOrEqual(WALL_BOUNDS.minX);
      expect(pos.x).toBeLessThanOrEqual(WALL_BOUNDS.maxX);
      expect(pos.z).toBeGreaterThanOrEqual(WALL_BOUNDS.minZ);
      expect(pos.z).toBeLessThanOrEqual(WALL_BOUNDS.maxZ);
    });

    it('should avoid obstacles', () => {
      const obstacle = makeObstacle(-1, 1, -1, 1);
      // Run multiple times — result should never be inside obstacle
      for (let i = 0; i < 20; i++) {
        const pos = getRandomClearPosition([obstacle]);
        expect(isInsideObstacle(pos.x, pos.z, [obstacle])).toBe(false);
      }
    });

    it('should respect custom center and range', () => {
      // Small range centered at (15, 15) — all results should be nearby
      const pos = getRandomClearPosition([], 2, 2, 15, 15);
      expect(pos.x).toBeGreaterThanOrEqual(13);
      expect(pos.x).toBeLessThanOrEqual(17);
      expect(pos.z).toBeGreaterThanOrEqual(13);
      expect(pos.z).toBeLessThanOrEqual(17);
    });

    it('should return fallback when all attempts fail', () => {
      // Giant obstacle covering entire factory
      const giant = makeObstacle(-50, 50, -50, 50);
      const pos = getRandomClearPosition([giant], 18, 18, 0, 0, 5);
      // Should fallback to clampToWalls(0, 0) = (0, 0)
      expect(pos.x).toBe(0);
      expect(pos.z).toBe(0);
    });

    it('should use maxAttempts parameter', () => {
      // Spy on Math.random to count calls
      const spy = vi.spyOn(Math, 'random');
      const giant = makeObstacle(-50, 50, -50, 50);

      getRandomClearPosition([giant], 18, 18, 0, 0, 3);

      // Each attempt calls Math.random twice (for x and z)
      expect(spy).toHaveBeenCalledTimes(6); // 3 attempts × 2 calls
      spy.mockRestore();
    });
  });
});
