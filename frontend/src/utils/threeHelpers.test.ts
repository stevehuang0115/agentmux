/**
 * Tests for shared Three.js helper utilities.
 *
 * Tests rotation normalization, circle indicator styling, and
 * the pure function signatures of scene helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRotationDiff,
  getCircleIndicatorStyle,
} from './threeHelpers';

describe('Three.js Helpers', () => {
  // ------ normalizeRotationDiff ------

  describe('normalizeRotationDiff', () => {
    it('should return 0 for zero diff', () => {
      expect(normalizeRotationDiff(0)).toBe(0);
    });

    it('should pass through values already in [-PI, PI]', () => {
      expect(normalizeRotationDiff(1)).toBe(1);
      expect(normalizeRotationDiff(-1)).toBe(-1);
      expect(normalizeRotationDiff(Math.PI)).toBe(Math.PI);
    });

    it('should normalize values greater than PI', () => {
      const result = normalizeRotationDiff(Math.PI + 1);
      expect(result).toBeCloseTo(-Math.PI + 1, 10);
    });

    it('should normalize values less than -PI', () => {
      const result = normalizeRotationDiff(-Math.PI - 1);
      expect(result).toBeCloseTo(Math.PI - 1, 10);
    });

    it('should normalize 2*PI to approximately 0', () => {
      const result = normalizeRotationDiff(Math.PI * 2);
      expect(Math.abs(result)).toBeLessThan(0.001);
    });

    it('should normalize -2*PI to approximately 0', () => {
      const result = normalizeRotationDiff(-Math.PI * 2);
      expect(Math.abs(result)).toBeLessThan(0.001);
    });

    it('should handle large positive values', () => {
      const result = normalizeRotationDiff(Math.PI * 6 + 0.5);
      expect(result).toBeCloseTo(0.5, 10);
    });

    it('should handle large negative values', () => {
      const result = normalizeRotationDiff(-Math.PI * 6 - 0.5);
      expect(result).toBeCloseTo(-0.5, 10);
    });

    it('should always return value in [-PI, PI] range', () => {
      for (let i = -20; i <= 20; i += 0.7) {
        const result = normalizeRotationDiff(i);
        expect(result).toBeGreaterThanOrEqual(-Math.PI);
        expect(result).toBeLessThanOrEqual(Math.PI);
      }
    });
  });

  // ------ getCircleIndicatorStyle ------

  describe('getCircleIndicatorStyle', () => {
    it('should return selected style when isSelected=true', () => {
      const style = getCircleIndicatorStyle(true, false);
      expect(style.color).toBe(0xffaa00);
      expect(style.opacity).toBe(1.0);
      expect(style.emissive).toBe(0xffaa00);
      expect(style.emissiveIntensity).toBe(0.8);
    });

    it('should return hovered style when isHovered=true and not selected', () => {
      const style = getCircleIndicatorStyle(false, true);
      expect(style.color).toBe(0x66ccff);
      expect(style.opacity).toBe(0.9);
      expect(style.emissive).toBe(0x66ccff);
      expect(style.emissiveIntensity).toBe(0.5);
    });

    it('should prioritize selected over hovered', () => {
      const style = getCircleIndicatorStyle(true, true);
      expect(style.color).toBe(0xffaa00); // Selected color
    });

    it('should return default style with custom color', () => {
      const style = getCircleIndicatorStyle(false, false, 0x44aa44);
      expect(style.color).toBe(0x44aa44);
      expect(style.opacity).toBe(0.6);
      expect(style.emissive).toBe(0x000000);
      expect(style.emissiveIntensity).toBe(0);
    });

    it('should use blue default color when no custom color', () => {
      const style = getCircleIndicatorStyle(false, false);
      expect(style.color).toBe(0x4488ff);
    });

    it('should always return all four properties', () => {
      const style = getCircleIndicatorStyle(false, false);
      expect(style).toHaveProperty('color');
      expect(style).toHaveProperty('opacity');
      expect(style).toHaveProperty('emissive');
      expect(style).toHaveProperty('emissiveIntensity');
    });
  });
});
