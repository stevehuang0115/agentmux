/**
 * DoubleClickHandler - Handles double-click interactions in the 3D scene.
 *
 * When freestyle mode is active and an entity is selected, double-click sets
 * the move target for that entity. When no entity is selected (not in boss mode),
 * double-click moves the camera to that location.
 */

import React, { useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { useFactory } from '../../../contexts/FactoryContext';
import * as THREE from 'three';

/** Camera animation duration in milliseconds */
const CAMERA_ANIMATION_DURATION = 1000;

/** Camera height above the target position */
const CAMERA_HEIGHT = 15;

/** Camera distance behind the target position */
const CAMERA_DISTANCE = 20;

/**
 * DoubleClickHandler - Invisible plane that captures double-clicks on the floor.
 *
 * Uses raycasting to determine the 3D position of the click on the ground plane.
 * Routes the click to either freestyle movement or camera movement based on context.
 */
export const DoubleClickHandler: React.FC = () => {
  const { camera } = useThree();
  const {
    selectedEntityId,
    bossModeState,
    freestyleMode,
    setFreestyleMoveTarget,
    updateCamera,
  } = useFactory();

  const meshRef = useRef<THREE.Mesh>(null);
  const lastClickTime = useRef(0);

  /**
   * Handle pointer down event - detect double-clicks
   */
  const handlePointerDown = useCallback(
    (event: THREE.Event) => {
      const e = event as unknown as { point: THREE.Vector3; stopPropagation?: () => void };

      const now = Date.now();
      const timeDiff = now - lastClickTime.current;
      lastClickTime.current = now;

      // Check for double-click (< 300ms between clicks)
      if (timeDiff > 300) return;

      // Get the click position on the floor
      const clickPos = { x: e.point.x, z: e.point.z };

      // If freestyle mode is active and an entity is selected, set move target
      if (freestyleMode && selectedEntityId) {
        setFreestyleMoveTarget(clickPos);
        e.stopPropagation?.();
        return;
      }

      // If no entity is selected (not in boss mode), move camera to that location
      if (!bossModeState.isActive || !selectedEntityId) {
        // Set up camera animation to look at the clicked position
        // Calculate camera position above and behind the target
        const targetLookAt = new THREE.Vector3(clickPos.x, 0, clickPos.z);
        const cameraPos = new THREE.Vector3(
          clickPos.x,
          CAMERA_HEIGHT,
          clickPos.z + CAMERA_DISTANCE
        );

        // Get current camera state for animation start values
        const startPosition = camera.position.clone();
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const startLookAt = startPosition.clone().add(direction.multiplyScalar(10));

        updateCamera({
          isAnimating: true,
          animationTarget: {
            position: cameraPos,
            lookAt: targetLookAt,
            startTime: Date.now(),
            duration: CAMERA_ANIMATION_DURATION,
            startPosition,
            startLookAt,
          },
        });
        e.stopPropagation?.();
      }
    },
    [freestyleMode, selectedEntityId, bossModeState.isActive, setFreestyleMoveTarget, updateCamera, camera]
  );

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onPointerDown={handlePointerDown}
    >
      {/* Large invisible plane covering the floor area */}
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
};

export default DoubleClickHandler;
