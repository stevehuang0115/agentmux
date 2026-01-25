/**
 * ConveyorBelt - Animated conveyor belt with moving packages.
 *
 * A decorative industrial element that adds movement to the factory.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BoxData {
  offset: number;
  color: number;
  size: number;
}

/**
 * ConveyorBelt - Animated belt with packages.
 *
 * Features:
 * - Belt surface with metallic appearance
 * - Support legs
 * - Animated boxes moving across
 *
 * @returns JSX element with conveyor belt and animated boxes
 */
export const ConveyorBelt: React.FC = () => {
  const boxRefs = useRef<THREE.Mesh[]>([]);

  // Generate box data
  const boxes = useMemo<BoxData[]>(() => {
    const colors = [0x8b0000, 0x006400, 0x00008b, 0x8b8b00, 0x8b4500];
    return Array.from({ length: 6 }, (_, i) => ({
      offset: i * 2.5 - 7.5,
      color: colors[i % colors.length],
      size: 0.4 + Math.random() * 0.2,
    }));
  }, []);

  // Animate boxes
  useFrame((state, delta) => {
    boxRefs.current.forEach((box) => {
      if (box) {
        box.position.x += delta * 0.8;
        if (box.position.x > 7) {
          box.position.x = -7;
        }
      }
    });
  });

  return (
    <group position={[0, 0, -14]}>
      {/* Belt surface */}
      <mesh position={[0, 0.5, 0]} receiveShadow>
        <boxGeometry args={[16, 0.1, 1.2]} />
        <meshStandardMaterial color={0x333333} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Belt rails */}
      <mesh position={[0, 0.55, 0.55]}>
        <boxGeometry args={[16, 0.05, 0.08]} />
        <meshStandardMaterial color={0x666666} metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.55, -0.55]}>
        <boxGeometry args={[16, 0.05, 0.08]} />
        <meshStandardMaterial color={0x666666} metalness={0.8} />
      </mesh>

      {/* Belt rollers at ends */}
      <mesh position={[-7.5, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.2, 16]} />
        <meshStandardMaterial color={0x444444} metalness={0.7} />
      </mesh>
      <mesh position={[7.5, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.2, 16]} />
        <meshStandardMaterial color={0x444444} metalness={0.7} />
      </mesh>

      {/* Support legs */}
      {[-6, -2, 2, 6].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0.25, 0.4]}>
            <boxGeometry args={[0.15, 0.5, 0.15]} />
            <meshStandardMaterial color={0x555555} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.25, -0.4]}>
            <boxGeometry args={[0.15, 0.5, 0.15]} />
            <meshStandardMaterial color={0x555555} metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Animated boxes */}
      {boxes.map((box, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) boxRefs.current[i] = el;
          }}
          position={[box.offset, 0.6 + box.size / 2, 0]}
          castShadow
        >
          <boxGeometry args={[box.size, box.size, box.size]} />
          <meshStandardMaterial color={box.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
};

export default ConveyorBelt;
