import { describe, it, expect } from '@jest/globals';
import {
  TASK_OUTPUT_CONSTANTS,
  type TaskOutputSchema,
  type TaskOutputValidationResult,
  type TaskOutputData,
  type TaskOutputRetryInfo,
} from './task-output.types.js';

describe('Task Output Types', () => {
  describe('TASK_OUTPUT_CONSTANTS', () => {
    it('should have MAX_RETRIES set to 2', () => {
      expect(TASK_OUTPUT_CONSTANTS.MAX_RETRIES).toBe(2);
    });

    it('should have MAX_OUTPUT_SIZE_BYTES set to 1MB', () => {
      expect(TASK_OUTPUT_CONSTANTS.MAX_OUTPUT_SIZE_BYTES).toBe(1_048_576);
    });

    it('should have correct section headers', () => {
      expect(TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.OUTPUT_SCHEMA).toBe('## Output Schema');
      expect(TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.RETRY_INFO).toBe('## Output Validation Retry Info');
      expect(TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.VALIDATION_FAILURE).toBe('## Validation Failure');
    });

    it('should have correct output file extension', () => {
      expect(TASK_OUTPUT_CONSTANTS.OUTPUT_FILE_EXTENSION).toBe('.output.json');
    });

    it('should be immutable (as const)', () => {
      // Verify the shape is correct - as const makes values readonly
      const constants = TASK_OUTPUT_CONSTANTS;
      expect(typeof constants.MAX_RETRIES).toBe('number');
      expect(typeof constants.MAX_OUTPUT_SIZE_BYTES).toBe('number');
      expect(typeof constants.SECTION_HEADERS).toBe('object');
      expect(typeof constants.OUTPUT_FILE_EXTENSION).toBe('string');
    });
  });

  describe('TaskOutputSchema type', () => {
    it('should accept a valid schema with all properties', () => {
      const schema: TaskOutputSchema = {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary'],
        additionalProperties: false,
        description: 'Expected output for the task',
      };

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toEqual(['summary']);
      expect(schema.additionalProperties).toBe(false);
      expect(schema.description).toBeDefined();
    });

    it('should accept a minimal schema with only type', () => {
      const schema: TaskOutputSchema = {
        type: 'object',
      };

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeUndefined();
      expect(schema.required).toBeUndefined();
    });
  });

  describe('TaskOutputValidationResult type', () => {
    it('should represent a valid result', () => {
      const result: TaskOutputValidationResult = {
        valid: true,
        errors: [],
        data: {
          output: { summary: 'Done' },
          producedAt: new Date().toISOString(),
          sessionName: 'dev-1',
        },
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('should represent an invalid result', () => {
      const result: TaskOutputValidationResult = {
        valid: false,
        errors: ['Missing required property: summary'],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.data).toBeUndefined();
    });
  });

  describe('TaskOutputData type', () => {
    it('should contain output, timestamp, and session name', () => {
      const data: TaskOutputData = {
        output: { summary: 'Implemented feature', filesChanged: 3 },
        producedAt: '2026-01-01T00:00:00.000Z',
        sessionName: 'dev-session-1',
      };

      expect(data.output).toBeDefined();
      expect(data.producedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(data.sessionName).toBe('dev-session-1');
    });
  });

  describe('TaskOutputRetryInfo type', () => {
    it('should track retry state', () => {
      const retryInfo: TaskOutputRetryInfo = {
        retryCount: 1,
        maxRetries: 2,
        lastErrors: ['Missing property: files'],
        lastAttemptAt: '2026-01-01T00:00:00.000Z',
      };

      expect(retryInfo.retryCount).toBe(1);
      expect(retryInfo.maxRetries).toBe(2);
      expect(retryInfo.lastErrors).toHaveLength(1);
      expect(retryInfo.lastAttemptAt).toBeDefined();
    });
  });
});
