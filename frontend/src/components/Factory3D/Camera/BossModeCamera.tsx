/**
 * BossModeCamera - Auto-tour camera controller.
 *
 * Automatically cycles through different viewpoints in the factory,
 * focusing on different zones and agents. Useful for demos or monitoring.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';

/**
 * Props for BossModeCamera component.
 */
interface BossModeCameraProps {
  /** Whether boss mode is active */
  active: boolean;
  /** Callback when tour completes a full cycle */
  onCycleComplete?: () => void;
}

/**
 * Camera viewpoint configuration.
 */
interface Viewpoint {
  name: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  duration: number;
}

/**
 * BossModeCamera - Implements automatic camera tour.
 *
 * Features:
 * - Cycles through predefined viewpoints
 * - Smooth camera transitions
 * - Focuses on active agents and zones
 * - Can be triggered manually or on timer
 *
 * @param props - BossModeCamera component props
 * @returns Empty JSX element (camera controller)
 */
export const BossModeCamera: React.FC<BossModeCameraProps> = ({
  active,
  onCycleComplete,
}) => {
  const { camera } = useThree();
  const { agents, zones, projects } = useFactory();
  const stateRef = useRef({
    isActive: false,
    currentViewpointIndex: 0,
    transitionProgress: 0,
    viewpointStartTime: 0,
    startPosition: new THREE.Vector3(),
    startLookAt: new THREE.Vector3(),
    targetPosition: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
    currentLookAt: new THREE.Vector3(),
  });

  // Generate viewpoints based on current factory state
  const generateViewpoints = useCallback((): Viewpoint[] => {
    const viewpoints: Viewpoint[] = [];

    // Overview shot
    viewpoints.push({
      name: 'Overview',
      position: new THREE.Vector3(-25, 20, -25),
      lookAt: new THREE.Vector3(0, 0, 5),
      duration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
    });

    // Zone views
    const projectList = Array.from(zones.keys());
    projectList.forEach((projectName, index) => {
      const zone = zones.get(projectName);
      if (zone) {
        viewpoints.push({
          name: `Zone: ${projectName}`,
          position: new THREE.Vector3(
            zone.zoneX - 5,
            8,
            zone.zoneZ + 5
          ),
          lookAt: new THREE.Vector3(
            zone.zoneX,
            1,
            zone.zoneZ
          ),
          duration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
        });
      }
    });

    // Break room view
    viewpoints.push({
      name: 'Break Room',
      position: new THREE.Vector3(
        FACTORY_CONSTANTS.BREAK_ROOM.POSITION.x - 6,
        5,
        FACTORY_CONSTANTS.BREAK_ROOM.POSITION.z + 6
      ),
      lookAt: new THREE.Vector3(
        FACTORY_CONSTANTS.BREAK_ROOM.POSITION.x,
        1,
        FACTORY_CONSTANTS.BREAK_ROOM.POSITION.z
      ),
      duration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL * 0.75,
    });

    // Poker table view
    viewpoints.push({
      name: 'Poker Table',
      position: new THREE.Vector3(
        FACTORY_CONSTANTS.POKER_TABLE.POSITION.x + 6,
        5,
        FACTORY_CONSTANTS.POKER_TABLE.POSITION.z + 6
      ),
      lookAt: new THREE.Vector3(
        FACTORY_CONSTANTS.POKER_TABLE.POSITION.x,
        1,
        FACTORY_CONSTANTS.POKER_TABLE.POSITION.z
      ),
      duration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL * 0.75,
    });

    // Active agent close-ups
    const activeAgents = Array.from(agents.values()).filter(
      (a) => a.status === 'active' && a.cpuPercent > 10
    );
    activeAgents.slice(0, 3).forEach((agent) => {
      viewpoints.push({
        name: `Agent: ${agent.name}`,
        position: new THREE.Vector3(
          agent.basePosition.x - 2,
          3,
          agent.basePosition.z + 2
        ),
        lookAt: new THREE.Vector3(
          agent.basePosition.x,
          1.5,
          agent.basePosition.z
        ),
        duration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL * 0.5,
      });
    });

    // Final wide shot
    viewpoints.push({
      name: 'Final Overview',
      position: new THREE.Vector3(25, 25, 25),
      lookAt: new THREE.Vector3(0, 0, 5),
      duration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
    });

    return viewpoints;
  }, [agents, zones, projects]);

  // Initialize boss mode
  useEffect(() => {
    const state = stateRef.current;

    if (active && !state.isActive) {
      // Starting boss mode
      state.isActive = true;
      state.currentViewpointIndex = 0;
      state.transitionProgress = 0;
      state.viewpointStartTime = performance.now();
      state.startPosition.copy(camera.position);

      // Calculate initial lookAt from camera direction
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      state.startLookAt.copy(camera.position).add(direction.multiplyScalar(10));
      state.currentLookAt.copy(state.startLookAt);

      const viewpoints = generateViewpoints();
      if (viewpoints.length > 0) {
        state.targetPosition.copy(viewpoints[0].position);
        state.targetLookAt.copy(viewpoints[0].lookAt);
      }
    } else if (!active && state.isActive) {
      // Stopping boss mode
      state.isActive = false;
    }
  }, [active, camera, generateViewpoints]);

  // Animate camera
  useFrame(() => {
    const state = stateRef.current;
    if (!state.isActive) return;

    const viewpoints = generateViewpoints();
    if (viewpoints.length === 0) return;

    const currentViewpoint = viewpoints[state.currentViewpointIndex];
    const now = performance.now();
    const elapsed = now - state.viewpointStartTime;
    const transitionDuration = 2000; // 2 seconds for camera movement
    const holdDuration = currentViewpoint.duration - transitionDuration;

    if (elapsed < transitionDuration) {
      // Transitioning to new viewpoint
      const t = elapsed / transitionDuration;
      const eased = easeInOutCubic(t);

      camera.position.lerpVectors(
        state.startPosition,
        state.targetPosition,
        eased
      );
      state.currentLookAt.lerpVectors(
        state.startLookAt,
        state.targetLookAt,
        eased
      );
      camera.lookAt(state.currentLookAt);
    } else if (elapsed < currentViewpoint.duration) {
      // Holding at viewpoint with subtle movement
      const holdProgress = (elapsed - transitionDuration) / holdDuration;
      const sway = Math.sin(holdProgress * Math.PI * 2) * 0.1;

      const swayPosition = state.targetPosition.clone();
      swayPosition.x += sway;
      camera.position.copy(swayPosition);
      camera.lookAt(state.targetLookAt);
    } else {
      // Move to next viewpoint
      state.currentViewpointIndex =
        (state.currentViewpointIndex + 1) % viewpoints.length;

      if (state.currentViewpointIndex === 0) {
        onCycleComplete?.();
      }

      state.viewpointStartTime = now;
      state.startPosition.copy(camera.position);
      state.startLookAt.copy(state.currentLookAt);

      const nextViewpoint = viewpoints[state.currentViewpointIndex];
      state.targetPosition.copy(nextViewpoint.position);
      state.targetLookAt.copy(nextViewpoint.lookAt);
    }
  });

  return null;
};

/**
 * Easing function for smooth camera transitions.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export default BossModeCamera;
