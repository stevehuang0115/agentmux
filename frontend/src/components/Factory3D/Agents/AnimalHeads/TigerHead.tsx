/**
 * TigerHead - Procedural tiger head for agents.
 *
 * Creates a stylized tiger head using Three.js geometries.
 * Tigers are assigned to agents based on project name hash.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Props for TigerHead component.
 */
interface TigerHeadProps {
  /** Head rotation for animation */
  headRotation?: { x: number; y: number };
}

/**
 * TigerHead - Procedural tiger head with stripes.
 *
 * Features:
 * - Orange and white fur coloring
 * - Striped pattern
 * - Pointed ears
 * - White muzzle
 *
 * @param props - TigerHead component props
 * @returns Tiger head JSX element
 */
export const TigerHead: React.FC<TigerHeadProps> = ({ headRotation }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Animate head
  useFrame(() => {
    if (groupRef.current && headRotation) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        headRotation.x,
        0.1
      );
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        headRotation.y,
        0.1
      );
    }
  });

  // Tiger colors
  const orangeFur = 0xe87a1c; // Orange
  const stripeColor = 0x1a1a1a; // Black stripes
  const whiteFur = 0xf5f5f0; // Off-white

  return (
    <group ref={groupRef} position={[0, 1.65, 0]}>
      {/* Main head - rounded */}
      <mesh position={[0, 0, 0.05]} scale={[0.22, 0.2, 0.22]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={orangeFur} roughness={0.8} />
      </mesh>

      {/* White cheek puffs */}
      <mesh position={[-0.12, -0.02, 0.15]} scale={[0.1, 0.08, 0.08]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={whiteFur} roughness={0.9} />
      </mesh>
      <mesh position={[0.12, -0.02, 0.15]} scale={[0.1, 0.08, 0.08]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={whiteFur} roughness={0.9} />
      </mesh>

      {/* White muzzle */}
      <mesh position={[0, -0.06, 0.2]} scale={[0.1, 0.08, 0.1]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={whiteFur} roughness={0.9} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, -0.02, 0.28]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={0xff6699} roughness={0.5} />
      </mesh>

      {/* Left ear */}
      <group position={[-0.14, 0.18, -0.02]}>
        <mesh rotation={[0, 0, Math.PI / 8]} scale={[0.06, 0.08, 0.03]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={orangeFur} roughness={0.8} />
        </mesh>
        {/* Inner ear */}
        <mesh position={[0.01, -0.01, 0.015]} rotation={[0, 0, Math.PI / 8]} scale={[0.035, 0.05, 0.02]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={0xffb6c1} roughness={0.7} />
        </mesh>
      </group>

      {/* Right ear */}
      <group position={[0.14, 0.18, -0.02]}>
        <mesh rotation={[0, 0, -Math.PI / 8]} scale={[0.06, 0.08, 0.03]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={orangeFur} roughness={0.8} />
        </mesh>
        {/* Inner ear */}
        <mesh position={[-0.01, -0.01, 0.015]} rotation={[0, 0, -Math.PI / 8]} scale={[0.035, 0.05, 0.02]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={0xffb6c1} roughness={0.7} />
        </mesh>
      </group>

      {/* Forehead stripes */}
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh
          key={i}
          position={[x, 0.12, 0.12]}
          rotation={[0.3, 0, 0]}
          scale={[0.015, 0.04, 0.01]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={stripeColor} roughness={0.9} />
        </mesh>
      ))}

      {/* Cheek stripes */}
      {[1, 2, 3].map((i) => (
        <React.Fragment key={i}>
          <mesh
            position={[-0.18 + i * 0.01, 0.02 - i * 0.03, 0.08]}
            rotation={[0, Math.PI / 6, Math.PI / 8]}
            scale={[0.01, 0.03, 0.01]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={stripeColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[0.18 - i * 0.01, 0.02 - i * 0.03, 0.08]}
            rotation={[0, -Math.PI / 6, -Math.PI / 8]}
            scale={[0.01, 0.03, 0.01]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={stripeColor} roughness={0.9} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Eyes - white background */}
      <mesh position={[-0.08, 0.04, 0.18]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>
      <mesh position={[0.08, 0.04, 0.18]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>

      {/* Pupils */}
      <mesh position={[-0.08, 0.04, 0.21]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color={0x1a1a1a} />
      </mesh>
      <mesh position={[0.08, 0.04, 0.21]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshStandardMaterial color={0x1a1a1a} />
      </mesh>

      {/* Whisker spots */}
      {[-1, 1].map((side) => (
        <React.Fragment key={side}>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[side * (0.08 + i * 0.015), -0.04 - i * 0.015, 0.22]}
              scale={[0.01, 0.01, 0.01]}
            >
              <sphereGeometry args={[1, 6, 6]} />
              <meshStandardMaterial color={0x1a1a1a} />
            </mesh>
          ))}
        </React.Fragment>
      ))}
    </group>
  );
};
