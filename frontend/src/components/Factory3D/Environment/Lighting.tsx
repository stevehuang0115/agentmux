/**
 * Lighting - Dynamic lighting system with day/night modes.
 *
 * Provides ambient, directional (sun), and spot lighting that
 * transitions smoothly between day and night configurations.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { LIGHTING_CONFIGS } from '../../../types/factory.types';

/**
 * Main lighting component that handles day/night transitions.
 *
 * Features:
 * - Ambient light for base illumination
 * - Directional "sun" light with shadows
 * - Dynamic intensity based on lighting mode
 *
 * @returns JSX element with lighting configuration
 */
export const Lighting: React.FC = () => {
  const { isNightMode } = useFactory();

  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);

  // Calculate current lighting config
  const config = useMemo(() => {
    return isNightMode ? LIGHTING_CONFIGS.night : LIGHTING_CONFIGS.day;
  }, [isNightMode]);

  // Animate light transitions
  useFrame(() => {
    if (ambientRef.current) {
      // Smoothly interpolate ambient intensity
      const targetIntensity = config.ambientIntensity;
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        targetIntensity,
        0.05
      );
    }

    if (sunRef.current) {
      // Smoothly interpolate sun intensity
      const targetIntensity = config.sunIntensity;
      sunRef.current.intensity = THREE.MathUtils.lerp(
        sunRef.current.intensity,
        targetIntensity,
        0.05
      );
    }
  });

  return (
    <>
      {/* Ambient light - base illumination */}
      <ambientLight
        ref={ambientRef}
        color={isNightMode ? 0x4466aa : 0xffffff}
        intensity={config.ambientIntensity}
      />

      {/* Directional "sun" light with shadows */}
      <directionalLight
        ref={sunRef}
        color={isNightMode ? 0x8899cc : 0xffffee}
        intensity={config.sunIntensity}
        position={[20, 30, 10]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0001}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        color={isNightMode ? 0x223355 : 0xaabbff}
        intensity={isNightMode ? 0.1 : 0.3}
        position={[-15, 10, -10]}
      />

      {/* Night mode accent lights */}
      {isNightMode && (
        <>
          {/* Moon light - subtle blue */}
          <directionalLight
            color={0x6677aa}
            intensity={0.2}
            position={[-10, 20, 15]}
          />

          {/* Ceiling point lights for office */}
          <CeilingLights />
        </>
      )}
    </>
  );
};

/**
 * CeilingLights - Point lights for night mode illumination
 */
const CeilingLights: React.FC = () => {
  const lightPositions = useMemo(() => [
    { x: -14, z: 8 },
    { x: 0, z: 8 },
    { x: 14, z: 8 },
    { x: -14, z: -2 },
    { x: 0, z: -2 },
    { x: 14, z: -2 },
  ], []);

  return (
    <>
      {lightPositions.map((pos, i) => (
        <pointLight
          key={i}
          color={0xffffee}
          intensity={0.8}
          distance={12}
          decay={2}
          position={[pos.x, 3.5, pos.z]}
        />
      ))}
    </>
  );
};

export default Lighting;
