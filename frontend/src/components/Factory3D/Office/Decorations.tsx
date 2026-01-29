/**
 * Decorations - Apple-style modern office decorations.
 *
 * Minimalist, clean design with items properly mounted on walls.
 * Inspired by Apple store aesthetics - white, aluminum, glass.
 *
 * Performance optimizations:
 * - Shared geometries at module level (single GPU upload)
 * - Shared materials at module level (reused across all instances)
 * - Static position arrays as module constants (no useMemo overhead)
 * - WallClock uses performance.now() instead of new Date() per frame
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';

const { WALLS } = FACTORY_CONSTANTS;

// ====== SHARED GEOMETRIES (created once at module load) ======
const sharedGeometries = {
  // Plant
  pot: new THREE.CylinderGeometry(0.25, 0.2, 0.5, 16),
  soil: new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16),
  leaf: new THREE.PlaneGeometry(0.25, 0.4),
  // Clock
  clockFace: new THREE.CircleGeometry(0.4, 64),
  clockRim: new THREE.RingGeometry(0.38, 0.42, 64),
  hourMarkerLarge: new THREE.CircleGeometry(0.02, 8),
  hourMarkerSmall: new THREE.CircleGeometry(0.01, 8),
  hourHand: new THREE.BoxGeometry(0.02, 0.16, 0.01),
  minuteHand: new THREE.BoxGeometry(0.015, 0.24, 0.01),
  secondHand: new THREE.BoxGeometry(0.008, 0.28, 0.005),
  centerCap: new THREE.CircleGeometry(0.02, 16),
  // Pendant/Lamp
  cord: new THREE.CylinderGeometry(0.02, 0.02, 1, 8),
  pendantDome: new THREE.ConeGeometry(0.4, 0.25, 32, 1, true),
  floorLampDome: new THREE.ConeGeometry(0.25, 0.15, 32, 1, true),
  lightBulb: new THREE.SphereGeometry(0.08, 16, 16),
  smallLightBulb: new THREE.SphereGeometry(0.06, 16, 16),
  lampBase: new THREE.CylinderGeometry(0.3, 0.35, 0.1, 32),
  lampPole: new THREE.CylinderGeometry(0.025, 0.025, 1.9, 16),
  lampArc: new THREE.CylinderGeometry(0.025, 0.025, 0.8, 16),
  // Display
  logoCircle: new THREE.CircleGeometry(0.15, 32),
};

// ====== SHARED MATERIALS (created once at module load) ======
const sharedMaterials = {
  whiteCeramic: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 }),
  aluminum: new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 }),
  darkGray: new THREE.MeshStandardMaterial({ color: 0x333333 }),
  clockHand: new THREE.MeshStandardMaterial({ color: 0x333333 }),
  secondHand: new THREE.MeshStandardMaterial({ color: 0xff6600 }),
  whiteFace: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  whiteShade: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, side: THREE.DoubleSide, roughness: 0.3 }),
  logo: new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }),
};

// Dynamic materials that depend on isNightMode need to be created per-instance
// But we can cache them by night mode state
const nightModeMaterials = {
  leafDay: new THREE.MeshStandardMaterial({ color: 0x4a9a4a, side: THREE.DoubleSide, roughness: 0.6 }),
  leafNight: new THREE.MeshStandardMaterial({ color: 0x2d5a2d, side: THREE.DoubleSide, roughness: 0.6 }),
  screenDay: new THREE.MeshStandardMaterial({ color: 0x2a2a3e, emissive: 0x000000, emissiveIntensity: 0.5 }),
  screenNight: new THREE.MeshStandardMaterial({ color: 0x1a1a2e, emissive: 0x111122, emissiveIntensity: 0.5 }),
  bulbDay: new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.5 }),
  bulbNight: new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 2 }),
  smallBulbDay: new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.3 }),
  smallBulbNight: new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.5 }),
};

// ====== STATIC POSITION ARRAYS (module-level constants) ======
const WALL_HEIGHT = WALLS.HEIGHT;

// Plant positions - against walls, on floor [x, y, z, size]
const PLANT_POSITIONS: [number, number, number, number][] = [
  [WALLS.BACK_X + 2, 0, WALLS.LEFT_Z + 3, 1.5],
  [WALLS.FRONT_X - 2, 0, WALLS.LEFT_Z + 3, 1.3],
  [WALLS.BACK_X + 2, 0, 0, 1.4],
  [WALLS.FRONT_X - 2, 0, 0, 1.2],
  [WALLS.BACK_X + 2, 0, WALLS.RIGHT_Z - 3, 1.5],
  [WALLS.FRONT_X - 2, 0, WALLS.RIGHT_Z - 3, 1.3],
];

// Pendant light positions - hanging from ceiling
const PENDANT_POSITIONS: [number, number, number][] = [
  [-14, WALL_HEIGHT - 1, 8],
  [0, WALL_HEIGHT - 1, 8],
  [14, WALL_HEIGHT - 1, 8],
  [-14, WALL_HEIGHT - 1, -4],
  [0, WALL_HEIGHT - 1, -4],
  [14, WALL_HEIGHT - 1, -4],
  [-14, WALL_HEIGHT - 1, -16],
  [0, WALL_HEIGHT - 1, -16],
  [14, WALL_HEIGHT - 1, -16],
];

// Floor lamp positions - near corners and seating areas
const FLOOR_LAMP_POSITIONS: [number, number, number][] = [
  [WALLS.BACK_X + 4, 0, WALLS.LEFT_Z + 5],
  [WALLS.FRONT_X - 4, 0, WALLS.LEFT_Z + 5],
  [WALLS.BACK_X + 4, 0, 12],
  [WALLS.FRONT_X - 4, 0, 12],
];

// Pre-computed leaf angles and positions for plants
const LEAF_ANGLES = [0, 72, 144, 216, 288];
const LEAF_DATA = LEAF_ANGLES.map((angle, i) => ({
  position: [
    Math.sin((angle * Math.PI) / 180) * 0.15,
    0.7 + i * 0.12,
    Math.cos((angle * Math.PI) / 180) * 0.15,
  ] as [number, number, number],
  rotation: [0.4 + i * 0.1, (angle * Math.PI) / 180, 0] as [number, number, number],
}));

// Pre-computed hour marker data for clocks
const HOUR_MARKERS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * Math.PI) / 6;
  return {
    position: [Math.sin(angle) * 0.32, Math.cos(angle) * 0.32, 0.01] as [number, number, number],
    isMainHour: i % 3 === 0,
  };
});

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
  const leafMaterial = isNightMode ? nightModeMaterials.leafNight : nightModeMaterials.leafDay;

  return (
    <group position={position} scale={[size, size, size]}>
      {/* Modern white ceramic pot */}
      <mesh position={[0, 0.25, 0]} geometry={sharedGeometries.pot} material={sharedMaterials.whiteCeramic} castShadow />

      {/* Soil */}
      <mesh position={[0, 0.48, 0]} geometry={sharedGeometries.soil} material={sharedMaterials.soil} />

      {/* Modern fiddle leaf fig style plant */}
      {LEAF_DATA.map((leaf, i) => (
        <mesh
          key={i}
          position={leaf.position}
          rotation={leaf.rotation}
          geometry={sharedGeometries.leaf}
          material={leafMaterial}
        />
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
 * Note: Frame and screen geometries are dynamic based on dimensions,
 * so we create them inline but materials are shared.
 */
const WallDisplay: React.FC<WallDisplayProps> = ({
  position,
  rotation = 0,
  width = 3,
  height = 1.8,
}) => {
  const { isNightMode } = useFactory();
  const screenMaterial = isNightMode ? nightModeMaterials.screenNight : nightModeMaterials.screenDay;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Thin aluminum frame */}
      <mesh castShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.03]} />
        <primitive object={sharedMaterials.aluminum} attach="material" />
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[width, height, 0.01]} />
        <primitive object={screenMaterial} attach="material" />
      </mesh>

      {/* Apple logo placeholder - simple circle */}
      <mesh position={[0, 0, 0.025]} geometry={sharedGeometries.logoCircle} material={sharedMaterials.logo} />
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
 * Uses performance.now() instead of new Date() for better performance.
 */
const WallClock: React.FC<WallClockProps> = ({ position, rotation = 0 }) => {
  const hourHandRef = useRef<THREE.Mesh>(null);
  const minuteHandRef = useRef<THREE.Mesh>(null);
  const secondHandRef = useRef<THREE.Mesh>(null);

  // Calculate time offset once on mount
  const timeOffset = useRef<number>(0);
  if (timeOffset.current === 0) {
    const now = new Date();
    const msOfDay = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds();
    timeOffset.current = msOfDay - performance.now();
  }

  useFrame(() => {
    // Use performance.now() + offset instead of new Date() every frame
    const msOfDay = (performance.now() + timeOffset.current) % 86400000;
    const totalSeconds = msOfDay / 1000;
    const seconds = totalSeconds % 60;
    const minutes = (totalSeconds / 60) % 60;
    const hours = (totalSeconds / 3600) % 12;

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
      <mesh geometry={sharedGeometries.clockFace} material={sharedMaterials.whiteFace} />

      {/* Thin aluminum rim */}
      <mesh position={[0, 0, -0.01]} geometry={sharedGeometries.clockRim} material={sharedMaterials.aluminum} />

      {/* Minimal hour markers - just dots */}
      {HOUR_MARKERS.map((marker, i) => (
        <mesh
          key={i}
          position={marker.position}
          geometry={marker.isMainHour ? sharedGeometries.hourMarkerLarge : sharedGeometries.hourMarkerSmall}
          material={sharedMaterials.darkGray}
        />
      ))}

      {/* Hour hand */}
      <mesh ref={hourHandRef} position={[0, 0.08, 0.02]} geometry={sharedGeometries.hourHand} material={sharedMaterials.clockHand} />

      {/* Minute hand */}
      <mesh ref={minuteHandRef} position={[0, 0.12, 0.02]} geometry={sharedGeometries.minuteHand} material={sharedMaterials.clockHand} />

      {/* Second hand - orange accent */}
      <mesh ref={secondHandRef} position={[0, 0.12, 0.02]} geometry={sharedGeometries.secondHand} material={sharedMaterials.secondHand} />

      {/* Center cap */}
      <mesh position={[0, 0, 0.03]} geometry={sharedGeometries.centerCap} material={sharedMaterials.darkGray} />
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
  const bulbMaterial = isNightMode ? nightModeMaterials.bulbNight : nightModeMaterials.bulbDay;

  return (
    <group position={position}>
      {/* Cord */}
      <mesh position={[0, 0.5, 0]} geometry={sharedGeometries.cord} material={sharedMaterials.darkGray} />

      {/* Dome shade - white aluminum */}
      <mesh rotation={[Math.PI, 0, 0]} geometry={sharedGeometries.pendantDome} material={sharedMaterials.whiteShade} />

      {/* Light bulb glow */}
      <mesh position={[0, -0.1, 0]} geometry={sharedGeometries.lightBulb} material={bulbMaterial} />
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
  const bulbMaterial = isNightMode ? nightModeMaterials.smallBulbNight : nightModeMaterials.smallBulbDay;

  return (
    <group position={position}>
      {/* Heavy base */}
      <mesh position={[0, 0.05, 0]} geometry={sharedGeometries.lampBase} material={sharedMaterials.aluminum} castShadow />

      {/* Vertical pole */}
      <mesh position={[0, 1.0, 0]} geometry={sharedGeometries.lampPole} material={sharedMaterials.aluminum} castShadow />

      {/* Curved arc section */}
      <mesh position={[0.3, 1.9, 0]} rotation={[0, 0, Math.PI / 6]} geometry={sharedGeometries.lampArc} material={sharedMaterials.aluminum} castShadow />

      {/* Dome shade */}
      <group position={[0.6, 1.7, 0]}>
        <mesh rotation={[Math.PI, 0, 0]} geometry={sharedGeometries.floorLampDome} material={sharedMaterials.whiteShade} />

        {/* Light glow */}
        <mesh position={[0, -0.05, 0]} geometry={sharedGeometries.smallLightBulb} material={bulbMaterial} />
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
  return (
    <group>
      {/* Modern potted plants */}
      {PLANT_POSITIONS.map(([x, y, z, size], i) => (
        <PottedPlant key={`plant-${i}`} position={[x, y, z]} size={size} />
      ))}

      {/* Wall displays - mounted on back wall */}
      <WallDisplay
        position={[0, WALL_HEIGHT / 2, WALLS.LEFT_Z + 0.2]}
        rotation={0}
        width={4}
        height={2.5}
      />

      {/* Wall clocks - mounted on side walls */}
      <WallClock
        position={[WALLS.BACK_X + 0.2, WALL_HEIGHT * 0.6, 8]}
        rotation={Math.PI / 2}
      />
      <WallClock
        position={[WALLS.FRONT_X - 0.2, WALL_HEIGHT * 0.6, -8]}
        rotation={-Math.PI / 2}
      />

      {/* Pendant lights from ceiling */}
      {PENDANT_POSITIONS.map((pos, i) => (
        <PendantLight key={`pendant-${i}`} position={pos} />
      ))}

      {/* Modern floor lamps */}
      {FLOOR_LAMP_POSITIONS.map((pos, i) => (
        <FloorLamp key={`lamp-${i}`} position={pos} />
      ))}
    </group>
  );
};

export default Decorations;
