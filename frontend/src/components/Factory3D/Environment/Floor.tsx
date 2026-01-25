/**
 * Floor - Office floor with carpet-like material.
 *
 * Renders the main floor plane that receives shadows and
 * changes color based on day/night mode.
 */

import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { LIGHTING_CONFIGS } from '../../../types/factory.types';

/**
 * Main floor component for the factory.
 *
 * Features:
 * - Large plane geometry for floor
 * - Carpet-like material with roughness
 * - Shadow receiving
 * - Day/night color transitions
 *
 * @returns JSX element with floor mesh
 */
export const Floor: React.FC = () => {
  const { isNightMode } = useFactory();
  const meshRef = useRef<THREE.Mesh>(null);

  const floorColor = useMemo(() => {
    return isNightMode ? LIGHTING_CONFIGS.night.floorColor : LIGHTING_CONFIGS.day.floorColor;
  }, [isNightMode]);

  // Update material color when mode changes
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.color.setHex(floorColor);
    }
  }, [floorColor]);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[60, 50]} />
      <meshStandardMaterial
        color={floorColor}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  );
};

export default Floor;
