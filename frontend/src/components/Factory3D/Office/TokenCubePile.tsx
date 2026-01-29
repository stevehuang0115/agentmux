/**
 * TokenCubePile - Visualizes token usage as piled cubes behind the conveyor belt.
 *
 * The more tokens a project uses, the more cubes are piled up in that project's
 * section of the factory floor (between the conveyor belt and the back wall).
 *
 * Performance optimizations:
 * - Shared BoxGeometry for all cubes (single GPU upload)
 * - Materials cached by color (reused across cubes)
 * - Proper disposal on unmount
 */

import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';

/** Cube size range */
const CUBE_SIZE_MIN = 0.3;
const CUBE_SIZE_MAX = 0.5;

/** Position constants */
const PILE_Z_START = -15.5; // Just behind conveyor belt (belt is at Z=-14)
const PILE_Z_END = -18.5; // Near the back wall
const PILE_X_START = -7; // Left side of conveyor belt
const PILE_X_END = 7; // Right side of conveyor belt

/** Maximum cubes per project to avoid performance issues */
const MAX_CUBES_PER_PROJECT = 30;

/** Minimum tokens to show at least one cube (100K tokens) */
const MIN_TOKENS_FOR_CUBE = 100000;

/** Tokens per cube (each cube represents ~200K tokens) */
const TOKENS_PER_CUBE = 200000;

interface CubeData {
  position: [number, number, number];
  size: number;
  color: number;
}

/** Standard cube size for consistent stacking */
const CUBE_SIZE = 0.4;

/**
 * TokenCubePile - Displays piled cubes representing token usage per project.
 *
 * Features:
 * - Cubes colored by project zone color
 * - More tokens = more cubes stacked
 * - Positioned between conveyor belt and back wall
 * - Each project's cubes are in their zone's X region
 *
 * @returns JSX element with cube pile meshes
 */
export const TokenCubePile: React.FC = () => {
  const { stats } = useFactory();

  // Shared geometry for all cubes - created once, reused
  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  }, []);

  // Material cache by color - avoids creating duplicate materials
  const materialCache = useRef<Map<number, THREE.MeshStandardMaterial>>(new Map());

  // Get or create material for a given color
  const getMaterial = (color: number): THREE.MeshStandardMaterial => {
    let material = materialCache.current.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.1,
      });
      materialCache.current.set(color, material);
    }
    return material;
  };

  // Cleanup geometry and materials on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      materialCache.current.forEach((mat) => mat.dispose());
      materialCache.current.clear();
    };
  }, [geometry]);

  const cubes = useMemo<CubeData[]>(() => {
    const result: CubeData[] = [];
    const tokensByProject = stats.tokensByProject || [];

    if (tokensByProject.length === 0) return result;

    // Calculate X width per project
    const totalWidth = PILE_X_END - PILE_X_START;
    const projectWidth = totalWidth / Math.max(tokensByProject.length, 1);

    // Use constant cube size for neat stacking
    const spacing = CUBE_SIZE * 1.1; // Small gap between cubes

    tokensByProject.forEach((project, projectIndex) => {
      const { tokens, color } = project;

      // Skip if not enough tokens
      if (tokens < MIN_TOKENS_FOR_CUBE) return;

      // Calculate number of cubes based on tokens
      const numCubes = Math.min(
        Math.ceil(tokens / TOKENS_PER_CUBE),
        MAX_CUBES_PER_PROJECT
      );

      // Project's X center position
      const projectXCenter = PILE_X_START + (projectIndex + 0.5) * projectWidth;
      const pileZCenter = (PILE_Z_START + PILE_Z_END) / 2;

      // Stack cubes in organized layers (pyramid-like from bottom up)
      // Base layer: rows x cols, each higher layer is smaller
      let cubesPlaced = 0;
      let layer = 0;

      // Calculate base dimensions to fit all cubes nicely
      // Use a roughly square base that builds up into a pyramid
      const baseRowsMax = 4; // Max rows in depth (Z direction)
      const baseColsMax = Math.ceil(projectWidth / spacing) - 1; // Max cols based on project width

      while (cubesPlaced < numCubes) {
        // Each layer gets smaller (pyramid effect)
        const layerOffset = layer * 0.5; // Shrink pattern per layer
        const rowsInLayer = Math.max(1, Math.floor(baseRowsMax - layerOffset));
        const colsInLayer = Math.max(1, Math.floor(baseColsMax - layerOffset));
        const maxInLayer = rowsInLayer * colsInLayer;
        const cubesInLayer = Math.min(maxInLayer, numCubes - cubesPlaced);

        // Place cubes in a grid for this layer
        for (let i = 0; i < cubesInLayer; i++) {
          const row = Math.floor(i / colsInLayer);
          const col = i % colsInLayer;

          // Center the grid within the project's area
          const gridWidth = (colsInLayer - 1) * spacing;
          const gridDepth = (rowsInLayer - 1) * spacing;

          const x = projectXCenter - gridWidth / 2 + col * spacing;
          const z = pileZCenter - gridDepth / 2 + row * spacing;
          const y = CUBE_SIZE / 2 + layer * spacing;

          result.push({
            position: [x, y, z],
            size: CUBE_SIZE,
            color,
          });

          cubesPlaced++;
        }

        layer++;

        // Safety break for infinite loop
        if (layer > 10) break;
      }
    });

    return result;
  }, [stats.tokensByProject]);

  if (cubes.length === 0) return null;

  return (
    <group>
      {cubes.map((cube, i) => (
        <mesh
          key={i}
          position={cube.position}
          geometry={geometry}
          material={getMaterial(cube.color)}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
};

export default TokenCubePile;
