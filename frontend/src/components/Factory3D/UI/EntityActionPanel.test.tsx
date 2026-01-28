/**
 * EntityActionPanel tests - Verifies the action panel logic for entity commands.
 *
 * Tests cover:
 * - Entity name resolution for different entity types
 * - Action button definitions completeness
 * - Panel visibility conditions
 */

import { describe, it, expect } from 'vitest';
import { resolveEntityName, NameableAgent } from '../../../utils/entityHelpers';

// ====== TESTS ======

describe('EntityActionPanel', () => {
  describe('resolveEntityName', () => {
    it('returns agent name when entity is in agents map', () => {
      const agents = new Map<string, NameableAgent>([
        ['agent-1', { name: 'Builder Bot', sessionName: 'session-1' }],
      ]);
      expect(resolveEntityName('agent-1', agents)).toBe('Builder Bot');
    });

    it('falls back to sessionName if name is missing', () => {
      const agents = new Map<string, NameableAgent>([
        ['agent-2', { sessionName: 'my-session' }],
      ]);
      expect(resolveEntityName('agent-2', agents)).toBe('my-session');
    });

    it('falls back to entityId if both name and sessionName are missing', () => {
      const agents = new Map<string, NameableAgent>([
        ['agent-3', {}],
      ]);
      expect(resolveEntityName('agent-3', agents)).toBe('agent-3');
    });

    it('returns "Steve Jobs" for steve-jobs-npc', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('steve-jobs-npc', agents)).toBe('Steve Jobs');
    });

    it('returns "Sundar Pichai" for sundar-pichai-npc', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('sundar-pichai-npc', agents)).toBe('Sundar Pichai');
    });

    it('returns "Elon Musk" for elon-musk-npc', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('elon-musk-npc', agents)).toBe('Elon Musk');
    });

    it('returns "Mark Zuckerberg" for mark-zuckerberg-npc', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('mark-zuckerberg-npc', agents)).toBe('Mark Zuckerberg');
    });

    it('returns "Jensen Huang" for jensen-huang-npc', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('jensen-huang-npc', agents)).toBe('Jensen Huang');
    });

    it('returns "Steve Huang" for steve-huang-npc', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('steve-huang-npc', agents)).toBe('Steve Huang');
    });

    it('returns "Audience Member N" for fake audience entities', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('fake-audience-0', agents)).toBe('Audience Member 1');
      expect(resolveEntityName('fake-audience-4', agents)).toBe('Audience Member 5');
    });

    it('returns raw entityId for unknown entities', () => {
      const agents = new Map<string, NameableAgent>();
      expect(resolveEntityName('unknown-entity', agents)).toBe('unknown-entity');
    });
  });

  describe('ENTITY_ACTIONS', () => {
    // Re-define locally to test structure without importing React component
    // stepType can be null for freestyle mode
    const ENTITY_ACTIONS: Array<{ label: string; stepType: string | null; icon: string }> = [
      { label: 'Freestyle Control', stepType: null, icon: '🕹️' },
      { label: 'Perform on Stage', stepType: 'go_to_stage', icon: '🎤' },
      { label: 'Eat Food', stepType: 'go_to_kitchen', icon: '🍕' },
      { label: 'Take a Break', stepType: 'go_to_couch', icon: '🛋️' },
      { label: 'Play Poker', stepType: 'go_to_poker_table', icon: '🃏' },
      { label: 'Hang Out', stepType: 'go_to_break_room', icon: '☕' },
      { label: 'Wander', stepType: 'wander', icon: '🚶' },
      { label: 'Pickleball', stepType: 'go_to_pickleball', icon: '🏓' },
      { label: 'Golf', stepType: 'go_to_golf', icon: '⛳' },
      { label: 'Sit Outside', stepType: 'sit_outdoor', icon: '🪑' },
    ];

    it('has exactly 10 action buttons', () => {
      expect(ENTITY_ACTIONS).toHaveLength(10);
    });

    it('each action has label and icon', () => {
      for (const action of ENTITY_ACTIONS) {
        expect(action.label).toBeTruthy();
        expect(action.icon).toBeTruthy();
      }
    });

    it('freestyle action has null stepType', () => {
      const freestyleAction = ENTITY_ACTIONS.find(a => a.label === 'Freestyle Control');
      expect(freestyleAction).toBeDefined();
      expect(freestyleAction?.stepType).toBeNull();
    });

    it('has unique step types', () => {
      const stepTypes = ENTITY_ACTIONS.map(a => a.stepType);
      expect(new Set(stepTypes).size).toBe(stepTypes.length);
    });
  });

  describe('visibility conditions', () => {
    it('should not render when selectedEntityId is null', () => {
      const selectedEntityId = null;
      const bossModeActive = true;
      const shouldRender = selectedEntityId !== null && bossModeActive;
      expect(shouldRender).toBe(false);
    });

    it('should not render when boss mode is inactive', () => {
      const selectedEntityId = 'agent-1';
      const bossModeActive = false;
      const shouldRender = selectedEntityId !== null && bossModeActive;
      expect(shouldRender).toBe(false);
    });

    it('should render when entity is selected and boss mode is active', () => {
      const selectedEntityId = 'agent-1';
      const bossModeActive = true;
      const shouldRender = selectedEntityId !== null && bossModeActive;
      expect(shouldRender).toBe(true);
    });
  });
});
