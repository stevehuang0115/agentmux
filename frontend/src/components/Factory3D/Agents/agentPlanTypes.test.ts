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
  FAKE_AUDIENCE_WEIGHTS,
  STEP_DURATION_RANGES,
  WEIGHT_KEY_TO_STEP_TYPE,
  SEATED_STEP_TYPES,
  STEP_TYPE_TO_SEAT_AREA,
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

  describe('STEP_DURATION_RANGES', () => {
    it('should have ranges for all step types', () => {
      const allTypes: PlanStepType[] = [
        'go_to_workstation', 'go_to_kitchen', 'go_to_couch', 'go_to_break_room',
        'go_to_poker_table', 'go_to_stage', 'watch_stage', 'wander',
        'check_agent', 'present', 'walk_circle',
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
