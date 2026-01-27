/**
 * Tests for ThinkingBubble exported thought data constants.
 *
 * Validates that all thought lists are non-empty, contain non-empty strings,
 * and cover the expected behavior state keys for agents and NPCs.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_THOUGHTS,
  STEVE_JOBS_THOUGHTS,
  SUNDAR_PICHAI_THOUGHTS,
} from './ThinkingBubble';

describe('ThinkingBubble thought lists', () => {
  // ------ AGENT_THOUGHTS ------

  describe('AGENT_THOUGHTS', () => {
    const expectedKeys = [
      'wander',
      'couch',
      'stage',
      'break_room',
      'poker_table',
      'kitchen',
    ];

    it('should have all expected behavior keys', () => {
      expectedKeys.forEach((key) => {
        expect(AGENT_THOUGHTS).toHaveProperty(key);
      });
    });

    it('each behavior should have at least 3 thoughts', () => {
      Object.entries(AGENT_THOUGHTS).forEach(([key, thoughts]) => {
        expect(thoughts.length, `${key} should have ≥3 thoughts`).toBeGreaterThanOrEqual(3);
      });
    });

    it('all thoughts should be non-empty strings', () => {
      Object.entries(AGENT_THOUGHTS).forEach(([key, thoughts]) => {
        thoughts.forEach((thought, i) => {
          expect(thought.trim().length, `${key}[${i}] should not be empty`).toBeGreaterThan(0);
        });
      });
    });

    it('should not have duplicate thoughts within a behavior', () => {
      Object.entries(AGENT_THOUGHTS).forEach(([key, thoughts]) => {
        const unique = new Set(thoughts);
        expect(unique.size, `${key} should not have duplicates`).toBe(thoughts.length);
      });
    });
  });

  // ------ STEVE_JOBS_THOUGHTS ------

  describe('STEVE_JOBS_THOUGHTS', () => {
    const expectedKeys = [
      'wandering',
      'checking_agent',
      'watching_stage',
      'resting',
      'visiting_kitchen',
      'walking_to_target',
    ];

    it('should have all expected behavior keys', () => {
      expectedKeys.forEach((key) => {
        expect(STEVE_JOBS_THOUGHTS).toHaveProperty(key);
      });
    });

    it('each behavior should have at least 3 thoughts', () => {
      Object.entries(STEVE_JOBS_THOUGHTS).forEach(([key, thoughts]) => {
        expect(thoughts.length, `${key} should have ≥3 thoughts`).toBeGreaterThanOrEqual(3);
      });
    });

    it('all thoughts should be non-empty strings', () => {
      Object.entries(STEVE_JOBS_THOUGHTS).forEach(([key, thoughts]) => {
        thoughts.forEach((thought, i) => {
          expect(thought.trim().length, `${key}[${i}] should not be empty`).toBeGreaterThan(0);
        });
      });
    });

    it('should not have duplicate thoughts within a behavior', () => {
      Object.entries(STEVE_JOBS_THOUGHTS).forEach(([key, thoughts]) => {
        const unique = new Set(thoughts);
        expect(unique.size, `${key} should not have duplicates`).toBe(thoughts.length);
      });
    });
  });

  // ------ SUNDAR_PICHAI_THOUGHTS ------

  describe('SUNDAR_PICHAI_THOUGHTS', () => {
    const expectedKeys = [
      'wandering',
      'talking_to_agent',
      'presenting',
      'walking_circle',
      'visiting_kitchen',
      'walking_to_target',
    ];

    it('should have all expected behavior keys', () => {
      expectedKeys.forEach((key) => {
        expect(SUNDAR_PICHAI_THOUGHTS).toHaveProperty(key);
      });
    });

    it('each behavior should have at least 3 thoughts', () => {
      Object.entries(SUNDAR_PICHAI_THOUGHTS).forEach(([key, thoughts]) => {
        expect(thoughts.length, `${key} should have ≥3 thoughts`).toBeGreaterThanOrEqual(3);
      });
    });

    it('all thoughts should be non-empty strings', () => {
      Object.entries(SUNDAR_PICHAI_THOUGHTS).forEach(([key, thoughts]) => {
        thoughts.forEach((thought, i) => {
          expect(thought.trim().length, `${key}[${i}] should not be empty`).toBeGreaterThan(0);
        });
      });
    });

    it('should not have duplicate thoughts within a behavior', () => {
      Object.entries(SUNDAR_PICHAI_THOUGHTS).forEach(([key, thoughts]) => {
        const unique = new Set(thoughts);
        expect(unique.size, `${key} should not have duplicates`).toBe(thoughts.length);
      });
    });
  });

  // ------ Cross-NPC consistency ------

  describe('Cross-NPC consistency', () => {
    it('Steve Jobs and Sundar should both have kitchen thoughts', () => {
      expect(STEVE_JOBS_THOUGHTS).toHaveProperty('visiting_kitchen');
      expect(SUNDAR_PICHAI_THOUGHTS).toHaveProperty('visiting_kitchen');
    });

    it('both NPCs should have walking_to_target thoughts', () => {
      expect(STEVE_JOBS_THOUGHTS).toHaveProperty('walking_to_target');
      expect(SUNDAR_PICHAI_THOUGHTS).toHaveProperty('walking_to_target');
    });

    it('all thought lists should have a combined total exceeding 50 entries', () => {
      const total =
        Object.values(AGENT_THOUGHTS).reduce((sum, arr) => sum + arr.length, 0) +
        Object.values(STEVE_JOBS_THOUGHTS).reduce((sum, arr) => sum + arr.length, 0) +
        Object.values(SUNDAR_PICHAI_THOUGHTS).reduce((sum, arr) => sum + arr.length, 0);
      expect(total).toBeGreaterThan(50);
    });
  });
});
