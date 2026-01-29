/**
 * Error Signal Pattern Definitions
 *
 * Patterns for detecting various types of errors
 * in terminal output.
 *
 * @module services/continuation/patterns/error-patterns
 */

/**
 * Error types that can be detected
 */
export type ErrorType = 'compile' | 'test' | 'runtime' | 'permission' | 'unknown';

/**
 * Patterns for compile/build errors
 */
export const COMPILE_ERROR_PATTERNS: RegExp[] = [
  /error TS\d+:/i,                    // TypeScript
  /SyntaxError:/i,
  /Cannot find module/i,
  /Module not found/i,
  /Unexpected token/i,
  /Parse error/i,
  /Build failed/i,
  /Compilation failed/i,
  /tsc.*error/i,
];

/**
 * Patterns for test failures
 */
export const TEST_ERROR_PATTERNS: RegExp[] = [
  /\d+\s+fail(ed|ing)?/i,
  /FAIL\s+/,
  /AssertionError/i,
  /Expected.*but (got|received)/i,
  /Test failed/i,
  /✕.*fail/i,
  /\d+\s+failing/,
  /test.*failed/i,
];

/**
 * Patterns for runtime errors
 */
export const RUNTIME_ERROR_PATTERNS: RegExp[] = [
  /Error:/i,
  /Exception:/i,
  /fatal:/i,
  /ENOENT:/i,
  /EACCES:/i,
  /Uncaught/i,
  /Unhandled/i,
  /ReferenceError:/i,
  /TypeError:/i,
  /RangeError:/i,
];

/**
 * Patterns for permission errors
 */
export const PERMISSION_ERROR_PATTERNS: RegExp[] = [
  /permission denied/i,
  /EACCES/i,
  /sudo required/i,
  /access denied/i,
  /not authorized/i,
  /forbidden/i,
];

/**
 * All error pattern categories with their types
 */
export const ERROR_PATTERNS: Record<ErrorType, RegExp[]> = {
  compile: COMPILE_ERROR_PATTERNS,
  test: TEST_ERROR_PATTERNS,
  runtime: RUNTIME_ERROR_PATTERNS,
  permission: PERMISSION_ERROR_PATTERNS,
  unknown: [],
} as const;

/**
 * Suggested fixes for common error types
 */
export const ERROR_FIXES: Record<ErrorType, string[]> = {
  compile: [
    'Check for syntax errors in the code',
    'Verify all imports are correct',
    'Run npm install to ensure dependencies are present',
    'Check TypeScript types match expected values',
  ],
  test: [
    'Review the failing test expectations',
    'Check if recent code changes broke existing functionality',
    'Verify test data and mocks are correct',
    'Run tests individually to isolate the failure',
  ],
  runtime: [
    'Check if required files exist',
    'Verify environment variables are set',
    'Check for null/undefined values',
    'Review recent code changes for bugs',
  ],
  permission: [
    'Check file permissions',
    'Verify the user has access to the resource',
    'Consider if elevated privileges are needed',
  ],
  unknown: [
    'Review the error message carefully',
    'Search for similar issues online',
    'Check logs for more context',
  ],
};
