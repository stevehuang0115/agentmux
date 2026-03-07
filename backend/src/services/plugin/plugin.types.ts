/**
 * Plugin System Types
 *
 * Defines the hook points, plugin interface, and event payloads
 * for the Crewly plugin system. Pro and third-party extensions
 * register handlers for these hooks to inject commercial features.
 *
 * @module services/plugin/plugin.types
 */

// =============================================================================
// Hook Names
// =============================================================================

/** All available hook points in the system */
export type HookName =
  | 'onAgentBoot'
  | 'onTaskVerify'
  | 'onSkillExecute'
  | 'onDashboardRender';

/** Array of all hook names for iteration */
export const HOOK_NAMES: HookName[] = [
  'onAgentBoot',
  'onTaskVerify',
  'onSkillExecute',
  'onDashboardRender',
];

// =============================================================================
// Hook Payloads
// =============================================================================

/** Payload for the onAgentBoot hook */
export interface AgentBootPayload {
  /** Agent session name */
  sessionName: string;
  /** Agent member ID */
  memberId: string;
  /** Team ID the agent belongs to */
  teamId: string;
  /** Agent role */
  role: string;
  /** Runtime type (claude-code, gemini-cli, etc.) */
  runtimeType: string;
}

/** Payload for the onTaskVerify hook */
export interface TaskVerifyPayload {
  /** Task ID being verified */
  taskId: string;
  /** Worker who completed the task */
  workerId: string;
  /** Team ID */
  teamId: string;
  /** Verification results from the pipeline */
  results: Array<{ name: string; passed: boolean; output?: string }>;
  /** Overall pass status */
  passed: boolean;
  /** Verification score (0-100) */
  score: number;
}

/** Payload for the onSkillExecute hook */
export interface SkillExecutePayload {
  /** Skill name being executed */
  skillName: string;
  /** Skill path */
  skillPath: string;
  /** Agent session executing the skill */
  sessionName: string;
  /** Input arguments */
  input: string;
}

/** Payload for the onDashboardRender hook */
export interface DashboardRenderPayload {
  /** The route being rendered */
  route: string;
  /** Team ID if applicable */
  teamId?: string;
  /** Additional render context */
  context: Record<string, unknown>;
}

/** Map of hook names to their payload types */
export interface HookPayloadMap {
  onAgentBoot: AgentBootPayload;
  onTaskVerify: TaskVerifyPayload;
  onSkillExecute: SkillExecutePayload;
  onDashboardRender: DashboardRenderPayload;
}

// =============================================================================
// Hook Handler & Plugin
// =============================================================================

/** A hook handler function */
export type HookHandler<T = unknown> = (payload: T) => void | Promise<void>;

/** Plugin registration interface */
export interface CrewlyPlugin {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version (semver) */
  version: string;
  /** Hook registrations */
  hooks?: Partial<{
    [K in HookName]: HookHandler<HookPayloadMap[K]>;
  }>;
}
