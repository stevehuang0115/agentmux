/**
 * Tests for entity helper utilities.
 *
 * @module utils/entityHelpers.test
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEntityName,
  isNPC,
  isFakeAudience,
  getNPCIds,
  NameableAgent,
} from './entityHelpers';
import { FACTORY_CONSTANTS } from '../types/factory.types';

describe('entityHelpers', () => {
  describe('resolveEntityName', () => {
    it('should resolve agent name from agents map', () => {
      const agents = new Map<string, NameableAgent>([
        ['agent-1', { name: 'Test Agent', sessionName: 'test-session' }],
      ]);
      expect(resolveEntityName('agent-1', agents)).toBe('Test Agent');
    });

    it('should fall back to sessionName when name is not available', () => {
      const agents = new Map<string, NameableAgent>([
        ['agent-1', { sessionName: 'my-session' }],
      ]);
      expect(resolveEntityName('agent-1', agents)).toBe('my-session');
    });

    it('should fall back to entityId when neither name nor sessionName is available', () => {
      const agents = new Map<string, NameableAgent>([['agent-1', {}]]);
      expect(resolveEntityName('agent-1', agents)).toBe('agent-1');
    });

    it('should resolve Steve Jobs NPC', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS)).toBe(
        'Steve Jobs'
      );
    });

    it('should resolve Sundar Pichai NPC', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.SUNDAR_PICHAI)).toBe(
        'Sundar Pichai'
      );
    });

    it('should resolve Elon Musk NPC', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.ELON_MUSK)).toBe(
        'Elon Musk'
      );
    });

    it('should resolve Mark Zuckerberg NPC', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.MARK_ZUCKERBERG)).toBe(
        'Mark Zuckerberg'
      );
    });

    it('should resolve Jensen Huang NPC', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.JENSEN_HUANG)).toBe(
        'Jensen Huang'
      );
    });

    it('should resolve Steve Huang NPC', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.STEVE_HUANG)).toBe(
        'Steve Huang'
      );
    });

    it('should resolve fake audience member with 1-based index', () => {
      expect(resolveEntityName('fake-audience-0')).toBe('Audience Member 1');
      expect(resolveEntityName('fake-audience-5')).toBe('Audience Member 6');
      expect(resolveEntityName('fake-audience-99')).toBe('Audience Member 100');
    });

    it('should return entityId for unknown entities', () => {
      expect(resolveEntityName('unknown-entity')).toBe('unknown-entity');
    });

    it('should work without agents map', () => {
      expect(resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS)).toBe(
        'Steve Jobs'
      );
    });

    it('should prioritize agent name over NPC name if same id exists in both', () => {
      const agents = new Map<string, NameableAgent>([
        [FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS, { name: 'Custom Name' }],
      ]);
      expect(
        resolveEntityName(FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS, agents)
      ).toBe('Custom Name');
    });
  });

  describe('isNPC', () => {
    it('should return true for known NPC IDs', () => {
      expect(isNPC(FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS)).toBe(true);
      expect(isNPC(FACTORY_CONSTANTS.NPC_IDS.ELON_MUSK)).toBe(true);
      expect(isNPC(FACTORY_CONSTANTS.NPC_IDS.JENSEN_HUANG)).toBe(true);
    });

    it('should return false for non-NPC IDs', () => {
      expect(isNPC('fake-audience-1')).toBe(false);
      expect(isNPC('agent-123')).toBe(false);
      expect(isNPC('unknown')).toBe(false);
    });
  });

  describe('isFakeAudience', () => {
    it('should return true for fake audience pattern', () => {
      expect(isFakeAudience('fake-audience-0')).toBe(true);
      expect(isFakeAudience('fake-audience-5')).toBe(true);
      expect(isFakeAudience('fake-audience-99')).toBe(true);
    });

    it('should return false for non-matching patterns', () => {
      expect(isFakeAudience('fake-audience-')).toBe(false);
      expect(isFakeAudience('fake-audience-abc')).toBe(false);
      expect(isFakeAudience('audience-5')).toBe(false);
      expect(isFakeAudience('steve-jobs-npc')).toBe(false);
    });
  });

  describe('getNPCIds', () => {
    it('should return all NPC IDs', () => {
      const ids = getNPCIds();
      expect(ids).toContain(FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS);
      expect(ids).toContain(FACTORY_CONSTANTS.NPC_IDS.SUNDAR_PICHAI);
      expect(ids).toContain(FACTORY_CONSTANTS.NPC_IDS.ELON_MUSK);
      expect(ids).toContain(FACTORY_CONSTANTS.NPC_IDS.MARK_ZUCKERBERG);
      expect(ids).toContain(FACTORY_CONSTANTS.NPC_IDS.JENSEN_HUANG);
      expect(ids).toContain(FACTORY_CONSTANTS.NPC_IDS.STEVE_HUANG);
    });

    it('should return 6 NPC IDs', () => {
      expect(getNPCIds()).toHaveLength(6);
    });
  });
});
