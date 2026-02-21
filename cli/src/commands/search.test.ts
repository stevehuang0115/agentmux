/**
 * Tests for the CLI search command.
 *
 * Validates search filtering, output formatting, and error handling.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock chalk (ESM-only)
jest.mock('chalk', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: () => {
      const fn = (s: string) => s;
      return new Proxy(fn, { get: () => fn, apply: (_t: unknown, _this: unknown, args: string[]) => args[0] });
    },
  }),
}));

const mockFetchRegistry = jest.fn();
const mockLoadManifest = jest.fn();

jest.mock('../utils/marketplace.js', () => ({
  fetchRegistry: (...args: unknown[]) => mockFetchRegistry(...args),
  loadManifest: (...args: unknown[]) => mockLoadManifest(...args),
}));

import { searchCommand } from './search.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeItem(id: string, name: string, type = 'skill') {
  return {
    id,
    type,
    name,
    description: 'A test item for testing',
    author: 'test',
    version: '1.0.0',
    category: 'development',
    tags: ['test', 'agent'],
    license: 'MIT',
    downloads: 0,
    rating: 5,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    assets: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchCommand', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    mockFetchRegistry.mockReset();
    mockLoadManifest.mockReset();
    mockLoadManifest.mockResolvedValue({ schemaVersion: 1, items: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists all items when no query given', async () => {
    mockFetchRegistry.mockResolvedValue({
      schemaVersion: 1,
      lastUpdated: '2025-01-01',
      cdnBaseUrl: '',
      items: [
        makeFakeItem('skill-a', 'Skill A'),
        makeFakeItem('skill-b', 'Skill B'),
      ],
    });

    await searchCommand();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Skill A'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Skill B'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 item(s) found'));
  });

  it('filters items by query', async () => {
    mockFetchRegistry.mockResolvedValue({
      schemaVersion: 1,
      lastUpdated: '2025-01-01',
      cdnBaseUrl: '',
      items: [
        makeFakeItem('skill-banana', 'Banana Skill'),
        makeFakeItem('skill-apple', 'Apple Skill'),
      ],
    });

    await searchCommand('banana');

    // Should show banana but output also contains header/footer
    const allOutput = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(allOutput).toContain('Banana Skill');
    expect(allOutput).toContain('1 item(s) found');
  });

  it('filters items by type', async () => {
    mockFetchRegistry.mockResolvedValue({
      schemaVersion: 1,
      lastUpdated: '2025-01-01',
      cdnBaseUrl: '',
      items: [
        makeFakeItem('skill-a', 'Skill A', 'skill'),
        makeFakeItem('model-b', 'Model B', 'model'),
      ],
    });

    await searchCommand(undefined, { type: 'model' });

    const allOutput = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(allOutput).toContain('Model B');
    expect(allOutput).toContain('1 item(s) found');
  });

  it('shows no results message when nothing matches', async () => {
    mockFetchRegistry.mockResolvedValue({
      schemaVersion: 1,
      lastUpdated: '2025-01-01',
      cdnBaseUrl: '',
      items: [],
    });

    await searchCommand('xyz');

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No items matching'));
  });

  it('shows installed status for installed items', async () => {
    mockFetchRegistry.mockResolvedValue({
      schemaVersion: 1,
      lastUpdated: '2025-01-01',
      cdnBaseUrl: '',
      items: [makeFakeItem('skill-a', 'Skill A')],
    });
    mockLoadManifest.mockResolvedValue({
      schemaVersion: 1,
      items: [{ id: 'skill-a', type: 'skill', name: 'Skill A', version: '1.0.0', installedAt: '', installPath: '' }],
    });

    await searchCommand();

    const allOutput = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(allOutput).toContain('installed');
  });

  it('handles fetch failure', async () => {
    mockFetchRegistry.mockRejectedValue(new Error('Network error'));

    await expect(searchCommand()).rejects.toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Search failed'));
  });
});
