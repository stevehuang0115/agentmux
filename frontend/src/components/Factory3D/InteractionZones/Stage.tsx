/**
 * Stage - Performance stage for dancing and singing agents.
 *
 * A raised platform with spotlights where agents can
 * perform dance and entertainment animations.
 */

import React from 'react';
import * as THREE from 'three';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

const { STAGE } = FACTORY_CONSTANTS;

// ====== SPOTLIGHT ======

interface SpotlightProps {
  position: [number, number, number];
  color: number;
}

/**
 * Spotlight - Decorative stage spotlight.
 */
const Spotlight: React.FC<SpotlightProps> = ({ position, color }) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position}>
      {/* Light housing */}
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 12]} />
        <meshStandardMaterial color={0x222222} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Light lens */}
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={isNightMode ? color : 0x000000}
          emissiveIntensity={isNightMode ? 0.8 : 0.2}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Light beam (visible in night mode) */}
      {isNightMode && (
        <mesh position={[0, -1.5, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[0.8, 3, 12, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};

// ====== SPEAKER ======

interface SpeakerProps {
  position: [number, number, number];
  rotation?: number;
}

/**
 * Speaker - Stage speaker/monitor.
 */
const Speaker: React.FC<SpeakerProps> = ({ position, rotation = 0 }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Speaker cabinet */}
      <mesh castShadow>
        <boxGeometry args={[0.6, 1.2, 0.5]} />
        <meshStandardMaterial color={0x111111} roughness={0.8} />
      </mesh>

      {/* Speaker cone (woofer) */}
      <mesh position={[0, -0.1, 0.26]}>
        <cylinderGeometry args={[0.2, 0.18, 0.05, 16]} />
        <meshStandardMaterial color={0x333333} metalness={0.3} />
      </mesh>

      {/* Speaker cone (tweeter) */}
      <mesh position={[0, 0.35, 0.26]}>
        <cylinderGeometry args={[0.08, 0.06, 0.04, 12]} />
        <meshStandardMaterial color={0x222222} metalness={0.4} />
      </mesh>

      {/* Fabric cover decoration */}
      <mesh position={[0, 0, 0.251]}>
        <planeGeometry args={[0.5, 1.0]} />
        <meshStandardMaterial color={0x1a1a1a} roughness={0.9} />
      </mesh>
    </group>
  );
};

// ====== MICROPHONE STAND ======

/**
 * MicrophoneStand - Stage microphone on a stand.
 */
const MicrophoneStand: React.FC = () => {
  return (
    <group position={[0, 0, 1.5]}>
      {/* Base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.1, 16]} />
        <meshStandardMaterial color={0x222222} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Stand pole */}
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 8]} />
        <meshStandardMaterial color={0x333333} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Mic holder arm */}
      <mesh position={[0, 1.4, 0.1]} rotation={[Math.PI / 6, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
        <meshStandardMaterial color={0x333333} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Microphone */}
      <group position={[0, 1.5, 0.2]}>
        {/* Mic body */}
        <mesh rotation={[Math.PI / 6, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.15, 12]} />
          <meshStandardMaterial color={0x444444} metalness={0.5} roughness={0.4} />
        </mesh>
        {/* Mic head */}
        <mesh position={[0, 0.08, 0.04]} rotation={[Math.PI / 6, 0, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={0x222222} metalness={0.4} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};

// ====== STAGE FLOOR ======

/**
 * StageFloor - The main stage platform.
 */
const StageFloor: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group>
      {/* Main stage platform */}
      <mesh position={[0, STAGE.HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[STAGE.WIDTH, STAGE.HEIGHT, STAGE.DEPTH]} />
        <meshStandardMaterial
          color={0x4a3728}
          roughness={0.6}
        />
      </mesh>

      {/* Stage front edge (decorative trim) */}
      <mesh position={[0, STAGE.HEIGHT / 2, STAGE.DEPTH / 2 + 0.05]}>
        <boxGeometry args={[STAGE.WIDTH, STAGE.HEIGHT, 0.1]} />
        <meshStandardMaterial
          color={0xd4af37}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Stage steps */}
      <mesh position={[0, 0.1, STAGE.DEPTH / 2 + 0.5]} castShadow>
        <boxGeometry args={[2, 0.2, 0.8]} />
        <meshStandardMaterial color={0x4a3728} roughness={0.6} />
      </mesh>

      {/* Dance floor effect (glowing in night mode) */}
      <mesh
        position={[0, STAGE.HEIGHT + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[STAGE.WIDTH - 0.4, STAGE.DEPTH - 0.4]} />
        <meshStandardMaterial
          color={0x3a2a1a}
          roughness={0.5}
          emissive={isNightMode ? 0x221100 : 0x000000}
          emissiveIntensity={isNightMode ? 0.3 : 0}
        />
      </mesh>
    </group>
  );
};

// ====== BACKDROP CURTAIN ======

/**
 * Curtain - Stage backdrop curtain.
 */
const Curtain: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[0, 2, -STAGE.DEPTH / 2 + 0.1]}>
      {/* Main curtain */}
      <mesh castShadow>
        <boxGeometry args={[STAGE.WIDTH + 1, 4, 0.15]} />
        <meshStandardMaterial
          color={0x8b0000}
          roughness={0.8}
          emissive={isNightMode ? 0x220000 : 0x000000}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Curtain rod */}
      <mesh position={[0, 2.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, STAGE.WIDTH + 1.5, 12]} />
        <meshStandardMaterial color={0xd4af37} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Curtain valance */}
      <mesh position={[0, 2, 0.1]}>
        <boxGeometry args={[STAGE.WIDTH + 1.2, 0.5, 0.1]} />
        <meshStandardMaterial color={0x8b0000} roughness={0.7} />
      </mesh>
    </group>
  );
};

// ====== STAGE ======

/**
 * Stage - Complete performance stage area.
 *
 * Includes raised platform, spotlights, speakers,
 * microphone stand, and backdrop curtain.
 *
 * @returns JSX element with stage setup
 */
export const Stage: React.FC = () => {
  const { x, z } = STAGE.POSITION;
  const rotation = (STAGE as { ROTATION?: number }).ROTATION || 0;

  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      {/* Stage floor */}
      <StageFloor />

      {/* Backdrop curtain */}
      <Curtain />

      {/* Spotlights */}
      <Spotlight position={[-3, 4, 1]} color={0xff4444} />
      <Spotlight position={[0, 4, 1]} color={0x44ff44} />
      <Spotlight position={[3, 4, 1]} color={0x4444ff} />

      {/* Speakers */}
      <Speaker position={[-STAGE.WIDTH / 2 - 0.5, 0.6, 0]} rotation={Math.PI / 8} />
      <Speaker position={[STAGE.WIDTH / 2 + 0.5, 0.6, 0]} rotation={-Math.PI / 8} />

      {/* Microphone stand */}
      <group position={[0, STAGE.HEIGHT, 0]}>
        <MicrophoneStand />
      </group>

      {/* Stage sign */}
      <group position={[0, 4.5, -STAGE.DEPTH / 2]}>
        <mesh>
          <boxGeometry args={[3, 0.5, 0.1]} />
          <meshStandardMaterial color={0x222222} />
        </mesh>
        {/* Text would be rendered with canvas texture in production */}
      </group>
    </group>
  );
};

export default Stage;
