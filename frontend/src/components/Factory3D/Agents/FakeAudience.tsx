/**
 * FakeAudience - Decorative audience agents that watch the stage.
 *
 * These are animated characters that appear when there's a performer on stage.
 * They are not tied to actual Claude agents.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { MODEL_PATHS, FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

const { STAGE } = FACTORY_CONSTANTS;

// Preload models
useGLTF.preload(MODEL_PATHS.COW);
useGLTF.preload(MODEL_PATHS.HORSE);

interface FakeAudienceMemberProps {
  position: { x: number; z: number };
  modelPath: string;
  index: number;
}

/**
 * Single fake audience member
 */
const FakeAudienceMember: React.FC<FakeAudienceMemberProps> = ({
  position,
  modelPath,
  index,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(modelPath);

  // Clone scene for this instance
  const { clonedScene, modelScale } = useMemo(() => {
    const clone = SkeletonUtils.clone(gltf.scene);

    // Fix materials for better visibility and set yellow shirt color
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Clone the material to avoid shared reference issues that cause color accumulation
        if (child.material) {
          child.material = (child.material as THREE.Material).clone();
        }
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat && mat.isMeshStandardMaterial) {
          mat.metalnessMap = null;
          mat.roughnessMap = null;
          mat.metalness = 0.0;
          mat.roughness = 0.7;

          mat.needsUpdate = true;
        }
      }
    });

    return { clonedScene: clone, modelScale: 2.0 };
  }, [gltf.scene]);

  // Remove root motion from animations
  const processedAnimations = useMemo(() => {
    return gltf.animations.map((clip) => {
      const tracks = clip.tracks.filter((track) => {
        const isRootPositionTrack =
          track.name.includes('Hips') && track.name.endsWith('.position');
        return !isRootPositionTrack;
      });
      return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
    });
  }, [gltf.animations]);

  const { actions, mixer } = useAnimations(processedAnimations, clonedScene);

  // Play idle animation and add subtle movement
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    mixer?.update(delta);

    // Start idle animation if not playing
    const idleAction = actions?.['Breathing idle'] || actions?.['Idle'];
    if (idleAction && !idleAction.isRunning()) {
      idleAction.reset().play();
    }

    // Subtle swaying motion to make them look alive
    const time = state.clock.elapsedTime;
    const swayAmount = 0.02;
    groupRef.current.rotation.z = Math.sin(time * 0.5 + index) * swayAmount;
  });

  return (
    <group
      ref={groupRef}
      position={[position.x, 0, position.z]}
      rotation={[0, Math.PI / 2, 0]} // Face the stage (towards positive x)
    >
      {/* Grey circle indicator under fake audience member */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial color={0x808080} transparent opacity={0.6} />
      </mesh>
      <primitive object={clonedScene} scale={modelScale} />
    </group>
  );
};

/**
 * FakeAudience - Group of decorative audience members watching the stage.
 * Only appears when there's a performer on stage.
 */
export const FakeAudience: React.FC = () => {
  const { idleDestinations } = useFactory();

  // Show audience when there are any idle agents (for visibility testing)
  // The audience watches the stage area even without a specific performer
  const hasIdleAgents = Array.from(idleDestinations.destinations.values()).length > 0;
  if (!hasIdleAgents && !idleDestinations.stagePerformerId) {
    return null;
  }

  // Audience positions from constants
  const audiencePositions = STAGE.AUDIENCE_POSITIONS;

  // Alternate between cow and horse models for variety
  const models = [MODEL_PATHS.COW, MODEL_PATHS.HORSE];

  return (
    <group>
      {audiencePositions.map((pos, index) => (
        <FakeAudienceMember
          key={`fake-audience-${index}`}
          position={pos}
          modelPath={models[index % models.length]}
          index={index}
        />
      ))}
    </group>
  );
};

export default FakeAudience;
