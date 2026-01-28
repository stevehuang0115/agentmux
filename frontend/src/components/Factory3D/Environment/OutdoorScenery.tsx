/**
 * OutdoorScenery - Trees, houses, and clouds visible through windows.
 *
 * Creates the outdoor environment visible from inside the factory,
 * including stylized trees, houses, and animated clouds.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { MODEL_PATHS } from '../../../types/factory.types';

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

// ====== WALKWAY COMPONENT ======

/**
 * Concrete walkway extending from the building entrance.
 */
const Walkway: React.FC = () => {
  const { isNightMode } = useFactory();
  const concreteColor = isNightMode ? 0x555560 : 0xbbbbc0;

  return (
    <group>
      {/* Main walkway from entrance straight out */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 38]} receiveShadow>
        <planeGeometry args={[6, 34]} />
        <meshStandardMaterial color={concreteColor} roughness={0.85} />
      </mesh>
      {/* Cross path connecting courts */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 42]} receiveShadow>
        <planeGeometry args={[48, 4]} />
        <meshStandardMaterial color={concreteColor} roughness={0.85} />
      </mesh>
    </group>
  );
};

// ====== PICKLEBALL COURT COMPONENT ======

/**
 * Pickleball court with colored surface, white lines, and center net.
 */
const PickleballCourt: React.FC = () => {
  const { isNightMode } = useFactory();
  const courtBlue = isNightMode ? 0x1a3050 : 0x2a6090;
  const courtGreen = isNightMode ? 0x1a4030 : 0x2a7050;
  const lineColor = 0xffffff;

  return (
    <group position={[-18, 0, 42]}>
      {/* Surround area - green (thin box to avoid z-fighting with grass) */}
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[16, 0.08, 23]} />
        <meshStandardMaterial color={courtGreen} roughness={0.7} />
      </mesh>

      {/* Court surface - blue playing area (on top of green surround) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} receiveShadow>
        <planeGeometry args={[13, 20]} />
        <meshStandardMaterial color={courtBlue} roughness={0.7} />
      </mesh>

      {/* Court lines - sidelines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6.5, 0.10, 0]}>
        <planeGeometry args={[0.08, 20]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, 0.10, 0]}>
        <planeGeometry args={[0.08, 20]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Baselines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.10, -10]}>
        <planeGeometry args={[13, 0.08]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.10, 10]}>
        <planeGeometry args={[13, 0.08]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Kitchen lines (non-volley zone) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.10, -3.5]}>
        <planeGeometry args={[13, 0.08]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.10, 3.5]}>
        <planeGeometry args={[13, 0.08]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.10, 0]}>
        <planeGeometry args={[0.08, 7]} />
        <meshStandardMaterial color={lineColor} />
      </mesh>

      {/* Net */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[13.5, 0.9, 0.05]} />
        <meshStandardMaterial color={0x222222} transparent opacity={0.7} />
      </mesh>
      {/* Net posts */}
      <mesh position={[-6.8, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.0, 8]} />
        <meshStandardMaterial color={0x888888} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[6.8, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 1.0, 8]} />
        <meshStandardMaterial color={0x888888} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
};

// ====== GOLF PUTTING GREEN COMPONENT ======

/**
 * Miniature golf putting green with sand bunker and flag pins.
 */
const GolfGreen: React.FC = () => {
  const { isNightMode } = useFactory();
  const greenColor = isNightMode ? 0x1a4a20 : 0x2a8a30;
  const sandColor = isNightMode ? 0x8a7a50 : 0xd4c47a;
  const flagPoleColor = 0xcccccc;

  const flagPositions: [number, number, number][] = [
    [-2, 0, -3],
    [3, 0, 1],
    [-1, 0, 4],
  ];

  return (
    <group position={[18, 0.03, 42]}>
      {/* Putting green surface - oval shape approximated with circle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 32]} />
        <meshStandardMaterial color={greenColor} roughness={0.6} />
      </mesh>

      {/* Sand bunker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.01, -4]}>
        <circleGeometry args={[3, 16]} />
        <meshStandardMaterial color={sandColor} roughness={0.95} />
      </mesh>

      {/* Flag pins */}
      {flagPositions.map(([fx, fy, fz], i) => (
        <group key={`flag-${i}`} position={[fx, fy, fz]}>
          {/* Hole */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.15, 16]} />
            <meshStandardMaterial color={0x111111} />
          </mesh>
          {/* Pole */}
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.2, 6]} />
            <meshStandardMaterial color={flagPoleColor} metalness={0.5} roughness={0.3} />
          </mesh>
          {/* Flag */}
          <mesh position={[0.2, 1.05, 0]}>
            <planeGeometry args={[0.4, 0.25]} />
            <meshStandardMaterial
              color={0xff3333}
              side={THREE.DoubleSide}
              emissive={0xff3333}
              emissiveIntensity={0.2}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ====== GARDEN BED COMPONENT ======

/**
 * Garden bed with colorful flowers and small bushes.
 */
const GardenBed: React.FC<{
  position: [number, number, number];
  mirror?: boolean;
}> = ({ position, mirror = false }) => {
  const { isNightMode } = useFactory();
  const soilColor = isNightMode ? 0x3a2a1a : 0x6a4a2a;
  const flowerColors = [0xff6688, 0xffaa33, 0xaa55ff, 0xff4466, 0xffdd44];
  const bushColor = isNightMode ? 0x1a4a1a : 0x2a7a2a;
  const scale = mirror ? -1 : 1;

  return (
    <group position={position} scale={[scale, 1, 1]}>
      {/* Soil bed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
        <planeGeometry args={[6, 4]} />
        <meshStandardMaterial color={soilColor} roughness={0.95} />
      </mesh>
      {/* Raised border */}
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <boxGeometry args={[6.2, 0.3, 4.2]} />
        <meshStandardMaterial color={0x8a7a6a} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[5.8, 0.35, 3.8]} />
        <meshStandardMaterial color={soilColor} roughness={0.95} />
      </mesh>

      {/* Flowers - small colorful spheres */}
      {[
        [-2, 0.4, -1], [-1, 0.35, -1.2], [0, 0.4, -0.8],
        [1, 0.35, -1], [2, 0.4, -1.1],
        [-1.5, 0.4, 0.5], [0, 0.35, 0.8], [1.5, 0.4, 0.3],
        [-0.5, 0.4, 1.2], [0.8, 0.35, 1],
      ].map(([fx, fy, fz], i) => (
        <mesh key={`flower-${i}`} position={[fx, fy, fz]} castShadow>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial
            color={flowerColors[i % flowerColors.length]}
            emissive={flowerColors[i % flowerColors.length]}
            emissiveIntensity={isNightMode ? 0.3 : 0.1}
          />
        </mesh>
      ))}

      {/* Small bushes */}
      <mesh position={[-2.2, 0.5, 0]} castShadow>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial color={bushColor} roughness={0.8} />
      </mesh>
      <mesh position={[2.2, 0.45, 0.3]} castShadow>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial color={bushColor} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ====== PARK BENCH COMPONENT ======

/**
 * Simple park bench with seat and backrest.
 */
const ParkBench: React.FC<{
  position: [number, number, number];
  rotation?: number;
}> = ({ position, rotation = 0 }) => {
  const { isNightMode } = useFactory();
  const woodColor = isNightMode ? 0x3a2a1a : 0x8b5e3c;
  const metalColor = isNightMode ? 0x444450 : 0x666670;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat slats */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.08, 0.6]} />
        <meshStandardMaterial color={woodColor} roughness={0.8} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.9, -0.25]} rotation={[0.15, 0, 0]} castShadow>
        <boxGeometry args={[2.0, 0.5, 0.08]} />
        <meshStandardMaterial color={woodColor} roughness={0.8} />
      </mesh>
      {/* Legs */}
      {[-0.8, 0.8].map((lx, i) => (
        <group key={`leg-${i}`}>
          <mesh position={[lx, 0.25, 0.2]} castShadow>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
            <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[lx, 0.25, -0.2]} castShadow>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
            <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ====== CYBERTRUCK COMPONENT ======

/** Preload cybertruck model */
useGLTF.preload(MODEL_PATHS.CYBERTRUCK);

/** Scale factor — native model is ~1 unit long due to baked micro-scale */
const CYBERTRUCK_SCALE = 6.5;

/**
 * Cybertruck loaded from GLB model.
 * Compressed from 28MB to 630KB (texture + mesh optimization).
 */
const CyberTruck: React.FC<{
  position: [number, number, number];
  rotation?: number;
}> = ({ position, rotation = 0 }) => {
  const gltf = useGLTF(MODEL_PATHS.CYBERTRUCK);

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [gltf.scene]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive
        object={clonedScene}
        scale={[CYBERTRUCK_SCALE, CYBERTRUCK_SCALE, CYBERTRUCK_SCALE]}
      />
    </group>
  );
};

// ====== OUTDOOR SCENERY ======

interface OutdoorSceneryProps {
  /** Whether to show additional objects like Cybertruck (default: true) */
  showObjects?: boolean;
}

/**
 * OutdoorScenery - Complete outdoor environment.
 *
 * Positions trees, houses, and clouds around the building
 * to create a pleasant view through the windows.
 *
 * @param showObjects - Whether to render additional objects like Cybertruck
 * @returns JSX element with all outdoor objects
 */
export const OutdoorScenery: React.FC<OutdoorSceneryProps> = ({ showObjects = true }) => {
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

    // Front area trees (Z > 24, in front of building)
    [-35, 0, 26, 4],
    [-30, 0, 30, 3.5],
    [-38, 0, 35, 4.5],
    [-32, 0, 40, 3.8],
    [-40, 0, 45, 4.2],
    [35, 0, 26, 3.8],
    [30, 0, 30, 4],
    [38, 0, 35, 4.5],
    [32, 0, 40, 3.5],
    [40, 0, 45, 4.2],
    // Far front
    [-25, 0, 55, 5],
    [-10, 0, 52, 4.5],
    [10, 0, 54, 4.8],
    [25, 0, 52, 5.2],
    [0, 0, 58, 5],
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

      {/* Ground plane outside building - extended to cover front outdoor area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -20]} receiveShadow>
        <planeGeometry args={[200, 200]} />
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

      {/* ===== OUTDOOR RECREATION AREA ===== */}
      {/* Walkway from entrance */}
      <Walkway />

      {/* Pickleball court - left side */}
      <PickleballCourt />

      {/* Golf putting green - right side */}
      <GolfGreen />

      {/* Garden beds flanking entrance */}
      <GardenBed position={[-12, 0, 26]} />
      <GardenBed position={[12, 0, 26]} mirror />

      {/* Park benches along walkways */}
      <ParkBench position={[-4, 0, 30]} rotation={Math.PI / 2} />
      <ParkBench position={[4, 0, 30]} rotation={-Math.PI / 2} />
      <ParkBench position={[-4, 0, 36]} rotation={Math.PI / 2} />
      <ParkBench position={[4, 0, 36]} rotation={-Math.PI / 2} />

      {/* Cybertruck parked on the main walkway */}
      {showObjects && <CyberTruck position={[0, 0, 50]} rotation={0} />}
    </group>
  );
};

export default OutdoorScenery;
