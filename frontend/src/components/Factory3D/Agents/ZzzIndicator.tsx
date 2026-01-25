/**
 * ZzzIndicator - Floating Zzz symbols for sleeping agents.
 *
 * Animated text that floats upward to indicate an agent is idle/sleeping.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

interface ZzzIndicatorProps {
  /** Horizontal offset */
  xOffset?: number;
  /** Vertical offset from agent */
  yOffset?: number;
}

/**
 * ZzzIndicator - Animated sleeping indicator.
 *
 * Features:
 * - Multiple Z letters in different sizes
 * - Floating upward animation
 * - Subtle rotation
 * - Fading effect
 *
 * @param xOffset - Horizontal offset
 * @param yOffset - Vertical offset from agent center
 * @returns JSX element with Zzz animation
 */
export const ZzzIndicator: React.FC<ZzzIndicatorProps> = ({
  xOffset = 0.5,
  yOffset = 1.8,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const z1Ref = useRef<THREE.Group>(null);
  const z2Ref = useRef<THREE.Group>(null);
  const z3Ref = useRef<THREE.Group>(null);

  // Animate Zzz floating and bobbing
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      // Overall group floating
      groupRef.current.position.y = yOffset + Math.sin(t * 0.8) * 0.2;
      groupRef.current.rotation.y = t * 0.5;
    }

    // Individual Z animations with offset timing
    if (z1Ref.current) {
      const phase1 = (t * 0.5) % 1;
      z1Ref.current.position.y = phase1 * 0.6;
      z1Ref.current.position.x = Math.sin(phase1 * Math.PI) * 0.1;
      const mat = z1Ref.current.children[0] as any;
      if (mat?.material) {
        mat.material.opacity = 1 - phase1 * 0.5;
      }
    }

    if (z2Ref.current) {
      const phase2 = ((t * 0.5) + 0.33) % 1;
      z2Ref.current.position.y = 0.3 + phase2 * 0.6;
      z2Ref.current.position.x = 0.15 + Math.sin(phase2 * Math.PI) * 0.1;
      const mat = z2Ref.current.children[0] as any;
      if (mat?.material) {
        mat.material.opacity = 1 - phase2 * 0.5;
      }
    }

    if (z3Ref.current) {
      const phase3 = ((t * 0.5) + 0.66) % 1;
      z3Ref.current.position.y = 0.6 + phase3 * 0.6;
      z3Ref.current.position.x = 0.3 + Math.sin(phase3 * Math.PI) * 0.1;
      const mat = z3Ref.current.children[0] as any;
      if (mat?.material) {
        mat.material.opacity = 1 - phase3 * 0.5;
      }
    }
  });

  return (
    <Billboard follow>
      <group ref={groupRef} position={[xOffset, yOffset, 0]}>
        {/* Small Z */}
        <group ref={z1Ref} position={[0, 0, 0]}>
          <Text
            fontSize={0.2}
            color="#4466aa"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={1}
          >
            z
          </Text>
        </group>

        {/* Medium Z */}
        <group ref={z2Ref} position={[0.15, 0.3, 0]}>
          <Text
            fontSize={0.25}
            color="#4466aa"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={1}
          >
            Z
          </Text>
        </group>

        {/* Large Z */}
        <group ref={z3Ref} position={[0.3, 0.6, 0]}>
          <Text
            fontSize={0.3}
            color="#4466aa"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={1}
          >
            Z
          </Text>
        </group>
      </group>
    </Billboard>
  );
};

export default ZzzIndicator;
