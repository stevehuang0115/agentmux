/**
 * Decorations - Apple-style modern office decorations.
 *
 * Minimalist, clean design with items properly mounted on walls.
 * Inspired by Apple store aesthetics - white, aluminum, glass.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';

const { WALLS } = FACTORY_CONSTANTS;

// ====== MODERN POTTED PLANT ======

interface PottedPlantProps {
  position: [number, number, number];
  size?: number;
}

/**
 * Modern minimalist plant in white ceramic pot - Apple store style.
 */
const PottedPlant: React.FC<PottedPlantProps> = ({ position, size = 1 }) => {
  const { isNightMode } = useFactory();
  const leafColor = isNightMode ? 0x2d5a2d : 0x4a9a4a;

  return (
    <group position={position} scale={[size, size, size]}>
      {/* Modern white ceramic pot */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.2, 0.5, 16]} />
        <meshStandardMaterial color={0xf5f5f5} roughness={0.3} />
      </mesh>

      {/* Soil */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
        <meshStandardMaterial color={0x3d2817} roughness={0.9} />
      </mesh>

      {/* Modern fiddle leaf fig style plant */}
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin((angle * Math.PI) / 180) * 0.15,
            0.7 + i * 0.12,
            Math.cos((angle * Math.PI) / 180) * 0.15,
          ]}
          rotation={[0.4 + i * 0.1, (angle * Math.PI) / 180, 0]}
        >
          <planeGeometry args={[0.25, 0.4]} />
          <meshStandardMaterial
            color={leafColor}
            side={THREE.DoubleSide}
            roughness={0.6}
          />
        </mesh>
      ))}
    </group>
  );
};

// ====== WALL-MOUNTED DISPLAY ======

interface WallDisplayProps {
  position: [number, number, number];
  rotation?: number;
  width?: number;
  height?: number;
}

/**
 * Modern wall-mounted display - thin aluminum frame with screen.
 * Properly mounted flush against wall.
 */
const WallDisplay: React.FC<WallDisplayProps> = ({
  position,
  rotation = 0,
  width = 3,
  height = 1.8,
}) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Thin aluminum frame */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.03]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[width, height, 0.01]} />
        <meshStandardMaterial
          color={isNightMode ? 0x1a1a2e : 0x2a2a3e}
          emissive={isNightMode ? 0x111122 : 0x000000}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Apple logo placeholder - simple circle */}
      <mesh position={[0, 0, 0.025]}>
        <circleGeometry args={[0.15, 32]} />
        <meshStandardMaterial
          color={0xffffff}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};

// ====== WALL CLOCK - MINIMAL DESIGN ======

interface WallClockProps {
  position: [number, number, number];
  rotation?: number;
}

/**
 * Minimal wall clock - Apple-style with clean face.
 * Mounted flush against wall.
 */
const WallClock: React.FC<WallClockProps> = ({ position, rotation = 0 }) => {
  const hourHandRef = useRef<THREE.Mesh>(null);
  const minuteHandRef = useRef<THREE.Mesh>(null);
  const secondHandRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = now.getHours() + minutes / 60;

    if (secondHandRef.current) {
      secondHandRef.current.rotation.z = -seconds * (Math.PI / 30);
    }
    if (minuteHandRef.current) {
      minuteHandRef.current.rotation.z = -minutes * (Math.PI / 30);
    }
    if (hourHandRef.current) {
      hourHandRef.current.rotation.z = -hours * (Math.PI / 6);
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Clean white face */}
      <mesh>
        <circleGeometry args={[0.4, 64]} />
        <meshStandardMaterial color={0xffffff} roughness={0.3} />
      </mesh>

      {/* Thin aluminum rim */}
      <mesh position={[0, 0, -0.01]}>
        <ringGeometry args={[0.38, 0.42, 64]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Minimal hour markers - just dots */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * Math.PI) / 6;
        const isMainHour = i % 3 === 0;
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * 0.32, Math.cos(angle) * 0.32, 0.01]}
          >
            <circleGeometry args={[isMainHour ? 0.02 : 0.01, 8]} />
            <meshStandardMaterial color={0x333333} />
          </mesh>
        );
      })}

      {/* Hour hand */}
      <mesh ref={hourHandRef} position={[0, 0.08, 0.02]}>
        <boxGeometry args={[0.02, 0.16, 0.01]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Minute hand */}
      <mesh ref={minuteHandRef} position={[0, 0.12, 0.02]}>
        <boxGeometry args={[0.015, 0.24, 0.01]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Second hand - orange accent */}
      <mesh ref={secondHandRef} position={[0, 0.12, 0.02]}>
        <boxGeometry args={[0.008, 0.28, 0.005]} />
        <meshStandardMaterial color={0xff6600} />
      </mesh>

      {/* Center cap */}
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.02, 16]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>
    </group>
  );
};

// ====== MODERN PENDANT LIGHT ======

interface PendantLightProps {
  position: [number, number, number];
}

/**
 * Modern pendant light - minimal dome shape.
 */
const PendantLight: React.FC<PendantLightProps> = ({ position }) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position}>
      {/* Cord */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Dome shade - white aluminum */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.4, 0.25, 32, 1, true]} />
        <meshStandardMaterial
          color={0xf5f5f5}
          side={THREE.DoubleSide}
          roughness={0.3}
        />
      </mesh>

      {/* Light bulb glow */}
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={0xffffee}
          emissive={0xffffcc}
          emissiveIntensity={isNightMode ? 2 : 0.5}
        />
      </mesh>
    </group>
  );
};

// ====== MODERN FLOOR LAMP ======

interface FloorLampProps {
  position: [number, number, number];
}

/**
 * Modern arc floor lamp - Apple store style.
 */
const FloorLamp: React.FC<FloorLampProps> = ({ position }) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position}>
      {/* Heavy base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.35, 0.1, 32]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Vertical pole */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.9, 16]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Curved arc section */}
      <mesh position={[0.3, 1.9, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.8, 16]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Dome shade */}
      <group position={[0.6, 1.7, 0]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.25, 0.15, 32, 1, true]} />
          <meshStandardMaterial
            color={0xf5f5f5}
            side={THREE.DoubleSide}
            roughness={0.3}
          />
        </mesh>

        {/* Light glow */}
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial
            color={0xffffee}
            emissive={0xffffcc}
            emissiveIntensity={isNightMode ? 1.5 : 0.3}
          />
        </mesh>
      </group>
    </group>
  );
};

// ====== DECORATIONS ======

/**
 * Decorations - Apple-style modern office decorations.
 *
 * All items properly placed - plants on floor near walls,
 * displays and clocks mounted on walls, pendant lights from ceiling.
 *
 * @returns JSX element with all decorations
 */
export const Decorations: React.FC = () => {
  const wallHeight = WALLS.HEIGHT;

  // Plant positions - against walls, on floor
  const plantPositions = useMemo<[number, number, number, number][]>(() => [
    // Along back wall
    [WALLS.BACK_X + 2, 0, WALLS.LEFT_Z + 3, 1.5],
    [WALLS.FRONT_X - 2, 0, WALLS.LEFT_Z + 3, 1.3],
    // Along side walls
    [WALLS.BACK_X + 2, 0, 0, 1.4],
    [WALLS.FRONT_X - 2, 0, 0, 1.2],
    // Near entrance
    [WALLS.BACK_X + 2, 0, WALLS.RIGHT_Z - 3, 1.5],
    [WALLS.FRONT_X - 2, 0, WALLS.RIGHT_Z - 3, 1.3],
  ], []);

  // Pendant light positions - hanging from ceiling
  const pendantPositions = useMemo<[number, number, number][]>(() => [
    // Grid of pendant lights across the space
    [-14, wallHeight - 1, 8],
    [0, wallHeight - 1, 8],
    [14, wallHeight - 1, 8],
    [-14, wallHeight - 1, -4],
    [0, wallHeight - 1, -4],
    [14, wallHeight - 1, -4],
    [-14, wallHeight - 1, -16],
    [0, wallHeight - 1, -16],
    [14, wallHeight - 1, -16],
  ], [wallHeight]);

  // Floor lamp positions - near corners and seating areas
  const floorLampPositions = useMemo<[number, number, number][]>(() => [
    [WALLS.BACK_X + 4, 0, WALLS.LEFT_Z + 5],
    [WALLS.FRONT_X - 4, 0, WALLS.LEFT_Z + 5],
    [WALLS.BACK_X + 4, 0, 12],
    [WALLS.FRONT_X - 4, 0, 12],
  ], []);

  return (
    <group>
      {/* Modern potted plants */}
      {plantPositions.map(([x, y, z, size], i) => (
        <PottedPlant key={`plant-${i}`} position={[x, y, z]} size={size} />
      ))}

      {/* Wall displays - mounted on back wall */}
      <WallDisplay
        position={[0, wallHeight / 2, WALLS.LEFT_Z + 0.2]}
        rotation={0}
        width={4}
        height={2.5}
      />

      {/* Wall clocks - mounted on side walls */}
      <WallClock
        position={[WALLS.BACK_X + 0.2, wallHeight * 0.6, 8]}
        rotation={Math.PI / 2}
      />
      <WallClock
        position={[WALLS.FRONT_X - 0.2, wallHeight * 0.6, -8]}
        rotation={-Math.PI / 2}
      />

      {/* Pendant lights from ceiling */}
      {pendantPositions.map((pos, i) => (
        <PendantLight key={`pendant-${i}`} position={pos} />
      ))}

      {/* Modern floor lamps */}
      {floorLampPositions.map((pos, i) => (
        <FloorLamp key={`lamp-${i}`} position={pos} />
      ))}
    </group>
  );
};

export default Decorations;
