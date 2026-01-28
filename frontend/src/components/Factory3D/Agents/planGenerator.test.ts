/**
 * Tests for planGenerator - validates plan generation, weighted selection, and filtering
 */

import { describe, it, expect } from 'vitest';
import {
  generatePlan,
  weightedRandomSelect,
  getEligibleSteps,
  getRandomDuration,
  SEAT_CAPACITY,
} from './planGenerator';
import {
  WORKER_AGENT_WEIGHTS,
  STEVE_JOBS_WEIGHTS,
  SUNDAR_PICHAI_WEIGHTS,
  FAKE_AUDIENCE_WEIGHTS,
  PersonalityWeights,
  STEP_DURATION_RANGES,
  WEIGHT_KEY_TO_STEP_TYPE,
} from './agentPlanTypes';

describe('planGenerator', () => {
  describe('weightedRandomSelect', () => {
    it('should return null for empty entries', () => {
      expect(weightedRandomSelect([])).toBeNull();
    });

    it('should return null for all-zero weights', () => {
      expect(weightedRandomSelect([['a', 0], ['b', 0]])).toBeNull();
    });

    it('should return the only entry if single entry', () => {
      expect(weightedRandomSelect([['only', 10]])).toBe('only');
    });

    it('should return one of the entries', () => {
      const result = weightedRandomSelect([['a', 50], ['b', 50]]);
      expect(['a', 'b']).toContain(result);
    });

    it('should heavily favor high-weight entries over many iterations', () => {
      let highCount = 0;
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        const result = weightedRandomSelect([['high', 99], ['low', 1]]);
        if (result === 'high') highCount++;
      }
      // Expect high to win at least 90% of the time
      expect(highCount / iterations).toBeGreaterThan(0.9);
    });
  });

  describe('getEligibleSteps', () => {
    it('should exclude zero-weight steps', () => {
      const weights: PersonalityWeights = {
        kitchen: 10,
        couch: 0,
        break_room: 0,
        poker_table: 0,
        stage: 0,
        watch_stage: 0,
        wander: 10,
      };
      const eligible = getEligibleSteps(weights, null, {});
      const keys = eligible.map(([k]) => k);
      expect(keys).toContain('kitchen');
      expect(keys).toContain('wander');
      expect(keys).not.toContain('couch');
      expect(keys).not.toContain('stage');
    });

    it('should exclude the previous step type (no consecutive duplicates)', () => {
      const eligible = getEligibleSteps(WORKER_AGENT_WEIGHTS, 'wander', {});
      const types = eligible.map(([k]) => WEIGHT_KEY_TO_STEP_TYPE[k]);
      expect(types).not.toContain('wander');
    });

    it('should exclude stage when occupied', () => {
      const eligible = getEligibleSteps(WORKER_AGENT_WEIGHTS, null, {
        stageOccupied: true,
      });
      const types = eligible.map(([k]) => WEIGHT_KEY_TO_STEP_TYPE[k]);
      expect(types).not.toContain('go_to_stage');
    });

    it('should exclude full seated areas', () => {
      const eligible = getEligibleSteps(WORKER_AGENT_WEIGHTS, null, {
        seatOccupancy: {
          couch: 2,
          break_room: 4,
          poker_table: 4,
          kitchen: 5,
        },
      });
      const types = eligible.map(([k]) => WEIGHT_KEY_TO_STEP_TYPE[k]);
      expect(types).not.toContain('go_to_couch');
      expect(types).not.toContain('go_to_break_room');
      expect(types).not.toContain('go_to_poker_table');
      expect(types).not.toContain('go_to_kitchen');
    });

    it('should include NPC-only steps when weights provided', () => {
      const eligible = getEligibleSteps(STEVE_JOBS_WEIGHTS, null, {});
      const keys = eligible.map(([k]) => k);
      expect(keys).toContain('check_agent');
    });

    it('should include sundar-specific steps', () => {
      const eligible = getEligibleSteps(SUNDAR_PICHAI_WEIGHTS, null, {});
      const keys = eligible.map(([k]) => k);
      expect(keys).toContain('check_agent');
      expect(keys).toContain('present');
      expect(keys).toContain('walk_circle');
    });
  });

  describe('getRandomDuration', () => {
    it('should return duration within the defined range', () => {
      for (let i = 0; i < 100; i++) {
        const duration = getRandomDuration('wander');
        const [min, max] = STEP_DURATION_RANGES['wander'];
        expect(duration).toBeGreaterThanOrEqual(min);
        expect(duration).toBeLessThanOrEqual(max);
      }
    });

    it('should produce different durations (not always the same)', () => {
      const durations = new Set<number>();
      for (let i = 0; i < 50; i++) {
        durations.add(Math.round(getRandomDuration('go_to_kitchen') * 100));
      }
      // Should have at least 2 different values
      expect(durations.size).toBeGreaterThan(1);
    });
  });

  describe('generatePlan', () => {
    it('should generate a plan with 2-5 steps by default', () => {
      for (let i = 0; i < 50; i++) {
        const plan = generatePlan(WORKER_AGENT_WEIGHTS);
        expect(plan.steps.length).toBeGreaterThanOrEqual(2);
        expect(plan.steps.length).toBeLessThanOrEqual(5);
      }
    });

    it('should respect custom step count range', () => {
      for (let i = 0; i < 50; i++) {
        const plan = generatePlan(WORKER_AGENT_WEIGHTS, { stepCount: [3, 3] });
        expect(plan.steps).toHaveLength(3);
      }
    });

    it('should initialize plan with correct defaults', () => {
      const plan = generatePlan(WORKER_AGENT_WEIGHTS);
      expect(plan.currentStepIndex).toBe(0);
      expect(plan.paused).toBe(false);
      expect(plan.arrivalTime).toBeNull();
    });

    it('should not have consecutive duplicate step types', () => {
      for (let i = 0; i < 100; i++) {
        const plan = generatePlan(WORKER_AGENT_WEIGHTS);
        for (let j = 1; j < plan.steps.length; j++) {
          expect(plan.steps[j].type).not.toBe(plan.steps[j - 1].type);
        }
      }
    });

    it('should assign durations within valid ranges', () => {
      const plan = generatePlan(WORKER_AGENT_WEIGHTS);
      for (const step of plan.steps) {
        const [min, max] = STEP_DURATION_RANGES[step.type];
        expect(step.duration).toBeGreaterThanOrEqual(min);
        expect(step.duration).toBeLessThanOrEqual(max);
      }
    });

    it('should not include stage step when stage is occupied', () => {
      for (let i = 0; i < 100; i++) {
        const plan = generatePlan(WORKER_AGENT_WEIGHTS, { stageOccupied: true });
        const hasStage = plan.steps.some(s => s.type === 'go_to_stage');
        expect(hasStage).toBe(false);
      }
    });

    it('should generate valid plans for NPC weights', () => {
      const stevePlan = generatePlan(STEVE_JOBS_WEIGHTS);
      expect(stevePlan.steps.length).toBeGreaterThanOrEqual(2);

      const sundarPlan = generatePlan(SUNDAR_PICHAI_WEIGHTS);
      expect(sundarPlan.steps.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate valid plans for audience weights', () => {
      const plan = generatePlan(FAKE_AUDIENCE_WEIGHTS);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle case where all specific destinations are full', () => {
      const plan = generatePlan(WORKER_AGENT_WEIGHTS, {
        stageOccupied: true,
        seatOccupancy: {
          couch: 2,
          break_room: 4,
          poker_table: 4,
          kitchen: 5,
        },
      });
      // Should still generate a plan (with wander and watch_stage)
      expect(plan.steps.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate at least one step even with minimal options', () => {
      const minimalWeights: PersonalityWeights = {
        kitchen: 0,
        couch: 0,
        break_room: 0,
        poker_table: 0,
        stage: 0,
        watch_stage: 0,
        wander: 1,
      };
      const plan = generatePlan(minimalWeights);
      expect(plan.steps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('SEAT_CAPACITY', () => {
    it('should have correct capacities for all areas', () => {
      expect(SEAT_CAPACITY['couch']).toBe(2);
      expect(SEAT_CAPACITY['break_room']).toBe(4);
      expect(SEAT_CAPACITY['poker_table']).toBe(4);
      expect(SEAT_CAPACITY['kitchen']).toBe(5);
    });
  });
});
