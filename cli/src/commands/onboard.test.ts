/**
 * Tests for the CLI onboard command.
 *
 * Validates the interactive setup wizard: banner output, provider selection,
 * tool detection/installation, skills check, and the full flow.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('chalk', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: () => {
      const fn = (s: string) => s;
      return new Proxy(fn, { get: () => fn, apply: (_t: unknown, _this: unknown, args: string[]) => args[0] });
    },
  }),
}));

const mockExecSync = jest.fn();
jest.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

const mockCheckSkillsInstalled = jest.fn();
const mockInstallAllSkills = jest.fn();
jest.mock('../utils/marketplace.js', () => ({
  checkSkillsInstalled: (...args: unknown[]) => mockCheckSkillsInstalled(...args),
  installAllSkills: (...args: unknown[]) => mockInstallAllSkills(...args),
}));

/** Shared mock readline answers — set per-test */
let mockReadlineAnswers: string[] = [];
let mockReadlineAnswerIndex = 0;
const mockRlClose = jest.fn();

jest.mock('readline', () => ({
  createInterface: () => ({
    question: (_prompt: string, cb: (answer: string) => void) => {
      const answer = mockReadlineAnswerIndex < mockReadlineAnswers.length
        ? mockReadlineAnswers[mockReadlineAnswerIndex++]
        : '';
      setImmediate(() => cb(answer));
    },
    close: mockRlClose,
    on: jest.fn().mockReturnThis(),
    removeListener: jest.fn(),
  }),
}));

import {
  printBanner,
  selectProvider,
  checkToolInstalled,
  getToolVersion,
  installTool,
  ensureTools,
  ensureSkills,
  printSummary,
  onboardCommand,
  type ProviderChoice,
} from './onboard.js';

import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock readline interface that answers questions
 * from the provided array of responses (consumed in order).
 */
function createMockReadline(answers: string[]) {
  let answerIndex = 0;
  const emitter = new EventEmitter();
  return {
    question: (_prompt: string, cb: (answer: string) => void) => {
      const answer = answerIndex < answers.length ? answers[answerIndex++] : '';
      // Simulate async readline
      setImmediate(() => cb(answer));
    },
    close: jest.fn(),
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
  } as unknown as import('readline').Interface;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('onboard command', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    mockExecSync.mockReset();
    mockCheckSkillsInstalled.mockReset();
    mockInstallAllSkills.mockReset();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // printBanner
  // -----------------------------------------------------------------------

  describe('printBanner', () => {
    it('prints the ASCII art and welcome message', () => {
      printBanner();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Crewly');
      expect(output).toContain('Welcome');
    });
  });

  // -----------------------------------------------------------------------
  // selectProvider
  // -----------------------------------------------------------------------

  describe('selectProvider', () => {
    it.each([
      ['1', 'claude'],
      ['2', 'gemini'],
      ['3', 'both'],
      ['4', 'skip'],
    ] as [string, ProviderChoice][])('returns "%s" when user enters %s', async (input, expected) => {
      const rl = createMockReadline([input]);
      const result = await selectProvider(rl);
      expect(result).toBe(expected);
    });

    it('re-prompts on invalid input then accepts valid', async () => {
      const rl = createMockReadline(['x', '9', '2']);
      const result = await selectProvider(rl);
      expect(result).toBe('gemini');
      // Should have printed a warning for bad inputs
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Please enter 1, 2, 3, or 4');
    });
  });

  // -----------------------------------------------------------------------
  // checkToolInstalled
  // -----------------------------------------------------------------------

  describe('checkToolInstalled', () => {
    it('returns true when which succeeds', () => {
      mockExecSync.mockReturnValue(Buffer.from('/usr/local/bin/claude'));
      expect(checkToolInstalled('claude')).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('which claude', { stdio: 'pipe' });
    });

    it('returns false when which throws', () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });
      expect(checkToolInstalled('nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getToolVersion
  // -----------------------------------------------------------------------

  describe('getToolVersion', () => {
    it('extracts version from output', () => {
      mockExecSync.mockReturnValue(Buffer.from('claude v1.0.17\n'));
      expect(getToolVersion('claude')).toBe('1.0.17');
    });

    it('returns null on error', () => {
      mockExecSync.mockImplementation(() => { throw new Error('fail'); });
      expect(getToolVersion('missing')).toBeNull();
    });

    it('returns first line when no version pattern found', () => {
      mockExecSync.mockReturnValue(Buffer.from('some tool output'));
      expect(getToolVersion('tool')).toBe('some tool output');
    });
  });

  // -----------------------------------------------------------------------
  // installTool
  // -----------------------------------------------------------------------

  describe('installTool', () => {
    it('runs npm install and returns true on success', () => {
      mockExecSync.mockReturnValue(Buffer.from(''));
      const result = installTool('Claude Code', '@anthropic-ai/claude-code');
      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        'npm install -g @anthropic-ai/claude-code',
        expect.objectContaining({ stdio: 'pipe' }),
      );
    });

    it('returns false on failure', () => {
      mockExecSync.mockImplementation(() => { throw new Error('permission denied'); });
      const result = installTool('Claude Code', '@anthropic-ai/claude-code');
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // ensureTools
  // -----------------------------------------------------------------------

  describe('ensureTools', () => {
    it('skips tool installation when provider is skip', async () => {
      const rl = createMockReadline([]);
      await ensureTools(rl, 'skip');
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Skipped');
    });

    it('detects an already-installed tool', async () => {
      // First call: which claude → found; second call: claude --version
      mockExecSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/claude'))
        .mockReturnValueOnce(Buffer.from('1.0.17'));

      const rl = createMockReadline([]);
      await ensureTools(rl, 'claude');

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Claude Code detected');
    });

    it('prompts to install a missing tool and installs on Y', async () => {
      // which claude → fails (not found)
      // ask user → 'Y'
      // npm install → succeeds
      mockExecSync
        .mockImplementationOnce(() => { throw new Error('not found'); })  // which
        .mockReturnValueOnce(Buffer.from(''))  // npm install
        ;

      const rl = createMockReadline(['Y']);
      await ensureTools(rl, 'claude');

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('not found');
      expect(output).toContain('installed');
    });

    it('skips installation when user declines', async () => {
      mockExecSync.mockImplementation(() => { throw new Error('not found'); });

      const rl = createMockReadline(['n']);
      await ensureTools(rl, 'claude');

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Skipped Claude Code');
    });
  });

  // -----------------------------------------------------------------------
  // ensureSkills
  // -----------------------------------------------------------------------

  describe('ensureSkills', () => {
    it('reports already-installed skills', async () => {
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 22, total: 22 });
      await ensureSkills();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('22 agent skills already installed');
    });

    it('installs missing skills', async () => {
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 0, total: 5 });
      mockInstallAllSkills.mockResolvedValue(5);
      await ensureSkills();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Installing 5 agent skills');
      expect(output).toContain('5 skills installed');
    });

    it('handles zero marketplace skills', async () => {
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 0, total: 0 });
      await ensureSkills();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('No skills available');
    });

    it('handles errors gracefully', async () => {
      mockCheckSkillsInstalled.mockRejectedValue(new Error('network error'));
      await ensureSkills();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Could not install skills');
      expect(output).toContain('network error');
    });
  });

  // -----------------------------------------------------------------------
  // printSummary
  // -----------------------------------------------------------------------

  describe('printSummary', () => {
    it('prints completion message and next steps', () => {
      printSummary();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Setup complete');
      expect(output).toContain('crewly start');
    });
  });

  // -----------------------------------------------------------------------
  // onboardCommand (full flow)
  // -----------------------------------------------------------------------

  describe('onboardCommand', () => {
    beforeEach(() => {
      mockRlClose.mockReset();
    });

    it('runs the full wizard selecting skip provider', async () => {
      mockReadlineAnswers = ['4']; // skip provider
      mockReadlineAnswerIndex = 0;

      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      await onboardCommand();

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Welcome');
      expect(output).toContain('Skipped');
      expect(output).toContain('Setup complete');
      expect(mockRlClose).toHaveBeenCalled();
    });

    it('closes readline even if an error occurs in skills', async () => {
      mockReadlineAnswers = ['1']; // claude provider
      mockReadlineAnswerIndex = 0;

      // which claude → found
      mockExecSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/claude'))
        .mockReturnValueOnce(Buffer.from('1.0.17'));

      // Skills check fails
      mockCheckSkillsInstalled.mockRejectedValue(new Error('fail'));

      await onboardCommand();

      // readline should still be closed
      expect(mockRlClose).toHaveBeenCalled();
    });
  });
});
