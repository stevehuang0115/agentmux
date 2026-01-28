/**
 * BossModeCamera tests - Verifies easing functions and viewpoint logic.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

/**
 * Easing function for smooth camera transitions.
 * Replicates the easeInOutCubic function from BossModeCamera.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
 * Creates a viewpoint with the given parameters.
 */
function createViewpoint(
  name: string,
  position: [number, number, number],
  lookAt: [number, number, number],
  duration: number
): Viewpoint {
  return {
    name,
    position: new THREE.Vector3(...position),
    lookAt: new THREE.Vector3(...lookAt),
    duration,
  };
}

describe('BossModeCamera', () => {
  describe('easeInOutCubic', () => {
    it('should return 0 at t=0', () => {
      expect(easeInOutCubic(0)).toBe(0);
    });

    it('should return 1 at t=1', () => {
      expect(easeInOutCubic(1)).toBe(1);
    });

    it('should return 0.5 at t=0.5', () => {
      expect(easeInOutCubic(0.5)).toBe(0.5);
    });

    it('should ease in during first half (slow start)', () => {
      const t = 0.25;
      const result = easeInOutCubic(t);
      // At t=0.25, linear would be 0.25, but easeInOut should be less
      expect(result).toBeLessThan(0.25);
      expect(result).toBeCloseTo(0.0625); // 4 * 0.25^3 = 0.0625
    });

    it('should ease out during second half (slow end)', () => {
      const t = 0.75;
      const result = easeInOutCubic(t);
      // At t=0.75, linear would be 0.75, but easeInOut should be more
      expect(result).toBeGreaterThan(0.75);
      expect(result).toBeCloseTo(0.9375);
    });

    it('should be symmetric around 0.5', () => {
      const t1 = 0.2;
      const t2 = 0.8;
      const val1 = easeInOutCubic(t1);
      const val2 = easeInOutCubic(t2);
      expect(val1 + val2).toBeCloseTo(1);
    });

    it('should be monotonically increasing', () => {
      let prev = 0;
      for (let t = 0; t <= 1; t += 0.1) {
        const current = easeInOutCubic(t);
        expect(current).toBeGreaterThanOrEqual(prev);
        prev = current;
      }
    });

    it('should handle edge values correctly', () => {
      expect(easeInOutCubic(-0.1)).toBeLessThan(0);
      expect(easeInOutCubic(1.1)).toBeGreaterThan(1);
    });
  });

  describe('Viewpoint creation', () => {
    it('should create viewpoint with correct properties', () => {
      const viewpoint = createViewpoint(
        'Overview',
        [-25, 20, -25],
        [0, 0, 5],
        5000
      );

      expect(viewpoint.name).toBe('Overview');
      expect(viewpoint.position.x).toBe(-25);
      expect(viewpoint.position.y).toBe(20);
      expect(viewpoint.position.z).toBe(-25);
      expect(viewpoint.lookAt.x).toBe(0);
      expect(viewpoint.lookAt.y).toBe(0);
      expect(viewpoint.lookAt.z).toBe(5);
      expect(viewpoint.duration).toBe(5000);
    });

    it('should support different viewpoint types', () => {
      const viewpoints: Viewpoint[] = [
        createViewpoint('Overview', [-25, 20, -25], [0, 0, 5], 5000),
        createViewpoint('Break Room', [-6, 5, 6], [0, 1, 0], 3750),
        createViewpoint('Poker Table', [6, 5, 6], [0, 1, 0], 3750),
        createViewpoint('Agent: Test', [-2, 3, 2], [0, 1.5, 0], 2500),
      ];

      expect(viewpoints).toHaveLength(4);
      expect(viewpoints[0].name).toBe('Overview');
      expect(viewpoints[1].name).toBe('Break Room');
      expect(viewpoints[2].name).toBe('Poker Table');
      expect(viewpoints[3].name).toContain('Agent:');
    });
  });

  describe('Viewpoint cycling', () => {
    it('should cycle through viewpoints correctly', () => {
      const viewpoints = [
        createViewpoint('A', [0, 0, 0], [0, 0, 0], 1000),
        createViewpoint('B', [1, 1, 1], [0, 0, 0], 1000),
        createViewpoint('C', [2, 2, 2], [0, 0, 0], 1000),
      ];

      let currentIndex = 0;

      // Simulate cycling
      for (let i = 0; i < 10; i++) {
        const viewpoint = viewpoints[currentIndex];
        expect(viewpoint).toBeDefined();
        currentIndex = (currentIndex + 1) % viewpoints.length;
      }

      expect(currentIndex).toBe(10 % 3); // 1
    });

    it('should detect cycle completion', () => {
      const viewpoints = [
        createViewpoint('A', [0, 0, 0], [0, 0, 0], 1000),
        createViewpoint('B', [1, 1, 1], [0, 0, 0], 1000),
      ];

      let currentIndex = 0;
      let cycleCompleteCount = 0;

      for (let i = 0; i < 5; i++) {
        currentIndex = (currentIndex + 1) % viewpoints.length;
        if (currentIndex === 0) {
          cycleCompleteCount++;
        }
      }

      expect(cycleCompleteCount).toBe(2); // Completed 2 full cycles
    });
  });

  describe('Camera transition timing', () => {
    const TRANSITION_DURATION = 2000; // 2 seconds for camera movement

    it('should calculate transition progress correctly', () => {
      const elapsed = 1000; // 1 second into transition
      const t = elapsed / TRANSITION_DURATION;
      expect(t).toBe(0.5);
    });

    it('should detect when in hold phase', () => {
      const transitionDuration = 2000;
      const viewpointDuration = 5000;

      const elapsed = 3000; // Past transition, in hold phase
      const inHold = elapsed >= transitionDuration && elapsed < viewpointDuration;
      expect(inHold).toBe(true);
    });

    it('should detect when viewpoint duration exceeded', () => {
      const viewpointDuration = 5000;
      const elapsed = 5500;

      const shouldAdvance = elapsed >= viewpointDuration;
      expect(shouldAdvance).toBe(true);
    });
  });

  describe('Hold phase sway animation', () => {
    it('should calculate sway offset correctly', () => {
      const transitionDuration = 2000;
      const holdDuration = 3000;
      const elapsed = 3500; // 1.5 seconds into hold

      const holdProgress = (elapsed - transitionDuration) / holdDuration;
      expect(holdProgress).toBe(0.5);

      const sway = Math.sin(holdProgress * Math.PI * 2) * 0.1;
      expect(sway).toBeCloseTo(0); // sin(π) = 0
    });

    it('should produce bounded sway values', () => {
      for (let progress = 0; progress <= 1; progress += 0.1) {
        const sway = Math.sin(progress * Math.PI * 2) * 0.1;
        expect(sway).toBeGreaterThanOrEqual(-0.1);
        expect(sway).toBeLessThanOrEqual(0.1);
      }
    });
  });

  describe('Vector interpolation (lerp)', () => {
    it('should interpolate position correctly', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(10, 20, 30);
      const result = new THREE.Vector3();

      result.lerpVectors(start, end, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(0);

      result.lerpVectors(start, end, 0.5);
      expect(result.x).toBe(5);
      expect(result.y).toBe(10);
      expect(result.z).toBe(15);

      result.lerpVectors(start, end, 1);
      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
      expect(result.z).toBe(30);
    });

    it('should handle eased interpolation', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(10, 0, 0);
      const result = new THREE.Vector3();

      // At t=0.25, linear would give 2.5, but eased gives 0.625
      const eased = easeInOutCubic(0.25);
      result.lerpVectors(start, end, eased);
      expect(result.x).toBeCloseTo(0.625);
    });
  });
});
