/**
 * Shared Three.js helper utilities for Factory3D components.
 *
 * Provides common operations for scene cloning, material fixing,
 * animation processing, scene disposal, and rotation math used
 * across all agent and NPC components.
 */

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/**
 * Clone a GLTF scene and fix materials for better visibility.
 *
 * Clones each mesh's material to avoid shared-reference issues,
 * then nullifies metalness/roughness maps and sets fixed values
 * so models display correctly under scene lighting.
 *
 * @param scene - The original GLTF scene to clone
 * @returns A deep clone with fixed materials
 */
export function cloneAndFixMaterials(scene: THREE.Object3D): THREE.Object3D {
  const clone = SkeletonUtils.clone(scene);

  clone.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material) {
        child.material = (child.material as THREE.Material).clone();
      }
      const mat = child.material as THREE.MeshStandardMaterial;

      if (mat && mat.isMeshStandardMaterial) {
        mat.metalnessMap = null;
        mat.roughnessMap = null;
        mat.metalness = 0.0;
        mat.roughness = 0.7;
        mat.needsUpdate = true;
      }
    }
  });

  return clone;
}


/**
 * Remove root motion (Hips position track) from animation clips.
 *
 * Filters out the root bone's position track to prevent world-space
 * drift while preserving other bone position tracks for correct
 * skeletal animation.
 *
 * @param animations - Array of GLTF animation clips
 * @returns Processed clips without root position tracks
 */
export function removeRootMotion(animations: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return animations.map((clip) => {
    const tracks = clip.tracks.filter((track) => {
      const isRootPositionTrack =
        track.name.includes('Hips') && track.name.endsWith('.position');
      return !isRootPositionTrack;
    });
    return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  });
}


/**
 * Dispose all geometry and materials in a scene graph.
 *
 * Traverses the scene tree and calls dispose() on every mesh's
 * geometry and material(s) to free GPU memory.
 *
 * @param scene - The scene or group to dispose
 */
export function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

/**
 * Normalize a rotation difference to the [-PI, PI] range.
 *
 * @param diff - Raw rotation difference in radians
 * @returns Normalized difference in [-PI, PI]
 */
export function normalizeRotationDiff(diff: number): number {
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * Smoothly rotate a group towards a target rotation.
 *
 * @param group - The Three.js group to rotate
 * @param targetRotation - Target Y rotation in radians
 * @param delta - Frame delta time in seconds
 * @param speed - Rotation interpolation speed (default: 3)
 */
export function rotateTowards(
  group: THREE.Group,
  targetRotation: number,
  delta: number,
  speed: number = 3
): void {
  const diff = normalizeRotationDiff(targetRotation - group.rotation.y);
  group.rotation.y += diff * Math.min(1, delta * speed);
}

/**
 * Calculate circle indicator visual properties based on hover/select state.
 *
 * @param isSelected - Whether the entity is currently selected
 * @param isHovered - Whether the entity is currently hovered
 * @param defaultColor - The default (non-interactive) circle color
 * @returns Object with color, opacity, emissive, and emissiveIntensity
 */
export function getCircleIndicatorStyle(
  isSelected: boolean,
  isHovered: boolean,
  defaultColor: number = 0x4488ff
): { color: number; opacity: number; emissive: number; emissiveIntensity: number } {
  if (isSelected) {
    return { color: 0xffaa00, opacity: 1.0, emissive: 0xffaa00, emissiveIntensity: 0.8 };
  }
  if (isHovered) {
    return { color: 0x66ccff, opacity: 0.9, emissive: 0x66ccff, emissiveIntensity: 0.5 };
  }
  return { color: defaultColor, opacity: 0.6, emissive: 0x000000, emissiveIntensity: 0 };
}

// ====== EASING FUNCTIONS ======

/**
 * Cubic ease-in-out function for smooth camera transitions.
 *
 * Starts slow, speeds up in the middle, and slows down at the end.
 * Common for camera movements and UI animations.
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
 * Linear interpolation helper.
 *
 * @param start - Start value
 * @param end - End value
 * @param t - Progress from 0 to 1
 * @returns Interpolated value
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Quadratic ease-out for smooth deceleration.
 *
 * Starts fast and slows down at the end.
 * Good for physics-like movements.
 *
 * @param t - Progress value from 0 to 1
 * @returns Eased value from 0 to 1
 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Create a camera viewpoint configuration.
 *
 * @param name - Viewpoint display name
 * @param position - Camera position [x, y, z]
 * @param lookAt - Target position [x, y, z]
 * @param duration - Duration in milliseconds
 * @returns Viewpoint configuration object
 */
export function createViewpoint(
  name: string,
  position: [number, number, number],
  lookAt: [number, number, number],
  duration: number
): {
  name: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  duration: number;
} {
  return {
    name,
    position: new THREE.Vector3(...position),
    lookAt: new THREE.Vector3(...lookAt),
    duration,
  };
}
