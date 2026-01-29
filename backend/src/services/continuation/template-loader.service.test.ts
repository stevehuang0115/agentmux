/**
 * Tests for TemplateLoader Service
 *
 * @module services/continuation/template-loader.service.test
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TemplateLoader } from './template-loader.service.js';

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

describe('TemplateLoader', () => {
  let loader: TemplateLoader;
  let tempDir: string;

  beforeAll(async () => {
    // Create temp directory for test templates
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-test-'));
  });

  afterAll(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create test templates
    await fs.writeFile(
      path.join(tempDir, 'simple.md'),
      `---
name: simple
description: A simple test template
variables:
  - VAR1
  - VAR2
---

# Hello {{VAR1}}

This is {{VAR2}}.
`
    );

    await fs.writeFile(
      path.join(tempDir, 'conditional.md'),
      `---
name: conditional
description: Template with conditionals
variables:
  - SHOW_SECTION
  - CONTENT
---

# Title

{{#if SHOW_SECTION}}
## Optional Section
{{CONTENT}}
{{/if}}

Footer
`
    );

    await fs.writeFile(
      path.join(tempDir, 'no-frontmatter.md'),
      `# No Frontmatter

Just content with {{VAR}}.
`
    );

    await fs.writeFile(
      path.join(tempDir, 'computed.md'),
      `---
name: computed
description: Template with computed variables
variables:
  - ITERATIONS
  - MAX_ITERATIONS
---

Progress: {{ITERATIONS}} of {{MAX_ITERATIONS}} ({{REMAINING_ITERATIONS}} remaining)
`
    );

    // Create fresh loader instance
    TemplateLoader.clearInstance();
    loader = TemplateLoader.createWithDir(tempDir);
  });

  describe('loadTemplate', () => {
    it('should load a template and return content without frontmatter', async () => {
      const content = await loader.loadTemplate('simple');

      expect(content).toContain('# Hello {{VAR1}}');
      expect(content).not.toContain('---');
      expect(content).not.toContain('name: simple');
    });

    it('should handle templates without frontmatter', async () => {
      const content = await loader.loadTemplate('no-frontmatter');

      expect(content).toContain('# No Frontmatter');
      expect(content).toContain('{{VAR}}');
    });

    it('should throw error for non-existent template', async () => {
      await expect(loader.loadTemplate('non-existent')).rejects.toThrow(
        "Failed to load template 'non-existent'"
      );
    });

    it('should cache templates on subsequent loads', async () => {
      // First load
      const content1 = await loader.loadTemplate('simple');

      // Second load should use cache
      const content2 = await loader.loadTemplate('simple');

      expect(content1).toBe(content2);
    });
  });

  describe('loadParsedTemplate', () => {
    it('should parse frontmatter metadata', async () => {
      const parsed = await loader.loadParsedTemplate('simple');

      expect(parsed.metadata.name).toBe('simple');
      expect(parsed.metadata.description).toBe('A simple test template');
      expect(parsed.metadata.variables).toContain('VAR1');
      expect(parsed.metadata.variables).toContain('VAR2');
    });

    it('should use filename as default name for templates without frontmatter', async () => {
      const parsed = await loader.loadParsedTemplate('no-frontmatter');

      expect(parsed.metadata.name).toBe('no-frontmatter');
    });
  });

  describe('substituteVariables', () => {
    it('should substitute simple variables', async () => {
      const template = await loader.loadTemplate('simple');
      const result = loader.substituteVariables(template, {
        VAR1: 'World',
        VAR2: 'a test',
      });

      expect(result).toContain('# Hello World');
      expect(result).toContain('This is a test.');
    });

    it('should handle missing variables gracefully', async () => {
      const template = await loader.loadTemplate('simple');
      const result = loader.substituteVariables(template, {
        VAR1: 'World',
        // VAR2 is missing
      });

      expect(result).toContain('# Hello World');
      expect(result).toContain('This is .');
    });

    it('should handle number values', async () => {
      const template = 'Count: {{COUNT}}';
      const result = loader.substituteVariables(template, { COUNT: 42 });

      expect(result).toBe('Count: 42');
    });

    it('should handle array values', async () => {
      const template = 'Items:\n{{ITEMS}}';
      const result = loader.substituteVariables(template, {
        ITEMS: ['apple', 'banana', 'cherry'],
      });

      expect(result).toContain('- apple');
      expect(result).toContain('- banana');
      expect(result).toContain('- cherry');
    });

    it('should compute REMAINING_ITERATIONS', async () => {
      const template = await loader.loadTemplate('computed');
      const result = loader.substituteVariables(template, {
        ITERATIONS: 3,
        MAX_ITERATIONS: 10,
      });

      expect(result).toContain('Progress: 3 of 10 (7 remaining)');
    });
  });

  describe('conditionals', () => {
    it('should show content when condition is truthy', async () => {
      const template = await loader.loadTemplate('conditional');
      const result = loader.substituteVariables(template, {
        SHOW_SECTION: true,
        CONTENT: 'Hello!',
      });

      expect(result).toContain('## Optional Section');
      expect(result).toContain('Hello!');
    });

    it('should hide content when condition is falsy', async () => {
      const template = await loader.loadTemplate('conditional');
      const result = loader.substituteVariables(template, {
        SHOW_SECTION: false,
        CONTENT: 'Hello!',
      });

      expect(result).not.toContain('## Optional Section');
      expect(result).not.toContain('Hello!');
    });

    it('should treat empty string as falsy', async () => {
      const template = await loader.loadTemplate('conditional');
      const result = loader.substituteVariables(template, {
        SHOW_SECTION: '',
        CONTENT: 'Hello!',
      });

      expect(result).not.toContain('## Optional Section');
    });

    it('should treat non-empty string as truthy', async () => {
      const template = await loader.loadTemplate('conditional');
      const result = loader.substituteVariables(template, {
        SHOW_SECTION: 'yes',
        CONTENT: 'Hello!',
      });

      expect(result).toContain('## Optional Section');
    });

    it('should treat empty array as falsy', async () => {
      const template = '{{#if ITEMS}}Has items{{/if}}';
      const result = loader.substituteVariables(template, { ITEMS: [] });

      expect(result).not.toContain('Has items');
    });

    it('should treat non-empty array as truthy', async () => {
      const template = '{{#if ITEMS}}Has items{{/if}}';
      const result = loader.substituteVariables(template, { ITEMS: [1, 2, 3] });

      expect(result).toContain('Has items');
    });

    it('should treat undefined as falsy', async () => {
      const template = '{{#if MISSING}}Shown{{/if}}';
      const result = loader.substituteVariables(template, {});

      expect(result).not.toContain('Shown');
    });
  });

  describe('clearCache', () => {
    it('should clear cached templates', async () => {
      // Load template to cache it
      await loader.loadTemplate('simple');

      // Modify the file
      await fs.writeFile(
        path.join(tempDir, 'simple.md'),
        `---
name: simple
description: Modified
variables: []
---

# Modified Content
`
      );

      // Clear cache
      loader.clearCache();

      // Load again - should get new content
      const content = await loader.loadTemplate('simple');

      expect(content).toContain('# Modified Content');
    });
  });

  describe('templateExists', () => {
    it('should return true for existing template', async () => {
      const exists = await loader.templateExists('simple');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing template', async () => {
      const exists = await loader.templateExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('listTemplates', () => {
    it('should list all available templates', async () => {
      const templates = await loader.listTemplates();

      expect(templates).toContain('simple');
      expect(templates).toContain('conditional');
      expect(templates).toContain('no-frontmatter');
      expect(templates).toContain('computed');
    });

    it('should return empty array for non-existent directory', async () => {
      const invalidLoader = TemplateLoader.createWithDir('/non/existent/path');
      const templates = await invalidLoader.listTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      TemplateLoader.clearInstance();
      const instance1 = TemplateLoader.getInstance();
      const instance2 = TemplateLoader.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after clearInstance', () => {
      const instance1 = TemplateLoader.getInstance();
      TemplateLoader.clearInstance();
      const instance2 = TemplateLoader.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });
});
