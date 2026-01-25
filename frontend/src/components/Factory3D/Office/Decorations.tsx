/**
 * Decorations - Office decorations like plants, whiteboard, clocks.
 *
 * Adds visual interest and realism to the factory environment.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';

// ====== POTTED PLANT ======

interface PottedPlantProps {
  position: [number, number, number];
  size?: number;
}

/**
 * PottedPlant - Decorative plant in a pot.
 */
const PottedPlant: React.FC<PottedPlantProps> = ({ position, size = 1 }) => {
  const { isNightMode } = useFactory();
  const leafColor = isNightMode ? 0x1a4d1a : 0x2e8b2e;

  return (
    <group position={position} scale={[size, size, size]}>
      {/* Pot */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.3, 12]} />
        <meshStandardMaterial color={0x8b4513} roughness={0.8} />
      </mesh>

      {/* Soil */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 12]} />
        <meshStandardMaterial color={0x3d2817} roughness={0.9} />
      </mesh>

      {/* Plant leaves */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.sin((angle * Math.PI) / 180) * 0.1,
            0.4 + i * 0.05,
            Math.cos((angle * Math.PI) / 180) * 0.1,
          ]}
          rotation={[0.3, (angle * Math.PI) / 180, 0]}
        >
          <planeGeometry args={[0.15, 0.3]} />
          <meshStandardMaterial
            color={leafColor}
            side={THREE.DoubleSide}
            roughness={0.8}
          />
        </mesh>
      ))}
    </group>
  );
};

// ====== WATER COOLER ======

interface WaterCoolerProps {
  position: [number, number, number];
}

/**
 * WaterCooler - Office water cooler.
 */
const WaterCooler: React.FC<WaterCoolerProps> = ({ position }) => {
  return (
    <group position={position}>
      {/* Base cabinet */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.4, 0.8, 0.4]} />
        <meshStandardMaterial color={0xdddddd} roughness={0.3} />
      </mesh>

      {/* Water tank */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 16]} />
        <meshStandardMaterial
          color={0x88ccff}
          transparent
          opacity={0.6}
          roughness={0.1}
        />
      </mesh>

      {/* Tap area */}
      <mesh position={[0, 0.7, 0.18]}>
        <boxGeometry args={[0.15, 0.08, 0.05]} />
        <meshStandardMaterial color={0x666666} metalness={0.8} />
      </mesh>
    </group>
  );
};

// ====== WHITEBOARD ======

interface WhiteboardProps {
  position: [number, number, number];
  rotation?: number;
}

/**
 * Whiteboard - Wall-mounted whiteboard.
 */
const Whiteboard: React.FC<WhiteboardProps> = ({ position, rotation = 0 }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Board */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3, 1.5, 0.05]} />
        <meshStandardMaterial color={0xf5f5f5} roughness={0.2} />
      </mesh>

      {/* Frame */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[3.1, 1.6, 0.02]} />
        <meshStandardMaterial color={0x888888} metalness={0.5} />
      </mesh>

      {/* Marker tray */}
      <mesh position={[0, -0.85, 0.1]}>
        <boxGeometry args={[1, 0.08, 0.15]} />
        <meshStandardMaterial color={0x666666} />
      </mesh>

      {/* Markers */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, -0.83, 0.15]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
          <meshStandardMaterial
            color={[0xff0000, 0x0000ff, 0x00aa00][i]}
          />
        </mesh>
      ))}
    </group>
  );
};

// ====== WALL CLOCK ======

interface WallClockProps {
  position: [number, number, number];
  rotation?: number;
}

/**
 * WallClock - Analog clock with animated hands.
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
      {/* Clock face */}
      <mesh>
        <circleGeometry args={[0.3, 32]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>

      {/* Frame */}
      <mesh position={[0, 0, -0.02]}>
        <ringGeometry args={[0.28, 0.32, 32]} />
        <meshStandardMaterial color={0x333333} metalness={0.6} />
      </mesh>

      {/* Hour markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * Math.PI) / 6;
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * 0.22, Math.cos(angle) * 0.22, 0.01]}
          >
            <circleGeometry args={[0.02, 8]} />
            <meshStandardMaterial color={0x333333} />
          </mesh>
        );
      })}

      {/* Hour hand */}
      <mesh ref={hourHandRef} position={[0, 0.06, 0.02]}>
        <boxGeometry args={[0.02, 0.12, 0.01]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Minute hand */}
      <mesh ref={minuteHandRef} position={[0, 0.08, 0.02]}>
        <boxGeometry args={[0.015, 0.18, 0.01]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Second hand */}
      <mesh ref={secondHandRef} position={[0, 0.1, 0.02]}>
        <boxGeometry args={[0.008, 0.22, 0.005]} />
        <meshStandardMaterial color={0xff0000} />
      </mesh>

      {/* Center dot */}
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.015, 16]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>
    </group>
  );
};

// ====== FILING CABINET ======

interface FilingCabinetProps {
  position: [number, number, number];
}

/**
 * FilingCabinet - Metal filing cabinet with drawers.
 */
const FilingCabinet: React.FC<FilingCabinetProps> = ({ position }) => {
  return (
    <group position={position}>
      {/* Cabinet body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.5, 1.2, 0.6]} />
        <meshStandardMaterial color={0x666666} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Drawer faces */}
      {[0.2, 0.6, 1.0].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0.31]}>
            <boxGeometry args={[0.45, 0.35, 0.02]} />
            <meshStandardMaterial color={0x555555} metalness={0.6} />
          </mesh>
          {/* Handle */}
          <mesh position={[0, y, 0.33]}>
            <boxGeometry args={[0.15, 0.02, 0.02]} />
            <meshStandardMaterial color={0x888888} metalness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ====== CEILING LIGHT FIXTURE ======

interface CeilingLightProps {
  position: [number, number, number];
}

/**
 * CeilingLight - Overhead fluorescent light fixture.
 */
const CeilingLight: React.FC<CeilingLightProps> = ({ position }) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position}>
      {/* Fixture housing */}
      <mesh>
        <boxGeometry args={[1.5, 0.1, 0.5]} />
        <meshStandardMaterial color={0xdddddd} roughness={0.3} />
      </mesh>

      {/* Light panel */}
      <mesh position={[0, -0.06, 0]}>
        <boxGeometry args={[1.4, 0.02, 0.4]} />
        <meshStandardMaterial
          color={0xffffee}
          emissive={0xffffee}
          emissiveIntensity={isNightMode ? 0.8 : 0.2}
        />
      </mesh>
    </group>
  );
};

// ====== DECORATIONS ======

/**
 * Decorations - All office decorations.
 *
 * Places plants, water coolers, whiteboards, clocks,
 * filing cabinets, and ceiling lights throughout the office.
 *
 * @returns JSX element with all decorations
 */
export const Decorations: React.FC = () => {
  // Plant positions
  const plantPositions = useMemo<[number, number, number, number][]>(() => [
    [-22, 0, -15, 1.2],
    [22, 0, -15, 1.0],
    [-22, 0, 5, 0.9],
    [22, 0, 5, 1.1],
    [-22, 0, 15, 1.0],
    [22, 0, 15, 1.2],
  ], []);

  // Ceiling light positions
  const ceilingLightPositions = useMemo<[number, number, number][]>(() => [
    [-14, 3.9, 8],
    [0, 3.9, 8],
    [14, 3.9, 8],
    [-14, 3.9, -2],
    [0, 3.9, -2],
    [14, 3.9, -2],
    [-14, 3.9, -12],
    [0, 3.9, -12],
    [14, 3.9, -12],
  ], []);

  return (
    <group>
      {/* Potted plants */}
      {plantPositions.map(([x, y, z, size], i) => (
        <PottedPlant key={`plant-${i}`} position={[x, y, z]} size={size} />
      ))}

      {/* Water coolers */}
      <WaterCooler position={[-23, 0, 0]} />
      <WaterCooler position={[23, 0, 0]} />

      {/* Whiteboards on walls */}
      <Whiteboard position={[0, 2.5, -17.7]} rotation={0} />
      <Whiteboard position={[-25.7, 2.5, -5]} rotation={Math.PI / 2} />
      <Whiteboard position={[25.7, 2.5, 5]} rotation={-Math.PI / 2} />

      {/* Wall clocks */}
      <WallClock position={[-25.7, 3, 10]} rotation={Math.PI / 2} />
      <WallClock position={[25.7, 3, -10]} rotation={-Math.PI / 2} />

      {/* Filing cabinets */}
      <FilingCabinet position={[-23, 0, -10]} />
      <FilingCabinet position={[23, 0, -10]} />
      <FilingCabinet position={[-23, 0, 10]} />
      <FilingCabinet position={[23, 0, 10]} />

      {/* Ceiling lights */}
      {ceilingLightPositions.map((pos, i) => (
        <CeilingLight key={`light-${i}`} position={pos} />
      ))}
    </group>
  );
};

export default Decorations;
