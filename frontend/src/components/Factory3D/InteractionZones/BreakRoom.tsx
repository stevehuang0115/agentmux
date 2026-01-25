/**
 * BreakRoom - Coffee area with seating for agent interactions.
 *
 * A designated area where agents can take coffee breaks
 * and interact with each other.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

const { BREAK_ROOM } = FACTORY_CONSTANTS;

// ====== COFFEE MACHINE ======

/**
 * CoffeeMachine - Industrial coffee machine.
 */
const CoffeeMachine: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[-2, 0, 0]}>
      {/* Machine body */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[0.8, 1.5, 0.6]} />
        <meshStandardMaterial color={0x333333} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Water tank */}
      <mesh position={[0, 1.3, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.5]} />
        <meshStandardMaterial
          color={0x88ccff}
          transparent
          opacity={0.5}
          roughness={0.1}
        />
      </mesh>

      {/* Display panel */}
      <mesh position={[0, 0.9, 0.31]}>
        <boxGeometry args={[0.4, 0.2, 0.02]} />
        <meshStandardMaterial
          color={0x111111}
          emissive={isNightMode ? 0x00ff00 : 0x003300}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Cup platform */}
      <mesh position={[0, 0.2, 0.2]}>
        <boxGeometry args={[0.5, 0.05, 0.4]} />
        <meshStandardMaterial color={0x444444} metalness={0.5} />
      </mesh>
    </group>
  );
};

// ====== ROUND TABLE ======

/**
 * RoundTable - Coffee table with chairs.
 */
const RoundTable: React.FC = () => {
  return (
    <group>
      {/* Table top */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.05, 24]} />
        <meshStandardMaterial color={0x8b4513} roughness={0.6} />
      </mesh>

      {/* Table leg */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.7, 12]} />
        <meshStandardMaterial color={0x333333} metalness={0.7} />
      </mesh>

      {/* Table base */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.04, 16]} />
        <meshStandardMaterial color={0x333333} metalness={0.6} />
      </mesh>

      {/* Chairs around table */}
      {[0, 90, 180, 270].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.sin(rad) * 1.3;
        const z = Math.cos(rad) * 1.3;
        return (
          <CoffeeChair
            key={i}
            position={[x, 0, z]}
            rotation={-rad + Math.PI}
          />
        );
      })}
    </group>
  );
};

// ====== COFFEE CHAIR ======

interface CoffeeChairProps {
  position: [number, number, number];
  rotation: number;
}

/**
 * CoffeeChair - Casual seating for break room.
 */
const CoffeeChair: React.FC<CoffeeChairProps> = ({ position, rotation }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.08, 16]} />
        <meshStandardMaterial color={0xff6b35} roughness={0.8} />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, 0.75, -0.2]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.45, 0.5, 0.06]} />
        <meshStandardMaterial color={0xff6b35} roughness={0.8} />
      </mesh>

      {/* Leg */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color={0x333333} metalness={0.7} />
      </mesh>

      {/* Base */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 12]} />
        <meshStandardMaterial color={0x333333} metalness={0.6} />
      </mesh>
    </group>
  );
};

// ====== SNACK VENDING MACHINE ======

/**
 * VendingMachine - Snack vending machine.
 */
const VendingMachine: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[2, 0, -0.5]}>
      {/* Machine body */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.9, 2, 0.7]} />
        <meshStandardMaterial color={0x2244aa} roughness={0.4} />
      </mesh>

      {/* Glass front */}
      <mesh position={[0, 1.2, 0.36]}>
        <boxGeometry args={[0.8, 1.2, 0.02]} />
        <meshStandardMaterial
          color={0x88bbff}
          transparent
          opacity={0.4}
          roughness={0.1}
        />
      </mesh>

      {/* Product slots (visual) */}
      {[1.5, 1.2, 0.9].map((y, row) => (
        <group key={row}>
          {[-0.25, 0, 0.25].map((x, col) => (
            <mesh key={`${row}-${col}`} position={[x, y, 0.25]}>
              <boxGeometry args={[0.15, 0.2, 0.1]} />
              <meshStandardMaterial
                color={[0xff0000, 0x00ff00, 0xffff00][col]}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Coin slot */}
      <mesh position={[0.3, 0.6, 0.36]}>
        <boxGeometry args={[0.1, 0.05, 0.02]} />
        <meshStandardMaterial color={0x111111} metalness={0.8} />
      </mesh>

      {/* Pickup area */}
      <mesh position={[0, 0.15, 0.36]}>
        <boxGeometry args={[0.6, 0.25, 0.02]} />
        <meshStandardMaterial color={0x111111} />
      </mesh>
    </group>
  );
};

// ====== BREAK ROOM FLOOR ======

/**
 * BreakRoomFloor - Distinct flooring for break area.
 */
const BreakRoomFloor: React.FC = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      receiveShadow
    >
      <circleGeometry args={[4, 32]} />
      <meshStandardMaterial
        color={0x8b7355}
        roughness={0.8}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
};

// ====== BREAK ROOM ======

/**
 * BreakRoom - Complete break room area.
 *
 * Includes coffee machine, round table with chairs,
 * vending machine, and distinct flooring.
 *
 * @returns JSX element with break room setup
 */
export const BreakRoom: React.FC = () => {
  const { x, z } = BREAK_ROOM.POSITION;

  return (
    <group position={[x, 0, z]}>
      {/* Floor */}
      <BreakRoomFloor />

      {/* Coffee machine */}
      <CoffeeMachine />

      {/* Round table with chairs */}
      <RoundTable />

      {/* Vending machine */}
      <VendingMachine />

      {/* Potted plant */}
      <group position={[-3, 0, 1.5]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.25, 0.2, 0.4, 12]} />
          <meshStandardMaterial color={0x8b4513} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshStandardMaterial color={0x2e8b2e} roughness={0.8} />
        </mesh>
      </group>

      {/* Overhead sign */}
      <group position={[0, 3.5, -2]}>
        <mesh>
          <boxGeometry args={[2, 0.4, 0.1]} />
          <meshStandardMaterial color={0x2244aa} />
        </mesh>
        {/* Text would be rendered with canvas texture in production */}
      </group>
    </group>
  );
};

export default BreakRoom;
