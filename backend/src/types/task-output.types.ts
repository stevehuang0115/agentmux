/**
 * Task Output Type Definitions
 *
 * Types for structured task output with JSON Schema validation.
 * Enables agents to produce validated, structured deliverables
 * when completing tasks.
 *
 * @module types/task-output.types
 */

/**
 * JSON Schema definition for validating task output.
 * Uses a subset of JSON Schema Draft 7 compatible with ajv.
 */
export interface TaskOutputSchema {
  /** JSON Schema type (typically 'object') */
  type: string;
  /** Property definitions for the output */
  properties?: Record<string, Record<string, unknown>>;
  /** List of required property names */
  required?: string[];
  /** Whether additional properties are allowed */
  additionalProperties?: boolean;
  /** Human-readable description of the expected output */
  description?: string;
}

/**
 * Result of validating task output against its schema
 */
export interface TaskOutputValidationResult {
  /** Whether the output passed validation */
  valid: boolean;
  /** Validation error messages (empty if valid) */
  errors: string[];
  /** The validated output data (only set if valid) */
  data?: TaskOutputData;
}

/**
 * Structured output data from a completed task
 */
export interface TaskOutputData {
  /** The validated output object */
  output: Record<string, unknown>;
  /** ISO timestamp of when the output was produced */
  producedAt: string;
  /** Session name of the agent that produced the output */
  sessionName: string;
}

/**
 * Retry tracking information embedded in task markdown
 */
export interface TaskOutputRetryInfo {
  /** Number of validation attempts so far */
  retryCount: number;
  /** Maximum allowed retries */
  maxRetries: number;
  /** Error messages from the last failed validation */
  lastErrors: string[];
  /** ISO timestamp of the last retry attempt */
  lastAttemptAt: string;
}

/**
 * Constants for task output validation
 */
export const TASK_OUTPUT_CONSTANTS = {
  /** Maximum number of validation retries before blocking the task */
  MAX_RETRIES: 2,
  /** Maximum output size in bytes (1MB) */
  MAX_OUTPUT_SIZE_BYTES: 1_048_576,
  /** Markdown section headers used in task files */
  SECTION_HEADERS: {
    OUTPUT_SCHEMA: '## Output Schema',
    RETRY_INFO: '## Output Validation Retry Info',
    VALIDATION_FAILURE: '## Validation Failure',
  },
  /** File extension for stored output files */
  OUTPUT_FILE_EXTENSION: '.output.json',
} as const;
