import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TaskOutputValidatorService } from './task-output-validator.service.js';
import {
  TASK_OUTPUT_CONSTANTS,
  type TaskOutputSchema,
  type TaskOutputRetryInfo,
} from '../../types/task-output.types.js';

describe('TaskOutputValidatorService', () => {
  let service: TaskOutputValidatorService;

  beforeEach(() => {
    TaskOutputValidatorService.clearInstance();
    service = TaskOutputValidatorService.getInstance();
  });

  afterEach(() => {
    TaskOutputValidatorService.clearInstance();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = TaskOutputValidatorService.getInstance();
      const instance2 = TaskOutputValidatorService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return a new instance after clearInstance', () => {
      const instance1 = TaskOutputValidatorService.getInstance();
      TaskOutputValidatorService.clearInstance();
      const instance2 = TaskOutputValidatorService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('validate', () => {
    const schema: TaskOutputSchema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        filesChanged: { type: 'number' },
      },
      required: ['summary'],
      additionalProperties: false,
    };

    it('should return valid for output matching the schema', () => {
      const output = { summary: 'Done', filesChanged: 3 };
      const result = service.validate(output, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid when optional properties are missing', () => {
      const output = { summary: 'Done' };
      const result = service.validate(output, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid when required property is missing', () => {
      const output = { filesChanged: 3 };
      const result = service.validate(output, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('summary'))).toBe(true);
    });

    it('should return invalid when property has wrong type', () => {
      const output = { summary: 123 };
      const result = service.validate(output, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return invalid when additional properties are present', () => {
      const output = { summary: 'Done', extra: 'not allowed' };
      const result = service.validate(output, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return valid for schema without additionalProperties restriction', () => {
      const looseSchema: TaskOutputSchema = {
        type: 'object',
        properties: {
          summary: { type: 'string' },
        },
        required: ['summary'],
      };
      const output = { summary: 'Done', extra: 'allowed' };
      const result = service.validate(output, looseSchema);

      expect(result.valid).toBe(true);
    });

    it('should handle empty object with no required fields', () => {
      const emptySchema: TaskOutputSchema = {
        type: 'object',
        properties: {
          optional: { type: 'string' },
        },
      };
      const result = service.validate({}, emptySchema);

      expect(result.valid).toBe(true);
    });

    it('should handle invalid schema gracefully', () => {
      // Pass something that would cause ajv to throw
      const badSchema = { type: 'invalid_type_that_does_not_exist' } as unknown as TaskOutputSchema;
      const result = service.validate({ foo: 'bar' }, badSchema);

      // ajv may still validate or throw depending on strictness;
      // the service should not crash
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('extractSchemaFromMarkdown', () => {
    it('should extract schema from valid markdown', () => {
      const schema: TaskOutputSchema = {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      };
      const markdown = `# Task Title\n\n## Output Schema\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n## Other Section`;

      const result = service.extractSchemaFromMarkdown(markdown);

      expect(result).toEqual(schema);
    });

    it('should return null when no Output Schema header exists', () => {
      const markdown = '# Task Title\n\n## Description\nSome text';

      const result = service.extractSchemaFromMarkdown(markdown);

      expect(result).toBeNull();
    });

    it('should return null when no code block after header', () => {
      const markdown = `# Task Title\n\n## Output Schema\n\nNo code block here\n\n## Next Section`;

      const result = service.extractSchemaFromMarkdown(markdown);

      expect(result).toBeNull();
    });

    it('should return null when JSON is invalid', () => {
      const markdown = `# Task Title\n\n## Output Schema\n\n\`\`\`json\n{invalid json}\n\`\`\`\n`;

      const result = service.extractSchemaFromMarkdown(markdown);

      expect(result).toBeNull();
    });
  });

  describe('extractRetryInfoFromMarkdown', () => {
    it('should extract retry info from valid markdown', () => {
      const retryInfo: TaskOutputRetryInfo = {
        retryCount: 1,
        maxRetries: 2,
        lastErrors: ['Missing property: summary'],
        lastAttemptAt: '2026-01-01T00:00:00.000Z',
      };
      const markdown = `# Task\n\n## Output Validation Retry Info\n\n\`\`\`json\n${JSON.stringify(retryInfo, null, 2)}\n\`\`\`\n`;

      const result = service.extractRetryInfoFromMarkdown(markdown);

      expect(result).toEqual(retryInfo);
    });

    it('should return null when no Retry Info header exists', () => {
      const result = service.extractRetryInfoFromMarkdown('# Task\n\nNo retry info');

      expect(result).toBeNull();
    });

    it('should return null when JSON is invalid', () => {
      const markdown = `# Task\n\n## Output Validation Retry Info\n\n\`\`\`json\n{bad}\n\`\`\`\n`;

      const result = service.extractRetryInfoFromMarkdown(markdown);

      expect(result).toBeNull();
    });
  });

  describe('generateSchemaMarkdown', () => {
    it('should generate valid markdown with schema in fenced block', () => {
      const schema: TaskOutputSchema = {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      };

      const markdown = service.generateSchemaMarkdown(schema);

      expect(markdown).toContain(TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.OUTPUT_SCHEMA);
      expect(markdown).toContain('```json');
      expect(markdown).toContain('"type": "object"');
      expect(markdown).toContain('```');
    });

    it('should produce markdown that extractSchemaFromMarkdown can parse', () => {
      const schema: TaskOutputSchema = {
        type: 'object',
        properties: { count: { type: 'number' } },
        required: ['count'],
      };

      const markdown = service.generateSchemaMarkdown(schema);
      const extracted = service.extractSchemaFromMarkdown(markdown);

      expect(extracted).toEqual(schema);
    });
  });

  describe('generateRetryMarkdown', () => {
    it('should generate valid markdown with retry info', () => {
      const retryInfo: TaskOutputRetryInfo = {
        retryCount: 1,
        maxRetries: 2,
        lastErrors: ['Error 1'],
        lastAttemptAt: '2026-01-01T00:00:00.000Z',
      };

      const markdown = service.generateRetryMarkdown(retryInfo);

      expect(markdown).toContain(TASK_OUTPUT_CONSTANTS.SECTION_HEADERS.RETRY_INFO);
      expect(markdown).toContain('```json');
      expect(markdown).toContain('"retryCount": 1');
    });

    it('should produce markdown that extractRetryInfoFromMarkdown can parse', () => {
      const retryInfo: TaskOutputRetryInfo = {
        retryCount: 2,
        maxRetries: 2,
        lastErrors: ['Error A', 'Error B'],
        lastAttemptAt: '2026-02-01T00:00:00.000Z',
      };

      const markdown = service.generateRetryMarkdown(retryInfo);
      const extracted = service.extractRetryInfoFromMarkdown(markdown);

      expect(extracted).toEqual(retryInfo);
    });
  });

  describe('validateOutputSize', () => {
    it('should return valid for output within size limit', () => {
      const output = { summary: 'Small output' };
      const result = service.validateOutputSize(output);

      expect(result.valid).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for output exceeding size limit', () => {
      // Create a string just over 1MB (the JSON overhead pushes it over)
      const bigChunk = 'A'.repeat(1_048_577);
      const output = { d: bigChunk };
      const result = service.validateOutputSize(output);

      expect(result.valid).toBe(false);
      expect(result.sizeBytes).toBeGreaterThan(TASK_OUTPUT_CONSTANTS.MAX_OUTPUT_SIZE_BYTES);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('exceeds maximum');
    });

    it('should correctly measure byte size for multi-byte characters', () => {
      const output = { text: '你好世界' };
      const result = service.validateOutputSize(output);

      // Each Chinese character is 3 bytes in UTF-8
      expect(result.valid).toBe(true);
      expect(result.sizeBytes).toBeGreaterThan(4); // More than 4 single-byte chars
    });
  });
});
