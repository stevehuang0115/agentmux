/**
 * HorseHead - Stylized horse head for robot agents.
 *
 * A friendly cartoon-style horse head with mane and elongated snout.
 */

import React from 'react';
import * as THREE from 'three';
import { useFactory } from '../../../../contexts/FactoryContext';

/**
 * HorseHead - Procedural horse head geometry.
 *
 * Features:
 * - Elongated head shape
 * - Mane
 * - Ears
 * - Eyes with eyelids
 * - Long snout with nostrils
 *
 * @returns JSX element with horse head meshes
 */
export const HorseHead: React.FC = () => {
  const { isNightMode } = useFactory();

  const headColor = isNightMode ? 0x8b6914 : 0xc4a44e;
  const maneColor = isNightMode ? 0x3d2817 : 0x654321;
  const noseColor = isNightMode ? 0x666666 : 0x888888;

  return (
    <group scale={0.6}>
      {/* Main head - elongated */}
      <mesh castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color={headColor} roughness={0.8} />
      </mesh>

      {/* Snout - elongated cylinder */}
      <mesh position={[0, -0.1, 0.5]} rotation={[-0.3, 0, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.4, 8, 16]} />
        <meshStandardMaterial color={headColor} roughness={0.8} />
      </mesh>

      {/* Nose tip */}
      <mesh position={[0, -0.2, 0.85]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color={noseColor} roughness={0.6} />
      </mesh>

      {/* Nostrils */}
      <mesh position={[-0.06, -0.22, 0.98]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={0x222222} />
      </mesh>
      <mesh position={[0.06, -0.22, 0.98]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color={0x222222} />
      </mesh>

      {/* Mane - series of curved shapes */}
      <Mane color={maneColor} />

      {/* Ears */}
      <HorseEar position={[-0.25, 0.45, 0]} rotation={[0.3, 0.2, -0.2]} />
      <HorseEar position={[0.25, 0.45, 0]} rotation={[0.3, -0.2, 0.2]} />

      {/* Eyes */}
      <HorseEye position={[-0.25, 0.15, 0.3]} />
      <HorseEye position={[0.25, 0.15, 0.3]} />

      {/* White blaze on forehead */}
      <mesh position={[0, 0.2, 0.42]} rotation={[0.2, 0, 0]}>
        <planeGeometry args={[0.1, 0.25]} />
        <meshStandardMaterial
          color={0xffffff}
          side={THREE.DoubleSide}
          roughness={0.8}
        />
      </mesh>
    </group>
  );
};

/**
 * Mane - Horse mane along the top of the head.
 */
const Mane: React.FC<{ color: number }> = ({ color }) => {
  return (
    <group>
      {/* Main mane tuft */}
      {[-0.15, -0.05, 0.05, 0.15].map((z, i) => (
        <mesh
          key={i}
          position={[0, 0.45 - i * 0.05, z - 0.1]}
          rotation={[0.3 - i * 0.1, 0, 0]}
          castShadow
        >
          <coneGeometry args={[0.08 + i * 0.02, 0.2, 6]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}

      {/* Back of mane */}
      <mesh position={[0, 0.2, -0.4]} rotation={[0.8, 0, 0]}>
        <boxGeometry args={[0.15, 0.4, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  );
};

/**
 * HorseEar - Pointed horse ear.
 */
const HorseEar: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
}> = ({ position, rotation }) => {
  const { isNightMode } = useFactory();
  const earColor = isNightMode ? 0x8b6914 : 0xc4a44e;
  const innerColor = isNightMode ? 0xcc9999 : 0xffcccc;

  return (
    <group position={position} rotation={rotation}>
      {/* Outer ear */}
      <mesh castShadow>
        <coneGeometry args={[0.08, 0.25, 6]} />
        <meshStandardMaterial color={earColor} roughness={0.8} />
      </mesh>
      {/* Inner ear */}
      <mesh position={[0, 0.02, 0.03]} scale={0.6}>
        <coneGeometry args={[0.06, 0.18, 6]} />
        <meshStandardMaterial color={innerColor} roughness={0.8} />
      </mesh>
    </group>
  );
};

/**
 * HorseEye - Horse eye with larger shape.
 */
const HorseEye: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => {
  return (
    <group position={position}>
      {/* Eye white */}
      <mesh>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={0xffffff} roughness={0.2} />
      </mesh>
      {/* Iris */}
      <mesh position={[0, 0, 0.04]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color={0x4a3520} roughness={0.3} />
      </mesh>
      {/* Pupil */}
      <mesh position={[0, 0, 0.06]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={0x111111} roughness={0.1} />
      </mesh>
      {/* Highlight */}
      <mesh position={[0.02, 0.02, 0.07]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color={0xffffff} emissive={0xffffff} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
};
