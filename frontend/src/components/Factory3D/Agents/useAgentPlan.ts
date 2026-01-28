/**
 * useAgentPlan - Hook that manages the plan lifecycle for an agent or NPC.
 *
 * Handles plan generation, step execution, advancement, pausing/resuming
 * for conversations, and stage event reactions. All state lives in refs
 * to avoid re-renders during frame updates.
 */

import { useRef, useCallback, useState } from 'react';
import {
  AgentPlan,
  PlanStep,
  PlanStepType,
  PersonalityWeights,
  STEP_TYPE_TO_SEAT_AREA,
} from './agentPlanTypes.js';
import { generatePlan, PlanGenerationOptions } from './planGenerator.js';

// ====== HOOK RETURN TYPE ======

/**
 * Return value of the useAgentPlan hook
 */
export interface UseAgentPlanReturn {
  /** Ref to the current plan (mutable, no re-renders) */
  planRef: React.MutableRefObject<AgentPlan | null>;
  /**
   * Call each frame to check the current step.
   * Returns the current PlanStep if the plan is active, null if paused/empty.
   */
  getCurrentStep: () => PlanStep | null;
  /**
   * Mark the current step as complete and advance to the next.
   * If the plan is exhausted, generates a new one.
   */
  advanceStep: () => void;
  /**
   * Generate a new plan, replacing the current one.
   * Optionally pass generation options for availability checks.
   */
  newPlan: (options?: PlanGenerationOptions) => void;
  /**
   * Pause the plan (e.g., when a conversation starts).
   * Movement should stop; plan resumes from same step.
   */
  pause: () => void;
  /**
   * Resume the plan after a pause (e.g., conversation ended).
   */
  resume: () => void;
  /**
   * Replace the current plan with a stage-watching plan.
   * Used when a performer is detected on stage.
   */
  interruptForStage: () => void;
  /**
   * Check if the plan is currently paused
   */
  isPaused: () => boolean;
  /**
   * Current step type for display state (uses useState for ThinkingBubble).
   * Only updates when the step type actually changes.
   */
  displayStepType: PlanStepType | null;
  /**
   * Record arrival time for the current step (called when entity reaches target)
   */
  markArrival: (elapsedTime: number) => void;
  /**
   * Check if the current step's duration has elapsed since arrival
   *
   * @param elapsedTime - Current elapsed time from clock
   * @returns true if arrived and duration has passed
   */
  isDurationElapsed: (elapsedTime: number) => boolean;
  /**
   * Get the seat area key for the current step (if it's a seated step)
   */
  getCurrentSeatArea: () => string | null;
  /**
   * Store the previous plan when interrupted by stage events
   */
  savedPlanRef: React.MutableRefObject<AgentPlan | null>;
}

// ====== HOOK IMPLEMENTATION ======

/**
 * Hook managing plan lifecycle for a single entity.
 *
 * @param entityId - Unique ID of the entity (for logging/debugging)
 * @param weights - Personality weight profile controlling plan generation
 * @returns Plan management functions and state
 *
 * @example
 * ```typescript
 * const plan = useAgentPlan('agent-1', WORKER_AGENT_WEIGHTS);
 *
 * useFrame((state) => {
 *   const step = plan.getCurrentStep();
 *   if (!step) return;
 *   // Move toward step.target, play step.arrivalAnimation, etc.
 *   if (arrived && plan.isDurationElapsed(state.clock.elapsedTime)) {
 *     plan.advanceStep();
 *   }
 * });
 * ```
 */
export function useAgentPlan(
  _entityId: string,
  weights: PersonalityWeights
): UseAgentPlanReturn {
  const planRef = useRef<AgentPlan | null>(null);
  const savedPlanRef = useRef<AgentPlan | null>(null);
  const weightsRef = useRef(weights);
  weightsRef.current = weights;

  // Display state - only triggers re-render when step type changes (for ThinkingBubble)
  const [displayStepType, setDisplayStepType] = useState<PlanStepType | null>(null);
  const lastDisplayStepTypeRef = useRef<PlanStepType | null>(null);

  /**
   * Updates the display step type if it has changed
   */
  const updateDisplayState = useCallback((stepType: PlanStepType | null) => {
    if (stepType !== lastDisplayStepTypeRef.current) {
      lastDisplayStepTypeRef.current = stepType;
      setDisplayStepType(stepType);
    }
  }, []);

  /**
   * Generate a new plan from the current weights
   */
  const newPlan = useCallback((options?: PlanGenerationOptions) => {
    const plan = generatePlan(weightsRef.current, options);
    planRef.current = plan;
    if (plan.steps.length > 0) {
      updateDisplayState(plan.steps[0].type);
    }
  }, [updateDisplayState]);

  /**
   * Get the current step of the active plan
   */
  const getCurrentStep = useCallback((): PlanStep | null => {
    const plan = planRef.current;
    if (!plan || plan.paused) return null;
    if (plan.currentStepIndex >= plan.steps.length) return null;
    return plan.steps[plan.currentStepIndex];
  }, []);

  /**
   * Advance to the next step, or generate a new plan if exhausted
   */
  const advanceStep = useCallback(() => {
    const plan = planRef.current;
    if (!plan) {
      newPlan();
      return;
    }

    plan.currentStepIndex++;
    plan.arrivalTime = null;

    if (plan.currentStepIndex >= plan.steps.length) {
      // Plan exhausted - generate new one
      newPlan();
    } else {
      updateDisplayState(plan.steps[plan.currentStepIndex].type);
    }
  }, [newPlan, updateDisplayState]);

  /**
   * Pause the plan (conversation started)
   */
  const pause = useCallback(() => {
    if (planRef.current) {
      planRef.current.paused = true;
    }
  }, []);

  /**
   * Resume the plan (conversation ended)
   */
  const resume = useCallback(() => {
    if (planRef.current) {
      planRef.current.paused = false;
      // Reset arrival time so duration counting restarts
      planRef.current.arrivalTime = null;
    }
  }, []);

  /**
   * Interrupt current plan for stage watching
   */
  const interruptForStage = useCallback(() => {
    // Save current plan if not already saved
    if (planRef.current && !savedPlanRef.current) {
      savedPlanRef.current = { ...planRef.current };
    }

    // Replace with a watch_stage plan
    planRef.current = {
      steps: [{
        type: 'watch_stage',
        duration: Infinity,
      }],
      currentStepIndex: 0,
      paused: false,
      arrivalTime: null,
    };
    updateDisplayState('watch_stage');
  }, [updateDisplayState]);

  /**
   * Check if the plan is paused
   */
  const isPaused = useCallback((): boolean => {
    return planRef.current?.paused ?? false;
  }, []);

  /**
   * Record arrival time for the current step
   */
  const markArrival = useCallback((elapsedTime: number) => {
    if (planRef.current) {
      planRef.current.arrivalTime = elapsedTime;
    }
  }, []);

  /**
   * Check if current step duration has elapsed since arrival
   */
  const isDurationElapsed = useCallback((elapsedTime: number): boolean => {
    const plan = planRef.current;
    if (!plan || plan.arrivalTime === null) return false;
    const step = plan.steps[plan.currentStepIndex];
    if (!step) return false;
    return (elapsedTime - plan.arrivalTime) >= step.duration;
  }, []);

  /**
   * Get the seat area key for the current step
   */
  const getCurrentSeatArea = useCallback((): string | null => {
    const step = getCurrentStep();
    if (!step) return null;
    return STEP_TYPE_TO_SEAT_AREA[step.type] ?? null;
  }, [getCurrentStep]);

  return {
    planRef,
    getCurrentStep,
    advanceStep,
    newPlan,
    pause,
    resume,
    interruptForStage,
    isPaused,
    displayStepType,
    markArrival,
    isDurationElapsed,
    getCurrentSeatArea,
    savedPlanRef,
  };
}
