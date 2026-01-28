/**
 * Tests for useAgentPlan hook - validates plan lifecycle management
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentPlan } from './useAgentPlan';
import { WORKER_AGENT_WEIGHTS } from './agentPlanTypes';

/** Helper to safely access plan from ref */
function getPlan(result: { current: ReturnType<typeof useAgentPlan> }) {
  const plan = result.current.planRef.current;
  if (!plan) throw new Error('Expected plan to exist');
  return plan;
}

/** Helper to safely access saved plan from ref */
function getSavedPlan(result: { current: ReturnType<typeof useAgentPlan> }) {
  const plan = result.current.savedPlanRef.current;
  if (!plan) throw new Error('Expected saved plan to exist');
  return plan;
}

describe('useAgentPlan', () => {
  describe('initialization', () => {
    it('should start with no plan', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );
      expect(result.current.planRef.current).toBeNull();
      expect(result.current.displayStepType).toBeNull();
    });

    it('should not be paused initially', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );
      expect(result.current.isPaused()).toBe(false);
    });
  });

  describe('newPlan', () => {
    it('should generate a new plan', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
      });

      expect(result.current.planRef.current).not.toBeNull();
      const plan = getPlan(result);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    });

    it('should set displayStepType to first step type', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
      });

      const plan = getPlan(result);
      const firstStepType = plan.steps[0].type;
      expect(result.current.displayStepType).toBe(firstStepType);
    });

    it('should pass options to plan generator', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan({ stageOccupied: true });
      });

      const plan = getPlan(result);
      const hasStage = plan.steps.some(
        (s) => s.type === 'go_to_stage'
      );
      expect(hasStage).toBe(false);
    });
  });

  describe('getCurrentStep', () => {
    it('should return null when no plan exists', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );
      expect(result.current.getCurrentStep()).toBeNull();
    });

    it('should return the first step after plan generation', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
      });

      const step = result.current.getCurrentStep();
      expect(step).not.toBeNull();
      const plan = getPlan(result);
      expect(step && step.type).toBe(plan.steps[0].type);
    });

    it('should return null when paused', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.pause();
      });

      expect(result.current.getCurrentStep()).toBeNull();
    });
  });

  describe('advanceStep', () => {
    it('should advance to next step', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
      });

      const plan = getPlan(result);
      const secondType = plan.steps[1]?.type;

      act(() => {
        result.current.advanceStep();
      });

      if (secondType) {
        const updatedPlan = getPlan(result);
        expect(updatedPlan.currentStepIndex).toBe(1);
      }
    });

    it('should generate new plan when current plan is exhausted', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan({ stepCount: [2, 2] });
      });

      act(() => {
        result.current.advanceStep();
        result.current.advanceStep();
      });

      // After exhausting the plan, a new one should be generated
      expect(result.current.planRef.current).not.toBeNull();
      const plan = getPlan(result);
      expect(plan.currentStepIndex).toBe(0);
    });

    it('should generate new plan if no plan exists', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.advanceStep();
      });

      expect(result.current.planRef.current).not.toBeNull();
    });
  });

  describe('pause and resume', () => {
    it('should pause the plan', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.pause();
      });

      expect(result.current.isPaused()).toBe(true);
      expect(result.current.getCurrentStep()).toBeNull();
    });

    it('should resume the plan', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.pause();
        result.current.resume();
      });

      expect(result.current.isPaused()).toBe(false);
      expect(result.current.getCurrentStep()).not.toBeNull();
    });

    it('should reset arrival time on resume', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.markArrival(10);
        result.current.pause();
        result.current.resume();
      });

      const plan = getPlan(result);
      expect(plan.arrivalTime).toBeNull();
    });
  });

  describe('interruptForStage', () => {
    it('should replace current plan with watch_stage', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.interruptForStage();
      });

      const step = result.current.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step && step.type).toBe('watch_stage');
      expect(step && step.duration).toBe(Infinity);
    });

    it('should save the previous plan', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
      });

      const plan = getPlan(result);
      const originalPlanSteps = plan.steps.length;

      act(() => {
        result.current.interruptForStage();
      });

      expect(result.current.savedPlanRef.current).not.toBeNull();
      const savedPlan = getSavedPlan(result);
      expect(savedPlan.steps.length).toBe(originalPlanSteps);
    });

    it('should update display step type to watch_stage', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.interruptForStage();
      });

      expect(result.current.displayStepType).toBe('watch_stage');
    });
  });

  describe('markArrival and isDurationElapsed', () => {
    it('should not consider duration elapsed before marking arrival', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
      });

      expect(result.current.isDurationElapsed(1000)).toBe(false);
    });

    it('should correctly detect elapsed duration', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );

      act(() => {
        result.current.newPlan();
        result.current.markArrival(10);
      });

      const plan = getPlan(result);
      const step = plan.steps[0];
      // Not elapsed yet
      expect(result.current.isDurationElapsed(10 + step.duration - 1)).toBe(false);
      // Elapsed
      expect(result.current.isDurationElapsed(10 + step.duration + 1)).toBe(true);
    });
  });

  describe('getCurrentSeatArea', () => {
    it('should return null when no plan exists', () => {
      const { result } = renderHook(() =>
        useAgentPlan('test-agent', WORKER_AGENT_WEIGHTS)
      );
      expect(result.current.getCurrentSeatArea()).toBeNull();
    });
  });
});
