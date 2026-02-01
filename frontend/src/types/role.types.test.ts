/**
 * Tests for Role Types
 *
 * @module types/role.types.test
 */

import { describe, it, expect } from 'vitest';
import {
  ROLE_CATEGORIES,
  ROLE_CATEGORY_DISPLAY_NAMES,
  ROLE_CATEGORY_ICONS,
  isValidRoleCategory,
  getRoleCategoryDisplayName,
  getRoleCategoryIcon,
} from './role.types';

describe('Role Types', () => {
  describe('ROLE_CATEGORIES', () => {
    it('should contain all categories', () => {
      expect(ROLE_CATEGORIES).toContain('development');
      expect(ROLE_CATEGORIES).toContain('management');
      expect(ROLE_CATEGORIES).toContain('quality');
      expect(ROLE_CATEGORIES).toContain('design');
      expect(ROLE_CATEGORIES).toContain('sales');
      expect(ROLE_CATEGORIES).toContain('support');
    });

    it('should have exactly 6 categories', () => {
      expect(ROLE_CATEGORIES).toHaveLength(6);
    });
  });

  describe('ROLE_CATEGORY_DISPLAY_NAMES', () => {
    it('should have display names for all categories', () => {
      expect(ROLE_CATEGORY_DISPLAY_NAMES.development).toBe('Development');
      expect(ROLE_CATEGORY_DISPLAY_NAMES.management).toBe('Management');
      expect(ROLE_CATEGORY_DISPLAY_NAMES.quality).toBe('Quality');
      expect(ROLE_CATEGORY_DISPLAY_NAMES.design).toBe('Design');
      expect(ROLE_CATEGORY_DISPLAY_NAMES.sales).toBe('Sales');
      expect(ROLE_CATEGORY_DISPLAY_NAMES.support).toBe('Support');
    });
  });

  describe('ROLE_CATEGORY_ICONS', () => {
    it('should have icons for all categories', () => {
      expect(ROLE_CATEGORY_ICONS.development).toBe('💻');
      expect(ROLE_CATEGORY_ICONS.management).toBe('📋');
      expect(ROLE_CATEGORY_ICONS.quality).toBe('✅');
      expect(ROLE_CATEGORY_ICONS.design).toBe('🎨');
      expect(ROLE_CATEGORY_ICONS.sales).toBe('💼');
      expect(ROLE_CATEGORY_ICONS.support).toBe('🎧');
    });
  });

  describe('isValidRoleCategory', () => {
    it('should return true for valid categories', () => {
      expect(isValidRoleCategory('development')).toBe(true);
      expect(isValidRoleCategory('management')).toBe(true);
      expect(isValidRoleCategory('quality')).toBe(true);
      expect(isValidRoleCategory('design')).toBe(true);
      expect(isValidRoleCategory('sales')).toBe(true);
      expect(isValidRoleCategory('support')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(isValidRoleCategory('invalid')).toBe(false);
      expect(isValidRoleCategory('')).toBe(false);
      expect(isValidRoleCategory('DEVELOPMENT')).toBe(false);
      expect(isValidRoleCategory('dev')).toBe(false);
    });
  });

  describe('getRoleCategoryDisplayName', () => {
    it('should return display name for development', () => {
      expect(getRoleCategoryDisplayName('development')).toBe('Development');
    });

    it('should return display name for management', () => {
      expect(getRoleCategoryDisplayName('management')).toBe('Management');
    });

    it('should return display name for quality', () => {
      expect(getRoleCategoryDisplayName('quality')).toBe('Quality');
    });

    it('should return display name for design', () => {
      expect(getRoleCategoryDisplayName('design')).toBe('Design');
    });

    it('should return display name for sales', () => {
      expect(getRoleCategoryDisplayName('sales')).toBe('Sales');
    });

    it('should return display name for support', () => {
      expect(getRoleCategoryDisplayName('support')).toBe('Support');
    });
  });

  describe('getRoleCategoryIcon', () => {
    it('should return icon for development', () => {
      expect(getRoleCategoryIcon('development')).toBe('💻');
    });

    it('should return icon for management', () => {
      expect(getRoleCategoryIcon('management')).toBe('📋');
    });

    it('should return icon for quality', () => {
      expect(getRoleCategoryIcon('quality')).toBe('✅');
    });

    it('should return icon for design', () => {
      expect(getRoleCategoryIcon('design')).toBe('🎨');
    });

    it('should return icon for sales', () => {
      expect(getRoleCategoryIcon('sales')).toBe('💼');
    });

    it('should return icon for support', () => {
      expect(getRoleCategoryIcon('support')).toBe('🎧');
    });
  });
});
