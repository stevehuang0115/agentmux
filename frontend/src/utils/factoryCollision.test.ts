/**
 * Tests for Factory Collision utility.
 *
 * Covers obstacle detection, wall clamping, safe position computation,
 * position clearance checks, entity-to-entity collision, entity position
 * map building, random position generation, workstation obstacle computation,
 * and exported constants.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  WALL_BOUNDS,
  STATIC_OBSTACLES,
  ENTITY_BLOCKER_RADIUS,
  getWorkstationObstacles,
  isInsideObstacle,
  clampToWalls,
  getSafePosition,
  isPositionClear,
  isBlockedByEntity,
  buildEntityPositionMap,
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
    it('should be derived from FACTORY_CONSTANTS walls with 1.5 margin', () => {
      const margin = 1.5;
      expect(WALL_BOUNDS.minX).toBe(FACTORY_CONSTANTS.WALLS.BACK_X + margin);
      expect(WALL_BOUNDS.maxX).toBe(FACTORY_CONSTANTS.WALLS.FRONT_X - margin);
      expect(WALL_BOUNDS.minZ).toBe(FACTORY_CONSTANTS.WALLS.LEFT_Z + margin);
      expect(WALL_BOUNDS.maxZ).toBe(FACTORY_CONSTANTS.WALLS.RIGHT_Z - margin);
    });

    it('should define a valid bounding box (min < max on both axes)', () => {
      expect(WALL_BOUNDS.minX).toBeLessThan(WALL_BOUNDS.maxX);
      expect(WALL_BOUNDS.minZ).toBeLessThan(WALL_BOUNDS.maxZ);
    });

    it('should have concrete numeric values matching current wall config', () => {
      // BACK_X = -32, FRONT_X = 32, LEFT_Z = -22, RIGHT_Z = 22
      expect(WALL_BOUNDS.minX).toBe(-30.5);
      expect(WALL_BOUNDS.maxX).toBe(30.5);
      expect(WALL_BOUNDS.minZ).toBe(-20.5);
      expect(WALL_BOUNDS.maxZ).toBe(20.5);
    });
  });

  // ------ STATIC_OBSTACLES ------

  describe('STATIC_OBSTACLES', () => {
    it('should contain the conveyor belt and three kitchen zones', () => {
      // 1 conveyor + 3 kitchen = 4 total
      expect(STATIC_OBSTACLES.length).toBe(4);
    });

    it('each obstacle should have valid bounds (min < max)', () => {
      STATIC_OBSTACLES.forEach((obs) => {
        expect(obs.minX).toBeLessThan(obs.maxX);
        expect(obs.minZ).toBeLessThan(obs.maxZ);
      });
    });

    it('conveyor belt obstacle should cover expected region', () => {
      const conveyor = STATIC_OBSTACLES[0];
      expect(conveyor.minX).toBe(-8.5);
      expect(conveyor.maxX).toBe(8.5);
      expect(conveyor.minZ).toBe(-15.5);
      expect(conveyor.maxZ).toBe(-12.5);
    });

    it('all obstacles should be within factory wall bounds', () => {
      // Obstacles should fit within the outer walls (not WALL_BOUNDS which has margin)
      STATIC_OBSTACLES.forEach((obs) => {
        expect(obs.minX).toBeGreaterThanOrEqual(FACTORY_CONSTANTS.WALLS.BACK_X);
        expect(obs.maxX).toBeLessThanOrEqual(FACTORY_CONSTANTS.WALLS.FRONT_X);
        expect(obs.minZ).toBeGreaterThanOrEqual(FACTORY_CONSTANTS.WALLS.LEFT_Z);
        expect(obs.maxZ).toBeLessThanOrEqual(FACTORY_CONSTANTS.WALLS.RIGHT_Z);
      });
    });
  });

  // ------ ENTITY_BLOCKER_RADIUS ------

  describe('ENTITY_BLOCKER_RADIUS', () => {
    it('should be a positive number', () => {
      expect(ENTITY_BLOCKER_RADIUS).toBeGreaterThan(0);
    });

    it('should be 1.5', () => {
      expect(ENTITY_BLOCKER_RADIUS).toBe(1.5);
    });
  });

  // ------ isInsideObstacle ------

  describe('isInsideObstacle', () => {
    const obstacles: Obstacle[] = [makeObstacle(-5, 5, -5, 5)];

    it('should return true for a point at the center of the obstacle', () => {
      expect(isInsideObstacle(0, 0, obstacles)).toBe(true);
    });

    it('should return true for points on all four corners of the boundary', () => {
      expect(isInsideObstacle(-5, -5, obstacles)).toBe(true);
      expect(isInsideObstacle(5, 5, obstacles)).toBe(true);
      expect(isInsideObstacle(-5, 5, obstacles)).toBe(true);
      expect(isInsideObstacle(5, -5, obstacles)).toBe(true);
    });

    it('should return true for points on each edge of the boundary', () => {
      expect(isInsideObstacle(0, -5, obstacles)).toBe(true); // bottom edge
      expect(isInsideObstacle(0, 5, obstacles)).toBe(true);  // top edge
      expect(isInsideObstacle(-5, 0, obstacles)).toBe(true); // left edge
      expect(isInsideObstacle(5, 0, obstacles)).toBe(true);  // right edge
    });

    it('should return false for points just outside each edge', () => {
      expect(isInsideObstacle(5.01, 0, obstacles)).toBe(false);
      expect(isInsideObstacle(-5.01, 0, obstacles)).toBe(false);
      expect(isInsideObstacle(0, 5.01, obstacles)).toBe(false);
      expect(isInsideObstacle(0, -5.01, obstacles)).toBe(false);
    });

    it('should return false for points far outside the obstacle', () => {
      expect(isInsideObstacle(100, 100, obstacles)).toBe(false);
      expect(isInsideObstacle(-100, -100, obstacles)).toBe(false);
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

    it('should handle overlapping obstacles correctly', () => {
      const overlapping = [
        makeObstacle(-2, 4, -2, 4),
        makeObstacle(2, 8, 2, 8),
      ];
      // Point in overlap region
      expect(isInsideObstacle(3, 3, overlapping)).toBe(true);
      // Point only in first obstacle
      expect(isInsideObstacle(0, 0, overlapping)).toBe(true);
      // Point only in second obstacle
      expect(isInsideObstacle(7, 7, overlapping)).toBe(true);
      // Point in neither
      expect(isInsideObstacle(9, 9, overlapping)).toBe(false);
    });

    it('should handle a zero-size obstacle (point obstacle) where min equals max', () => {
      const pointObstacle = [makeObstacle(3, 3, 7, 7)];
      // Exactly at the point
      expect(isInsideObstacle(3, 7, pointObstacle)).toBe(true);
      // Just off
      expect(isInsideObstacle(3.01, 7, pointObstacle)).toBe(false);
    });
  });

  // ------ clampToWalls ------

  describe('clampToWalls', () => {
    it('should not change a position at the origin (inside walls)', () => {
      const result = clampToWalls(0, 0);
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should not change an arbitrary position inside walls', () => {
      const result = clampToWalls(10, -5);
      expect(result.x).toBe(10);
      expect(result.z).toBe(-5);
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
      expect(result.x).toBe(0);
      expect(result.z).toBe(WALL_BOUNDS.minZ);
    });

    it('should clamp Z when too far positive', () => {
      const result = clampToWalls(0, 100);
      expect(result.x).toBe(0);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should clamp both axes simultaneously', () => {
      const result = clampToWalls(-100, 100);
      expect(result.x).toBe(WALL_BOUNDS.minX);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should return exact boundary when position is already on the boundary', () => {
      const result = clampToWalls(WALL_BOUNDS.minX, WALL_BOUNDS.maxZ);
      expect(result.x).toBe(WALL_BOUNDS.minX);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should return exact boundary for all four corners', () => {
      const corners: Array<{ x: number; z: number }> = [
        { x: WALL_BOUNDS.minX, z: WALL_BOUNDS.minZ },
        { x: WALL_BOUNDS.minX, z: WALL_BOUNDS.maxZ },
        { x: WALL_BOUNDS.maxX, z: WALL_BOUNDS.minZ },
        { x: WALL_BOUNDS.maxX, z: WALL_BOUNDS.maxZ },
      ];
      for (const corner of corners) {
        const result = clampToWalls(corner.x, corner.z);
        expect(result.x).toBe(corner.x);
        expect(result.z).toBe(corner.z);
      }
    });

    it('should clamp extreme values like Infinity', () => {
      const result = clampToWalls(Infinity, -Infinity);
      expect(result.x).toBe(WALL_BOUNDS.maxX);
      expect(result.z).toBe(WALL_BOUNDS.minZ);
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

    it('should clamp to walls before checking obstacles for a clear position', () => {
      const result = getSafePosition(200, 200, 0, 0, []);
      expect(result.x).toBe(WALL_BOUNDS.maxX);
      expect(result.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should slide along X axis when new position is inside obstacle', () => {
      // Moving from (10, 10) to (0, 0) which is inside obstacle.
      // Slide X: clampToWalls(0, 10) = (0, 10) -- clear of obstacle.
      const result = getSafePosition(0, 0, 10, 10, [obstacle]);
      expect(result.x).toBe(0);
      expect(result.z).toBe(10);
    });

    it('should slide along Z axis when both desired and X-slide are blocked', () => {
      // Wide obstacle blocks any X-slide keeping currentZ=0 inside
      const wideObstacle = makeObstacle(-25, 25, -3, 3);
      // Current is at (5, 10). Desired is (5, 0) -- blocked (z=0 in range).
      // Slide X: clampToWalls(5, 10) = (5, 10). z=10 is outside [-3,3], so clear.
      // Actually slide X succeeds here. Let's craft a better scenario:
      // Current at (0, 10). Desired at (0, 0) -- blocked.
      // Slide X: clampToWalls(0, 10) = (0, 10). z=10 outside obstacle, clear.
      // So X-slide succeeds. Need a scenario where X-slide also fails.

      // Two obstacles: one at center, one covering the X-slide position
      const obstacles = [
        makeObstacle(-3, 3, -3, 3),         // blocks desired (0, 0)
        makeObstacle(-3, 3, 8, 12),          // blocks X-slide (0, 10)
      ];
      // Current at (0, 10). Desired (0, 0). Blocked.
      // Slide X: clampToWalls(0, 10) = (0, 10). Inside second obstacle? 10 is in [8,12], yes.
      // Slide Z: clampToWalls(0, 0) = (0, 0). Inside first obstacle? 0 is in [-3,3], yes.
      // All blocked => stay at clampToWalls(0, 10) = (0, 10).
      // Wait, the fallback is clampToWalls(currentX, currentZ) = (0, 10) which is inside
      // second obstacle. The function does not check the fallback for obstacles.
      const result = getSafePosition(0, 0, 0, 10, obstacles);
      // Since all slides are blocked, it returns clampToWalls(currentX, currentZ)
      expect(result.x).toBe(0);
      expect(result.z).toBe(10);
    });

    it('should prefer Z-slide over staying in place when X-slide is blocked', () => {
      // Obstacle covering a horizontal band
      const horizontalObstacle = makeObstacle(-25, 25, -3, 3);
      // Current at (0, 10). Desired at (10, 0) -- blocked.
      // Slide X: clampToWalls(10, 10) = (10, 10). z=10 outside obstacle, clear!
      // X-slide succeeds in this case, so let's do something different.

      // We need: desired blocked, X-slide blocked, Z-slide clear.
      const obstacles = [
        makeObstacle(-5, 5, -5, 5),
      ];
      // Current at (10, 0). Desired at (0, 0) -- blocked (inside obstacle).
      // Slide X: clampToWalls(0, 0) = (0, 0). Inside obstacle? Yes. Blocked.
      // Slide Z: clampToWalls(10, 0) = (10, 0). Inside obstacle? No (x=10 outside). Clear!
      const result = getSafePosition(0, 0, 10, 0, obstacles);
      expect(result.x).toBe(10);
      expect(result.z).toBe(0);
    });

    it('should stay in place when all slides are blocked (giant obstacle)', () => {
      const giantObstacle = [makeObstacle(-50, 50, -50, 50)];
      const result = getSafePosition(5, 5, 0, 0, giantObstacle);
      // All blocked, returns clampToWalls(0, 0) = (0, 0)
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
    });

    it('should handle no obstacles at all', () => {
      const result = getSafePosition(10, 10, 0, 0, []);
      expect(result.x).toBe(10);
      expect(result.z).toBe(10);
    });

    it('should handle current and desired being the same clear position', () => {
      const result = getSafePosition(10, 10, 10, 10, [obstacle]);
      expect(result.x).toBe(10);
      expect(result.z).toBe(10);
    });

    it('should handle current and desired being the same blocked position', () => {
      // Both at center of obstacle
      const result = getSafePosition(0, 0, 0, 0, [obstacle]);
      // Desired blocked, slide X (0, 0) blocked, slide Z (0, 0) blocked,
      // fallback clampToWalls(0, 0) = (0, 0)
      expect(result.x).toBe(0);
      expect(result.z).toBe(0);
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

    it('should return true for a position exactly on the wall boundary', () => {
      expect(isPositionClear(WALL_BOUNDS.minX, WALL_BOUNDS.minZ, [])).toBe(true);
      expect(isPositionClear(WALL_BOUNDS.maxX, WALL_BOUNDS.maxZ, [])).toBe(true);
    });

    it('should return false when just outside walls beyond 0.01 tolerance', () => {
      expect(isPositionClear(WALL_BOUNDS.maxX + 0.02, 0, [])).toBe(false);
      expect(isPositionClear(WALL_BOUNDS.minX - 0.02, 0, [])).toBe(false);
      expect(isPositionClear(0, WALL_BOUNDS.maxZ + 0.02, [])).toBe(false);
      expect(isPositionClear(0, WALL_BOUNDS.minZ - 0.02, [])).toBe(false);
    });

    it('should return true with no obstacles and position inside walls', () => {
      expect(isPositionClear(0, 0, [])).toBe(true);
    });

    it('should return false when position is on obstacle boundary', () => {
      // Point exactly on the obstacle edge is considered inside
      expect(isPositionClear(3, 3, [obstacle])).toBe(false);
    });

    it('should check against multiple obstacles', () => {
      const obstacles = [
        makeObstacle(0, 2, 0, 2),
        makeObstacle(10, 12, 10, 12),
      ];
      expect(isPositionClear(1, 1, obstacles)).toBe(false);
      expect(isPositionClear(11, 11, obstacles)).toBe(false);
      expect(isPositionClear(5, 5, obstacles)).toBe(true);
    });
  });

  // ------ isBlockedByEntity ------

  describe('isBlockedByEntity', () => {
    it('should return false when entity map is empty', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(false);
    });

    it('should exclude own ID from blocking check', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('self', { x: 0, z: 0 });
      // Position exactly at own location should not be blocked
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(false);
    });

    it('should return true when another entity is within blocker radius', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('other', { x: 1, z: 0 });
      // Distance = 1, which is less than ENTITY_BLOCKER_RADIUS (1.5)
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(true);
    });

    it('should return false when another entity is outside blocker radius', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('other', { x: 10, z: 10 });
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(false);
    });

    it('should return true when another entity is at the exact same position', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('other', { x: 5, z: 5 });
      expect(isBlockedByEntity(5, 5, 'self', entityPositions)).toBe(true);
    });

    it('should return false when exactly at the blocker radius boundary', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      // Place entity exactly at ENTITY_BLOCKER_RADIUS distance along X axis
      entityPositions.set('other', { x: ENTITY_BLOCKER_RADIUS, z: 0 });
      // Distance equals radius. The check uses strict less-than (dx*dx + dz*dz < radiusSq)
      // So exactly at the boundary is NOT blocked.
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(false);
    });

    it('should return true when just inside the blocker radius', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('other', { x: ENTITY_BLOCKER_RADIUS - 0.01, z: 0 });
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(true);
    });

    it('should check against multiple entities', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('far-entity', { x: 100, z: 100 });
      entityPositions.set('close-entity', { x: 0.5, z: 0.5 });
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(true);
    });

    it('should not be blocked when only own entity is nearby', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('self', { x: 0, z: 0 });
      entityPositions.set('far-entity', { x: 50, z: 50 });
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(false);
    });

    it('should use squared distance comparison (diagonal check)', () => {
      const entityPositions = new Map<string, { x: number; z: number }>();
      // Distance diagonally: sqrt(1^2 + 1^2) = sqrt(2) ~ 1.414 < 1.5
      entityPositions.set('other', { x: 1, z: 1 });
      expect(isBlockedByEntity(0, 0, 'self', entityPositions)).toBe(true);

      // Distance diagonally: sqrt(1.1^2 + 1.1^2) = sqrt(2.42) ~ 1.556 > 1.5
      const entityPositions2 = new Map<string, { x: number; z: number }>();
      entityPositions2.set('other', { x: 1.1, z: 1.1 });
      expect(isBlockedByEntity(0, 0, 'self', entityPositions2)).toBe(false);
    });
  });

  // ------ buildEntityPositionMap ------

  describe('buildEntityPositionMap', () => {
    it('should return empty map when both inputs are empty', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      const npcs = new Map<string, { x: number; z: number }>();

      const result = buildEntityPositionMap(agents, npcs);
      expect(result.size).toBe(0);
    });

    it('should include agent positions using currentPosition when available', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      agents.set('agent-1', {
        currentPosition: { x: 5, z: 10 },
        basePosition: { x: 0, z: 0 },
      });

      const npcs = new Map<string, { x: number; z: number }>();
      const result = buildEntityPositionMap(agents, npcs);

      expect(result.size).toBe(1);
      expect(result.get('agent-1')).toEqual({ x: 5, z: 10 });
    });

    it('should fall back to basePosition when currentPosition is undefined', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      agents.set('agent-1', {
        currentPosition: undefined,
        basePosition: { x: 7, z: 14 },
      });

      const npcs = new Map<string, { x: number; z: number }>();
      const result = buildEntityPositionMap(agents, npcs);

      expect(result.size).toBe(1);
      expect(result.get('agent-1')).toEqual({ x: 7, z: 14 });
    });

    it('should include NPC positions', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      const npcs = new Map<string, { x: number; z: number }>();
      npcs.set('steve-jobs-npc', { x: -26, z: -14 });

      const result = buildEntityPositionMap(agents, npcs);
      expect(result.size).toBe(1);
      expect(result.get('steve-jobs-npc')).toEqual({ x: -26, z: -14 });
    });

    it('should merge agents and NPCs into one map', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      agents.set('agent-1', {
        currentPosition: { x: 1, z: 2 },
        basePosition: { x: 0, z: 0 },
      });
      agents.set('agent-2', {
        basePosition: { x: 3, z: 4 },
      });

      const npcs = new Map<string, { x: number; z: number }>();
      npcs.set('npc-1', { x: 10, z: 20 });
      npcs.set('npc-2', { x: 30, z: 40 });

      const result = buildEntityPositionMap(agents, npcs);
      expect(result.size).toBe(4);
      expect(result.get('agent-1')).toEqual({ x: 1, z: 2 });
      expect(result.get('agent-2')).toEqual({ x: 3, z: 4 });
      expect(result.get('npc-1')).toEqual({ x: 10, z: 20 });
      expect(result.get('npc-2')).toEqual({ x: 30, z: 40 });
    });

    it('should handle NPC overriding agent with same ID (last write wins)', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      agents.set('shared-id', {
        currentPosition: { x: 1, z: 1 },
        basePosition: { x: 0, z: 0 },
      });

      const npcs = new Map<string, { x: number; z: number }>();
      npcs.set('shared-id', { x: 99, z: 99 });

      const result = buildEntityPositionMap(agents, npcs);
      // NPC is set after agent, so NPC value should win
      expect(result.get('shared-id')).toEqual({ x: 99, z: 99 });
    });

    it('should produce position objects with only x and z (no extra properties)', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      agents.set('agent-1', {
        currentPosition: { x: 5, z: 10 },
        basePosition: { x: 0, z: 0 },
      });

      const npcs = new Map<string, { x: number; z: number }>();
      const result = buildEntityPositionMap(agents, npcs);

      const pos = result.get('agent-1');
      expect(pos).toBeDefined();
      expect(Object.keys(pos!)).toEqual(expect.arrayContaining(['x', 'z']));
      expect(Object.keys(pos!)).toHaveLength(2);
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

    it('should center obstacle around workstation position with correct padding', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('test', makeZone('test', [{ x: 10, z: 20 }]));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toHaveLength(1);

      const obs = obstacles[0];
      // Padding: x +/- 1.8, z -1.5 / +2.0
      expect(obs.minX).toBe(10 - 1.8);
      expect(obs.maxX).toBe(10 + 1.8);
      expect(obs.minZ).toBe(20 - 1.5);
      expect(obs.maxZ).toBe(20 + 2.0);
    });

    it('should produce valid bounding boxes for all workstations', () => {
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

    it('should handle zones with no workstations', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('empty', makeZone('empty', []));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toEqual([]);
    });

    it('should handle negative workstation positions', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('negative', makeZone('negative', [{ x: -20, z: -15 }]));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toHaveLength(1);
      expect(obstacles[0].minX).toBe(-20 - 1.8);
      expect(obstacles[0].maxX).toBe(-20 + 1.8);
      expect(obstacles[0].minZ).toBe(-15 - 1.5);
      expect(obstacles[0].maxZ).toBe(-15 + 2.0);
    });

    it('should handle workstations at the same position (overlapping obstacles)', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('overlap', makeZone('overlap', [
        { x: 5, z: 5 },
        { x: 5, z: 5 },
      ]));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toHaveLength(2);
      expect(obstacles[0]).toEqual(obstacles[1]);
    });

    it('should aggregate workstations across multiple zones', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('alpha', makeZone('alpha', [{ x: 0, z: 0 }]));
      zones.set('beta', makeZone('beta', [{ x: 10, z: 10 }, { x: 20, z: 20 }]));
      zones.set('gamma', makeZone('gamma', [{ x: 30, z: 30 }]));

      const obstacles = getWorkstationObstacles(zones);
      expect(obstacles).toHaveLength(4);
    });
  });

  // ------ getRandomClearPosition ------

  describe('getRandomClearPosition', () => {
    it('should return a position inside wall bounds with no obstacles', () => {
      const pos = getRandomClearPosition([]);
      expect(pos.x).toBeGreaterThanOrEqual(WALL_BOUNDS.minX);
      expect(pos.x).toBeLessThanOrEqual(WALL_BOUNDS.maxX);
      expect(pos.z).toBeGreaterThanOrEqual(WALL_BOUNDS.minZ);
      expect(pos.z).toBeLessThanOrEqual(WALL_BOUNDS.maxZ);
    });

    it('should avoid obstacles', () => {
      const obstacle = makeObstacle(-1, 1, -1, 1);
      for (let i = 0; i < 30; i++) {
        const pos = getRandomClearPosition([obstacle]);
        expect(isInsideObstacle(pos.x, pos.z, [obstacle])).toBe(false);
      }
    });

    it('should respect custom center and range', () => {
      // Small range centered at (15, 15)
      const pos = getRandomClearPosition([], 2, 2, 15, 15);
      expect(pos.x).toBeGreaterThanOrEqual(13);
      expect(pos.x).toBeLessThanOrEqual(17);
      expect(pos.z).toBeGreaterThanOrEqual(13);
      expect(pos.z).toBeLessThanOrEqual(17);
    });

    it('should return fallback when all attempts fail (giant obstacle)', () => {
      const giant = makeObstacle(-50, 50, -50, 50);
      const pos = getRandomClearPosition([giant], 18, 18, 0, 0, 5);
      // Should fallback to clampToWalls(0, 0) = (0, 0)
      expect(pos.x).toBe(0);
      expect(pos.z).toBe(0);
    });

    it('should return fallback clamped to walls when center is outside walls', () => {
      const giant = makeObstacle(-50, 50, -50, 50);
      const pos = getRandomClearPosition([giant], 1, 1, 200, 200, 1);
      // Fallback: clampToWalls(200, 200) = (WALL_BOUNDS.maxX, WALL_BOUNDS.maxZ)
      expect(pos.x).toBe(WALL_BOUNDS.maxX);
      expect(pos.z).toBe(WALL_BOUNDS.maxZ);
    });

    it('should use maxAttempts parameter controlling Math.random calls', () => {
      const spy = vi.spyOn(Math, 'random');
      const giant = makeObstacle(-50, 50, -50, 50);

      getRandomClearPosition([giant], 18, 18, 0, 0, 3);

      // Each attempt calls Math.random twice (for x and z)
      expect(spy).toHaveBeenCalledTimes(6);
      spy.mockRestore();
    });

    it('should succeed on first attempt when position is clear', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // Math.random() = 0.5 => (0.5 - 0.5) * range * 2 = 0 => x=centerX, z=centerZ
      const pos = getRandomClearPosition([], 10, 10, 5, 5, 10);
      expect(pos.x).toBe(5);
      expect(pos.z).toBe(5);
      // Should only call random twice (one successful attempt)
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('should handle zero-range by always generating center position', () => {
      const pos = getRandomClearPosition([], 0, 0, 10, 10);
      expect(pos.x).toBe(10);
      expect(pos.z).toBe(10);
    });

    it('should handle maxAttempts of 0 by immediately returning fallback', () => {
      const spy = vi.spyOn(Math, 'random');
      const pos = getRandomClearPosition([], 10, 10, 0, 0, 0);
      // With 0 attempts, the loop never executes
      expect(spy).not.toHaveBeenCalled();
      // Returns clampToWalls(0, 0) = (0, 0)
      expect(pos.x).toBe(0);
      expect(pos.z).toBe(0);
      spy.mockRestore();
    });

    it('should return a clear position even with many small obstacles', () => {
      // Scatter small obstacles but leave most of the space open
      const obstacles = [
        makeObstacle(-2, -1, -2, -1),
        makeObstacle(1, 2, 1, 2),
        makeObstacle(-2, -1, 1, 2),
        makeObstacle(1, 2, -2, -1),
      ];
      for (let i = 0; i < 20; i++) {
        const pos = getRandomClearPosition(obstacles, 10, 10, 0, 0, 50);
        expect(isPositionClear(pos.x, pos.z, obstacles)).toBe(true);
      }
    });
  });

  // ------ Integration: combining functions ------

  describe('integration scenarios', () => {
    it('should correctly identify workstation obstacles as blocking for isPositionClear', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('proj', makeZone('proj', [{ x: 10, z: 10 }]));
      const wsObstacles = getWorkstationObstacles(zones);

      // Position at workstation center should be blocked
      expect(isPositionClear(10, 10, wsObstacles)).toBe(false);
      // Position far from workstation should be clear
      expect(isPositionClear(0, 0, wsObstacles)).toBe(true);
    });

    it('should safely navigate around combined static and workstation obstacles', () => {
      const zones = new Map<string, OfficeZone>();
      zones.set('proj', makeZone('proj', [{ x: 10, z: 10 }]));
      const wsObstacles = getWorkstationObstacles(zones);
      const allObstacles = [...STATIC_OBSTACLES, ...wsObstacles];

      // Attempt to move into a workstation -- should get a safe alternative
      const safe = getSafePosition(10, 10, 15, 15, allObstacles);
      expect(isInsideObstacle(safe.x, safe.z, allObstacles)).toBe(false);
    });

    it('should combine entity blocking with obstacle checking', () => {
      const obstacle = makeObstacle(-3, 3, -3, 3);
      const entityPositions = new Map<string, { x: number; z: number }>();
      entityPositions.set('npc-1', { x: 10, z: 10 });

      // Position clear of obstacles but blocked by entity
      expect(isInsideObstacle(10, 10, [obstacle])).toBe(false);
      expect(isBlockedByEntity(10, 10, 'agent-1', entityPositions)).toBe(true);

      // Position blocked by obstacle
      expect(isInsideObstacle(0, 0, [obstacle])).toBe(true);

      // Position clear of both
      expect(isInsideObstacle(20, 20, [obstacle])).toBe(false);
      expect(isBlockedByEntity(20, 20, 'agent-1', entityPositions)).toBe(false);
    });

    it('should build entity map and use it for blocking checks', () => {
      const agents = new Map<
        string,
        { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }
      >();
      agents.set('agent-1', {
        currentPosition: { x: 5, z: 5 },
        basePosition: { x: 0, z: 0 },
      });

      const npcs = new Map<string, { x: number; z: number }>();
      npcs.set('npc-1', { x: 15, z: 15 });

      const entityMap = buildEntityPositionMap(agents, npcs);

      // agent-2 trying to move near agent-1
      expect(isBlockedByEntity(5, 5, 'agent-2', entityMap)).toBe(true);
      // agent-1 checking own position -- not blocked
      expect(isBlockedByEntity(5, 5, 'agent-1', entityMap)).toBe(false);
      // agent-2 trying to move near npc-1
      expect(isBlockedByEntity(15, 15, 'agent-2', entityMap)).toBe(true);
      // agent-2 far from everyone
      expect(isBlockedByEntity(25, 0, 'agent-2', entityMap)).toBe(false);
    });
  });
});
