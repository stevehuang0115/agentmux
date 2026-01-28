/**
 * Agent Plan Types - Type definitions and personality weight constants
 * for the plan-based agent behavior system.
 *
 * Each agent/NPC has a multi-step plan (e.g., "go to kitchen, grab coffee,
 * then go check on Agent X, then wander near the lounge"). Plans get
 * interrupted by conversations and stage events.
 */

// ====== PLAN STEP TYPES ======

/**
 * All possible plan step actions an entity can perform
 */
export type PlanStepType =
  | 'go_to_workstation'   // Return to own desk
  | 'go_to_kitchen'       // Visit kitchen counter
  | 'go_to_couch'         // Sit on lounge couch
  | 'go_to_break_room'    // Sit at break room table
  | 'go_to_poker_table'   // Play poker
  | 'go_to_stage'         // Perform on stage
  | 'watch_stage'         // Go to audience spot
  | 'wander'              // Walk to random clear position
  | 'check_agent'         // (NPC only) Walk near an agent's workstation
  | 'present'             // (NPC only) Give presentation at stage
  | 'walk_circle'         // (NPC only) Walk in circle at center
  | 'go_to_pickleball'    // Play pickleball at outdoor court
  | 'go_to_golf'          // Practice putting at outdoor green
  | 'sit_outdoor';        // Sit on outdoor park bench

/**
 * A single step in an agent's plan
 */
export interface PlanStep {
  /** The action to perform */
  type: PlanStepType;
  /** Target position (computed when step begins) */
  target?: { x: number; z: number };
  /** How long to stay once arrived (seconds) */
  duration: number;
  /** Animation to play while at destination */
  arrivalAnimation?: string;
  /** Facing direction on arrival (radians) */
  arrivalRotation?: number;
  /** Whether to raise Y position on arrival (e.g., couch, stage) */
  arrivalY?: number;
  /** Seat index for seated areas (couch, break room, poker, kitchen) */
  seatIndex?: number;
}

/**
 * A multi-step plan for an agent or NPC
 */
export interface AgentPlan {
  /** Ordered list of steps to execute */
  steps: PlanStep[];
  /** Index of the currently executing step */
  currentStepIndex: number;
  /** Set to true when a conversation interrupts the plan */
  paused: boolean;
  /** Timestamp when the current step's arrival started (seconds, from clock.elapsedTime) */
  arrivalTime: number | null;
  /** When true, this plan was set by an external command and should not be paused by conversations */
  commanded?: boolean;
}

// ====== PERSONALITY WEIGHTS ======

/**
 * Weight map controlling how often each step type appears in generated plans.
 * Higher weights = more frequent selection. Weights are relative (not percentages).
 */
export interface PersonalityWeights {
  /** Weight for visiting the kitchen */
  kitchen: number;
  /** Weight for sitting on the couch */
  couch: number;
  /** Weight for visiting the break room */
  break_room: number;
  /** Weight for visiting the poker table */
  poker_table: number;
  /** Weight for performing on stage */
  stage: number;
  /** Weight for watching stage performances */
  watch_stage: number;
  /** Weight for random wandering */
  wander: number;
  /** Weight for returning to workstation (worker agents only) */
  workstation?: number;
  /** Weight for checking on agents (NPC only) */
  check_agent?: number;
  /** Weight for giving presentations (NPC only) */
  present?: number;
  /** Weight for walking in circles (NPC only) */
  walk_circle?: number;
  /** Weight for playing pickleball outdoors */
  pickleball?: number;
  /** Weight for putting golf outdoors */
  golf?: number;
  /** Weight for sitting on outdoor bench */
  sit_outdoor?: number;
}

// ====== PERSONALITY WEIGHT CONSTANTS ======

/**
 * Worker agent personality - balanced idle activities
 */
export const WORKER_AGENT_WEIGHTS: PersonalityWeights = {
  kitchen: 15,
  couch: 12,
  break_room: 12,
  poker_table: 12,
  stage: 8,
  watch_stage: 10,
  wander: 15,
  pickleball: 8,
  golf: 8,
  sit_outdoor: 8,
} as const;

/**
 * Steve Jobs NPC personality - focused on checking agents and wandering
 */
export const STEVE_JOBS_WEIGHTS: PersonalityWeights = {
  kitchen: 15,
  couch: 10,
  break_room: 5,
  poker_table: 5,
  stage: 0,
  watch_stage: 12,
  wander: 15,
  check_agent: 28,
  pickleball: 5,
  golf: 5,
  sit_outdoor: 5,
} as const;

/**
 * Sundar Pichai NPC personality - balanced with presentations and agent checks
 */
export const SUNDAR_PICHAI_WEIGHTS: PersonalityWeights = {
  kitchen: 15,
  couch: 5,
  break_room: 5,
  poker_table: 5,
  stage: 0,
  watch_stage: 8,
  wander: 15,
  check_agent: 22,
  present: 10,
  walk_circle: 5,
  pickleball: 5,
  golf: 5,
  sit_outdoor: 5,
} as const;

/**
 * Elon Musk NPC personality - outdoor-focused, likes wandering and checking agents
 */
export const ELON_MUSK_WEIGHTS: PersonalityWeights = {
  kitchen: 8,
  couch: 5,
  break_room: 5,
  poker_table: 8,
  stage: 0,
  watch_stage: 10,
  wander: 18,
  check_agent: 18,
  pickleball: 10,
  golf: 8,
  sit_outdoor: 10,
} as const;

/**
 * Mark Zuckerberg NPC personality - tech-focused, likes outdoor and checking agents
 */
export const MARK_ZUCKERBERG_WEIGHTS: PersonalityWeights = {
  kitchen: 10,
  couch: 5,
  break_room: 8,
  poker_table: 5,
  stage: 0,
  watch_stage: 10,
  wander: 15,
  check_agent: 20,
  pickleball: 8,
  golf: 12,
  sit_outdoor: 8,
} as const;

/**
 * Jensen Huang NPC personality - indoor presenter, checks agents frequently
 */
export const JENSEN_HUANG_WEIGHTS: PersonalityWeights = {
  kitchen: 12,
  couch: 8,
  break_room: 8,
  poker_table: 5,
  stage: 0,
  watch_stage: 12,
  wander: 15,
  check_agent: 25,
  present: 8,
  pickleball: 3,
  golf: 3,
  sit_outdoor: 5,
} as const;

/**
 * Steve Huang NPC personality - builder/architect, loves golf and outdoor
 */
export const STEVE_HUANG_WEIGHTS: PersonalityWeights = {
  kitchen: 10,
  couch: 5,
  break_room: 5,
  poker_table: 5,
  stage: 0,
  watch_stage: 8,
  wander: 12,
  check_agent: 15,
  pickleball: 10,
  golf: 18,
  sit_outdoor: 12,
} as const;

/**
 * Fake audience personality - primarily wanders, occasionally kitchen
 */
export const FAKE_AUDIENCE_WEIGHTS: PersonalityWeights = {
  kitchen: 18,
  couch: 5,
  break_room: 5,
  poker_table: 5,
  stage: 0,
  watch_stage: 8,
  wander: 45,
  pickleball: 5,
  golf: 5,
  sit_outdoor: 5,
} as const;

// ====== STEP DURATION RANGES ======

/**
 * Duration ranges (in seconds) for each step type [min, max].
 * Used by the plan generator to assign random durations.
 */
export const STEP_DURATION_RANGES: Record<PlanStepType, [number, number]> = {
  go_to_workstation: [5, 10],
  go_to_kitchen: [6, 14],
  go_to_couch: [10, 20],
  go_to_break_room: [8, 15],
  go_to_poker_table: [8, 15],
  go_to_stage: [15, 30],
  watch_stage: [10, 20],
  wander: [3, 8],
  check_agent: [3, 7],
  present: [8, 13],
  walk_circle: [10, 15],
  go_to_pickleball: [10, 20],
  go_to_golf: [10, 20],
  sit_outdoor: [8, 18],
} as const;

// ====== STEP TYPE TO PLAN STEP TYPE MAPPING ======

/**
 * Maps personality weight keys to PlanStepType values.
 * Used by the plan generator to convert weights into step types.
 */
export const WEIGHT_KEY_TO_STEP_TYPE: Record<string, PlanStepType> = {
  kitchen: 'go_to_kitchen',
  couch: 'go_to_couch',
  break_room: 'go_to_break_room',
  poker_table: 'go_to_poker_table',
  stage: 'go_to_stage',
  watch_stage: 'watch_stage',
  wander: 'wander',
  workstation: 'go_to_workstation',
  check_agent: 'check_agent',
  present: 'present',
  walk_circle: 'walk_circle',
  pickleball: 'go_to_pickleball',
  golf: 'go_to_golf',
  sit_outdoor: 'sit_outdoor',
} as const;

// ====== ENTITY COMMAND ======

/**
 * A command sent from the UI to override an entity's current plan.
 * Used by the EntityActionPanel to direct entities to specific activities.
 */
export interface EntityCommand {
  /** The plan step type to execute */
  stepType: PlanStepType;
}

// ====== SEATED STEP TYPES ======

/**
 * Seated area types that require seat claiming
 */
export const SEATED_STEP_TYPES: PlanStepType[] = [
  'go_to_couch',
  'go_to_break_room',
  'go_to_poker_table',
  'go_to_kitchen',
] as const;

/**
 * Map from PlanStepType to the seat area key used in seat occupancy tracking
 */
export const STEP_TYPE_TO_SEAT_AREA: Partial<Record<PlanStepType, string>> = {
  go_to_couch: 'couch',
  go_to_break_room: 'break_room',
  go_to_poker_table: 'poker_table',
  go_to_kitchen: 'kitchen',
} as const;

// ====== STEP TYPE TO THOUGHT KEY MAPPING ======

/**
 * Default mapping from PlanStepType to ThinkingBubble thought category key.
 * Used by NPC and agent components to select the correct thought pool.
 * Components can override individual mappings for NPC-specific thought categories.
 */
export const DEFAULT_STEP_THOUGHT_KEY: Partial<Record<PlanStepType, string>> = {
  wander: 'wander',
  go_to_couch: 'couch',
  go_to_stage: 'stage',
  go_to_break_room: 'break_room',
  go_to_poker_table: 'poker_table',
  go_to_kitchen: 'kitchen',
  watch_stage: 'wander',
  go_to_workstation: 'wander',
  go_to_pickleball: 'pickleball',
  go_to_golf: 'golf',
  sit_outdoor: 'sit_outdoor',
  check_agent: 'wander',
  present: 'wander',
  walk_circle: 'wander',
};

// ====== OUTDOOR STEP TYPES ======

/**
 * Step types that target positions outside the building walls.
 * Movement logic skips wall boundary clamping for these steps.
 */
export const OUTDOOR_STEP_TYPES: ReadonlySet<PlanStepType> = new Set([
  'go_to_pickleball',
  'go_to_golf',
  'sit_outdoor',
]);
