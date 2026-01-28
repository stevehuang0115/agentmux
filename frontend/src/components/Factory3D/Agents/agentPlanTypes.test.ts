/**
 * Tests for agentPlanTypes - validates type exports and personality weight constants
 */

import { describe, it, expect } from 'vitest';
import {
  PlanStepType,
  PlanStep,
  AgentPlan,
  PersonalityWeights,
  WORKER_AGENT_WEIGHTS,
  STEVE_JOBS_WEIGHTS,
  SUNDAR_PICHAI_WEIGHTS,
  ELON_MUSK_WEIGHTS,
  MARK_ZUCKERBERG_WEIGHTS,
  JENSEN_HUANG_WEIGHTS,
  STEVE_HUANG_WEIGHTS,
  FAKE_AUDIENCE_WEIGHTS,
  STEP_DURATION_RANGES,
  WEIGHT_KEY_TO_STEP_TYPE,
  SEATED_STEP_TYPES,
  STEP_TYPE_TO_SEAT_AREA,
  OUTDOOR_STEP_TYPES,
} from './agentPlanTypes';

describe('agentPlanTypes', () => {
  describe('WORKER_AGENT_WEIGHTS', () => {
    it('should have positive weights for all common activities', () => {
      expect(WORKER_AGENT_WEIGHTS.kitchen).toBeGreaterThan(0);
      expect(WORKER_AGENT_WEIGHTS.couch).toBeGreaterThan(0);
      expect(WORKER_AGENT_WEIGHTS.break_room).toBeGreaterThan(0);
      expect(WORKER_AGENT_WEIGHTS.poker_table).toBeGreaterThan(0);
      expect(WORKER_AGENT_WEIGHTS.wander).toBeGreaterThan(0);
      expect(WORKER_AGENT_WEIGHTS.watch_stage).toBeGreaterThan(0);
    });

    it('should have stage weight for performance', () => {
      expect(WORKER_AGENT_WEIGHTS.stage).toBeGreaterThan(0);
    });

    it('should not have NPC-only weights', () => {
      expect(WORKER_AGENT_WEIGHTS.check_agent).toBeUndefined();
      expect(WORKER_AGENT_WEIGHTS.present).toBeUndefined();
      expect(WORKER_AGENT_WEIGHTS.walk_circle).toBeUndefined();
    });
  });

  describe('STEVE_JOBS_WEIGHTS', () => {
    it('should have check_agent as the highest weight', () => {
      const weights = STEVE_JOBS_WEIGHTS;
      expect(weights.check_agent).toBeDefined();
      expect(weights.check_agent).toBeGreaterThan(weights.kitchen);
      expect(weights.check_agent).toBeGreaterThan(weights.wander);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(STEVE_JOBS_WEIGHTS.stage).toBe(0);
    });

    it('should not have present or walk_circle', () => {
      expect(STEVE_JOBS_WEIGHTS.present).toBeUndefined();
      expect(STEVE_JOBS_WEIGHTS.walk_circle).toBeUndefined();
    });
  });

  describe('SUNDAR_PICHAI_WEIGHTS', () => {
    it('should have check_agent, present, and walk_circle weights', () => {
      expect(SUNDAR_PICHAI_WEIGHTS.check_agent).toBeGreaterThan(0);
      expect(SUNDAR_PICHAI_WEIGHTS.present).toBeGreaterThan(0);
      expect(SUNDAR_PICHAI_WEIGHTS.walk_circle).toBeGreaterThan(0);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(SUNDAR_PICHAI_WEIGHTS.stage).toBe(0);
    });
  });

  describe('FAKE_AUDIENCE_WEIGHTS', () => {
    it('should have wander as the highest weight', () => {
      const weights = FAKE_AUDIENCE_WEIGHTS;
      expect(weights.wander).toBeGreaterThan(weights.kitchen);
      expect(weights.wander).toBeGreaterThan(weights.couch);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(FAKE_AUDIENCE_WEIGHTS.stage).toBe(0);
    });

    it('should not have NPC-only weights', () => {
      expect(FAKE_AUDIENCE_WEIGHTS.check_agent).toBeUndefined();
      expect(FAKE_AUDIENCE_WEIGHTS.present).toBeUndefined();
    });
  });

  describe('ELON_MUSK_WEIGHTS', () => {
    it('should have check_agent and outdoor weights', () => {
      expect(ELON_MUSK_WEIGHTS.check_agent).toBeGreaterThan(0);
      expect(ELON_MUSK_WEIGHTS.pickleball).toBeGreaterThan(0);
      expect(ELON_MUSK_WEIGHTS.golf).toBeGreaterThan(0);
      expect(ELON_MUSK_WEIGHTS.sit_outdoor).toBeGreaterThan(0);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(ELON_MUSK_WEIGHTS.stage).toBe(0);
    });
  });

  describe('MARK_ZUCKERBERG_WEIGHTS', () => {
    it('should have check_agent and golf as top activities', () => {
      expect(MARK_ZUCKERBERG_WEIGHTS.check_agent).toBeGreaterThan(0);
      expect(MARK_ZUCKERBERG_WEIGHTS.golf).toBeGreaterThan(0);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(MARK_ZUCKERBERG_WEIGHTS.stage).toBe(0);
    });
  });

  describe('JENSEN_HUANG_WEIGHTS', () => {
    it('should have check_agent as highest weight', () => {
      expect(JENSEN_HUANG_WEIGHTS.check_agent).toBeGreaterThan(JENSEN_HUANG_WEIGHTS.kitchen);
      expect(JENSEN_HUANG_WEIGHTS.check_agent).toBeGreaterThan(JENSEN_HUANG_WEIGHTS.wander);
    });

    it('should have present weight for presentations', () => {
      expect(JENSEN_HUANG_WEIGHTS.present).toBeGreaterThan(0);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(JENSEN_HUANG_WEIGHTS.stage).toBe(0);
    });
  });

  describe('STEVE_HUANG_WEIGHTS', () => {
    it('should have golf as a top outdoor activity', () => {
      expect(STEVE_HUANG_WEIGHTS.golf).toBeGreaterThan(STEVE_HUANG_WEIGHTS.kitchen);
    });

    it('should have check_agent weight', () => {
      expect(STEVE_HUANG_WEIGHTS.check_agent).toBeGreaterThan(0);
    });

    it('should not perform on stage (weight 0)', () => {
      expect(STEVE_HUANG_WEIGHTS.stage).toBe(0);
    });
  });

  describe('all NPC weights should have required base fields', () => {
    const allWeights: [string, PersonalityWeights][] = [
      ['ELON_MUSK', ELON_MUSK_WEIGHTS],
      ['MARK_ZUCKERBERG', MARK_ZUCKERBERG_WEIGHTS],
      ['JENSEN_HUANG', JENSEN_HUANG_WEIGHTS],
      ['STEVE_HUANG', STEVE_HUANG_WEIGHTS],
    ];

    for (const [name, weights] of allWeights) {
      it(`${name} should have all required base weight fields`, () => {
        expect(weights.kitchen).toBeDefined();
        expect(weights.couch).toBeDefined();
        expect(weights.break_room).toBeDefined();
        expect(weights.poker_table).toBeDefined();
        expect(weights.stage).toBeDefined();
        expect(weights.watch_stage).toBeDefined();
        expect(weights.wander).toBeDefined();
      });
    }
  });

  describe('STEP_DURATION_RANGES', () => {
    it('should have ranges for all step types', () => {
      const allTypes: PlanStepType[] = [
        'go_to_workstation', 'go_to_kitchen', 'go_to_couch', 'go_to_break_room',
        'go_to_poker_table', 'go_to_stage', 'watch_stage', 'wander',
        'check_agent', 'present', 'walk_circle',
        'go_to_pickleball', 'go_to_golf', 'sit_outdoor',
      ];

      for (const type of allTypes) {
        expect(STEP_DURATION_RANGES[type]).toBeDefined();
        const [min, max] = STEP_DURATION_RANGES[type];
        expect(min).toBeGreaterThan(0);
        expect(max).toBeGreaterThan(min);
      }
    });
  });

  describe('WEIGHT_KEY_TO_STEP_TYPE', () => {
    it('should map all weight keys to valid step types', () => {
      expect(WEIGHT_KEY_TO_STEP_TYPE['kitchen']).toBe('go_to_kitchen');
      expect(WEIGHT_KEY_TO_STEP_TYPE['couch']).toBe('go_to_couch');
      expect(WEIGHT_KEY_TO_STEP_TYPE['break_room']).toBe('go_to_break_room');
      expect(WEIGHT_KEY_TO_STEP_TYPE['poker_table']).toBe('go_to_poker_table');
      expect(WEIGHT_KEY_TO_STEP_TYPE['stage']).toBe('go_to_stage');
      expect(WEIGHT_KEY_TO_STEP_TYPE['watch_stage']).toBe('watch_stage');
      expect(WEIGHT_KEY_TO_STEP_TYPE['wander']).toBe('wander');
      expect(WEIGHT_KEY_TO_STEP_TYPE['check_agent']).toBe('check_agent');
      expect(WEIGHT_KEY_TO_STEP_TYPE['present']).toBe('present');
      expect(WEIGHT_KEY_TO_STEP_TYPE['walk_circle']).toBe('walk_circle');
    });

    it('should map outdoor weight keys to valid step types', () => {
      expect(WEIGHT_KEY_TO_STEP_TYPE['pickleball']).toBe('go_to_pickleball');
      expect(WEIGHT_KEY_TO_STEP_TYPE['golf']).toBe('go_to_golf');
      expect(WEIGHT_KEY_TO_STEP_TYPE['sit_outdoor']).toBe('sit_outdoor');
    });
  });

  describe('OUTDOOR_STEP_TYPES', () => {
    it('should contain all outdoor step types', () => {
      expect(OUTDOOR_STEP_TYPES.has('go_to_pickleball')).toBe(true);
      expect(OUTDOOR_STEP_TYPES.has('go_to_golf')).toBe(true);
      expect(OUTDOOR_STEP_TYPES.has('sit_outdoor')).toBe(true);
    });

    it('should not contain indoor step types', () => {
      expect(OUTDOOR_STEP_TYPES.has('wander')).toBe(false);
      expect(OUTDOOR_STEP_TYPES.has('go_to_kitchen')).toBe(false);
      expect(OUTDOOR_STEP_TYPES.has('go_to_stage')).toBe(false);
    });

    it('should have exactly 3 outdoor types', () => {
      expect(OUTDOOR_STEP_TYPES.size).toBe(3);
    });
  });

  describe('SEATED_STEP_TYPES', () => {
    it('should include all seated area step types', () => {
      expect(SEATED_STEP_TYPES).toContain('go_to_couch');
      expect(SEATED_STEP_TYPES).toContain('go_to_break_room');
      expect(SEATED_STEP_TYPES).toContain('go_to_poker_table');
      expect(SEATED_STEP_TYPES).toContain('go_to_kitchen');
    });

    it('should not include non-seated types', () => {
      expect(SEATED_STEP_TYPES).not.toContain('wander');
      expect(SEATED_STEP_TYPES).not.toContain('go_to_stage');
    });
  });

  describe('STEP_TYPE_TO_SEAT_AREA', () => {
    it('should map seated step types to area keys', () => {
      expect(STEP_TYPE_TO_SEAT_AREA['go_to_couch']).toBe('couch');
      expect(STEP_TYPE_TO_SEAT_AREA['go_to_break_room']).toBe('break_room');
      expect(STEP_TYPE_TO_SEAT_AREA['go_to_poker_table']).toBe('poker_table');
      expect(STEP_TYPE_TO_SEAT_AREA['go_to_kitchen']).toBe('kitchen');
    });

    it('should not map non-seated types', () => {
      expect(STEP_TYPE_TO_SEAT_AREA['wander']).toBeUndefined();
      expect(STEP_TYPE_TO_SEAT_AREA['go_to_stage']).toBeUndefined();
    });
  });

  describe('type structure validation', () => {
    it('should create valid PlanStep objects', () => {
      const step: PlanStep = {
        type: 'wander',
        duration: 5,
      };
      expect(step.type).toBe('wander');
      expect(step.duration).toBe(5);
      expect(step.target).toBeUndefined();
    });

    it('should create valid PlanStep with all optional fields', () => {
      const step: PlanStep = {
        type: 'go_to_couch',
        target: { x: 10, z: 5 },
        duration: 15,
        arrivalAnimation: 'Sitting',
        arrivalRotation: Math.PI / 2,
        arrivalY: 0.35,
        seatIndex: 1,
      };
      expect(step.target).toEqual({ x: 10, z: 5 });
      expect(step.arrivalY).toBe(0.35);
    });

    it('should create valid AgentPlan objects', () => {
      const plan: AgentPlan = {
        steps: [
          { type: 'wander', duration: 5 },
          { type: 'go_to_kitchen', duration: 10 },
        ],
        currentStepIndex: 0,
        paused: false,
        arrivalTime: null,
      };
      expect(plan.steps).toHaveLength(2);
      expect(plan.currentStepIndex).toBe(0);
      expect(plan.paused).toBe(false);
    });
  });
});
