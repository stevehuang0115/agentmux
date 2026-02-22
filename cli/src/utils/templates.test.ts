/**
 * Tests for the team template loader utility.
 *
 * Validates template listing, retrieval by ID, handling of missing
 * templates directory, and malformed template files.
 */

import path from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';
import {
  listTemplates,
  getTemplate,
  getTemplatesDir,
  type TeamTemplate,
} from './templates.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
}));

const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_TEMPLATE: TeamTemplate = {
  id: 'test-team',
  name: 'Test Team',
  description: 'A test template',
  members: [
    {
      name: 'Dev',
      role: 'developer',
      systemPrompt: 'You are a developer.',
    },
  ],
};

const ANOTHER_TEMPLATE: TeamTemplate = {
  id: 'another-team',
  name: 'Another Team',
  description: 'Another test template',
  members: [
    {
      name: 'QA',
      role: 'qa',
      systemPrompt: 'You are a QA engineer.',
    },
    {
      name: 'PM',
      role: 'product-manager',
      systemPrompt: 'You are a product manager.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: existsSync returns false so getTemplatesDir falls back to CWD
    mockExistsSync.mockReturnValue(false);
  });

  // -----------------------------------------------------------------------
  // getTemplatesDir
  // -----------------------------------------------------------------------

  describe('getTemplatesDir', () => {
    it('returns a path ending in config/templates', () => {
      // When the walk-up finds config/templates, it returns that path.
      // When it does not, it falls back to CWD-based path.
      const dir = getTemplatesDir();
      expect(dir).toContain(path.join('config', 'templates'));
    });
  });

  // -----------------------------------------------------------------------
  // listTemplates
  // -----------------------------------------------------------------------

  describe('listTemplates', () => {
    it('returns templates sorted by name', () => {
      // First call to readdirSync is the walk-up probing; subsequent is the actual listing.
      // We need readdirSync to succeed on some calls for getTemplatesDir, and then for listing.
      mockReaddirSync.mockImplementation(() => {
        return ['b-team.json', 'a-team.json', 'not-json.txt'] as unknown as ReturnType<typeof readdirSync>;
      });
      mockReadFileSync.mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.endsWith('a-team.json')) {
          return JSON.stringify(SAMPLE_TEMPLATE);
        }
        if (p.endsWith('b-team.json')) {
          return JSON.stringify(ANOTHER_TEMPLATE);
        }
        throw new Error('unknown file');
      });

      const templates = listTemplates();
      expect(templates).toHaveLength(2);
      // "Another Team" < "Test Team" alphabetically
      expect(templates[0].id).toBe('another-team');
      expect(templates[1].id).toBe('test-team');
    });

    it('returns empty array when templates directory does not exist', () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const templates = listTemplates();
      expect(templates).toEqual([]);
    });

    it('skips malformed JSON files', () => {
      mockReaddirSync.mockImplementation(() => {
        return ['good.json', 'bad.json'] as unknown as ReturnType<typeof readdirSync>;
      });
      mockReadFileSync.mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.endsWith('good.json')) {
          return JSON.stringify(SAMPLE_TEMPLATE);
        }
        return '{ invalid json';
      });

      const templates = listTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe('test-team');
    });

    it('skips files missing required fields', () => {
      mockReaddirSync.mockImplementation(() => {
        return ['incomplete.json'] as unknown as ReturnType<typeof readdirSync>;
      });
      mockReadFileSync.mockImplementation(() => {
        return JSON.stringify({ id: 'no-name', description: 'missing name and members' });
      });

      const templates = listTemplates();
      expect(templates).toEqual([]);
    });

    it('filters to only .json files', () => {
      mockReaddirSync.mockImplementation(() => {
        return ['readme.md', 'template.json', '.gitkeep'] as unknown as ReturnType<typeof readdirSync>;
      });
      mockReadFileSync.mockImplementation(() => {
        return JSON.stringify(SAMPLE_TEMPLATE);
      });

      const templates = listTemplates();
      // Only template.json should be processed
      expect(templates).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // getTemplate
  // -----------------------------------------------------------------------

  describe('getTemplate', () => {
    beforeEach(() => {
      mockReaddirSync.mockImplementation(() => {
        return ['a.json', 'b.json'] as unknown as ReturnType<typeof readdirSync>;
      });
      mockReadFileSync.mockImplementation((filePath) => {
        const p = String(filePath);
        if (p.endsWith('a.json')) {
          return JSON.stringify(SAMPLE_TEMPLATE);
        }
        if (p.endsWith('b.json')) {
          return JSON.stringify(ANOTHER_TEMPLATE);
        }
        throw new Error('unknown');
      });
    });

    it('returns the matching template by id', () => {
      const template = getTemplate('test-team');
      expect(template).toBeDefined();
      expect(template!.name).toBe('Test Team');
      expect(template!.members).toHaveLength(1);
    });

    it('returns undefined for unknown id', () => {
      const template = getTemplate('nonexistent');
      expect(template).toBeUndefined();
    });
  });
});
