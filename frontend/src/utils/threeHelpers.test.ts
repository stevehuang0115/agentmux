/**
 * Unit tests for pure helper functions in threeHelpers.ts.
 *
 * Only the functions that do not require Three.js scene objects are
 * covered here: normalizeRotationDiff and getCircleIndicatorStyle.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRotationDiff,
  getCircleIndicatorStyle,
  easeInOutCubic,
  lerp,
  easeOutQuad,
  createViewpoint,
} from './threeHelpers';

/* -------------------------------------------------------------------------- */
/*  normalizeRotationDiff                                                     */
/* -------------------------------------------------------------------------- */

describe('normalizeRotationDiff', () => {
  const PI = Math.PI;

  it('returns 0 unchanged', () => {
    expect(normalizeRotationDiff(0)).toBe(0);
  });

  it('returns values already inside (-PI, PI) unchanged', () => {
    expect(normalizeRotationDiff(1)).toBe(1);
    expect(normalizeRotationDiff(-1)).toBe(-1);
    expect(normalizeRotationDiff(0.5)).toBe(0.5);
    expect(normalizeRotationDiff(-2.5)).toBe(-2.5);
  });

  // Boundary: exactly PI and -PI are within the range (loop condition is strict)
  it('returns exactly PI unchanged (boundary)', () => {
    expect(normalizeRotationDiff(PI)).toBe(PI);
  });

  it('returns exactly -PI unchanged (boundary)', () => {
    expect(normalizeRotationDiff(-PI)).toBe(-PI);
  });

  // Wrapping positive values
  it('wraps 2*PI to approximately 0', () => {
    expect(normalizeRotationDiff(2 * PI)).toBeCloseTo(0, 10);
  });

  it('wraps 3*PI to approximately PI (one full wrap)', () => {
    expect(normalizeRotationDiff(3 * PI)).toBeCloseTo(PI, 10);
  });

  it('wraps 4*PI to approximately 0 (two full wraps)', () => {
    expect(normalizeRotationDiff(4 * PI)).toBeCloseTo(0, 10);
  });

  it('wraps a value slightly above PI', () => {
    const input = PI + 0.1;
    const expected = -PI + 0.1;
    expect(normalizeRotationDiff(input)).toBeCloseTo(expected, 10);
  });

  // Wrapping negative values
  it('wraps -2*PI to approximately 0', () => {
    expect(normalizeRotationDiff(-2 * PI)).toBeCloseTo(0, 10);
  });

  it('wraps -3*PI to approximately -PI', () => {
    expect(normalizeRotationDiff(-3 * PI)).toBeCloseTo(-PI, 10);
  });

  it('wraps -4*PI to approximately 0', () => {
    expect(normalizeRotationDiff(-4 * PI)).toBeCloseTo(0, 10);
  });

  it('wraps a value slightly below -PI', () => {
    const input = -PI - 0.1;
    const expected = PI - 0.1;
    expect(normalizeRotationDiff(input)).toBeCloseTo(expected, 10);
  });

  // Large magnitudes
  it('normalizes a large positive value', () => {
    const input = 10 * PI + 0.5;
    expect(normalizeRotationDiff(input)).toBeCloseTo(0.5, 10);
  });

  it('normalizes a large negative value', () => {
    const input = -10 * PI - 0.5;
    expect(normalizeRotationDiff(input)).toBeCloseTo(-0.5, 10);
  });

  // Fractional multiples of PI
  it('handles PI/2 (already in range)', () => {
    expect(normalizeRotationDiff(PI / 2)).toBeCloseTo(PI / 2, 10);
  });

  it('handles -PI/2 (already in range)', () => {
    expect(normalizeRotationDiff(-PI / 2)).toBeCloseTo(-PI / 2, 10);
  });

  it('handles 1.5*PI by wrapping to -0.5*PI', () => {
    expect(normalizeRotationDiff(1.5 * PI)).toBeCloseTo(-0.5 * PI, 10);
  });

  it('handles -1.5*PI by wrapping to 0.5*PI', () => {
    expect(normalizeRotationDiff(-1.5 * PI)).toBeCloseTo(0.5 * PI, 10);
  });

  // Property-based sweep: result is always in [-PI, PI]
  it('always returns a value in [-PI, PI] for a sweep of inputs', () => {
    for (let i = -20; i <= 20; i += 0.7) {
      const result = normalizeRotationDiff(i);
      expect(result).toBeGreaterThanOrEqual(-PI);
      expect(result).toBeLessThanOrEqual(PI);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  getCircleIndicatorStyle                                                   */
/* -------------------------------------------------------------------------- */

describe('getCircleIndicatorStyle', () => {
  describe('selected state', () => {
    it('returns the selected style when selected but not hovered', () => {
      const style = getCircleIndicatorStyle(true, false);
      expect(style).toEqual({
        color: 0xffaa00,
        opacity: 1.0,
        emissive: 0xffaa00,
        emissiveIntensity: 0.8,
      });
    });

    it('returns the selected style when both selected and hovered (selected takes priority)', () => {
      const style = getCircleIndicatorStyle(true, true);
      expect(style).toEqual({
        color: 0xffaa00,
        opacity: 1.0,
        emissive: 0xffaa00,
        emissiveIntensity: 0.8,
      });
    });
  });

  describe('hovered state', () => {
    it('returns the hovered style when hovered but not selected', () => {
      const style = getCircleIndicatorStyle(false, true);
      expect(style).toEqual({
        color: 0x66ccff,
        opacity: 0.9,
        emissive: 0x66ccff,
        emissiveIntensity: 0.5,
      });
    });
  });

  describe('default state', () => {
    it('returns the default style with the built-in default color', () => {
      const style = getCircleIndicatorStyle(false, false);
      expect(style).toEqual({
        color: 0x4488ff,
        opacity: 0.6,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });
    });

    it('uses a custom default color when provided', () => {
      const customColor = 0xff0000;
      const style = getCircleIndicatorStyle(false, false, customColor);
      expect(style).toEqual({
        color: customColor,
        opacity: 0.6,
        emissive: 0x000000,
        emissiveIntensity: 0,
      });
    });

    it('ignores the custom default color when selected', () => {
      const style = getCircleIndicatorStyle(true, false, 0xff0000);
      expect(style.color).toBe(0xffaa00);
    });

    it('ignores the custom default color when hovered', () => {
      const style = getCircleIndicatorStyle(false, true, 0xff0000);
      expect(style.color).toBe(0x66ccff);
    });
  });

  describe('return shape', () => {
    it('always returns an object with exactly four numeric keys', () => {
      const style = getCircleIndicatorStyle(false, false);
      const keys = Object.keys(style).sort();
      expect(keys).toEqual(['color', 'emissive', 'emissiveIntensity', 'opacity']);

      for (const key of keys) {
        expect(typeof style[key as keyof typeof style]).toBe('number');
      }
    });
  });
});

/* -------------------------------------------------------------------------- */
/*  easeInOutCubic                                                            */
/* -------------------------------------------------------------------------- */

describe('easeInOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOutCubic(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeInOutCubic(1)).toBe(1);
  });

  it('returns 0.5 at t=0.5 (midpoint)', () => {
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it('eases in slowly at start (t=0.25 < 0.25)', () => {
    const result = easeInOutCubic(0.25);
    // 4 * 0.25^3 = 4 * 0.015625 = 0.0625
    expect(result).toBeCloseTo(0.0625, 10);
    expect(result).toBeLessThan(0.25); // slower than linear
  });

  it('eases out slowly at end (t=0.75 > 0.75)', () => {
    const result = easeInOutCubic(0.75);
    // 1 - ((-2 * 0.75 + 2)^3) / 2 = 1 - (0.5^3) / 2 = 1 - 0.0625 = 0.9375
    expect(result).toBeCloseTo(0.9375, 10);
    expect(result).toBeGreaterThan(0.75); // faster than linear
  });

  it('is symmetric around t=0.5', () => {
    // f(0.5 - x) + f(0.5 + x) should equal 1
    const offsets = [0.1, 0.2, 0.3, 0.4, 0.5];
    for (const offset of offsets) {
      const lower = easeInOutCubic(0.5 - offset);
      const upper = easeInOutCubic(0.5 + offset);
      expect(lower + upper).toBeCloseTo(1, 10);
    }
  });

  it('is monotonically increasing', () => {
    let prev = easeInOutCubic(0);
    for (let t = 0.1; t <= 1; t += 0.1) {
      const current = easeInOutCubic(t);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });

  it('outputs are always in [0, 1] for inputs in [0, 1]', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const result = easeInOutCubic(t);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  lerp                                                                      */
/* -------------------------------------------------------------------------- */

describe('lerp', () => {
  it('returns start value at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns end value at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it('interpolates correctly for t=0.25', () => {
    expect(lerp(0, 100, 0.25)).toBe(25);
  });

  it('interpolates correctly for t=0.75', () => {
    expect(lerp(0, 100, 0.75)).toBe(75);
  });

  it('works with negative start values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });

  it('works with negative end values', () => {
    expect(lerp(10, -10, 0.5)).toBe(0);
  });

  it('works when start equals end', () => {
    expect(lerp(5, 5, 0.5)).toBe(5);
  });

  it('works with decimal values', () => {
    expect(lerp(0.1, 0.9, 0.5)).toBeCloseTo(0.5, 10);
  });

  it('extrapolates beyond t=1', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
  });

  it('extrapolates below t=0', () => {
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });
});

/* -------------------------------------------------------------------------- */
/*  easeOutQuad                                                               */
/* -------------------------------------------------------------------------- */

describe('easeOutQuad', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutQuad(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeOutQuad(1)).toBe(1);
  });

  it('starts fast and slows down (t=0.25 > 0.25)', () => {
    const result = easeOutQuad(0.25);
    // 1 - (1 - 0.25)^2 = 1 - 0.5625 = 0.4375
    expect(result).toBeCloseTo(0.4375, 10);
    expect(result).toBeGreaterThan(0.25); // faster than linear at start
  });

  it('slows down toward end (t=0.75)', () => {
    const result = easeOutQuad(0.75);
    // 1 - (1 - 0.75)^2 = 1 - 0.0625 = 0.9375
    expect(result).toBeCloseTo(0.9375, 10);
  });

  it('is monotonically increasing', () => {
    let prev = easeOutQuad(0);
    for (let t = 0.1; t <= 1; t += 0.1) {
      const current = easeOutQuad(t);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });

  it('outputs are always in [0, 1] for inputs in [0, 1]', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const result = easeOutQuad(t);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });

  it('has greater slope at start than at end', () => {
    // Derivative at t=0: 2(1-0) = 2
    // Derivative at t=1: 2(1-1) = 0
    // We can approximate by checking small deltas
    const startSlope = (easeOutQuad(0.01) - easeOutQuad(0)) / 0.01;
    const endSlope = (easeOutQuad(1) - easeOutQuad(0.99)) / 0.01;
    expect(startSlope).toBeGreaterThan(endSlope);
  });
});

/* -------------------------------------------------------------------------- */
/*  createViewpoint                                                           */
/* -------------------------------------------------------------------------- */

describe('createViewpoint', () => {
  it('creates a viewpoint with correct name', () => {
    const vp = createViewpoint('Test View', [0, 0, 0], [1, 1, 1], 1000);
    expect(vp.name).toBe('Test View');
  });

  it('creates a viewpoint with correct duration', () => {
    const vp = createViewpoint('Test', [0, 0, 0], [1, 1, 1], 5000);
    expect(vp.duration).toBe(5000);
  });

  it('creates position as THREE.Vector3', () => {
    const vp = createViewpoint('Test', [1, 2, 3], [0, 0, 0], 1000);
    expect(vp.position.x).toBe(1);
    expect(vp.position.y).toBe(2);
    expect(vp.position.z).toBe(3);
  });

  it('creates lookAt as THREE.Vector3', () => {
    const vp = createViewpoint('Test', [0, 0, 0], [4, 5, 6], 1000);
    expect(vp.lookAt.x).toBe(4);
    expect(vp.lookAt.y).toBe(5);
    expect(vp.lookAt.z).toBe(6);
  });

  it('handles negative coordinates', () => {
    const vp = createViewpoint('Negative', [-1, -2, -3], [-4, -5, -6], 1000);
    expect(vp.position.x).toBe(-1);
    expect(vp.position.y).toBe(-2);
    expect(vp.position.z).toBe(-3);
    expect(vp.lookAt.x).toBe(-4);
    expect(vp.lookAt.y).toBe(-5);
    expect(vp.lookAt.z).toBe(-6);
  });

  it('handles decimal coordinates', () => {
    const vp = createViewpoint('Decimal', [1.5, 2.5, 3.5], [0.1, 0.2, 0.3], 1000);
    expect(vp.position.x).toBeCloseTo(1.5, 10);
    expect(vp.position.y).toBeCloseTo(2.5, 10);
    expect(vp.position.z).toBeCloseTo(3.5, 10);
  });

  it('returns object with exactly four properties', () => {
    const vp = createViewpoint('Test', [0, 0, 0], [1, 1, 1], 1000);
    expect(Object.keys(vp).sort()).toEqual(['duration', 'lookAt', 'name', 'position']);
  });

  it('position and lookAt are independent Vector3 instances', () => {
    const vp = createViewpoint('Test', [1, 1, 1], [1, 1, 1], 1000);
    expect(vp.position).not.toBe(vp.lookAt);

    // Modifying one shouldn't affect the other
    vp.position.x = 100;
    expect(vp.lookAt.x).toBe(1);
  });
});
