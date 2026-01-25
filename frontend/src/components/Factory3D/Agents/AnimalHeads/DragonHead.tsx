/**
 * DragonHead - Procedural dragon head for agents.
 *
 * Creates a stylized dragon head using Three.js geometries.
 * Dragons are assigned to agents based on project name hash.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Props for DragonHead component.
 */
interface DragonHeadProps {
  /** Head rotation for animation */
  headRotation?: { x: number; y: number };
}

/**
 * DragonHead - Procedural dragon head with horns and scales.
 *
 * Features:
 * - Main head shape with snout
 * - Two curved horns
 * - Glowing eyes
 * - Scale details
 *
 * @param props - DragonHead component props
 * @returns Dragon head JSX element
 */
export const DragonHead: React.FC<DragonHeadProps> = ({ headRotation }) => {
  const groupRef = useRef<THREE.Group>(null);
  const eyeGlowRef = useRef<number>(0);

  // Animate eye glow
  useFrame((state) => {
    eyeGlowRef.current = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7;

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

  // Dragon colors
  const scaleColor = 0x2e5a1c; // Dark green
  const hornColor = 0x3a3a3a; // Dark gray
  const eyeColor = 0xff4400; // Fiery orange

  return (
    <group ref={groupRef} position={[0, 1.65, 0]}>
      {/* Main head - elongated sphere */}
      <mesh position={[0, 0, 0.1]} scale={[0.22, 0.2, 0.28]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={scaleColor} roughness={0.6} />
      </mesh>

      {/* Snout */}
      <mesh position={[0, -0.03, 0.35]} scale={[0.12, 0.1, 0.15]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={scaleColor} roughness={0.6} />
      </mesh>

      {/* Nostrils */}
      <mesh position={[-0.04, 0, 0.42]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={0x1a1a1a} />
      </mesh>
      <mesh position={[0.04, 0, 0.42]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={0x1a1a1a} />
      </mesh>

      {/* Left horn */}
      <group position={[-0.12, 0.15, -0.05]} rotation={[0, 0, Math.PI / 6]}>
        <mesh scale={[0.03, 0.15, 0.03]}>
          <coneGeometry args={[1, 1, 6]} />
          <meshStandardMaterial color={hornColor} roughness={0.4} />
        </mesh>
      </group>

      {/* Right horn */}
      <group position={[0.12, 0.15, -0.05]} rotation={[0, 0, -Math.PI / 6]}>
        <mesh scale={[0.03, 0.15, 0.03]}>
          <coneGeometry args={[1, 1, 6]} />
          <meshStandardMaterial color={hornColor} roughness={0.4} />
        </mesh>
      </group>

      {/* Eye ridges */}
      <mesh position={[-0.1, 0.08, 0.18]} rotation={[0, 0, Math.PI / 8]} scale={[0.08, 0.03, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={scaleColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 0.08, 0.18]} rotation={[0, 0, -Math.PI / 8]} scale={[0.08, 0.03, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={scaleColor} roughness={0.5} />
      </mesh>

      {/* Left eye */}
      <mesh position={[-0.08, 0.03, 0.25]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial
          color={eyeColor}
          emissive={eyeColor}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Right eye */}
      <mesh position={[0.08, 0.03, 0.25]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial
          color={eyeColor}
          emissive={eyeColor}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Spine ridges down back of head */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[0, 0.18 - i * 0.08, -0.1 - i * 0.05]}
          rotation={[-Math.PI / 4, 0, 0]}
          scale={[0.02, 0.04, 0.02]}
        >
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color={scaleColor} roughness={0.5} />
        </mesh>
      ))}

      {/* Jaw */}
      <mesh position={[0, -0.1, 0.2]} scale={[0.18, 0.06, 0.2]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={0x1a3a10} roughness={0.6} />
      </mesh>
    </group>
  );
};
