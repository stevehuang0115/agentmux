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
  const { isNightMode } = useFactory();

  // Tree positions around the building - many more trees for denser forest
  const treePositions = useMemo<[number, number, number, number][]>(() => [
    // Back row - close
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

    // Back row - middle distance
    [-40, 0, -40, 5],
    [-32, 0, -42, 4.5],
    [-24, 0, -38, 5.5],
    [-16, 0, -44, 4],
    [-8, 0, -40, 5.2],
    [0, 0, -42, 4.8],
    [8, 0, -38, 5],
    [16, 0, -44, 4.5],
    [24, 0, -40, 5.5],
    [32, 0, -42, 4],
    [40, 0, -38, 5.2],

    // Back row - far distance
    [-45, 0, -55, 6],
    [-35, 0, -58, 5.5],
    [-25, 0, -52, 6.5],
    [-15, 0, -60, 5],
    [-5, 0, -55, 6.2],
    [5, 0, -58, 5.8],
    [15, 0, -52, 6],
    [25, 0, -60, 5.5],
    [35, 0, -55, 6.5],
    [45, 0, -58, 5],

    // Very far back
    [-50, 0, -70, 7],
    [-30, 0, -75, 6.5],
    [-10, 0, -72, 7.5],
    [10, 0, -70, 6],
    [30, 0, -75, 7.2],
    [50, 0, -72, 6.8],

    // Left side - dense
    [-35, 0, -15, 3.5],
    [-38, 0, -5, 4],
    [-35, 0, 5, 3.8],
    [-38, 0, 15, 4.2],
    [-42, 0, -20, 4.5],
    [-45, 0, -10, 5],
    [-42, 0, 0, 4.8],
    [-45, 0, 10, 5.2],
    [-50, 0, -15, 5.5],
    [-50, 0, 5, 5],

    // Right side - dense
    [35, 0, -15, 4],
    [38, 0, -5, 3.5],
    [35, 0, 5, 4.2],
    [38, 0, 15, 3.8],
    [42, 0, -20, 4.5],
    [45, 0, -10, 5],
    [42, 0, 0, 4.8],
    [45, 0, 10, 5.2],
    [50, 0, -15, 5.5],
    [50, 0, 5, 5],

    // Fill gaps
    [-25, 0, -32, 3.8],
    [-10, 0, -33, 4.2],
    [10, 0, -32, 3.5],
    [25, 0, -33, 4],
  ], []);

  // House positions - more houses scattered around
  const housePositions = useMemo<[number, number, number, number][]>(() => [
    // Back area
    [-32, 0, -35, 0.2],
    [-15, 0, -38, -0.1],
    [5, 0, -36, 0.3],
    [25, 0, -38, -0.2],

    // Far back area
    [-40, 0, -50, 0.4],
    [-20, 0, -52, -0.3],
    [0, 0, -48, 0.1],
    [20, 0, -52, -0.1],
    [40, 0, -50, 0.2],

    // Very far
    [-35, 0, -65, 0.5],
    [0, 0, -68, 0],
    [35, 0, -65, -0.4],

    // Left side
    [-40, 0, -10, Math.PI / 2],
    [-48, 0, -25, Math.PI / 2 + 0.2],
    [-45, 0, 8, Math.PI / 2 - 0.1],

    // Right side
    [40, 0, 0, -Math.PI / 2],
    [48, 0, -20, -Math.PI / 2 + 0.2],
    [45, 0, 12, -Math.PI / 2 - 0.1],
  ], []);

  // Cloud positions - more clouds to fill sky
  const cloudPositions = useMemo<[number, number, number, number][]>(() => [
    [-20, 15, -30, 0.3],
    [10, 18, -25, 0.5],
    [30, 14, -35, 0.4],
    [-35, 16, 0, 0.35],
    [35, 17, 10, 0.45],
    [-50, 20, -40, 0.25],
    [50, 19, -50, 0.55],
    [0, 22, -60, 0.3],
    [-30, 21, -55, 0.4],
    [30, 20, -65, 0.35],
    [-15, 17, -45, 0.45],
    [15, 19, -55, 0.3],
  ], []);

  // Sky color
  const skyColor = isNightMode ? 0x1a1a2e : 0x87ceeb;
  const grassColor = isNightMode ? 0x2a4a2f : 0x4a7c4f;
  const hillColor = isNightMode ? 0x3a5a3f : 0x5a8c5f;

  return (
    <group>
      {/* Sky backdrop - large curved plane behind everything */}
      <mesh position={[0, 20, -100]} receiveShadow={false}>
        <planeGeometry args={[300, 100]} />
        <meshBasicMaterial color={skyColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Ground plane outside building - extended */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -50]} receiveShadow>
        <planeGeometry args={[200, 150]} />
        <meshStandardMaterial color={grassColor} roughness={0.9} />
      </mesh>

      {/* Rolling hills in the distance */}
      <mesh position={[-30, 2, -80]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[25, 32]} />
        <meshStandardMaterial color={hillColor} roughness={0.9} />
      </mesh>
      <mesh position={[30, 3, -85]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[30, 32]} />
        <meshStandardMaterial color={hillColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, 4, -90]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[35, 32]} />
        <meshStandardMaterial color={hillColor} roughness={0.9} />
      </mesh>
      <mesh position={[-50, 2, -75]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[20, 32]} />
        <meshStandardMaterial color={hillColor} roughness={0.9} />
      </mesh>
      <mesh position={[50, 2.5, -78]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[22, 32]} />
        <meshStandardMaterial color={hillColor} roughness={0.9} />
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
