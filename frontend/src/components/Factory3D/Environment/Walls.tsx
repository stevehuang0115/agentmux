/**
 * Walls - Office walls with window cutouts.
 *
 * Creates the wall structure around the factory floor
 * with cutouts for windows and doors.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { LIGHTING_CONFIGS, FACTORY_CONSTANTS } from '../../../types/factory.types';

const { WALLS } = FACTORY_CONSTANTS;

interface WallProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  windows?: WindowConfig[];
}

interface WindowConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Single wall segment with optional window cutouts.
 *
 * @param position - Wall position
 * @param rotation - Wall rotation
 * @param size - Wall dimensions [width, height, depth]
 * @param windows - Array of window cutout configurations
 */
const Wall: React.FC<WallProps> = ({
  position,
  rotation = [0, 0, 0],
  size,
  windows = [],
}) => {
  const { isNightMode } = useFactory();
  const meshRef = useRef<THREE.Mesh>(null);

  const wallColor = useMemo(() => {
    return isNightMode ? LIGHTING_CONFIGS.night.wallColor : LIGHTING_CONFIGS.day.wallColor;
  }, [isNightMode]);

  // Update material color when mode changes
  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.color.setHex(wallColor);
    }
  }, [wallColor]);

  // Create wall geometry with window cutouts
  const geometry = useMemo(() => {
    if (windows.length === 0) {
      return new THREE.BoxGeometry(size[0], size[1], size[2]);
    }

    // Create wall shape
    const shape = new THREE.Shape();
    const hw = size[0] / 2;
    const hh = size[1] / 2;

    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();

    // Create window holes
    windows.forEach((win) => {
      const hole = new THREE.Path();
      const wx = win.x - win.width / 2;
      const wy = win.y - win.height / 2;

      hole.moveTo(wx, wy);
      hole.lineTo(wx + win.width, wy);
      hole.lineTo(wx + win.width, wy + win.height);
      hole.lineTo(wx, wy + win.height);
      hole.closePath();

      shape.holes.push(hole);
    });

    const extrudeSettings = {
      depth: size[2],
      bevelEnabled: false,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [size, windows]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      geometry={geometry}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={wallColor} roughness={0.8} />
    </mesh>
  );
};

/**
 * Glass window pane for window cutouts.
 */
const WindowGlass: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
}> = ({ position, rotation = [0, 0, 0], size }) => {
  const { isNightMode } = useFactory();

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        color={isNightMode ? 0x112233 : 0x88ccff}
        transparent
        opacity={isNightMode ? 0.6 : 0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * Walls - Complete wall structure for the factory.
 *
 * Creates back wall, side walls with window cutouts,
 * and front entrance area.
 *
 * @returns JSX element with all wall meshes
 */
export const Walls: React.FC = () => {
  // Window configurations for side walls
  const sideWindowConfigs: WindowConfig[] = useMemo(() => [
    { x: -15, y: 1.5, width: 4, height: 2.5 },
    { x: -5, y: 1.5, width: 4, height: 2.5 },
    { x: 5, y: 1.5, width: 4, height: 2.5 },
    { x: 15, y: 1.5, width: 4, height: 2.5 },
  ], []);

  // Back wall windows
  const backWindowConfigs: WindowConfig[] = useMemo(() => [
    { x: -8, y: 1.5, width: 3, height: 2 },
    { x: 0, y: 1.5, width: 3, height: 2 },
    { x: 8, y: 1.5, width: 3, height: 2 },
  ], []);

  return (
    <group>
      {/* Back wall */}
      <Wall
        position={[0, WALLS.HEIGHT / 2, WALLS.LEFT_Z]}
        size={[52, WALLS.HEIGHT, WALLS.THICKNESS]}
        windows={backWindowConfigs}
      />

      {/* Left side wall */}
      <Wall
        position={[WALLS.BACK_X, WALLS.HEIGHT / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[36, WALLS.HEIGHT, WALLS.THICKNESS]}
        windows={sideWindowConfigs}
      />

      {/* Right side wall */}
      <Wall
        position={[-WALLS.BACK_X, WALLS.HEIGHT / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        size={[36, WALLS.HEIGHT, WALLS.THICKNESS]}
        windows={sideWindowConfigs}
      />

      {/* Front wall segments (with entrance gap) */}
      <Wall
        position={[-15, WALLS.HEIGHT / 2, WALLS.RIGHT_Z]}
        size={[22, WALLS.HEIGHT, WALLS.THICKNESS]}
      />
      <Wall
        position={[15, WALLS.HEIGHT / 2, WALLS.RIGHT_Z]}
        size={[22, WALLS.HEIGHT, WALLS.THICKNESS]}
      />

      {/* Window glass panes - Back wall */}
      {backWindowConfigs.map((win, i) => (
        <WindowGlass
          key={`back-${i}`}
          position={[win.x, win.y + WALLS.HEIGHT / 2 - 0.5, WALLS.LEFT_Z + 0.16]}
          size={[win.width, win.height]}
        />
      ))}

      {/* Window glass panes - Left wall */}
      {sideWindowConfigs.map((win, i) => (
        <WindowGlass
          key={`left-${i}`}
          position={[WALLS.BACK_X + 0.16, win.y + WALLS.HEIGHT / 2 - 0.5, win.x]}
          rotation={[0, Math.PI / 2, 0]}
          size={[win.width, win.height]}
        />
      ))}

      {/* Window glass panes - Right wall */}
      {sideWindowConfigs.map((win, i) => (
        <WindowGlass
          key={`right-${i}`}
          position={[-WALLS.BACK_X - 0.16, win.y + WALLS.HEIGHT / 2 - 0.5, win.x]}
          rotation={[0, -Math.PI / 2, 0]}
          size={[win.width, win.height]}
        />
      ))}
    </group>
  );
};

export default Walls;
