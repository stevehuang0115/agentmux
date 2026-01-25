/**
 * OfficeZone - Project zone with floor coloring and workstations.
 *
 * Each project gets its own zone with a distinct floor color,
 * border, and up to 4 workstations.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFactory } from '../../../contexts/FactoryContext';
import { OfficeZone as OfficeZoneType, FACTORY_CONSTANTS } from '../../../types/factory.types';
import { Workstation } from './Workstation';

// ====== ZONE FLOOR ======

interface ZoneFloorProps {
  zone: OfficeZoneType;
}

/**
 * Colored floor panel for a project zone.
 */
const ZoneFloor: React.FC<ZoneFloorProps> = ({ zone }) => {
  const { WIDTH, DEPTH } = FACTORY_CONSTANTS.ZONE;

  return (
    <>
      {/* Colored floor panel */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[zone.zoneX, 0.03, zone.zoneZ]}
        receiveShadow
      >
        <planeGeometry args={[WIDTH, DEPTH]} />
        <meshStandardMaterial
          color={zone.color}
          roughness={0.8}
          transparent
          opacity={0.3}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Zone border */}
      <ZoneBorder zone={zone} />
    </>
  );
};

// ====== ZONE BORDER ======

interface ZoneBorderProps {
  zone: OfficeZoneType;
}

/**
 * Border line around the zone.
 */
const ZoneBorder: React.FC<ZoneBorderProps> = ({ zone }) => {
  const { WIDTH, DEPTH } = FACTORY_CONSTANTS.ZONE;

  const points = useMemo(() => {
    const hw = WIDTH / 2;
    const hd = DEPTH / 2;
    return [
      new THREE.Vector3(-hw, 0.05, -hd),
      new THREE.Vector3(hw, 0.05, -hd),
      new THREE.Vector3(hw, 0.05, hd),
      new THREE.Vector3(-hw, 0.05, hd),
      new THREE.Vector3(-hw, 0.05, -hd),
    ];
  }, []);

  return (
    <group position={[zone.zoneX, 0, zone.zoneZ]}>
      <Line
        points={points}
        color={zone.color}
        lineWidth={2}
      />
    </group>
  );
};

// ====== NAME CARD ======

interface NameCardProps {
  projectName: string;
  position: [number, number, number];
  color: number;
}

/**
 * Project name card displayed on the zone floor.
 */
const NameCard: React.FC<NameCardProps> = ({ projectName, position, color }) => {
  // Create canvas texture for text
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Background
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, 0, 512, 128);

      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let displayText = projectName || 'Project';
      if (displayText.length > 14) {
        displayText = displayText.substring(0, 13) + '...';
      }
      ctx.fillText(displayText, 256, 64);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [projectName, color]);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3, 0.75]} />
      <meshStandardMaterial
        map={texture}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

// ====== SINGLE ZONE ======

interface SingleZoneProps {
  zone: OfficeZoneType;
}

/**
 * Complete zone with floor, workstations, and name card.
 */
const SingleZone: React.FC<SingleZoneProps> = ({ zone }) => {
  const { DEPTH } = FACTORY_CONSTANTS.ZONE;

  return (
    <group>
      {/* Zone floor and border */}
      <ZoneFloor zone={zone} />

      {/* Workstations */}
      {zone.workstations.map((ws, i) => (
        <Workstation
          key={`ws-${zone.zoneIndex}-${i}`}
          workstation={ws}
          zoneColor={zone.color}
        />
      ))}

      {/* Name card */}
      <NameCard
        projectName={zone.projectName}
        position={[zone.zoneX, 0.04, zone.zoneZ + DEPTH / 2 - 0.5]}
        color={zone.color}
      />
    </group>
  );
};

// ====== OFFICE ZONES ======

/**
 * OfficeZones - Renders all project zones.
 *
 * Maps over the zones from context and renders
 * each with its floor, workstations, and name.
 *
 * @returns JSX element with all zones
 */
export const OfficeZones: React.FC = () => {
  const { zones } = useFactory();

  const zoneArray = useMemo(() => Array.from(zones.values()), [zones]);

  return (
    <group>
      {zoneArray.map((zone) => (
        <SingleZone key={zone.projectName} zone={zone} />
      ))}
    </group>
  );
};

export default OfficeZones;
