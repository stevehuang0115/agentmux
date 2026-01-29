/**
 * Factory Utilities - Helper functions for factory visualization.
 *
 * Extracted from FactoryContext for better testability and reuse.
 */

import * as THREE from 'three';
import { AnimalType, CameraState, FACTORY_CONSTANTS } from '../types/factory.types';

/**
 * Simple hash function for string to number conversion.
 * Uses djb2 algorithm for better distribution.
 *
 * @param str - Input string to hash
 * @returns Positive integer hash value
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Available animal types with models.
 * All animals have consistent height (2.0 units) and Mixamo animations.
 */
const AVAILABLE_ANIMALS: AnimalType[] = ['cow', 'horse', 'tiger', 'rabbit'];

/**
 * Determines animal type based on project name hash.
 * Provides consistent animal assignment per project.
 * Uses all available animal models (cow, horse, tiger, rabbit).
 *
 * @param projectName - Name of the project
 * @param index - Workstation index (unused, kept for API compatibility)
 * @returns Animal type for the agent
 *
 * @example
 * ```typescript
 * const animal = getAnimalTypeForProject('MyProject', 0);
 * // Returns same animal type for same project name
 * ```
 */
export function getAnimalTypeForProject(projectName: string, index: number): AnimalType {
  // Use project name hash to determine animal type
  // This ensures all agents in the same project have the same animal type
  const hash = hashString(projectName);
  const animalIndex = hash % AVAILABLE_ANIMALS.length;

  return AVAILABLE_ANIMALS[animalIndex];
}

/**
 * Check if it should be night based on local time (6 PM - 6 AM)
 *
 * @param hour - Optional hour to check (for testing), defaults to current hour
 * @returns True if time is between 6 PM and 6 AM
 *
 * @example
 * ```typescript
 * if (isNightTime()) {
 *   // Enable night mode lighting
 * }
 * ```
 */
export function isNightTime(hour?: number): boolean {
  const h = hour ?? new Date().getHours();
  return h >= 18 || h < 6;
}

/**
 * Creates initial camera state with default position and orientation.
 *
 * @returns Default camera state with position, target, yaw, and pitch
 */
export function createInitialCameraState(): CameraState {
  // CCTV-style view from upper floor corner, looking down diagonally
  // Position in back-left corner of upper floor, high up (inside building bounds)
  const position = new THREE.Vector3(-28, 22, -18);
  const target = new THREE.Vector3(15, 2, 10); // Looking diagonally down at ground floor

  // Calculate initial yaw/pitch to look at target
  const toTarget = target.clone().sub(position);
  const yaw = Math.atan2(toTarget.x, toTarget.z);
  const pitch = Math.atan2(
    toTarget.y,
    Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z)
  );

  return {
    yaw,
    pitch,
    position,
    target,
    isAnimating: false,
  };
}

/**
 * Easing function for smooth camera transitions.
 * Uses cubic ease-in-out for natural-feeling motion.
 *
 * @param t - Progress value from 0 to 1
 * @returns Eased value from 0 to 1
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Calculates zone grid position based on index.
 *
 * @param zoneIndex - Index of the zone (0-based)
 * @param zonesPerRow - Number of zones per row
 * @param zoneWidth - Width of each zone
 * @param zoneDepth - Depth of each zone
 * @param gap - Gap between zones
 * @returns Object with x and z coordinates
 */
export function calculateZonePosition(
  zoneIndex: number,
  zonesPerRow: number = FACTORY_CONSTANTS.ZONE.ZONES_PER_ROW,
  zoneWidth: number = FACTORY_CONSTANTS.ZONE.WIDTH,
  zoneDepth: number = FACTORY_CONSTANTS.ZONE.DEPTH,
  gap: number = 2
): { x: number; z: number } {
  const row = Math.floor(zoneIndex / zonesPerRow);
  const col = zoneIndex % zonesPerRow;

  const totalWidth = zonesPerRow * zoneWidth + (zonesPerRow - 1) * gap;
  const startX = -totalWidth / 2 + zoneWidth / 2;

  return {
    x: startX + col * (zoneWidth + gap),
    z: row * (zoneDepth + gap),
  };
}

/**
 * Calculates workstation positions within a zone.
 *
 * @param zoneX - X coordinate of zone center
 * @param zoneZ - Z coordinate of zone center
 * @returns Array of 4 workstation positions
 */
export function calculateWorkstationPositions(
  zoneX: number,
  zoneZ: number
): Array<{ x: number; z: number }> {
  return FACTORY_CONSTANTS.WORKSTATION_POSITIONS.map((pos) => ({
    x: zoneX + pos.x,
    z: zoneZ + pos.z,
  }));
}

/**
 * Calculates 3D view direction vector from yaw and pitch angles.
 * Used for camera look direction and zoom.
 *
 * @param yaw - Horizontal rotation angle in radians
 * @param pitch - Vertical rotation angle in radians
 * @param out - Optional output vector to reuse (avoids allocation)
 * @returns THREE.Vector3 representing the view direction
 */
export function calculateViewDirection(
  yaw: number,
  pitch: number,
  out?: THREE.Vector3
): THREE.Vector3 {
  const x = Math.sin(yaw) * Math.cos(pitch);
  const y = Math.sin(pitch);
  const z = Math.cos(yaw) * Math.cos(pitch);
  return out ? out.set(x, y, z) : new THREE.Vector3(x, y, z);
}

/**
 * Calculates horizontal movement direction from yaw angle.
 * Used for WASD ground movement (ignores pitch).
 *
 * @param yaw - Horizontal rotation angle in radians
 * @param out - Optional output vector to reuse (avoids allocation)
 * @returns THREE.Vector3 representing the forward direction on the ground plane
 */
export function calculateMoveDirection(yaw: number, out?: THREE.Vector3): THREE.Vector3 {
  const x = Math.sin(yaw);
  const z = Math.cos(yaw);
  return out ? out.set(x, 0, z) : new THREE.Vector3(x, 0, z);
}

/**
 * Calculates the right movement direction from yaw angle.
 * Used for strafing movement (A/D keys).
 *
 * @param yaw - Horizontal rotation angle in radians
 * @param out - Optional output vector to reuse (avoids allocation)
 * @returns THREE.Vector3 representing the right direction on the ground plane
 */
export function calculateRightDirection(yaw: number, out?: THREE.Vector3): THREE.Vector3 {
  const x = Math.sin(yaw + Math.PI / 2);
  const z = Math.cos(yaw + Math.PI / 2);
  return out ? out.set(x, 0, z) : new THREE.Vector3(x, 0, z);
}
