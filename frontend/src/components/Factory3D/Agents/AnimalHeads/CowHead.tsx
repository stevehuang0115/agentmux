/**
 * CowHead - Stylized cow head for robot agents.
 *
 * A friendly cartoon-style cow head with horns, ears, and snout.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useFactory } from '../../../../contexts/FactoryContext';

/**
 * CowHead - Procedural cow head geometry.
 *
 * Features:
 * - Main head shape
 * - Horns
 * - Ears
 * - Eyes with eyelids
 * - Snout with nostrils
 *
 * @returns JSX element with cow head meshes
 */
export const CowHead: React.FC = () => {
  const { isNightMode } = useFactory();

  const headColor = isNightMode ? 0xcccccc : 0xffffff;
  const spotColor = 0x333333;
  const hornColor = isNightMode ? 0x888888 : 0xd4a574;
  const noseColor = isNightMode ? 0xcc8888 : 0xffb6c1;

  return (
    <group scale={0.6}>
      {/* Main head */}
      <mesh castShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color={headColor} roughness={0.8} />
      </mesh>

      {/* Spots on head */}
      <mesh position={[-0.2, 0.3, 0.3]} rotation={[0.3, 0.5, 0]}>
        <circleGeometry args={[0.15, 8]} />
        <meshStandardMaterial
          color={spotColor}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[0.25, 0.2, 0.25]} rotation={[0.2, -0.3, 0.1]}>
        <circleGeometry args={[0.12, 8]} />
        <meshStandardMaterial
          color={spotColor}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </mesh>

      {/* Horns */}
      <Horn position={[-0.35, 0.4, 0]} rotation={[0, 0, -0.3]} />
      <Horn position={[0.35, 0.4, 0]} rotation={[0, 0, 0.3]} />

      {/* Ears */}
      <Ear position={[-0.45, 0.2, 0.1]} rotation={[0, 0.5, -0.3]} />
      <Ear position={[0.45, 0.2, 0.1]} rotation={[0, -0.5, 0.3]} />

      {/* Snout */}
      <mesh position={[0, -0.15, 0.45]} castShadow>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial color={noseColor} roughness={0.6} />
      </mesh>

      {/* Nostrils */}
      <mesh position={[-0.08, -0.18, 0.68]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>
      <mesh position={[0.08, -0.18, 0.68]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={0x333333} />
      </mesh>

      {/* Eyes */}
      <Eye position={[-0.18, 0.1, 0.4]} />
      <Eye position={[0.18, 0.1, 0.4]} />
    </group>
  );
};

/**
 * Horn - Cow horn shape.
 */
const Horn: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
}> = ({ position, rotation }) => {
  const { isNightMode } = useFactory();
  const hornColor = isNightMode ? 0x888888 : 0xd4a574;

  return (
    <mesh position={position} rotation={rotation} castShadow>
      <coneGeometry args={[0.08, 0.3, 8]} />
      <meshStandardMaterial color={hornColor} roughness={0.5} />
    </mesh>
  );
};

/**
 * Ear - Cow ear shape.
 */
const Ear: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
}> = ({ position, rotation }) => {
  const { isNightMode } = useFactory();
  const earColor = isNightMode ? 0xcccccc : 0xffffff;
  const innerColor = isNightMode ? 0xcc8888 : 0xffb6c1;

  return (
    <group position={position} rotation={rotation}>
      {/* Outer ear */}
      <mesh>
        <sphereGeometry args={[0.12, 8, 8, 0, Math.PI]} />
        <meshStandardMaterial color={earColor} roughness={0.8} />
      </mesh>
      {/* Inner ear */}
      <mesh position={[0, 0, 0.02]} scale={0.7}>
        <sphereGeometry args={[0.1, 8, 8, 0, Math.PI]} />
        <meshStandardMaterial color={innerColor} roughness={0.8} />
      </mesh>
    </group>
  );
};

/**
 * Eye - Cow eye with pupil.
 */
const Eye: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => {
  return (
    <group position={position}>
      {/* Eye white */}
      <mesh>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color={0xffffff} roughness={0.2} />
      </mesh>
      {/* Pupil */}
      <mesh position={[0, 0, 0.06]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={0x222222} roughness={0.1} />
      </mesh>
      {/* Highlight */}
      <mesh position={[0.02, 0.02, 0.08]}>
        <sphereGeometry args={[0.015, 6, 6]} />
        <meshStandardMaterial color={0xffffff} emissive={0xffffff} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
};
