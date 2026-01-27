/**
 * Lounge - Rest area with couches for sleeping and sitting agents.
 *
 * A cozy lounge area where idle agents can rest on couches
 * when they're sleeping or taking a break.
 */

import React from 'react';
import * as THREE from 'three';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

const { LOUNGE } = FACTORY_CONSTANTS;

// ====== COUCH ======

interface CouchProps {
  position: [number, number, number];
  rotation?: number;
  color?: number;
}

/**
 * Couch - Comfortable seating for resting agents.
 */
const Couch: React.FC<CouchProps> = ({ position, rotation = 0, color = 0x4a6fa5 }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat cushion */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[2.5, 0.3, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Back cushion */}
      <mesh position={[0, 0.8, -0.35]} castShadow>
        <boxGeometry args={[2.5, 0.6, 0.25]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Left armrest */}
      <mesh position={[-1.15, 0.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.6, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Right armrest */}
      <mesh position={[1.15, 0.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.6, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Couch base/frame */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[2.6, 0.2, 1]} />
        <meshStandardMaterial color={0x2a2a2a} roughness={0.6} />
      </mesh>

      {/* Legs */}
      {[
        [-1.1, 0.05, 0.35],
        [1.1, 0.05, 0.35],
        [-1.1, 0.05, -0.35],
        [1.1, 0.05, -0.35],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
          <meshStandardMaterial color={0x333333} metalness={0.5} />
        </mesh>
      ))}

      {/* Decorative pillows */}
      <mesh position={[-0.9, 0.65, 0.1]} rotation={[0, 0.2, 0.1]}>
        <boxGeometry args={[0.35, 0.35, 0.15]} />
        <meshStandardMaterial color={0xffa07a} roughness={0.9} />
      </mesh>
      <mesh position={[0.9, 0.65, 0.1]} rotation={[0, -0.2, -0.1]}>
        <boxGeometry args={[0.35, 0.35, 0.15]} />
        <meshStandardMaterial color={0x98d982} roughness={0.9} />
      </mesh>
    </group>
  );
};

// ====== COFFEE TABLE ======

/**
 * CoffeeTable - Low table between couches.
 */
const CoffeeTable: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[0, 0, 0]}>
      {/* Table top */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.05, 0.7]} />
        <meshStandardMaterial color={0x5c4033} roughness={0.5} />
      </mesh>

      {/* Glass surface */}
      <mesh position={[0, 0.43, 0]}>
        <boxGeometry args={[1.1, 0.01, 0.6]} />
        <meshStandardMaterial
          color={0x88ccff}
          transparent
          opacity={0.3}
          roughness={0.1}
        />
      </mesh>

      {/* Shelf */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.0, 0.03, 0.5]} />
        <meshStandardMaterial color={0x5c4033} roughness={0.6} />
      </mesh>

      {/* Legs */}
      {[
        [-0.5, 0.2, 0.25],
        [0.5, 0.2, 0.25],
        [-0.5, 0.2, -0.25],
        [0.5, 0.2, -0.25],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.05, 0.4, 0.05]} />
          <meshStandardMaterial color={0x333333} metalness={0.6} />
        </mesh>
      ))}

      {/* Magazines on table */}
      <group position={[0.3, 0.45, 0]}>
        <mesh rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.25, 0.02, 0.18]} />
          <meshStandardMaterial color={0xff6b6b} roughness={0.7} />
        </mesh>
        <mesh position={[0.05, 0.02, 0.02]} rotation={[0, -0.2, 0]}>
          <boxGeometry args={[0.25, 0.02, 0.18]} />
          <meshStandardMaterial color={0x4ecdc4} roughness={0.7} />
        </mesh>
      </group>

      {/* Coffee mug */}
      <group position={[-0.35, 0.45, 0.1]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.04, 0.035, 0.1, 12]} />
          <meshStandardMaterial color={0xffffff} roughness={0.3} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.05, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.025, 0.008, 8, 12, Math.PI]} />
          <meshStandardMaterial color={0xffffff} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

// ====== FLOOR LAMP ======

interface FloorLampProps {
  position: [number, number, number];
}

/**
 * FloorLamp - Standing lamp for ambient lighting.
 */
const FloorLamp: React.FC<FloorLampProps> = ({ position }) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.1, 16]} />
        <meshStandardMaterial color={0x333333} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Pole */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.7, 8]} />
        <meshStandardMaterial color={0x333333} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Lamp shade */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.15, 0.25, 0.3, 16, 1, true]} />
        <meshStandardMaterial
          color={0xf5e6d3}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Light bulb glow */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial
          color={0xffffee}
          emissive={isNightMode ? 0xffff88 : 0x444400}
          emissiveIntensity={isNightMode ? 1.0 : 0.3}
        />
      </mesh>
    </group>
  );
};

// ====== RUG ======

/**
 * Rug - Area rug under the lounge furniture.
 */
const Rug: React.FC = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      receiveShadow
    >
      <planeGeometry args={[6, 4]} />
      <meshStandardMaterial
        color={0x8b6914}
        roughness={0.9}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
};

// ====== PLANT ======

interface PlantProps {
  position: [number, number, number];
  scale?: number;
}

/**
 * Plant - Decorative potted plant.
 */
const Plant: React.FC<PlantProps> = ({ position, scale = 1 }) => {
  return (
    <group position={position} scale={scale}>
      {/* Pot */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.12, 0.3, 12]} />
        <meshStandardMaterial color={0x8b4513} roughness={0.7} />
      </mesh>

      {/* Soil */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.04, 12]} />
        <meshStandardMaterial color={0x3d2817} roughness={0.9} />
      </mesh>

      {/* Plant leaves */}
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial color={0x228b22} roughness={0.8} />
      </mesh>
      <mesh position={[-0.1, 0.7, 0.1]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={0x2e8b2e} roughness={0.8} />
      </mesh>
      <mesh position={[0.1, 0.65, -0.1]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color={0x228b22} roughness={0.8} />
      </mesh>
    </group>
  );
};

// ====== LOUNGE ======

/**
 * Lounge - Complete rest area with couches.
 *
 * Includes comfortable couches, coffee table,
 * floor lamps, and decorative elements.
 *
 * @returns JSX element with lounge setup
 */
export const Lounge: React.FC = () => {
  const { x, z } = LOUNGE.POSITION;

  return (
    <group position={[x, 0, z]}>
      {/* Area rug */}
      <Rug />

      {/* Couches - facing each other */}
      <Couch position={[-2, 0, 0]} rotation={Math.PI / 2} color={0x4a6fa5} />
      <Couch position={[2, 0, 0]} rotation={-Math.PI / 2} color={0x5a7fb5} />

      {/* Coffee table */}
      <CoffeeTable />

      {/* Floor lamps */}
      <FloorLamp position={[-3.5, 0, 1.5]} />
      <FloorLamp position={[3.5, 0, 1.5]} />

      {/* Decorative plants */}
      <Plant position={[-3.5, 0, -1.5]} scale={1.2} />
      <Plant position={[3.5, 0, -1.5]} scale={1.0} />

      {/* Lounge sign */}
      <group position={[0, 3, -2]}>
        <mesh>
          <boxGeometry args={[2, 0.4, 0.1]} />
          <meshStandardMaterial color={0x4a6fa5} />
        </mesh>
        {/* Text would be rendered with canvas texture in production */}
      </group>
    </group>
  );
};

export default Lounge;
