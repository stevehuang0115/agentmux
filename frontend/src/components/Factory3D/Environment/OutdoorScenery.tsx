/**
 * OutdoorScenery - Trees, houses, and clouds visible through windows.
 *
 * Creates the outdoor environment visible from inside the factory,
 * including stylized trees, houses, and animated clouds.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';

// ====== TREE COMPONENT ======

interface TreeProps {
  position: [number, number, number];
  height?: number;
}

/**
 * Stylized low-poly tree with trunk and foliage.
 */
const Tree: React.FC<TreeProps> = ({ position, height = 3 }) => {
  const { isNightMode } = useFactory();

  const foliageColor = isNightMode ? 0x1a3d1a : 0x2d8a2d;
  const trunkColor = isNightMode ? 0x3d2817 : 0x8b4513;

  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, height * 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, height * 0.6, 8]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>

      {/* Foliage layers */}
      <mesh position={[0, height * 0.6, 0]} castShadow>
        <coneGeometry args={[1.2, height * 0.5, 8]} />
        <meshStandardMaterial color={foliageColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, height * 0.85, 0]} castShadow>
        <coneGeometry args={[0.9, height * 0.4, 8]} />
        <meshStandardMaterial color={foliageColor} roughness={0.8} />
      </mesh>
      <mesh position={[0, height * 1.05, 0]} castShadow>
        <coneGeometry args={[0.6, height * 0.3, 8]} />
        <meshStandardMaterial color={foliageColor} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ====== HOUSE COMPONENT ======

interface HouseProps {
  position: [number, number, number];
  rotation?: number;
}

/**
 * Simple stylized house with roof.
 */
const House: React.FC<HouseProps> = ({ position, rotation = 0 }) => {
  const { isNightMode } = useFactory();

  const wallColor = isNightMode ? 0x4a4a5a : 0xf5f5dc;
  const roofColor = isNightMode ? 0x4a2020 : 0x8b0000;
  const windowColor = isNightMode ? 0xffdd88 : 0x87ceeb;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* House body */}
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 2.5, 2.5]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 3, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[2.5, 2.5, 2.8]} />
        <meshStandardMaterial color={roofColor} roughness={0.6} />
      </mesh>

      {/* Windows */}
      <mesh position={[0, 1.2, 1.26]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshStandardMaterial
          color={windowColor}
          emissive={isNightMode ? windowColor : 0x000000}
          emissiveIntensity={isNightMode ? 0.5 : 0}
        />
      </mesh>

      {/* Door */}
      <mesh position={[0, 0.6, 1.26]}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial color={0x654321} roughness={0.8} />
      </mesh>

      {/* Chimney */}
      <mesh position={[0.8, 3.5, 0]} castShadow>
        <boxGeometry args={[0.4, 1, 0.4]} />
        <meshStandardMaterial color={0x666666} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ====== CLOUD COMPONENT ======

interface CloudProps {
  position: [number, number, number];
  speed?: number;
}

/**
 * Animated fluffy cloud made of spheres.
 */
const Cloud: React.FC<CloudProps> = ({ position, speed = 0.5 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const initialX = position[0];
  const { isNightMode } = useFactory();

  // Animate cloud movement
  useFrame((state) => {
    if (groupRef.current) {
      // Move cloud slowly across the sky
      groupRef.current.position.x = initialX + Math.sin(state.clock.elapsedTime * speed * 0.1) * 5;
      // Slight vertical bob
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.3;
    }
  });

  const cloudColor = isNightMode ? 0x3a3a4a : 0xffffff;
  const opacity = isNightMode ? 0.3 : 0.9;

  return (
    <group ref={groupRef} position={position}>
      {/* Cloud puffs */}
      <mesh>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshStandardMaterial color={cloudColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[1.5, 0.3, 0]}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial color={cloudColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[-1.3, 0.2, 0]}>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshStandardMaterial color={cloudColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0.5, 0.6, 0.3]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color={cloudColor} transparent opacity={opacity} />
      </mesh>
      <mesh position={[-0.5, -0.3, 0.2]}>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshStandardMaterial color={cloudColor} transparent opacity={opacity} />
      </mesh>
    </group>
  );
};

// ====== OUTDOOR SCENERY ======

/**
 * OutdoorScenery - Complete outdoor environment.
 *
 * Positions trees, houses, and clouds around the building
 * to create a pleasant view through the windows.
 *
 * @returns JSX element with all outdoor objects
 */
export const OutdoorScenery: React.FC = () => {
  // Tree positions around the building
  const treePositions = useMemo<[number, number, number, number][]>(() => [
    // Back row
    [-35, 0, -25, 4],
    [-28, 0, -28, 3.5],
    [-20, 0, -26, 4.5],
    [-12, 0, -28, 3],
    [-4, 0, -25, 4.2],
    [4, 0, -27, 3.8],
    [12, 0, -26, 4],
    [20, 0, -28, 3.5],
    [28, 0, -25, 4.5],
    [35, 0, -27, 3],

    // Left side
    [-35, 0, -15, 3.5],
    [-38, 0, -5, 4],
    [-35, 0, 5, 3.8],
    [-38, 0, 15, 4.2],

    // Right side
    [35, 0, -15, 4],
    [38, 0, -5, 3.5],
    [35, 0, 5, 4.2],
    [38, 0, 15, 3.8],
  ], []);

  // House positions
  const housePositions = useMemo<[number, number, number, number][]>(() => [
    [-32, 0, -35, 0.2],
    [-15, 0, -38, -0.1],
    [5, 0, -36, 0.3],
    [25, 0, -38, -0.2],
    [-40, 0, -10, Math.PI / 2],
    [40, 0, 0, -Math.PI / 2],
  ], []);

  // Cloud positions
  const cloudPositions = useMemo<[number, number, number, number][]>(() => [
    [-20, 15, -30, 0.3],
    [10, 18, -25, 0.5],
    [30, 14, -35, 0.4],
    [-35, 16, 0, 0.35],
    [35, 17, 10, 0.45],
  ], []);

  return (
    <group>
      {/* Ground plane outside building */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -30]} receiveShadow>
        <planeGeometry args={[100, 40]} />
        <meshStandardMaterial color={0x4a7c4f} roughness={0.9} />
      </mesh>

      {/* Trees */}
      {treePositions.map(([x, y, z, height], i) => (
        <Tree key={`tree-${i}`} position={[x, y, z]} height={height} />
      ))}

      {/* Houses */}
      {housePositions.map(([x, y, z, rotation], i) => (
        <House key={`house-${i}`} position={[x, y, z]} rotation={rotation} />
      ))}

      {/* Clouds */}
      {cloudPositions.map(([x, y, z, speed], i) => (
        <Cloud key={`cloud-${i}`} position={[x, y, z]} speed={speed} />
      ))}
    </group>
  );
};

export default OutdoorScenery;
