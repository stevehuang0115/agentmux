/**
 * FactoryScene - Main React Three Fiber canvas and scene setup.
 *
 * This is the entry point for the 3D factory visualization.
 * It sets up the Canvas, providers, and renders all 3D components.
 */

import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stats, Preload, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { FactoryProvider, useFactory } from '../../contexts/FactoryContext';
import { FACTORY_CONSTANTS, LIGHTING_CONFIGS } from '../../types/factory.types';

// Environment components
import { Lighting } from './Environment/Lighting';
import { Floor } from './Environment/Floor';
import { Walls } from './Environment/Walls';
import { OutdoorScenery } from './Environment/OutdoorScenery';

// Office components
import { OfficeZones } from './Office/OfficeZone';
import { Decorations } from './Office/Decorations';
import { ConveyorBelt } from './Office/ConveyorBelt';

// Interaction zones
import { BreakRoom } from './InteractionZones/BreakRoom';
import { PokerTable } from './InteractionZones/PokerTable';

// Agent components
import { Agents } from './Agents/RobotAgent';

// Camera components
import { CameraController } from './Camera/CameraController';

// UI components (overlay)
import { InfoPanel } from './UI/InfoPanel';
import { ProjectButtons } from './UI/ProjectButtons';
import { LightingToggle } from './UI/LightingToggle';

// ====== SCENE SETUP ======

/**
 * SceneSetup - Configures the scene environment (fog, background, etc.)
 *
 * This component runs inside the Canvas and updates scene properties
 * based on the current lighting mode.
 */
const SceneSetup: React.FC = () => {
  const { scene, gl } = useThree();
  const { isNightMode } = useFactory();

  useEffect(() => {
    // Configure renderer
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2;
  }, [gl]);

  useEffect(() => {
    const config = isNightMode ? LIGHTING_CONFIGS.night : LIGHTING_CONFIGS.day;

    // Update scene background and fog
    scene.background = new THREE.Color(config.background);
    scene.fog = new THREE.Fog(config.fog, 30, 80);
  }, [scene, isNightMode]);

  return null;
};

// ====== LOADING FALLBACK ======

/**
 * LoadingFallback - 3D loading indicator while assets load
 */
const LoadingFallback: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 2, 0]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3a5f8a" wireframe />
    </mesh>
  );
};

// ====== SCENE CONTENT ======

/**
 * SceneContent - All 3D content rendered inside the Canvas
 */
const SceneContent: React.FC = () => {
  return (
    <>
      {/* Scene configuration */}
      <SceneSetup />

      {/* Lighting */}
      <Lighting />

      {/* Environment */}
      <Floor />
      <Walls />
      <OutdoorScenery />

      {/* Office content */}
      <OfficeZones />
      <Decorations />
      <ConveyorBelt />

      {/* Interaction zones */}
      <BreakRoom />
      <PokerTable />

      {/* Agents */}
      <Agents />

      {/* Camera controls */}
      <CameraController />

      {/* Preload assets */}
      <Preload all />
    </>
  );
};

// ====== MAIN COMPONENT ======

interface FactorySceneProps {
  /** Show performance stats overlay (dev mode) */
  showStats?: boolean;
  /** CSS class name for container */
  className?: string;
}

/**
 * FactoryScene - Main entry point for the 3D factory visualization.
 *
 * Renders a React Three Fiber Canvas with the complete factory scene
 * including environment, office zones, agents, and UI overlays.
 *
 * @param showStats - Whether to show FPS/performance stats
 * @param className - CSS class for the container div
 * @returns JSX element with Canvas and UI overlays
 *
 * @example
 * ```tsx
 * <FactoryScene showStats={isDev} className="h-screen" />
 * ```
 */
export const FactoryScene: React.FC<FactorySceneProps> = ({
  showStats = false,
  className = '',
}) => {
  const { CAMERA } = FACTORY_CONSTANTS;

  return (
    <FactoryProvider>
      <div className={`relative w-full h-full ${className}`}>
        {/* 3D Canvas */}
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{
            fov: CAMERA.FOV,
            near: CAMERA.NEAR,
            far: CAMERA.FAR,
            position: [
              CAMERA.DEFAULT_POSITION.x,
              CAMERA.DEFAULT_POSITION.y,
              CAMERA.DEFAULT_POSITION.z,
            ],
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
        >
          {/* Performance optimizations */}
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />

          {/* Loading boundary */}
          <Suspense fallback={<LoadingFallback />}>
            <SceneContent />
          </Suspense>

          {/* Performance stats (dev only) */}
          {showStats && <Stats />}
        </Canvas>

        {/* UI Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            <InfoPanel />
            <ProjectButtons />
            <LightingToggle />
          </div>
        </div>
      </div>
    </FactoryProvider>
  );
};

export default FactoryScene;
