/**
 * Plan Generator - Pure function that creates multi-step plans for agents/NPCs.
 *
 * Generates 2-5 step plans based on personality weight profiles.
 * Plans never repeat the same step type consecutively and respect
 * seat availability and stage occupancy.
 */

import {
  PlanStep,
  PlanStepType,
  AgentPlan,
  PersonalityWeights,
  STEP_DURATION_RANGES,
  WEIGHT_KEY_TO_STEP_TYPE,
} from './agentPlanTypes.js';

// ====== SEAT CAPACITY LIMITS ======

/** Maximum number of entities per seated area */
export const SEAT_CAPACITY: Record<string, number> = {
  couch: 2,
  break_room: 4,
  poker_table: 4,
  kitchen: 5,
} as const;

// ====== PLAN GENERATION OPTIONS ======

/**
 * Options for plan generation controlling constraints
 */
export interface PlanGenerationOptions {
  /** Min and max number of steps [min, max], default [2, 5] */
  stepCount?: [number, number];
  /** Whether the stage is currently occupied by a performer */
  stageOccupied?: boolean;
  /** Map of area name to number of occupied seats */
  seatOccupancy?: Record<string, number>;
}

// ====== WEIGHTED RANDOM SELECTION ======

/**
 * Selects a random item from a weighted list.
 * Each entry has a weight; higher weight = higher probability.
 *
 * @param entries - Array of [key, weight] pairs
 * @returns The selected key, or null if no valid entries
 */
export function weightedRandomSelect(entries: Array<[string, number]>): string | null {
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return null;

  let roll = Math.random() * totalWeight;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  // Fallback to last entry (floating point edge case)
  return entries[entries.length - 1]?.[0] ?? null;
}

// ====== STEP FILTERING ======

/**
 * Builds the list of eligible weight entries, filtering out:
 * - Steps with zero weight
 * - The previous step type (no consecutive duplicates)
 * - Stage if occupied
 * - Seated areas that are full
 *
 * @param weights - Personality weight profile
 * @param previousStepType - The type of the previous step (null for first step)
 * @param options - Generation options with availability info
 * @returns Filtered array of [weightKey, weight] pairs
 */
export function getEligibleSteps(
  weights: PersonalityWeights,
  previousStepType: PlanStepType | null,
  options: PlanGenerationOptions
): Array<[string, number]> {
  const entries: Array<[string, number]> = [];
  const allKeys = Object.keys(weights) as Array<keyof PersonalityWeights>;

  for (const key of allKeys) {
    const weight = weights[key];
    if (weight === undefined || weight <= 0) continue;

    const stepType = WEIGHT_KEY_TO_STEP_TYPE[key];
    if (!stepType) continue;

    // No consecutive duplicates
    if (stepType === previousStepType) continue;

    // Skip stage if occupied
    if (stepType === 'go_to_stage' && options.stageOccupied) continue;

    // Skip seated areas that are full
    if (stepType === 'go_to_couch' && isAreaFull('couch', options)) continue;
    if (stepType === 'go_to_break_room' && isAreaFull('break_room', options)) continue;
    if (stepType === 'go_to_poker_table' && isAreaFull('poker_table', options)) continue;
    if (stepType === 'go_to_kitchen' && isAreaFull('kitchen', options)) continue;

    entries.push([key, weight]);
  }

  return entries;
}

/**
 * Checks whether a seated area is at capacity
 *
 * @param area - The area key (couch, break_room, poker_table, kitchen)
 * @param options - Plan generation options containing seat occupancy
 * @returns true if the area is full
 */
function isAreaFull(area: string, options: PlanGenerationOptions): boolean {
  if (!options.seatOccupancy) return false;
  const occupied = options.seatOccupancy[area] ?? 0;
  const capacity = SEAT_CAPACITY[area] ?? 0;
  return occupied >= capacity;
}

// ====== DURATION GENERATION ======

/**
 * Generates a random duration for a plan step within its defined range
 *
 * @param stepType - The type of step to get duration for
 * @returns Duration in seconds
 */
export function getRandomDuration(stepType: PlanStepType): number {
  const range = STEP_DURATION_RANGES[stepType];
  return range[0] + Math.random() * (range[1] - range[0]);
}

// ====== PLAN GENERATION ======

/**
 * Generates a multi-step plan for an entity based on its personality weights.
 *
 * Creates 2-5 steps by weighted random selection, ensuring no consecutive
 * duplicate step types. Respects stage occupancy and seat availability.
 *
 * @param weights - Personality weight profile controlling step frequency
 * @param options - Generation options (step count range, availability info)
 * @returns A new AgentPlan with steps ready for execution
 *
 * @example
 * ```typescript
 * const plan = generatePlan(WORKER_AGENT_WEIGHTS, {
 *   stageOccupied: true,
 *   seatOccupancy: { couch: 2, break_room: 1 },
 * });
 * // plan.steps might be: [wander, go_to_kitchen, go_to_break_room]
 * ```
 */
export function generatePlan(
  weights: PersonalityWeights,
  options: PlanGenerationOptions = {}
): AgentPlan {
  const [minSteps, maxSteps] = options.stepCount ?? [2, 5];
  const stepCount = minSteps + Math.floor(Math.random() * (maxSteps - minSteps + 1));

  const steps: PlanStep[] = [];
  let previousStepType: PlanStepType | null = null;

  for (let i = 0; i < stepCount; i++) {
    const eligible = getEligibleSteps(weights, previousStepType, options);

    if (eligible.length === 0) {
      // Fallback: if nothing eligible (very unlikely), add a wander step
      steps.push({
        type: 'wander',
        duration: getRandomDuration('wander'),
      });
      previousStepType = 'wander';
      continue;
    }

    const selectedKey = weightedRandomSelect(eligible);
    if (!selectedKey) {
      steps.push({
        type: 'wander',
        duration: getRandomDuration('wander'),
      });
      previousStepType = 'wander';
      continue;
    }

    const stepType = WEIGHT_KEY_TO_STEP_TYPE[selectedKey];
    if (!stepType) continue;

    steps.push({
      type: stepType,
      duration: getRandomDuration(stepType),
    });

    previousStepType = stepType;
  }

  // Ensure at least one step
  if (steps.length === 0) {
    steps.push({
      type: 'wander',
      duration: getRandomDuration('wander'),
    });
  }

  return {
    steps,
    currentStepIndex: 0,
    paused: false,
    arrivalTime: null,
  };
}
