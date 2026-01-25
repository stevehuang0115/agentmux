/**
 * Workstation - Desk, chair, laptop, and status indicator.
 *
 * A complete workstation setup including desk, office chair,
 * laptop with animated screen, and status indicator light.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Workstation as WorkstationType } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

interface WorkstationProps {
  workstation: WorkstationType;
  zoneColor: number;
}

/**
 * Workstation - Complete desk setup with laptop and chair.
 *
 * @param workstation - Workstation data including position
 * @param zoneColor - Zone color for accents
 */
export const Workstation: React.FC<WorkstationProps> = ({
  workstation,
  zoneColor,
}) => {
  const { isNightMode, agents } = useFactory();
  const indicatorRef = useRef<THREE.Mesh>(null);
  const displayRef = useRef<THREE.Mesh>(null);
  const codeLineRefs = useRef<THREE.Mesh[]>([]);

  // Find assigned agent
  const agent = useMemo(() => {
    if (!workstation.assignedAgentId) return null;
    return agents.get(workstation.assignedAgentId);
  }, [workstation.assignedAgentId, agents]);

  // Determine status colors
  const statusColors = useMemo(() => {
    if (!agent) return { color: 0x888888, emissive: 0x888888 };
    switch (agent.status) {
      case 'active':
        return { color: 0x00ff00, emissive: 0x00ff00 };
      case 'idle':
        return { color: 0xffff00, emissive: 0xffff00 };
      case 'dormant':
        return { color: 0xff0000, emissive: 0xff0000 };
      default:
        return { color: 0x888888, emissive: 0x888888 };
    }
  }, [agent]);

  // Animate screen and indicator
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Indicator pulse
    if (indicatorRef.current) {
      const material = indicatorRef.current.material as THREE.MeshStandardMaterial;
      const pulse = (Math.sin(t * 3) + 1) / 2;
      material.emissiveIntensity = 0.3 + pulse * 0.7;
    }

    // Display glow when active
    if (displayRef.current && agent?.status === 'active') {
      const material = displayRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.2 + Math.sin(t * 2) * 0.1;
    }

    // Code line flicker
    codeLineRefs.current.forEach((line, i) => {
      if (line && agent?.status === 'active') {
        const material = line.material as THREE.MeshStandardMaterial;
        const flicker = Math.sin(t * 10 + i * 2) * 0.1 + 0.9;
        material.emissiveIntensity = 0.8 * flicker;
        material.opacity = agent.cpuPercent > 10 ? 0.9 : 0;
      }
    });
  });

  const { x, z } = workstation.position;

  return (
    <group position={[x, 0, z]}>
      {/* Desk */}
      <Desk />

      {/* Chair */}
      <Chair />

      {/* Laptop */}
      <Laptop
        isActive={workstation.isActive}
        displayRef={displayRef}
        codeLineRefs={codeLineRefs}
      />

      {/* Status indicator */}
      <mesh
        ref={indicatorRef}
        position={[0.8, 0.83, 0]}
      >
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial
          color={statusColors.color}
          emissive={statusColors.emissive}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Night mode spotlight */}
      {isNightMode && workstation.isActive && (
        <spotLight
          color={0xffffee}
          intensity={1.5}
          distance={8}
          angle={Math.PI / 4}
          penumbra={0.5}
          decay={1}
          position={[0, 4, 0]}
          target-position={[0, 0, 0.5]}
          castShadow
          shadow-mapSize-width={512}
          shadow-mapSize-height={512}
        />
      )}
    </group>
  );
};

/**
 * Desk - Wooden desk with metal legs.
 */
const Desk: React.FC = () => {
  return (
    <group>
      {/* Desktop surface */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.05, 1]} />
        <meshStandardMaterial color={0x8b4513} roughness={0.6} />
      </mesh>

      {/* Desk legs */}
      {[[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.375, lz]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.75, 8]} />
          <meshStandardMaterial color={0x333333} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Chair - Office chair with backrest.
 */
const Chair: React.FC = () => {
  return (
    <group position={[0, 0, 0.8]}>
      {/* Seat */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.5]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Backrest */}
      <mesh position={[0, 0.7, 0.21]}>
        <boxGeometry args={[0.5, 0.5, 0.08]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Chair leg */}
      <mesh position={[0, 0.225, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
        <meshStandardMaterial color={0x666666} metalness={0.8} />
      </mesh>

      {/* Chair base */}
      <mesh position={[0, 0.02, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.02, 16]} />
        <meshStandardMaterial color={0x444444} metalness={0.6} />
      </mesh>
    </group>
  );
};

/**
 * Laptop - Screen and keyboard with animated display.
 */
interface LaptopProps {
  isActive: boolean;
  displayRef: React.MutableRefObject<THREE.Mesh | null>;
  codeLineRefs: React.MutableRefObject<THREE.Mesh[]>;
}

const Laptop: React.FC<LaptopProps> = ({ isActive, displayRef, codeLineRefs }) => {
  const screenColor = isActive ? 0x1a1a2e : 0x0a0a12;

  return (
    <group>
      {/* Laptop base */}
      <mesh position={[0, 0.79, -0.1]}>
        <boxGeometry args={[1.0, 0.04, 0.7]} />
        <meshStandardMaterial color={0x333333} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Laptop screen group (angled) */}
      <group position={[0, 0.79, -0.45]} rotation={[-Math.PI / 6, 0, 0]}>
        {/* Screen frame */}
        <mesh position={[0, 0.35, -0.015]}>
          <boxGeometry args={[1.0, 0.7, 0.03]} />
          <meshStandardMaterial color={0x333333} metalness={0.5} roughness={0.3} />
        </mesh>

        {/* Display */}
        <mesh ref={displayRef} position={[0, 0.35, 0.002]}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshStandardMaterial
            color={screenColor}
            emissive={isActive ? 0x1a1a2e : 0x000000}
            emissiveIntensity={isActive ? 0.3 : 0}
          />
        </mesh>

        {/* Code lines */}
        {isActive && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh
                key={i}
                ref={(el) => {
                  if (el) codeLineRefs.current[i] = el;
                }}
                position={[-0.1 + Math.random() * 0.1, 0.5 - i * 0.1, 0.004]}
              >
                <planeGeometry args={[0.5 + Math.random() * 0.2, 0.03]} />
                <meshStandardMaterial
                  color={0x00ff88}
                  emissive={0x00ff88}
                  emissiveIntensity={0.8}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            ))}
          </>
        )}
      </group>

      {/* Keyboard */}
      <mesh position={[0, 0.801, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.4]} />
        <meshStandardMaterial color={0x222222} roughness={0.8} />
      </mesh>
    </group>
  );
};

export default Workstation;
