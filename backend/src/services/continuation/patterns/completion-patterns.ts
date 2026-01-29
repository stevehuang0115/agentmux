/**
 * Completion Signal Pattern Definitions
 *
 * Patterns for detecting successful task completion indicators
 * in terminal output.
 *
 * @module services/continuation/patterns/completion-patterns
 */

/**
 * Patterns indicating explicit task completion
 */
export const TASK_COMPLETE_PATTERNS: RegExp[] = [
  /task\s+(completed?|done|finished)/i,
  /successfully\s+completed/i,
  /\[complete_task\]/i,
  /task\s+marked\s+(as\s+)?complete/i,
  /moved?\s+task\s+to\s+done/i,
];

/**
 * Patterns indicating all tests passed
 */
export const TESTS_PASS_PATTERNS: RegExp[] = [
  /(\d+)\s+pass(ed|ing)?,?\s*0\s+fail/i,
  /all\s+tests\s+pass(ed)?/i,
  /test\s+suite(s)?\s+passed/i,
  /✓.*passed/i,
  /Tests:\s+\d+\s+passed,?\s*0\s+failed/i,
  /0\s+failing/i,
  /Test Suites:.*passed.*0 failed/i,
];

/**
 * Patterns indicating successful build
 */
export const BUILD_SUCCESS_PATTERNS: RegExp[] = [
  /build\s+(succeeded|successful|complete)/i,
  /compiled?\s+successfully/i,
  /webpack.*compiled/i,
  /vite.*built/i,
  /tsc.*completed/i,
  /no\s+errors\s+found/i,
  /✓\s+built\s+in/i,
];

/**
 * Patterns indicating git commit was made
 */
export const COMMIT_PATTERNS: RegExp[] = [
  /\[\w+\s+[a-f0-9]{7,}\]/,         // [main abc1234]
  /create mode \d+/,
  /\d+\s+files?\s+changed,/,
  /insertions?\(\+\).*deletions?\(-\)/,
  /git\s+commit.*-m/i,
];

/**
 * Patterns indicating PR was created
 */
export const PR_CREATED_PATTERNS: RegExp[] = [
  /pull request.*created/i,
  /gh\s+pr\s+create/i,
  /https:\/\/github\.com\/.*\/pull\/\d+/,
  /Created pull request/i,
  /PR\s+#?\d+\s+created/i,
];

/**
 * Patterns indicating explicit done statement
 */
export const EXPLICIT_DONE_PATTERNS: RegExp[] = [
  /\b(done|finished|completed)\b/i,
  /work\s+is\s+complete/i,
  /all\s+done/i,
];

/**
 * All completion pattern categories
 */
export const COMPLETION_PATTERNS = {
  taskComplete: TASK_COMPLETE_PATTERNS,
  testsPass: TESTS_PASS_PATTERNS,
  buildSuccess: BUILD_SUCCESS_PATTERNS,
  commitMade: COMMIT_PATTERNS,
  prCreated: PR_CREATED_PATTERNS,
  explicitDone: EXPLICIT_DONE_PATTERNS,
} as const;
