/**
 * Default Quality Gate Configuration
 *
 * Standard quality gates for TypeScript projects.
 * Projects can override these by creating their own
 * .crewly/config/quality-gates.yaml file.
 *
 * @module config/quality-gates/default-gates
 */

import {
  GateConfig,
  QualityGate,
  GateSettings,
  GATE_TIMEOUTS,
  STANDARD_GATES,
} from '../../backend/src/types/quality-gate.types.js';

/**
 * Default gate execution settings
 */
export const DEFAULT_SETTINGS: GateSettings = {
  runInParallel: false,
  stopOnFirstFailure: false,
  timeout: GATE_TIMEOUTS.TOTAL,
};

/**
 * Typecheck gate - validates TypeScript compilation
 */
export const TYPECHECK_GATE: QualityGate = {
  name: STANDARD_GATES.TYPECHECK,
  command: 'npm run typecheck',
  timeout: GATE_TIMEOUTS.TYPECHECK,
  required: true,
  description: 'TypeScript compilation check',
};

/**
 * Tests gate - runs unit tests
 */
export const TESTS_GATE: QualityGate = {
  name: STANDARD_GATES.TESTS,
  command: 'npm test -- --passWithNoTests',
  timeout: GATE_TIMEOUTS.TESTS,
  required: true,
  description: 'Unit test execution',
  env: {
    CI: 'true',
  },
};

/**
 * Build gate - runs production build
 */
export const BUILD_GATE: QualityGate = {
  name: STANDARD_GATES.BUILD,
  command: 'npm run build',
  timeout: GATE_TIMEOUTS.BUILD,
  required: true,
  description: 'Production build',
};

/**
 * Lint gate - runs code linting (optional)
 */
export const LINT_GATE: QualityGate = {
  name: STANDARD_GATES.LINT,
  command: 'npm run lint',
  timeout: GATE_TIMEOUTS.LINT,
  required: false,
  allowFailure: true,
  description: 'Code linting',
};

/**
 * Coverage gate - runs test coverage (optional)
 */
export const COVERAGE_GATE: QualityGate = {
  name: STANDARD_GATES.COVERAGE,
  command: 'npm run test:coverage',
  timeout: GATE_TIMEOUTS.TESTS,
  required: false,
  description: 'Code coverage check',
  threshold: {
    lines: 80,
    branches: 70,
    functions: 80,
    statements: 80,
  },
};

/**
 * Required gates that must pass for task completion
 */
export const DEFAULT_REQUIRED_GATES: QualityGate[] = [
  TYPECHECK_GATE,
  TESTS_GATE,
  BUILD_GATE,
];

/**
 * Optional gates that provide warnings but don't block
 */
export const DEFAULT_OPTIONAL_GATES: QualityGate[] = [
  LINT_GATE,
];

/**
 * Complete default gate configuration
 */
export const DEFAULT_GATES: GateConfig = {
  settings: DEFAULT_SETTINGS,
  required: DEFAULT_REQUIRED_GATES,
  optional: DEFAULT_OPTIONAL_GATES,
  custom: [],
};

/**
 * Minimal gate configuration (typecheck only)
 */
export const MINIMAL_GATES: GateConfig = {
  settings: DEFAULT_SETTINGS,
  required: [TYPECHECK_GATE],
  optional: [],
  custom: [],
};

/**
 * Full gate configuration (all standard gates)
 */
export const FULL_GATES: GateConfig = {
  settings: {
    ...DEFAULT_SETTINGS,
    timeout: GATE_TIMEOUTS.TOTAL * 2, // 10 minutes for full suite
  },
  required: [
    TYPECHECK_GATE,
    TESTS_GATE,
    BUILD_GATE,
  ],
  optional: [
    LINT_GATE,
    COVERAGE_GATE,
  ],
  custom: [],
};

/**
 * Create a custom gate configuration
 *
 * @param overrides - Partial configuration to merge with defaults
 * @returns Complete gate configuration
 */
export function createGateConfig(overrides: Partial<GateConfig>): GateConfig {
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...overrides.settings,
    },
    required: overrides.required ?? DEFAULT_REQUIRED_GATES,
    optional: overrides.optional ?? DEFAULT_OPTIONAL_GATES,
    custom: overrides.custom ?? [],
  };
}

/**
 * Create a single gate with defaults
 *
 * @param name - Gate name
 * @param command - Command to execute
 * @param options - Additional gate options
 * @returns Complete gate definition
 */
export function createGate(
  name: string,
  command: string,
  options: Partial<Omit<QualityGate, 'name' | 'command'>> = {}
): QualityGate {
  return {
    name,
    command,
    timeout: options.timeout ?? GATE_TIMEOUTS.DEFAULT,
    required: options.required ?? false,
    description: options.description,
    allowFailure: options.allowFailure,
    env: options.env,
    runOn: options.runOn,
    threshold: options.threshold,
  };
}
