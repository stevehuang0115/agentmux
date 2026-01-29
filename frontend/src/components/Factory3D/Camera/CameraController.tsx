/**
 * CameraController - Custom camera controls for the factory.
 *
 * Provides WASD movement, mouse drag rotation, scroll zoom,
 * and touch controls for mobile devices.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFactory } from '../../../contexts/FactoryContext';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
import { calculateViewDirection } from '../../../utils/factory.utils';

const { CAMERA } = FACTORY_CONSTANTS;

/**
 * Tracks keyboard input state for camera movement.
 * Each property represents whether that direction key is currently pressed.
 */
interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/**
 * Tracks mouse state for camera rotation.
 */
interface MouseState {
  /** Whether the user is currently dragging to rotate */
  isDragging: boolean;
  /** Last recorded X position for delta calculation */
  lastX: number;
  /** Last recorded Y position for delta calculation */
  lastY: number;
}

/**
 * CameraController - First-person style camera controls.
 *
 * Features:
 * - WASD/Arrow keys for movement
 * - Mouse drag for look rotation
 * - Scroll wheel for zoom
 * - Touch support for mobile
 * - Smooth camera animation transitions
 * - Boss mode orbit control
 *
 * @returns null (modifies camera directly)
 */
export const CameraController: React.FC = () => {
  const { camera: threeCamera, gl } = useThree();
  const { camera: cameraState, updateCamera, bossModeState, clearSelection } = useFactory();

  // Refs for input state
  const keyState = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const mouseState = useRef<MouseState>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const yawRef = useRef(cameraState.yaw);
  const pitchRef = useRef(cameraState.pitch);

  // Pre-allocated vectors to reduce GC pressure during animation and movement
  const tempLookAt = useRef(new THREE.Vector3());
  const tempDirection = useRef(new THREE.Vector3());
  const tempForward = useRef(new THREE.Vector3());
  const tempRight = useRef(new THREE.Vector3());

  // Update camera direction from yaw/pitch (uses pre-allocated vectors)
  const updateCameraDirection = useCallback(() => {
    calculateViewDirection(yawRef.current, pitchRef.current, tempDirection.current);
    tempLookAt.current.copy(threeCamera.position).add(tempDirection.current);
    threeCamera.lookAt(tempLookAt.current);
  }, [threeCamera]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keyState.current.forward = true;
          break;
        case 's':
        case 'arrowdown':
          keyState.current.backward = true;
          break;
        case 'a':
        case 'arrowleft':
          keyState.current.left = true;
          break;
        case 'd':
        case 'arrowright':
          keyState.current.right = true;
          break;
        case 'q':
        case ' ':
          keyState.current.up = true;
          break;
        case 'e':
          keyState.current.down = true;
          break;
        case 'escape':
          // ESC key deselects agent in boss mode
          if (bossModeState.isActive) {
            clearSelection();
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keyState.current.forward = false;
          break;
        case 's':
        case 'arrowdown':
          keyState.current.backward = false;
          break;
        case 'a':
        case 'arrowleft':
          keyState.current.left = false;
          break;
        case 'd':
        case 'arrowright':
          keyState.current.right = false;
          break;
        case 'q':
        case ' ':
          keyState.current.up = false;
          break;
        case 'e':
          keyState.current.down = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [bossModeState.isActive, clearSelection]);

  // Mouse event handlers
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      mouseState.current.isDragging = true;
      mouseState.current.lastX = e.clientX;
      mouseState.current.lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
      mouseState.current.isDragging = false;
      canvas.style.cursor = 'default';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mouseState.current.isDragging) return;

      const deltaX = e.clientX - mouseState.current.lastX;
      const deltaY = e.clientY - mouseState.current.lastY;

      yawRef.current -= deltaX * CAMERA.MOUSE_SENSITIVITY;
      pitchRef.current = Math.max(
        CAMERA.MIN_PITCH,
        Math.min(CAMERA.MAX_PITCH, pitchRef.current - deltaY * CAMERA.MOUSE_SENSITIVITY)
      );

      updateCameraDirection();

      mouseState.current.lastX = e.clientX;
      mouseState.current.lastY = e.clientY;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Use pre-allocated tempForward to avoid GC in scroll handler
      calculateViewDirection(yawRef.current, pitchRef.current, tempForward.current);
      const zoomAmount = e.deltaY < 0 ? CAMERA.ZOOM_SPEED : -CAMERA.ZOOM_SPEED;
      threeCamera.position.addScaledVector(tempForward.current, zoomAmount);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [gl, threeCamera, updateCameraDirection]);

  // Touch event handlers
  useEffect(() => {
    const canvas = gl.domElement;
    let touchState = {
      isDragging: false,
      lastX: 0,
      lastY: 0,
      isPinching: false,
      initialPinchDistance: 0,
    };

    const getTouchDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        touchState.isDragging = true;
        touchState.isPinching = false;
        touchState.lastX = e.touches[0].clientX;
        touchState.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchState.isDragging = false;
        touchState.isPinching = true;
        touchState.initialPinchDistance = getTouchDistance(
          e.touches[0],
          e.touches[1]
        );
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1 && touchState.isDragging) {
        const deltaX = e.touches[0].clientX - touchState.lastX;
        const deltaY = e.touches[0].clientY - touchState.lastY;

        yawRef.current += deltaX * CAMERA.TOUCH_SENSITIVITY;
        pitchRef.current = Math.max(
          CAMERA.MIN_PITCH,
          Math.min(CAMERA.MAX_PITCH, pitchRef.current + deltaY * CAMERA.TOUCH_SENSITIVITY)
        );

        updateCameraDirection();

        touchState.lastX = e.touches[0].clientX;
        touchState.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2 && touchState.isPinching) {
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const delta = currentDistance - touchState.initialPinchDistance;

        // Use pre-allocated tempForward to avoid GC in pinch handler
        calculateViewDirection(yawRef.current, pitchRef.current, tempForward.current);
        threeCamera.position.addScaledVector(tempForward.current, delta * 0.02);
        touchState.initialPinchDistance = currentDistance;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchState.isDragging = false;
        touchState.isPinching = false;
      } else if (e.touches.length === 1) {
        touchState.isDragging = true;
        touchState.isPinching = false;
        touchState.lastX = e.touches[0].clientX;
        touchState.lastY = e.touches[0].clientY;
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gl, threeCamera, updateCameraDirection]);

  // Animation frame updates
  useFrame((state, delta) => {
    const keys = keyState.current;

    // Handle boss mode orbit - camera follows the orbit position from state
    if (bossModeState.isActive) {
      // Apply camera position and target from state
      threeCamera.position.copy(cameraState.position);
      threeCamera.lookAt(cameraState.target);

      // Update yaw/pitch refs from current camera orientation
      tempDirection.current
        .copy(cameraState.target)
        .sub(cameraState.position)
        .normalize();
      yawRef.current = Math.atan2(tempDirection.current.x, tempDirection.current.z);
      pitchRef.current = Math.asin(tempDirection.current.y);

      return; // Skip other controls during boss mode
    }

    // Handle camera animation (from focus transitions)
    if (cameraState.isAnimating && cameraState.animationTarget) {
      const anim = cameraState.animationTarget;
      const elapsed = Date.now() - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1);

      // Smooth easing
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate position
      threeCamera.position.lerpVectors(
        anim.startPosition,
        anim.position,
        eased
      );

      // Interpolate look-at using pre-allocated vector
      tempLookAt.current.lerpVectors(anim.startLookAt, anim.lookAt, eased);
      threeCamera.lookAt(tempLookAt.current);

      // Update yaw/pitch from new orientation using pre-allocated vector
      tempDirection.current
        .copy(tempLookAt.current)
        .sub(threeCamera.position)
        .normalize();
      yawRef.current = Math.atan2(tempDirection.current.x, tempDirection.current.z);
      pitchRef.current = Math.asin(tempDirection.current.y);

      if (progress >= 1) {
        updateCamera({ isAnimating: false, animationTarget: undefined });
      }

      return; // Skip manual controls during animation
    }

    // Manual keyboard movement - use pre-allocated vectors
    const moveSpeed = CAMERA.MOVE_SPEED * delta;

    // Calculate forward direction (horizontal only for ground movement)
    tempForward.current.set(
      Math.sin(yawRef.current),
      0,
      Math.cos(yawRef.current)
    );

    // Calculate right direction (perpendicular to forward)
    tempRight.current.set(
      Math.sin(yawRef.current + Math.PI / 2),
      0,
      Math.cos(yawRef.current + Math.PI / 2)
    );

    if (keys.forward) {
      threeCamera.position.addScaledVector(tempForward.current, moveSpeed);
    }
    if (keys.backward) {
      threeCamera.position.addScaledVector(tempForward.current, -moveSpeed);
    }
    if (keys.left) {
      threeCamera.position.addScaledVector(tempRight.current, moveSpeed);
    }
    if (keys.right) {
      threeCamera.position.addScaledVector(tempRight.current, -moveSpeed);
    }
    if (keys.up) {
      threeCamera.position.y += moveSpeed;
    }
    if (keys.down) {
      threeCamera.position.y -= moveSpeed;
    }
  });

  return null;
};
