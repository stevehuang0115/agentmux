/**
 * Task Output Validator Service
 *
 * Validates structured task output against JSON Schema definitions
 * embedded in task markdown files. Uses ajv for schema validation.
 *
 * @module services/quality/task-output-validator.service
 */

import Ajv from 'ajv';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import {
  type TaskOutputSchema,
  type TaskOutputValidationResult,
  type TaskOutputRetryInfo,
  TASK_OUTPUT_CONSTANTS,
} from '../../types/task-output.types.js';

/**
 * Singleton service for validating task outputs against JSON Schema.
 *
 * @example
 * ```typescript
 * const validator = TaskOutputValidatorService.getInstance();
 * const result = validator.validate({ summary: 'Done' }, schema);
 * ```
 */
export class TaskOutputValidatorService {
  private static instance: TaskOutputValidatorService | null = null;
  private ajv: Ajv;
  private logger: ComponentLogger;

  private constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.logger = LoggerService.getInstance().createComponentLogger('TaskOutputValidatorService');
  }

  /**
   * Get the singleton instance of TaskOutputValidatorService
   *
   * @returns The singleton instance
   */
  public static getInstance(): TaskOutputValidatorService {
    if (!TaskOutputValidatorService.instance) {
      TaskOutputValidatorService.instance = new TaskOutputValidatorService();
    }
    return TaskOutputValidatorService.instance;
  }

  /**
   * Clear the singleton instance (for testing)
   */
  public static clearInstance(): void {
    TaskOutputValidatorService.instance = null;
  }

  /**
   * Validate output data against a JSON Schema
   *
   * @param output - The output object to validate
   * @param schema - The JSON Schema to validate against
   * @returns Validation result with errors if invalid
   */
  public validate(
    output: Record<string, unknown>,
    schema: TaskOutputSchema
  ): TaskOutputValidationResult {
    try {
      const valid = this.ajv.validate(schema, output);

      if (valid) {
        return { valid: true, errors: [] };
      }

      const errors = (this.ajv.errors || []).map((err) => {
        const path = err.instancePath || '/';
        return `${path}: ${err.message || 'unknown error'}`;
      });

      this.logger.debug('Output validation failed', { errors });
      return { valid: false, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Schema validation threw an error', { error: message });
      return { valid: false, errors: [`Schema validation error: ${message}`] };
    }
  }

  /**
   * Extract a TaskOutputSchema from a task markdown file's content.
   * Looks for a fenced JSON code block under the ## Output Schema header.
   *
   * @param content - The full markdown content of a task file
   * @returns The parsed schema, or null if none found
   */
  public extractSchemaFromMarkdown(content: string): TaskOutputSchema | null {
    const header = TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.OUTPUT_SCHEMA;
    const headerIndex = content.indexOf(header);
    if (headerIndex === -1) {
      return null;
    }

    // Find the fenced code block after the header
    const afterHeader = content.substring(headerIndex + header.length);
    const codeBlockMatch = afterHeader.match(/```json\s*\n([\s\S]*?)```/);
    if (!codeBlockMatch) {
      return null;
    }

    try {
      return JSON.parse(codeBlockMatch[1].trim()) as TaskOutputSchema;
    } catch {
      this.logger.warn('Failed to parse output schema from markdown');
      return null;
    }
  }

  /**
   * Extract retry information from a task markdown file's content.
   * Looks for structured data under the ## Output Validation Retry Info header.
   *
   * @param content - The full markdown content of a task file
   * @returns The parsed retry info, or null if none found
   */
  public extractRetryInfoFromMarkdown(content: string): TaskOutputRetryInfo | null {
    const header = TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.RETRY_INFO;
    const headerIndex = content.indexOf(header);
    if (headerIndex === -1) {
      return null;
    }

    const afterHeader = content.substring(headerIndex + header.length);
    const codeBlockMatch = afterHeader.match(/```json\s*\n([\s\S]*?)```/);
    if (!codeBlockMatch) {
      return null;
    }

    try {
      return JSON.parse(codeBlockMatch[1].trim()) as TaskOutputRetryInfo;
    } catch {
      this.logger.warn('Failed to parse retry info from markdown');
      return null;
    }
  }

  /**
   * Generate a markdown section containing the output schema
   *
   * @param schema - The schema to embed
   * @returns Markdown string with the schema in a fenced code block
   */
  public generateSchemaMarkdown(schema: TaskOutputSchema): string {
    return `\n\n${TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.OUTPUT_SCHEMA}\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n`;
  }

  /**
   * Generate a markdown section containing retry information
   *
   * @param retryInfo - The retry info to embed
   * @returns Markdown string with the retry info in a fenced code block
   */
  public generateRetryMarkdown(retryInfo: TaskOutputRetryInfo): string {
    return `\n\n${TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.RETRY_INFO}\n\n\`\`\`json\n${JSON.stringify(retryInfo, null, 2)}\n\`\`\`\n`;
  }

  /**
   * Validate output size against the maximum allowed size
   *
   * @param output - The output object to check
   * @returns Object with valid flag, size in bytes, and optional error
   */
  public validateOutputSize(output: Record<string, unknown>): {
    valid: boolean;
    sizeBytes: number;
    error?: string;
  } {
    const serialized = JSON.stringify(output);
    const sizeBytes = Buffer.byteLength(serialized, 'utf-8');
    const maxSize = TASK_OUTPUT_CONSTANTS.MAX_OUTPUT_SIZE_BYTES;

    if (sizeBytes > maxSize) {
      return {
        valid: false,
        sizeBytes,
        error: `Output size ${sizeBytes} bytes exceeds maximum ${maxSize} bytes`,
      };
    }

    return { valid: true, sizeBytes };
  }
}
