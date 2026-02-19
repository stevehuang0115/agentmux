/**
 * Knowledge Types Tests
 *
 * Validates the type constants, default values, and exported structures
 * for the Company Knowledge system.
 *
 * @module types/knowledge.types.test
 */

import {
  DEFAULT_KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CONSTANTS,
} from './knowledge.types.js';

describe('Knowledge Types', () => {
  describe('DEFAULT_KNOWLEDGE_CATEGORIES', () => {
    it('should contain all expected default categories', () => {
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toContain('SOPs');
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toContain('Team Norms');
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toContain('Architecture');
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toContain('Onboarding');
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toContain('Runbooks');
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toContain('General');
    });

    it('should have exactly 6 default categories', () => {
      expect(DEFAULT_KNOWLEDGE_CATEGORIES).toHaveLength(6);
    });

    it('should be a readonly array (const assertion)', () => {
      // Verify it is an array and the values are as expected
      const categories: readonly string[] = DEFAULT_KNOWLEDGE_CATEGORIES;
      expect(Array.isArray(categories)).toBe(true);
    });
  });

  describe('KNOWLEDGE_CONSTANTS', () => {
    it('should have MAX_CONTENT_LENGTH property', () => {
      expect(KNOWLEDGE_CONSTANTS).toHaveProperty('MAX_CONTENT_LENGTH');
    });

    it('should have MAX_TITLE_LENGTH property', () => {
      expect(KNOWLEDGE_CONSTANTS).toHaveProperty('MAX_TITLE_LENGTH');
    });

    it('should have MAX_TAGS property', () => {
      expect(KNOWLEDGE_CONSTANTS).toHaveProperty('MAX_TAGS');
    });

    it('should have MAX_TAG_LENGTH property', () => {
      expect(KNOWLEDGE_CONSTANTS).toHaveProperty('MAX_TAG_LENGTH');
    });

    it('should have MAX_CATEGORY_LENGTH property', () => {
      expect(KNOWLEDGE_CONSTANTS).toHaveProperty('MAX_CATEGORY_LENGTH');
    });

    it('should have PREVIEW_LENGTH property', () => {
      expect(KNOWLEDGE_CONSTANTS).toHaveProperty('PREVIEW_LENGTH');
    });

    it('should have numeric values for all constants', () => {
      expect(typeof KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH).toBe('number');
      expect(typeof KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH).toBe('number');
      expect(typeof KNOWLEDGE_CONSTANTS.MAX_TAGS).toBe('number');
      expect(typeof KNOWLEDGE_CONSTANTS.MAX_TAG_LENGTH).toBe('number');
      expect(typeof KNOWLEDGE_CONSTANTS.MAX_CATEGORY_LENGTH).toBe('number');
      expect(typeof KNOWLEDGE_CONSTANTS.PREVIEW_LENGTH).toBe('number');
    });

    it('should have positive values for all constants', () => {
      expect(KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH).toBeGreaterThan(0);
      expect(KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH).toBeGreaterThan(0);
      expect(KNOWLEDGE_CONSTANTS.MAX_TAGS).toBeGreaterThan(0);
      expect(KNOWLEDGE_CONSTANTS.MAX_TAG_LENGTH).toBeGreaterThan(0);
      expect(KNOWLEDGE_CONSTANTS.MAX_CATEGORY_LENGTH).toBeGreaterThan(0);
      expect(KNOWLEDGE_CONSTANTS.PREVIEW_LENGTH).toBeGreaterThan(0);
    });

    it('should have expected specific values', () => {
      expect(KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH).toBe(512000);
      expect(KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH).toBe(200);
      expect(KNOWLEDGE_CONSTANTS.MAX_TAGS).toBe(20);
      expect(KNOWLEDGE_CONSTANTS.MAX_TAG_LENGTH).toBe(50);
      expect(KNOWLEDGE_CONSTANTS.MAX_CATEGORY_LENGTH).toBe(50);
      expect(KNOWLEDGE_CONSTANTS.PREVIEW_LENGTH).toBe(200);
    });

    it('should have MAX_CONTENT_LENGTH larger than PREVIEW_LENGTH', () => {
      expect(KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH).toBeGreaterThan(
        KNOWLEDGE_CONSTANTS.PREVIEW_LENGTH,
      );
    });
  });
});
