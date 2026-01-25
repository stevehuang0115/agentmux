/**
 * PokerTable - Poker/game table with seating for agent interactions.
 *
 * A fun area where agents can take breaks and play games together.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

const { POKER_TABLE } = FACTORY_CONSTANTS;

// ====== POKER TABLE ======

/**
 * PokerTableTop - Green felt table with chip racks.
 */
const PokerTableTop: React.FC = () => {
  return (
    <group>
      {/* Table top - octagonal shape approximated with cylinder */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.2, 1.2, 0.08, 8]} />
        <meshStandardMaterial color={0x228b22} roughness={0.9} />
      </mesh>

      {/* Felt surface */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 32]} />
        <meshStandardMaterial color={0x1e7b1e} roughness={0.95} />
      </mesh>

      {/* Wood rim */}
      <mesh position={[0, 0.78, 0]}>
        <torusGeometry args={[1.15, 0.08, 8, 32]} />
        <meshStandardMaterial color={0x654321} roughness={0.6} />
      </mesh>

      {/* Table legs */}
      {[45, 135, 225, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.sin(rad) * 0.8;
        const z = Math.cos(rad) * 0.8;
        return (
          <mesh key={i} position={[x, 0.35, z]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.7, 8]} />
            <meshStandardMaterial color={0x654321} roughness={0.7} />
          </mesh>
        );
      })}

      {/* Chip stacks on table */}
      <ChipStack position={[-0.4, 0.85, -0.3]} colors={[0xff0000, 0x0000ff]} />
      <ChipStack position={[0.3, 0.85, 0.4]} colors={[0x00ff00, 0xffff00]} />
      <ChipStack position={[0.5, 0.85, -0.2]} colors={[0x000000, 0xffffff]} />

      {/* Playing cards (face down) */}
      <CardDeck position={[0, 0.82, 0]} />
    </group>
  );
};

// ====== CHIP STACK ======

interface ChipStackProps {
  position: [number, number, number];
  colors: [number, number];
}

/**
 * ChipStack - Stack of poker chips.
 */
const ChipStack: React.FC<ChipStackProps> = ({ position, colors }) => {
  return (
    <group position={position}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, i * 0.02, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
          <meshStandardMaterial color={colors[i % 2]} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

// ====== CARD DECK ======

interface CardDeckProps {
  position: [number, number, number];
}

/**
 * CardDeck - Stack of playing cards.
 */
const CardDeck: React.FC<CardDeckProps> = ({ position }) => {
  return (
    <group position={position}>
      {/* Card stack */}
      <mesh rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.12, 0.04, 0.18]} />
        <meshStandardMaterial color={0x2244aa} roughness={0.5} />
      </mesh>

      {/* Top card (slightly rotated) */}
      <mesh position={[0.02, 0.025, 0.01]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.12, 0.002, 0.18]} />
        <meshStandardMaterial color={0x2244aa} roughness={0.5} />
      </mesh>
    </group>
  );
};

// ====== POKER CHAIR ======

interface PokerChairProps {
  position: [number, number, number];
  rotation: number;
}

/**
 * PokerChair - Padded gaming chair.
 */
const PokerChair: React.FC<PokerChairProps> = ({ position, rotation }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat cushion */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color={0x8b0000} roughness={0.7} />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, 0.85, -0.22]}>
        <boxGeometry args={[0.5, 0.6, 0.08]} />
        <meshStandardMaterial color={0x8b0000} roughness={0.7} />
      </mesh>

      {/* Armrests */}
      {[-0.28, 0.28].map((x, i) => (
        <mesh key={i} position={[x, 0.65, 0]}>
          <boxGeometry args={[0.06, 0.08, 0.4]} />
          <meshStandardMaterial color={0x654321} roughness={0.6} />
        </mesh>
      ))}

      {/* Chair base */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
        <meshStandardMaterial color={0x333333} metalness={0.7} />
      </mesh>

      {/* Star base */}
      {[0, 72, 144, 216, 288].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <mesh
            key={i}
            position={[Math.sin(rad) * 0.15, 0.03, Math.cos(rad) * 0.15]}
            rotation={[0, -rad, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <meshStandardMaterial color={0x333333} metalness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
};

// ====== POKER AREA FLOOR ======

/**
 * PokerFloor - Distinct flooring for poker area.
 */
const PokerFloor: React.FC = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.02, 0]}
      receiveShadow
    >
      <circleGeometry args={[4, 32]} />
      <meshStandardMaterial
        color={0x2a2a35}
        roughness={0.8}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
};

// ====== OVERHEAD LAMP ======

/**
 * OverheadLamp - Classic poker table pendant lamp.
 */
const OverheadLamp: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[0, 2.5, 0]}>
      {/* Lamp shade */}
      <mesh>
        <coneGeometry args={[0.6, 0.4, 16, 1, true]} />
        <meshStandardMaterial
          color={0x2e8b2e}
          side={THREE.DoubleSide}
          roughness={0.6}
        />
      </mesh>

      {/* Inner shade (gold) */}
      <mesh position={[0, 0.02, 0]}>
        <coneGeometry args={[0.58, 0.38, 16, 1, true]} />
        <meshStandardMaterial
          color={0xdaa520}
          side={THREE.BackSide}
          emissive={0xffdd88}
          emissiveIntensity={isNightMode ? 0.5 : 0.1}
        />
      </mesh>

      {/* Bulb */}
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={0xffffee}
          emissive={0xffffee}
          emissiveIntensity={isNightMode ? 1 : 0.3}
        />
      </mesh>

      {/* Chain/cord */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 1.2, 8]} />
        <meshStandardMaterial color={0x333333} metalness={0.8} />
      </mesh>

      {/* Spotlight for table */}
      {isNightMode && (
        <spotLight
          color={0xffffdd}
          intensity={2}
          distance={5}
          angle={Math.PI / 3}
          penumbra={0.5}
          position={[0, -0.2, 0]}
          target-position={[0, -3, 0]}
          castShadow
        />
      )}
    </group>
  );
};

// ====== POKER TABLE AREA ======

/**
 * PokerTable - Complete poker/game table area.
 *
 * Includes poker table, chairs, overhead lamp,
 * and decorative flooring.
 *
 * @returns JSX element with poker table setup
 */
export const PokerTable: React.FC = () => {
  const { x, z } = POKER_TABLE.POSITION;

  // Chair positions around table
  const chairAngles = [0, 90, 180, 270];

  return (
    <group position={[x, 0, z]}>
      {/* Floor */}
      <PokerFloor />

      {/* Table */}
      <PokerTableTop />

      {/* Chairs */}
      {chairAngles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const distance = 1.8;
        return (
          <PokerChair
            key={i}
            position={[
              Math.sin(rad) * distance,
              0,
              Math.cos(rad) * distance,
            ]}
            rotation={-rad + Math.PI}
          />
        );
      })}

      {/* Overhead lamp */}
      <OverheadLamp />

      {/* Side table with drinks */}
      <group position={[3, 0, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 16]} />
          <meshStandardMaterial color={0x654321} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.05, 0.08, 0.5, 8]} />
          <meshStandardMaterial color={0x333333} metalness={0.7} />
        </mesh>

        {/* Drinks on table */}
        <mesh position={[-0.1, 0.58, 0.05]}>
          <cylinderGeometry args={[0.04, 0.03, 0.12, 8]} />
          <meshStandardMaterial color={0x8b4513} transparent opacity={0.8} />
        </mesh>
        <mesh position={[0.1, 0.58, -0.05]}>
          <cylinderGeometry args={[0.04, 0.03, 0.12, 8]} />
          <meshStandardMaterial color={0x8b4513} transparent opacity={0.8} />
        </mesh>
      </group>
    </group>
  );
};

export default PokerTable;
