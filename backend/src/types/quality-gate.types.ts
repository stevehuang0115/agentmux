/**
 * Quality Gate Type Definitions
 *
 * Types for configuring and running quality gates that validate
 * code quality before task completion.
 *
 * @module types/quality-gate.types
 */

/**
 * A single quality gate definition
 */
export interface QualityGate {
  /** Unique gate identifier */
  name: string;
  /** Shell command to execute */
  command: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Human-readable description */
  description?: string;
  /** Whether this gate must pass for task completion */
  required: boolean;
  /** Allow failure without blocking (for optional gates) */
  allowFailure?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Branch patterns where this gate runs (glob patterns) */
  runOn?: string[];
  /** Threshold values for gates with metrics (e.g., coverage) */
  threshold?: Record<string, number>;
}

/**
 * Settings for gate execution
 */
export interface GateSettings {
  /** Run gates in parallel (default: false for sequential) */
  runInParallel: boolean;
  /** Stop execution on first failure */
  stopOnFirstFailure: boolean;
  /** Overall timeout for all gates in milliseconds */
  timeout: number;
}

/**
 * Complete gate configuration for a project
 */
export interface GateConfig {
  /** Execution settings */
  settings: GateSettings;
  /** Required gates (must all pass) */
  required: QualityGate[];
  /** Optional gates (warning only) */
  optional: QualityGate[];
  /** Custom project-specific gates */
  custom: QualityGate[];
}

/**
 * Result of running a single gate
 */
export interface GateResult {
  /** Gate identifier */
  name: string;
  /** Whether the gate passed */
  passed: boolean;
  /** Whether this was a required gate */
  required: boolean;
  /** Execution duration in milliseconds */
  duration: number;
  /** Combined stdout/stderr output (truncated if too long) */
  output: string;
  /** Process exit code */
  exitCode: number;
  /** Error message if gate failed */
  error?: string;
  /** Whether the gate was skipped */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Summary of gate execution
 */
export interface GateSummary {
  /** Total number of gates */
  total: number;
  /** Number of gates that passed */
  passed: number;
  /** Number of gates that failed */
  failed: number;
  /** Number of gates that were skipped */
  skipped: number;
}

/**
 * Complete results from running all gates
 */
export interface GateRunResults {
  /** Whether all required gates passed */
  allRequiredPassed: boolean;
  /** Whether all gates (including optional) passed */
  allPassed: boolean;
  /** Individual gate results */
  results: GateResult[];
  /** Summary statistics */
  summary: GateSummary;
  /** Total execution duration in milliseconds */
  duration: number;
  /** ISO timestamp of when gates were run */
  timestamp: string;
}

/**
 * Gate runner interface
 */
export interface IGateRunner {
  /**
   * Run a single gate
   *
   * @param gate - Gate definition
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  runGate(gate: QualityGate, projectPath: string): Promise<GateResult>;

  /**
   * Run all gates according to configuration
   *
   * @param config - Gate configuration
   * @param projectPath - Path to project directory
   * @returns Complete run results
   */
  runAllGates(config: GateConfig, projectPath: string): Promise<GateRunResults>;

  /**
   * Check if a gate should run based on branch patterns
   *
   * @param gate - Gate definition
   * @param currentBranch - Current git branch name
   * @returns Whether the gate should run
   */
  shouldRunGate(gate: QualityGate, currentBranch: string): boolean;
}

/**
 * Default timeout values (in milliseconds)
 */
export const GATE_TIMEOUTS = {
  /** Typecheck timeout (1 minute) */
  TYPECHECK: 60000,
  /** Test timeout (2 minutes) */
  TESTS: 120000,
  /** Build timeout (3 minutes) */
  BUILD: 180000,
  /** Lint timeout (30 seconds) */
  LINT: 30000,
  /** Default gate timeout (1 minute) */
  DEFAULT: 60000,
  /** Overall timeout for all gates (5 minutes) */
  TOTAL: 300000,
} as const;

/**
 * Standard gate names
 */
export const STANDARD_GATES = {
  TYPECHECK: 'typecheck',
  TESTS: 'tests',
  BUILD: 'build',
  LINT: 'lint',
  COVERAGE: 'coverage',
  E2E: 'e2e',
  SECURITY: 'security',
} as const;

/**
 * Maximum output length to store (10KB)
 */
export const MAX_GATE_OUTPUT_LENGTH = 10000;
