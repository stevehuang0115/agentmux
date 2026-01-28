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
