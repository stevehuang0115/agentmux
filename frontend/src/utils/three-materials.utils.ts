/**
 * THREE.js Material Utilities - Shared material caching for 3D components.
 *
 * Provides centralized material management to reduce GPU memory usage
 * and ensure consistent material disposal across React components.
 */

import * as THREE from 'three';
import { useRef, useEffect } from 'react';

/**
 * Options for creating MeshStandardMaterial
 */
export interface MaterialOptions {
  /** Material roughness (0-1) */
  roughness?: number;
  /** Material metalness (0-1) */
  metalness?: number;
  /** Enable flat shading */
  flatShading?: boolean;
  /** Material opacity (0-1, requires transparent: true) */
  opacity?: number;
  /** Enable transparency */
  transparent?: boolean;
  /** Material emissive color */
  emissive?: number;
  /** Emissive intensity multiplier */
  emissiveIntensity?: number;
}

/**
 * Default material options for consistent appearance
 */
const DEFAULT_MATERIAL_OPTIONS: MaterialOptions = {
  roughness: 0.8,
  metalness: 0.1,
  flatShading: false,
  transparent: false,
};

/**
 * Generates a unique cache key for material options
 *
 * @param color - Material color as hex number
 * @param options - Material options
 * @returns Unique string key for caching
 */
function getMaterialKey(color: number, options: MaterialOptions): string {
  return `${color.toString(16)}_${options.roughness}_${options.metalness}_${options.flatShading}_${options.transparent}_${options.opacity}_${options.emissive}_${options.emissiveIntensity}`;
}

/**
 * Material cache interface for managing THREE.MeshStandardMaterial instances
 */
export interface MaterialCache {
  /**
   * Gets an existing material or creates a new one with the specified color and options.
   *
   * @param color - Material color as hex number (e.g., 0xff0000 for red)
   * @param options - Optional material configuration
   * @returns Cached or newly created material
   */
  getOrCreate: (color: number, options?: MaterialOptions) => THREE.MeshStandardMaterial;

  /**
   * Gets an existing material without creating a new one.
   *
   * @param color - Material color as hex number
   * @param options - Material options for key lookup
   * @returns Cached material or undefined
   */
  get: (color: number, options?: MaterialOptions) => THREE.MeshStandardMaterial | undefined;

  /**
   * Disposes all cached materials and clears the cache.
   * Call this on component unmount to prevent memory leaks.
   */
  dispose: () => void;

  /**
   * Gets the current number of cached materials.
   */
  size: () => number;
}

/**
 * Creates a new material cache for managing THREE.MeshStandardMaterial instances.
 *
 * Use this factory when you need manual control over the cache lifecycle,
 * such as in non-React contexts or when sharing a cache across components.
 *
 * @returns MaterialCache instance
 *
 * @example
 * ```typescript
 * const cache = createMaterialCache();
 *
 * // Get or create material
 * const redMaterial = cache.getOrCreate(0xff0000, { roughness: 0.5 });
 * const blueMaterial = cache.getOrCreate(0x0000ff);
 *
 * // Clean up when done
 * cache.dispose();
 * ```
 */
export function createMaterialCache(): MaterialCache {
  const cache = new Map<string, THREE.MeshStandardMaterial>();

  return {
    getOrCreate(color: number, options: MaterialOptions = {}): THREE.MeshStandardMaterial {
      const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };
      const key = getMaterialKey(color, mergedOptions);

      let material = cache.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color,
          roughness: mergedOptions.roughness,
          metalness: mergedOptions.metalness,
          flatShading: mergedOptions.flatShading,
          transparent: mergedOptions.transparent,
          opacity: mergedOptions.opacity,
          emissive: mergedOptions.emissive,
          emissiveIntensity: mergedOptions.emissiveIntensity,
        });
        cache.set(key, material);
      }

      return material;
    },

    get(color: number, options: MaterialOptions = {}): THREE.MeshStandardMaterial | undefined {
      const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };
      const key = getMaterialKey(color, mergedOptions);
      return cache.get(key);
    },

    dispose(): void {
      cache.forEach((material) => {
        material.dispose();
      });
      cache.clear();
    },

    size(): number {
      return cache.size;
    },
  };
}

/**
 * React hook for material caching with automatic cleanup on unmount.
 *
 * This hook creates a material cache that persists across renders and
 * automatically disposes all materials when the component unmounts.
 *
 * @returns MaterialCache instance bound to the component lifecycle
 *
 * @example
 * ```tsx
 * const MyComponent: React.FC = () => {
 *   const materialCache = useMaterialCache();
 *
 *   return (
 *     <mesh>
 *       <boxGeometry />
 *       <primitive object={materialCache.getOrCreate(0xff0000)} attach="material" />
 *     </mesh>
 *   );
 * };
 * ```
 */
export function useMaterialCache(): MaterialCache {
  const cacheRef = useRef<MaterialCache | null>(null);

  // Initialize cache lazily
  if (!cacheRef.current) {
    cacheRef.current = createMaterialCache();
  }

  // Dispose on unmount
  useEffect(() => {
    return () => {
      cacheRef.current?.dispose();
    };
  }, []);

  return cacheRef.current;
}

/**
 * Creates shared materials for common use cases.
 * These are module-level singletons that persist for the application lifetime.
 *
 * @param isNightMode - Whether to create night mode variants
 * @returns Object containing commonly used materials
 */
export function createSharedMaterials(isNightMode: boolean = false): {
  floor: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  plastic: THREE.MeshStandardMaterial;
} {
  const lightMultiplier = isNightMode ? 0.3 : 1.0;
  const emissiveBase = isNightMode ? 0.1 : 0;

  return {
    floor: new THREE.MeshStandardMaterial({
      color: isNightMode ? 0x1a1a2e : 0x2d2d44,
      roughness: 0.9,
      metalness: 0,
    }),
    wall: new THREE.MeshStandardMaterial({
      color: Math.floor(0x3d3d5c * lightMultiplier),
      roughness: 0.8,
      metalness: 0,
    }),
    metal: new THREE.MeshStandardMaterial({
      color: 0x888899,
      roughness: 0.4,
      metalness: 0.8,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.3,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: isNightMode ? 0x3d2817 : 0x5c3a21,
      roughness: 0.9,
      metalness: 0,
    }),
    plastic: new THREE.MeshStandardMaterial({
      color: 0x444455,
      roughness: 0.6,
      metalness: 0.1,
      emissive: isNightMode ? 0x111122 : 0x000000,
      emissiveIntensity: emissiveBase,
    }),
  };
}

/**
 * Disposes a material or array of materials safely.
 *
 * @param materials - Material(s) to dispose
 */
export function disposeMaterials(
  materials: THREE.Material | THREE.Material[] | null | undefined
): void {
  if (!materials) return;

  const materialArray = Array.isArray(materials) ? materials : [materials];
  materialArray.forEach((material) => {
    if (material && typeof material.dispose === 'function') {
      material.dispose();
    }
  });
}
