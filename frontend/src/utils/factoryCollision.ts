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
  // Mini kitchen at (-27, 0, 3) - split into 3 zones so stool seats remain accessible.
  // Back area (behind back stools at z=1.2)
  { minX: -29.5, maxX: -24.5, minZ: -2.5, maxZ: 0.5 },
  // Counter center (between back stools at z=1.2 and front stools at z=4.8)
  { minX: -29.5, maxX: -24.5, minZ: 1.8, maxZ: 4.2 },
  // Appliance area (beyond front stools, towards wall)
  { minX: -29.5, maxX: -24.5, minZ: 5.5, maxZ: 8.5 },
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

/** Reusable position object for internal clampToWalls calls */
const _tempPosition = { x: 0, z: 0 };

/**
 * Clamp a position to stay within wall boundaries.
 *
 * @param x - World X position
 * @param z - World Z position
 * @param out - Optional output object to avoid allocation (uses internal temp if not provided)
 * @returns Clamped position (same as out if provided)
 */
export function clampToWalls(
  x: number,
  z: number,
  out?: { x: number; z: number }
): { x: number; z: number } {
  const result = out || { x: 0, z: 0 };
  result.x = Math.max(WALL_BOUNDS.minX, Math.min(WALL_BOUNDS.maxX, x));
  result.z = Math.max(WALL_BOUNDS.minZ, Math.min(WALL_BOUNDS.maxZ, z));
  return result;
}

/** Reusable temp objects for getSafePosition to avoid per-frame allocations */
const _safePosClamped = { x: 0, z: 0 };
const _safePosSlideX = { x: 0, z: 0 };
const _safePosSlideZ = { x: 0, z: 0 };
const _safePosFallback = { x: 0, z: 0 };

/**
 * Get a safe position that avoids obstacles and stays within walls.
 * If the desired position is blocked, returns the current position (stops movement).
 *
 * @param newX - Desired X position
 * @param newZ - Desired Z position
 * @param currentX - Current X position (fallback)
 * @param currentZ - Current Z position (fallback)
 * @param obstacles - All obstacle rectangles to avoid
 * @param out - Optional output object to avoid allocation
 * @returns Safe position (same as out if provided)
 */
export function getSafePosition(
  newX: number,
  newZ: number,
  currentX: number,
  currentZ: number,
  obstacles: Obstacle[],
  out?: { x: number; z: number }
): { x: number; z: number } {
  const result = out || { x: 0, z: 0 };

  // First clamp to walls (using internal temp)
  clampToWalls(newX, newZ, _safePosClamped);

  // Then check obstacles
  if (!isInsideObstacle(_safePosClamped.x, _safePosClamped.z, obstacles)) {
    result.x = _safePosClamped.x;
    result.z = _safePosClamped.z;
    return result;
  }

  // Try sliding along X axis only
  clampToWalls(_safePosClamped.x, currentZ, _safePosSlideX);
  if (!isInsideObstacle(_safePosSlideX.x, _safePosSlideX.z, obstacles)) {
    result.x = _safePosSlideX.x;
    result.z = _safePosSlideX.z;
    return result;
  }

  // Try sliding along Z axis only
  clampToWalls(currentX, _safePosClamped.z, _safePosSlideZ);
  if (!isInsideObstacle(_safePosSlideZ.x, _safePosSlideZ.z, obstacles)) {
    result.x = _safePosSlideZ.x;
    result.z = _safePosSlideZ.z;
    return result;
  }

  // All blocked - stay in place
  clampToWalls(currentX, currentZ, _safePosFallback);
  result.x = _safePosFallback.x;
  result.z = _safePosFallback.z;
  return result;
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
  // Inline bounds check to avoid object allocation
  if (
    x < WALL_BOUNDS.minX ||
    x > WALL_BOUNDS.maxX ||
    z < WALL_BOUNDS.minZ ||
    z > WALL_BOUNDS.maxZ
  ) {
    return false;
  }
  return !isInsideObstacle(x, z, obstacles);
}

// ====== ENTITY-TO-ENTITY COLLISION ======

/** Minimum distance between entities to prevent overlap */
export const ENTITY_BLOCKER_RADIUS = 1.5;

/**
 * Check if a position is too close to any tracked entity (NPC or agent).
 * Each entity's own position is excluded from the check.
 *
 * @param x - Desired X position
 * @param z - Desired Z position
 * @param ownId - ID of the entity being moved (excluded from check)
 * @param entityPositions - Map of entity ID to position (x, z)
 * @returns true if the position is blocked by another entity
 */
export function isBlockedByEntity(
  x: number,
  z: number,
  ownId: string,
  entityPositions: Map<string, { x: number; z: number }>
): boolean {
  const radiusSq = ENTITY_BLOCKER_RADIUS * ENTITY_BLOCKER_RADIUS;
  for (const [id, pos] of entityPositions) {
    if (id === ownId) continue;
    const dx = x - pos.x;
    const dz = z - pos.z;
    if (dx * dx + dz * dz < radiusSq) {
      return true;
    }
  }
  return false;
}

/**
 * Build a combined map of all entity positions (agents + NPCs) for collision checks.
 *
 * @param agents - Map of agent ID to agent data with position
 * @param npcPositions - Map of NPC ID to tracked position
 * @returns Combined map of entity ID to {x, z} position
 */
export function buildEntityPositionMap(
  agents: Map<string, { currentPosition?: { x: number; z: number }; basePosition: { x: number; z: number } }>,
  npcPositions: Map<string, { x: number; z: number }>
): Map<string, { x: number; z: number }> {
  const positions = new Map<string, { x: number; z: number }>();
  agents.forEach((agent, id) => {
    const pos = agent.currentPosition || agent.basePosition;
    positions.set(id, { x: pos.x, z: pos.z });
  });
  npcPositions.forEach((pos, id) => {
    positions.set(id, { x: pos.x, z: pos.z });
  });
  return positions;
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
