/**
 * Factory Collision - Obstacle and wall boundary checking for NPC/agent movement.
 *
 * Provides rectangular obstacle definitions and collision checks so that
 * characters cannot walk through conveyor belts, workstations, or walls.
 */

import { FACTORY_CONSTANTS, OfficeZone } from '../types/factory.types';

/**
 * Axis-aligned rectangle in the XZ plane used as a movement blocker.
 */
export interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// ====== WALL BOUNDARIES ======

const WALL_MARGIN = 1.5;

/**
 * Inner wall boundaries with margin so characters stay inside the building.
 */
export const WALL_BOUNDS = {
  minX: FACTORY_CONSTANTS.WALLS.BACK_X + WALL_MARGIN,
  maxX: FACTORY_CONSTANTS.WALLS.FRONT_X - WALL_MARGIN,
  minZ: FACTORY_CONSTANTS.WALLS.LEFT_Z + WALL_MARGIN,
  maxZ: FACTORY_CONSTANTS.WALLS.RIGHT_Z - WALL_MARGIN,
};

// ====== STATIC OBSTACLES ======

/**
 * Obstacles that never change position (conveyor belt, stage platform, etc.)
 */
export const STATIC_OBSTACLES: Obstacle[] = [
  // Conveyor belt: group at (0, 0, -14), 16 units long (X), ~1.2 units wide (Z)
  // Add padding for character width
  { minX: -8.5, maxX: 8.5, minZ: -15.5, maxZ: -12.5 },
  // Mini kitchen: group at (-27, 0, 3), rotated 90° to face window. Footprint 5 wide (X) × 10 deep (Z)
  { minX: -29.5, maxX: -24.5, minZ: -2.5, maxZ: 8.5 },
];

// ====== DYNAMIC OBSTACLE COMPUTATION ======

/**
 * Compute obstacle rectangles for all workstation desks from zone data.
 * Each desk is ~2 units wide, ~1 unit deep with a chair behind it.
 *
 * @param zones - Map of project name to office zone
 * @returns Array of obstacle rectangles covering each workstation area
 */
export function getWorkstationObstacles(zones: Map<string, OfficeZone>): Obstacle[] {
  const obstacles: Obstacle[] = [];

  zones.forEach((zone) => {
    zone.workstations.forEach((ws) => {
      // Desk + chair area with padding for larger NPC models
      obstacles.push({
        minX: ws.position.x - 1.8,
        maxX: ws.position.x + 1.8,
        minZ: ws.position.z - 1.5,
        maxZ: ws.position.z + 2.0,
      });
    });
  });

  return obstacles;
}

// ====== COLLISION CHECKS ======

/**
 * Check if a point is inside any obstacle rectangle.
 *
 * @param x - World X position
 * @param z - World Z position
 * @param obstacles - Array of obstacle rectangles to check against
 * @returns true if the point is inside an obstacle
 */
export function isInsideObstacle(x: number, z: number, obstacles: Obstacle[]): boolean {
  for (const obs of obstacles) {
    if (x >= obs.minX && x <= obs.maxX && z >= obs.minZ && z <= obs.maxZ) {
      return true;
    }
  }
  return false;
}

/**
 * Clamp a position to stay within wall boundaries.
 *
 * @param x - World X position
 * @param z - World Z position
 * @returns Clamped position
 */
export function clampToWalls(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(WALL_BOUNDS.minX, Math.min(WALL_BOUNDS.maxX, x)),
    z: Math.max(WALL_BOUNDS.minZ, Math.min(WALL_BOUNDS.maxZ, z)),
  };
}

/**
 * Get a safe position that avoids obstacles and stays within walls.
 * If the desired position is blocked, returns the current position (stops movement).
 *
 * @param newX - Desired X position
 * @param newZ - Desired Z position
 * @param currentX - Current X position (fallback)
 * @param currentZ - Current Z position (fallback)
 * @param obstacles - All obstacle rectangles to avoid
 * @returns Safe position
 */
export function getSafePosition(
  newX: number,
  newZ: number,
  currentX: number,
  currentZ: number,
  obstacles: Obstacle[]
): { x: number; z: number } {
  // First clamp to walls
  const clamped = clampToWalls(newX, newZ);

  // Then check obstacles
  if (!isInsideObstacle(clamped.x, clamped.z, obstacles)) {
    return clamped;
  }

  // Try sliding along X axis only
  const slideX = clampToWalls(clamped.x, currentZ);
  if (!isInsideObstacle(slideX.x, slideX.z, obstacles)) {
    return slideX;
  }

  // Try sliding along Z axis only
  const slideZ = clampToWalls(currentX, clamped.z);
  if (!isInsideObstacle(slideZ.x, slideZ.z, obstacles)) {
    return slideZ;
  }

  // All blocked - stay in place
  return clampToWalls(currentX, currentZ);
}

/**
 * Check if a target position is reachable (not inside an obstacle or wall).
 * Useful for validating NPC targets before starting to walk.
 *
 * @param x - Target X position
 * @param z - Target Z position
 * @param obstacles - Obstacles to check
 * @returns true if the position is clear
 */
export function isPositionClear(x: number, z: number, obstacles: Obstacle[]): boolean {
  const clamped = clampToWalls(x, z);
  // Check the position was actually clamped (was outside walls)
  if (Math.abs(clamped.x - x) > 0.01 || Math.abs(clamped.z - z) > 0.01) {
    return false;
  }
  return !isInsideObstacle(x, z, obstacles);
}

/**
 * Generate a random position within wall bounds that is not inside any obstacle.
 * Tries up to maxAttempts times, then returns a fallback at factory center.
 *
 * @param obstacles - All obstacles to avoid
 * @param rangeX - Half-width of the random range (position will be -rangeX to +rangeX)
 * @param rangeZ - Half-depth of the random range (position will be -rangeZ to +rangeZ)
 * @param centerX - Center X of the random range
 * @param centerZ - Center Z of the random range
 * @param maxAttempts - Maximum attempts before using fallback
 * @returns A clear position
 */
export function getRandomClearPosition(
  obstacles: Obstacle[],
  rangeX: number = 18,
  rangeZ: number = 18,
  centerX: number = 0,
  centerZ: number = 0,
  maxAttempts: number = 15
): { x: number; z: number } {
  for (let i = 0; i < maxAttempts; i++) {
    const x = centerX + (Math.random() - 0.5) * rangeX * 2;
    const z = centerZ + (Math.random() - 0.5) * rangeZ * 2;
    if (isPositionClear(x, z, obstacles)) {
      return { x, z };
    }
  }
  // Fallback: factory center area (likely clear)
  return clampToWalls(centerX, centerZ);
}
