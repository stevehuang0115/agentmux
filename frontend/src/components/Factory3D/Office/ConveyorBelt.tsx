/**
 * ConveyorBelt - Animated conveyor belt with project product boxes.
 *
 * Boxes represent "products" from each project team. Active projects
 * produce more boxes, and each box uses the project's zone color.
 *
 * Performance optimizations:
 * - Shared geometries for belt structure (single GPU upload)
 * - Material cache by color for product boxes
 * - Proper disposal on unmount
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';

interface BoxData {
  offset: number;
  color: number;
  size: number;
}

// ====== SHARED GEOMETRIES (created once, reused) ======
const sharedGeometries = {
  beltSurface: new THREE.BoxGeometry(16, 0.1, 1.2),
  beltRail: new THREE.BoxGeometry(16, 0.05, 0.08),
  roller: new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16),
  supportLeg: new THREE.BoxGeometry(0.15, 0.5, 0.15),
  // Default box size - individual boxes may scale
  productBox: new THREE.BoxGeometry(1, 1, 1),
};

// ====== SHARED MATERIALS (created once, reused) ======
const sharedMaterials = {
  beltSurface: new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 }),
  beltRail: new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8 }),
  roller: new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7 }),
  supportLeg: new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5 }),
};

/** Boxes per active agent on the belt */
const BOXES_PER_AGENT = 2;
/** Maximum boxes per project to avoid overcrowding */
const MAX_BOXES_PER_PROJECT = 5;
/** Minimum boxes on belt when no project is active */
const MIN_IDLE_BOXES = 2;
/** Belt length from -7 to 7 */
const BELT_HALF = 7;
/** Box movement speed in units per second */
const BELT_SPEED = 0.8;
/** Idle box color when no projects are active */
const IDLE_BOX_COLOR = 0x666666;

/**
 * ConveyorBelt - Animated belt with project-colored product boxes.
 *
 * Features:
 * - Belt surface with metallic appearance
 * - Support legs and rollers
 * - Animated boxes colored by project zone
 * - More active agents = more boxes for that project
 *
 * @returns JSX element with conveyor belt and animated boxes
 */
export const ConveyorBelt: React.FC = () => {
  const { agents, zones } = useFactory();
  const boxRefs = useRef<THREE.Mesh[]>([]);

  // Material cache for product boxes by color
  const boxMaterialCache = useRef<Map<number, THREE.MeshStandardMaterial>>(new Map());

  // Get or create material for a product box color
  const getBoxMaterial = (color: number): THREE.MeshStandardMaterial => {
    let material = boxMaterialCache.current.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      boxMaterialCache.current.set(color, material);
    }
    return material;
  };

  // Cleanup box materials on unmount (shared geometries/materials are module-level)
  useEffect(() => {
    return () => {
      boxMaterialCache.current.forEach((mat) => mat.dispose());
      boxMaterialCache.current.clear();
    };
  }, []);

  // Build a stable key based on agent statuses only (not positions)
  // This prevents box regeneration on every position update
  const statusKey = useMemo(() => {
    const entries: string[] = [];
    agents.forEach((agent, id) => {
      entries.push(`${id}:${agent.status}`);
    });
    return entries.sort().join('|');
  }, [agents]);

  // Generate boxes based on active project agents
  const boxes = useMemo<BoxData[]>(() => {
    // Count active agents per project
    const projectCounts = new Map<string, { count: number; color: number }>();

    agents.forEach((agent) => {
      if (agent.status === 'active') {
        const zone = zones.get(agent.projectName);
        if (zone) {
          const existing = projectCounts.get(agent.projectName);
          if (existing) {
            existing.count++;
          } else {
            projectCounts.set(agent.projectName, { count: 1, color: zone.color });
          }
        }
      }
    });

    const result: BoxData[] = [];
    let idx = 0;

    projectCounts.forEach(({ count, color }) => {
      const numBoxes = Math.min(count * BOXES_PER_AGENT, MAX_BOXES_PER_PROJECT);
      for (let i = 0; i < numBoxes; i++) {
        result.push({
          // Spread boxes across the belt with deterministic offsets
          offset: -BELT_HALF + ((idx * 3.7 + i * 2.3) % (BELT_HALF * 2)),
          color,
          size: 0.35 + ((idx * 7 + i * 3) % 5) * 0.04,
        });
        idx++;
      }
    });

    // If no active projects, show a few idle placeholder boxes
    if (result.length === 0) {
      for (let i = 0; i < MIN_IDLE_BOXES; i++) {
        result.push({
          offset: -3 + i * 6,
          color: IDLE_BOX_COLOR,
          size: 0.3 + i * 0.05,
        });
      }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, zones]);

  // Animate boxes
  useFrame((_, delta) => {
    boxRefs.current.forEach((box) => {
      if (box) {
        box.position.x += delta * BELT_SPEED;
        if (box.position.x > BELT_HALF) {
          box.position.x = -BELT_HALF;
        }
      }
    });
  });

  return (
    <group position={[0, 0, -14]}>
      {/* Belt surface - using shared geometry and material */}
      <mesh
        position={[0, 0.5, 0]}
        geometry={sharedGeometries.beltSurface}
        material={sharedMaterials.beltSurface}
        receiveShadow
      />

      {/* Belt rails - using shared geometry and material */}
      <mesh
        position={[0, 0.55, 0.55]}
        geometry={sharedGeometries.beltRail}
        material={sharedMaterials.beltRail}
      />
      <mesh
        position={[0, 0.55, -0.55]}
        geometry={sharedGeometries.beltRail}
        material={sharedMaterials.beltRail}
      />

      {/* Belt rollers at ends - using shared geometry and material */}
      <mesh
        position={[-7.5, 0.5, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={sharedGeometries.roller}
        material={sharedMaterials.roller}
      />
      <mesh
        position={[7.5, 0.5, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={sharedGeometries.roller}
        material={sharedMaterials.roller}
      />

      {/* Support legs - using shared geometry and material */}
      {[-6, -2, 2, 6].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh
            position={[0, 0.25, 0.4]}
            geometry={sharedGeometries.supportLeg}
            material={sharedMaterials.supportLeg}
          />
          <mesh
            position={[0, 0.25, -0.4]}
            geometry={sharedGeometries.supportLeg}
            material={sharedMaterials.supportLeg}
          />
        </group>
      ))}

      {/* Animated product boxes - using shared geometry with scale, cached materials */}
      {boxes.map((box, i) => (
        <mesh
          key={`${i}-${box.color}`}
          ref={(el) => {
            if (el) boxRefs.current[i] = el;
          }}
          position={[box.offset, 0.6 + box.size / 2, 0]}
          scale={[box.size, box.size, box.size]}
          geometry={sharedGeometries.productBox}
          material={getBoxMaterial(box.color)}
          castShadow
        />
      ))}
    </group>
  );
};

export default ConveyorBelt;
