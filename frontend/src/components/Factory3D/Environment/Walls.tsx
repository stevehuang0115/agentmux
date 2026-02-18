/**
 * Walls - Apple-style office walls with floor-to-ceiling windows.
 *
 * Creates a modern, minimalist 2-story wall structure with large glass panels
 * for maximum natural light - inspired by Apple store architecture.
 * Includes a neon "Crewly" logo on the building.
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
    return isNightMode ? 0x1a1a1f : 0xf5f5f7;
  }, [isNightMode]);

  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.color.setHex(wallColor);
    }
  }, [wallColor]);

  const geometry = useMemo(() => {
    if (windows.length === 0) {
      return new THREE.BoxGeometry(size[0], size[1], size[2]);
    }

    const shape = new THREE.Shape();
    const hw = size[0] / 2;
    const hh = size[1] / 2;

    shape.moveTo(-hw, -hh);
    shape.lineTo(hw, -hh);
    shape.lineTo(hw, hh);
    shape.lineTo(-hw, hh);
    shape.closePath();

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
      <meshStandardMaterial color={wallColor} roughness={0.3} metalness={0.0} />
    </mesh>
  );
};

/**
 * Modern floor-to-ceiling glass window pane.
 */
const WindowGlass: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
}> = ({ position, rotation = [0, 0, 0], size }) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={size} />
        <meshPhysicalMaterial
          color={isNightMode ? 0x1a2a3a : 0xffffff}
          transparent
          opacity={isNightMode ? 0.4 : 0.15}
          roughness={0.0}
          metalness={0.0}
          transmission={0.9}
          thickness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[size[0] + 0.05, size[1] + 0.05]} />
        <meshStandardMaterial
          color={isNightMode ? 0x333344 : 0xcccccc}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

/**
 * Window frame - minimal aluminum style
 */
const WindowFrame: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
}> = ({ position, rotation = [0, 0, 0], width, height }) => {
  const frameThickness = 0.08;
  const frameDepth = 0.15;
  const frameColor = 0x888888;

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[-width / 2, 0, 0]} castShadow>
        <boxGeometry args={[frameThickness, height, frameDepth]} />
        <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[width / 2, 0, 0]} castShadow>
        <boxGeometry args={[frameThickness, height, frameDepth]} />
        <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width + frameThickness, frameThickness, frameDepth]} />
        <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -height / 2, 0]} castShadow>
        <boxGeometry args={[width + frameThickness, frameThickness, frameDepth]} />
        <meshStandardMaterial color={frameColor} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};

/**
 * Neon letter component - creates a glowing 3D letter
 */
const NeonLetter: React.FC<{
  char: string;
  position: [number, number, number];
  color?: number;
  glowColor?: number;
}> = ({ char, position, color = 0x00ffff, glowColor = 0x00ffff }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  const { isNightMode } = useFactory();

  // Animate glow intensity
  useFrame((state) => {
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshStandardMaterial;
      // Subtle pulsing effect
      const pulse = Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2 + 1;
      material.emissiveIntensity = isNightMode ? pulse * 2 : pulse * 0.8;
    }
  });

  // Letter paths for basic characters
  const getLetterGeometry = (letter: string): THREE.BufferGeometry => {
    const shape = new THREE.Shape();
    const thickness = 0.15;

    switch (letter.toUpperCase()) {
      case 'A':
        shape.moveTo(-0.4, -0.5);
        shape.lineTo(-0.1, 0.5);
        shape.lineTo(0.1, 0.5);
        shape.lineTo(0.4, -0.5);
        shape.lineTo(0.25, -0.5);
        shape.lineTo(0.15, -0.15);
        shape.lineTo(-0.15, -0.15);
        shape.lineTo(-0.25, -0.5);
        shape.closePath();
        // Inner hole
        const holeA = new THREE.Path();
        holeA.moveTo(-0.05, 0);
        holeA.lineTo(0, 0.2);
        holeA.lineTo(0.05, 0);
        holeA.closePath();
        shape.holes.push(holeA);
        break;
      case 'G':
        // Block-style G: C-shape (gap on upper-right) with horizontal bar at midline.
        // Single polygon with CW notch for the inner bay (same technique as E).
        shape.moveTo(-0.3, -0.5);    // outer bottom-left
        shape.lineTo(-0.3, 0.5);     // outer top-left
        shape.lineTo(0.3, 0.5);      // outer top-right
        shape.lineTo(0.3, 0.35);     // gap corner top (enter inner bay)
        shape.lineTo(-0.15, 0.35);   // inner top-left
        shape.lineTo(-0.15, -0.35);  // inner bottom-left
        shape.lineTo(0.15, -0.35);   // inner bottom-right
        shape.lineTo(0.15, -0.08);   // inner right wall up to bar bottom
        shape.lineTo(0, -0.08);      // bar tip bottom
        shape.lineTo(0, 0.08);       // bar tip top
        shape.lineTo(0.3, 0.08);     // bar top to outer wall (exit inner bay)
        shape.lineTo(0.3, -0.5);     // outer bottom-right
        shape.closePath();
        break;
      case 'E':
        shape.moveTo(-0.3, -0.5);
        shape.lineTo(-0.3, 0.5);
        shape.lineTo(0.3, 0.5);
        shape.lineTo(0.3, 0.35);
        shape.lineTo(-0.15, 0.35);
        shape.lineTo(-0.15, 0.08);
        shape.lineTo(0.2, 0.08);
        shape.lineTo(0.2, -0.08);
        shape.lineTo(-0.15, -0.08);
        shape.lineTo(-0.15, -0.35);
        shape.lineTo(0.3, -0.35);
        shape.lineTo(0.3, -0.5);
        shape.closePath();
        break;
      case 'N':
        shape.moveTo(-0.3, -0.5);
        shape.lineTo(-0.3, 0.5);
        shape.lineTo(-0.15, 0.5);
        shape.lineTo(0.15, -0.1);
        shape.lineTo(0.15, 0.5);
        shape.lineTo(0.3, 0.5);
        shape.lineTo(0.3, -0.5);
        shape.lineTo(0.15, -0.5);
        shape.lineTo(-0.15, 0.1);
        shape.lineTo(-0.15, -0.5);
        shape.closePath();
        break;
      case 'T':
        shape.moveTo(-0.35, 0.35);
        shape.lineTo(-0.35, 0.5);
        shape.lineTo(0.35, 0.5);
        shape.lineTo(0.35, 0.35);
        shape.lineTo(0.1, 0.35);
        shape.lineTo(0.1, -0.5);
        shape.lineTo(-0.1, -0.5);
        shape.lineTo(-0.1, 0.35);
        shape.closePath();
        break;
      case 'M':
        shape.moveTo(-0.4, -0.5);
        shape.lineTo(-0.4, 0.5);
        shape.lineTo(-0.25, 0.5);
        shape.lineTo(0, 0.1);
        shape.lineTo(0.25, 0.5);
        shape.lineTo(0.4, 0.5);
        shape.lineTo(0.4, -0.5);
        shape.lineTo(0.25, -0.5);
        shape.lineTo(0.25, 0.15);
        shape.lineTo(0, -0.25);
        shape.lineTo(-0.25, 0.15);
        shape.lineTo(-0.25, -0.5);
        shape.closePath();
        break;
      case 'U':
        shape.moveTo(-0.3, 0.5);
        shape.lineTo(-0.3, -0.2);
        // Outer bottom arc: CCW from π to 0 (goes through bottom, y=-0.5)
        shape.absarc(0, -0.2, 0.3, Math.PI, 0, false);
        shape.lineTo(0.3, 0.5);
        shape.lineTo(0.15, 0.5);
        shape.lineTo(0.15, -0.2);
        // Inner bottom arc: CW from 0 to π (goes through bottom, y=-0.35)
        shape.absarc(0, -0.2, 0.15, 0, Math.PI, true);
        shape.lineTo(-0.15, 0.5);
        shape.closePath();
        break;
      case 'X':
        shape.moveTo(-0.35, 0.5);
        shape.lineTo(-0.15, 0.5);
        shape.lineTo(0, 0.15);
        shape.lineTo(0.15, 0.5);
        shape.lineTo(0.35, 0.5);
        shape.lineTo(0.1, 0);
        shape.lineTo(0.35, -0.5);
        shape.lineTo(0.15, -0.5);
        shape.lineTo(0, -0.15);
        shape.lineTo(-0.15, -0.5);
        shape.lineTo(-0.35, -0.5);
        shape.lineTo(-0.1, 0);
        shape.closePath();
        break;
      default:
        // Default rectangle for unknown chars
        shape.moveTo(-0.2, -0.5);
        shape.lineTo(-0.2, 0.5);
        shape.lineTo(0.2, 0.5);
        shape.lineTo(0.2, -0.5);
        shape.closePath();
    }

    return new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
  };

  const geometry = useMemo(() => getLetterGeometry(char), [char]);

  return (
    <group position={position}>
      {/* Main letter */}
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color={color}
          emissive={glowColor}
          emissiveIntensity={isNightMode ? 1.5 : 0.5}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>

      {/* Glow effect - larger, semi-transparent version */}
      <mesh ref={glowRef} geometry={geometry} scale={[1.1, 1.1, 0.5]}>
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={isNightMode ? 2 : 0.8}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};

/**
 * Crewly Neon Sign
 */
const NeonSign: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  const letters = 'CREWLY';
  const letterSpacing = 1.0;
  const startX = -(letters.length - 1) * letterSpacing / 2;

  // Cyan/teal color for neon effect
  const neonColor = 0x00e5ff;

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Backing panel */}
      <mesh position={[0, 0, -0.3]}>
        <boxGeometry args={[letters.length * letterSpacing + 1, 2, 0.2]} />
        <meshStandardMaterial color={0x1a1a1a} roughness={0.8} />
      </mesh>

      {/* Neon letters */}
      {letters.split('').map((char, i) => (
        <NeonLetter
          key={i}
          char={char}
          position={[startX + i * letterSpacing, 0, 0]}
          color={neonColor}
          glowColor={neonColor}
        />
      ))}
    </group>
  );
};

/**
 * Wall-mounted TV on exterior front wall, facing the outdoor area.
 * Turns on with animated game visuals when agents are nearby.
 */
const WallTV: React.FC = () => {
  const { isNightMode } = useFactory();
  const screenRef = useRef<THREE.Mesh>(null);
  const isOnRef = useRef(false);

  // TV position in world space (exterior of front wall, facing +Z)
  const tvX = 18;
  const tvZ = WALLS.RIGHT_Z + 0.5;
  const detectionRadius = 12;

  // Check proximity of any entity and animate screen
  useFrame((state) => {
    if (!screenRef.current) return;

    // Check if camera (or any viewer) is near the TV area
    const camX = state.camera.position.x;
    const camZ = state.camera.position.z;
    const dx = camX - tvX;
    const dz = camZ - tvZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const shouldBeOn = dist < detectionRadius;
    isOnRef.current = shouldBeOn;

    const mat = screenRef.current.material as THREE.MeshStandardMaterial;
    if (shouldBeOn) {
      // Animated game screen - cycling colors to simulate a game display
      const t = state.clock.elapsedTime;
      const r = Math.sin(t * 1.5) * 0.3 + 0.3;
      const g = Math.sin(t * 2.0 + 1) * 0.3 + 0.5;
      const b = Math.sin(t * 1.2 + 2) * 0.2 + 0.7;
      mat.color.setRGB(r, g, b);
      mat.emissive.setRGB(r * 0.6, g * 0.6, b * 0.6);
      mat.emissiveIntensity = isNightMode ? 2.0 : 1.2;
    } else {
      // Off state - dark screen
      mat.color.setHex(0x111118);
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
  });

  return (
    <group position={[tvX, 6, tvZ]}>
      {/* TV bezel / frame */}
      <mesh castShadow>
        <boxGeometry args={[4.2, 2.7, 0.15]} />
        <meshStandardMaterial color={0x111111} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Screen surface - faces +Z (outward) */}
      <mesh ref={screenRef} position={[0, 0, 0.08]}>
        <planeGeometry args={[3.8, 2.3]} />
        <meshStandardMaterial
          color={0x111118}
          emissive={0x000000}
          emissiveIntensity={0}
          roughness={0.1}
          metalness={0.0}
        />
      </mesh>

      {/* Wall mount bracket - toward the wall (-Z) */}
      <mesh position={[0, 0, -0.15]} castShadow>
        <boxGeometry args={[1.0, 0.6, 0.2]} />
        <meshStandardMaterial color={0x333333} roughness={0.5} metalness={0.7} />
      </mesh>
    </group>
  );
};

/**
 * Upper floor structure - additional 3 floors on top
 */
const UpperFloor: React.FC<{
  baseY: number;
  height: number;
  factoryWidth: number;
  factoryDepth: number;
}> = ({ baseY, height, factoryWidth, factoryDepth }) => {
  // Window configuration for upper floor
  const windowHeight = height - 1;
  const windowY = 0;

  const sideWindowConfigs: WindowConfig[] = useMemo(() => [
    { x: -14, y: windowY, width: 10, height: windowHeight },
    { x: 0, y: windowY, width: 10, height: windowHeight },
    { x: 14, y: windowY, width: 10, height: windowHeight },
  ], [windowHeight, windowY]);

  const backWindowConfigs: WindowConfig[] = useMemo(() => [
    { x: -22, y: windowY, width: 10, height: windowHeight },
    { x: -8, y: windowY, width: 10, height: windowHeight },
    { x: 8, y: windowY, width: 10, height: windowHeight },
    { x: 22, y: windowY, width: 10, height: windowHeight },
  ], [windowHeight, windowY]);

  return (
    <group position={[0, baseY, 0]}>
      {/* Floor separator - exterior ledge/trim around the building */}
      {/* Left side trim */}
      <mesh position={[WALLS.BACK_X - 0.3, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.6, 0.5, factoryDepth + 1]} />
        <meshStandardMaterial color={0xaaaaaa} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Right side trim */}
      <mesh position={[WALLS.FRONT_X + 0.3, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.6, 0.5, factoryDepth + 1]} />
        <meshStandardMaterial color={0xaaaaaa} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Back trim */}
      <mesh position={[0, 0, WALLS.LEFT_Z - 0.3]} receiveShadow castShadow>
        <boxGeometry args={[factoryWidth + 1, 0.5, 0.6]} />
        <meshStandardMaterial color={0xaaaaaa} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Front trim */}
      <mesh position={[0, 0, WALLS.RIGHT_Z + 0.3]} receiveShadow castShadow>
        <boxGeometry args={[factoryWidth + 1, 0.5, 0.6]} />
        <meshStandardMaterial color={0xaaaaaa} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Upper floor walls */}
      {/* Back wall */}
      <Wall
        position={[0, height / 2, WALLS.LEFT_Z]}
        size={[factoryWidth, height, WALLS.THICKNESS]}
        windows={backWindowConfigs}
      />

      {/* Left side wall */}
      <Wall
        position={[WALLS.BACK_X, height / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[factoryDepth, height, WALLS.THICKNESS]}
        windows={sideWindowConfigs}
      />

      {/* Right side wall */}
      <Wall
        position={[WALLS.FRONT_X, height / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        size={[factoryDepth, height, WALLS.THICKNESS]}
        windows={sideWindowConfigs}
      />

      {/* Front wall - full wall for upper floor (no entrance) */}
      <Wall
        position={[0, height / 2, WALLS.RIGHT_Z]}
        size={[factoryWidth, height, WALLS.THICKNESS]}
        windows={backWindowConfigs}
      />

      {/* Window glass - Back wall */}
      {backWindowConfigs.map((win, i) => (
        <group key={`upper-back-${i}`}>
          <WindowGlass
            position={[win.x, height / 2, WALLS.LEFT_Z + 0.16]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[win.x, height / 2, WALLS.LEFT_Z + 0.2]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {/* Window glass - Left wall */}
      {sideWindowConfigs.map((win, i) => (
        <group key={`upper-left-${i}`}>
          <WindowGlass
            position={[WALLS.BACK_X + 0.16, height / 2, win.x]}
            rotation={[0, Math.PI / 2, 0]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[WALLS.BACK_X + 0.2, height / 2, win.x]}
            rotation={[0, Math.PI / 2, 0]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {/* Window glass - Right wall */}
      {sideWindowConfigs.map((win, i) => (
        <group key={`upper-right-${i}`}>
          <WindowGlass
            position={[WALLS.FRONT_X - 0.16, height / 2, win.x]}
            rotation={[0, -Math.PI / 2, 0]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[WALLS.FRONT_X - 0.2, height / 2, win.x]}
            rotation={[0, -Math.PI / 2, 0]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {/* Window glass - Front wall */}
      {backWindowConfigs.map((win, i) => (
        <group key={`upper-front-${i}`}>
          <WindowGlass
            position={[win.x, height / 2, WALLS.RIGHT_Z - 0.16]}
            rotation={[0, Math.PI, 0]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[win.x, height / 2, WALLS.RIGHT_Z - 0.2]}
            rotation={[0, Math.PI, 0]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {/* Upper floor ceiling - solid slab visible from both sides */}
      <mesh
        position={[0, height, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[factoryWidth - 0.5, 0.3, factoryDepth - 0.5]} />
        <meshStandardMaterial color={0xffffff} roughness={0.5} />
      </mesh>
    </group>
  );
};

/**
 * Walls - Complete wall structure for the factory.
 */
export const Walls: React.FC = () => {
  const { camera } = useThree();
  const floorSeparatorRef = useRef<THREE.Mesh>(null);
  const roofRef = useRef<THREE.Mesh>(null);
  const upperFloorGroupRef = useRef<THREE.Group>(null);

  const factoryWidth = WALLS.FRONT_X - WALLS.BACK_X;
  const factoryDepth = WALLS.RIGHT_Z - WALLS.LEFT_Z;
  const wallHeight = WALLS.HEIGHT; // 12 units (3 floors)
  const upperFloorHeight = 12; // Another 3 floors
  const totalHeight = wallHeight + upperFloorHeight;

  const windowHeight = wallHeight - 1;
  const windowY = 0;

  // Track camera position to hide structural elements for clear views.
  // Floor separator hidden when camera is inside the building.
  // Roof and upper floor hidden when camera is above the building (bird's eye view).
  useFrame(() => {
    const pos = camera.position;
    // Check if camera is inside the building bounds (X and Z)
    const isInsideX = pos.x > WALLS.BACK_X && pos.x < WALLS.FRONT_X;
    const isInsideZ = pos.z > WALLS.LEFT_Z && pos.z < WALLS.RIGHT_Z;

    // Hide the floor separator when camera is inside either floor or above (bird's eye)
    const isInsideBuilding = isInsideX && isInsideZ && pos.y > 0 && pos.y < totalHeight;
    const isAboveBuilding = pos.y > totalHeight;
    if (floorSeparatorRef.current) {
      floorSeparatorRef.current.visible = !isInsideBuilding && !isAboveBuilding;
    }

    // Hide roof and upper floor when camera is above the building (bird's eye)
    if (roofRef.current) {
      roofRef.current.visible = !isAboveBuilding;
    }
    if (upperFloorGroupRef.current) {
      upperFloorGroupRef.current.visible = !isAboveBuilding;
    }
  });

  const sideWindowConfigs: WindowConfig[] = useMemo(() => [
    { x: -14, y: windowY, width: 10, height: windowHeight },
    { x: 0, y: windowY, width: 10, height: windowHeight },
    { x: 14, y: windowY, width: 10, height: windowHeight },
  ], [windowHeight, windowY]);

  const backWindowConfigs: WindowConfig[] = useMemo(() => [
    { x: -22, y: windowY, width: 10, height: windowHeight },
    { x: -8, y: windowY, width: 10, height: windowHeight },
    { x: 8, y: windowY, width: 10, height: windowHeight },
    { x: 22, y: windowY, width: 10, height: windowHeight },
  ], [windowHeight, windowY]);

  return (
    <group>
      {/* ===== GROUND FLOOR (3 floors) ===== */}

      {/* Back wall */}
      <Wall
        position={[0, wallHeight / 2, WALLS.LEFT_Z]}
        size={[factoryWidth, wallHeight, WALLS.THICKNESS]}
        windows={backWindowConfigs}
      />

      {/* Left side wall */}
      <Wall
        position={[WALLS.BACK_X, wallHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[factoryDepth, wallHeight, WALLS.THICKNESS]}
        windows={sideWindowConfigs}
      />

      {/* Right side wall */}
      <Wall
        position={[WALLS.FRONT_X, wallHeight / 2, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        size={[factoryDepth, wallHeight, WALLS.THICKNESS]}
        windows={sideWindowConfigs}
      />

      {/* Front wall segments (with entrance gap) */}
      <Wall
        position={[-24, wallHeight / 2, WALLS.RIGHT_Z]}
        size={[16, wallHeight, WALLS.THICKNESS]}
      />
      <Wall
        position={[24, wallHeight / 2, WALLS.RIGHT_Z]}
        size={[16, wallHeight, WALLS.THICKNESS]}
      />

      {/* Window glass and frames - Ground floor */}
      {backWindowConfigs.map((win, i) => (
        <group key={`back-${i}`}>
          <WindowGlass
            position={[win.x, wallHeight / 2, WALLS.LEFT_Z + 0.16]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[win.x, wallHeight / 2, WALLS.LEFT_Z + 0.2]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {sideWindowConfigs.map((win, i) => (
        <group key={`left-${i}`}>
          <WindowGlass
            position={[WALLS.BACK_X + 0.16, wallHeight / 2, win.x]}
            rotation={[0, Math.PI / 2, 0]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[WALLS.BACK_X + 0.2, wallHeight / 2, win.x]}
            rotation={[0, Math.PI / 2, 0]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {sideWindowConfigs.map((win, i) => (
        <group key={`right-${i}`}>
          <WindowGlass
            position={[WALLS.FRONT_X - 0.16, wallHeight / 2, win.x]}
            rotation={[0, -Math.PI / 2, 0]}
            size={[win.width, win.height]}
          />
          <WindowFrame
            position={[WALLS.FRONT_X - 0.2, wallHeight / 2, win.x]}
            rotation={[0, -Math.PI / 2, 0]}
            width={win.width}
            height={win.height}
          />
        </group>
      ))}

      {/* Ground floor ceiling / Upper floor floor - visibility controlled by useFrame */}
      <mesh
        ref={floorSeparatorRef}
        position={[0, wallHeight, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[factoryWidth - 0.5, 0.3, factoryDepth - 0.5]} />
        <meshStandardMaterial color={0xffffff} roughness={0.5} />
      </mesh>

      {/* ===== UPPER FLOOR (3 floors) ===== */}
      <group ref={upperFloorGroupRef}>
        <UpperFloor
          baseY={wallHeight}
          height={upperFloorHeight}
          factoryWidth={factoryWidth}
          factoryDepth={factoryDepth}
        />
      </group>

      {/* ===== ROOF ===== */}
      {/* Roof structure - hidden when camera is above building (bird's eye view) */}
      <mesh
        ref={roofRef}
        position={[0, totalHeight + 0.5, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[factoryWidth + 2, 1, factoryDepth + 2]} />
        <meshStandardMaterial color={0x888888} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* ===== WALL TV ===== */}
      <WallTV />

      {/* ===== NEON SIGN ===== */}
      {/* Crewly logo - rooftop sign above building */}
      <NeonSign
        position={[0, totalHeight + 2, WALLS.RIGHT_Z + 0.5]}
        rotation={[0, 0, 0]}
        scale={1.5}
      />

    </group>
  );
};

export default Walls;
