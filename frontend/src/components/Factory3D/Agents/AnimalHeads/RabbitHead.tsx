/**
 * RabbitHead - Procedural rabbit head for agents.
 *
 * Creates a stylized rabbit head using Three.js geometries.
 * Rabbits are assigned to agents based on project name hash.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Props for RabbitHead component.
 */
interface RabbitHeadProps {
  /** Head rotation for animation */
  headRotation?: { x: number; y: number };
}

/**
 * RabbitHead - Procedural rabbit head with long ears.
 *
 * Features:
 * - Round fluffy head
 * - Long floppy ears
 * - Pink nose
 * - Buck teeth
 *
 * @param props - RabbitHead component props
 * @returns Rabbit head JSX element
 */
export const RabbitHead: React.FC<RabbitHeadProps> = ({ headRotation }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftEarRef = useRef<THREE.Group>(null);
  const rightEarRef = useRef<THREE.Group>(null);
  const earWobble = useRef<number>(0);

  // Animate head and ears
  useFrame((state) => {
    earWobble.current = Math.sin(state.clock.elapsedTime * 3) * 0.05;

    if (leftEarRef.current) {
      leftEarRef.current.rotation.z = Math.PI / 10 + earWobble.current;
    }
    if (rightEarRef.current) {
      rightEarRef.current.rotation.z = -Math.PI / 10 - earWobble.current;
    }

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

  // Rabbit colors
  const furColor = 0xd4c4b4; // Light brown/gray
  const innerEarColor = 0xffb6c1; // Light pink
  const noseColor = 0xff9999; // Pink
  const teethColor = 0xffffff; // White

  return (
    <group ref={groupRef} position={[0, 1.65, 0]}>
      {/* Main head - round */}
      <mesh position={[0, 0, 0.05]} scale={[0.2, 0.18, 0.2]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>

      {/* Fluffy cheeks */}
      <mesh position={[-0.1, -0.02, 0.12]} scale={[0.08, 0.07, 0.06]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>
      <mesh position={[0.1, -0.02, 0.12]} scale={[0.08, 0.07, 0.06]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>

      {/* Muzzle */}
      <mesh position={[0, -0.04, 0.18]} scale={[0.08, 0.06, 0.08]}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color={furColor} roughness={0.9} />
      </mesh>

      {/* Nose */}
      <mesh position={[0, -0.01, 0.24]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color={noseColor} roughness={0.4} />
      </mesh>

      {/* Left ear */}
      <group ref={leftEarRef} position={[-0.08, 0.2, 0]}>
        {/* Outer ear */}
        <mesh scale={[0.04, 0.18, 0.025]}>
          <capsuleGeometry args={[1, 1, 4, 8]} />
          <meshStandardMaterial color={furColor} roughness={0.9} />
        </mesh>
        {/* Inner ear */}
        <mesh position={[0, 0, 0.015]} scale={[0.025, 0.14, 0.01]}>
          <capsuleGeometry args={[1, 1, 4, 8]} />
          <meshStandardMaterial color={innerEarColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Right ear */}
      <group ref={rightEarRef} position={[0.08, 0.2, 0]}>
        {/* Outer ear */}
        <mesh scale={[0.04, 0.18, 0.025]}>
          <capsuleGeometry args={[1, 1, 4, 8]} />
          <meshStandardMaterial color={furColor} roughness={0.9} />
        </mesh>
        {/* Inner ear */}
        <mesh position={[0, 0, 0.015]} scale={[0.025, 0.14, 0.01]}>
          <capsuleGeometry args={[1, 1, 4, 8]} />
          <meshStandardMaterial color={innerEarColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Eyes - large and cute */}
      <mesh position={[-0.07, 0.04, 0.16]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color={0x1a1a1a} />
      </mesh>
      <mesh position={[0.07, 0.04, 0.16]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color={0x1a1a1a} />
      </mesh>

      {/* Eye highlights */}
      <mesh position={[-0.06, 0.05, 0.19]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>
      <mesh position={[0.08, 0.05, 0.19]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color={0xffffff} />
      </mesh>

      {/* Buck teeth */}
      <mesh position={[-0.015, -0.1, 0.2]} scale={[0.02, 0.03, 0.015]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={teethColor} roughness={0.3} />
      </mesh>
      <mesh position={[0.015, -0.1, 0.2]} scale={[0.02, 0.03, 0.015]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={teethColor} roughness={0.3} />
      </mesh>

      {/* Whiskers */}
      {[-1, 1].map((side) => (
        <React.Fragment key={side}>
          {[-1, 0, 1].map((y) => (
            <mesh
              key={y}
              position={[side * 0.12, -0.03 + y * 0.02, 0.18]}
              rotation={[0, 0, side * Math.PI / 12 + y * 0.1]}
              scale={[0.08, 0.003, 0.003]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color={0x888888} roughness={0.5} />
            </mesh>
          ))}
        </React.Fragment>
      ))}
    </group>
  );
};

export default RabbitHead;
