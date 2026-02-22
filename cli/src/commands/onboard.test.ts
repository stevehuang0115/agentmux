/**
 * Tests for the CLI onboard command.
 *
 * Validates the interactive setup wizard: banner output, provider selection,
 * tool detection/installation, skills check, the full flow, and the new
 * --yes (non-interactive) and --template flags.
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

const mockListTemplates = jest.fn();
const mockGetTemplate = jest.fn();
jest.mock('../utils/templates.js', () => ({
  listTemplates: (...args: unknown[]) => mockListTemplates(...args),
  getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
}));

const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockExistsSync = jest.fn();
jest.mock('fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
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
  selectTemplate,
  scaffoldCrewlyDirectory,
  printSummary,
  onboardCommand,
  type ProviderChoice,
} from './onboard.js';

import type { TeamTemplate } from '../utils/templates.js';

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

const sampleTemplate: TeamTemplate = {
  id: 'web-dev-team',
  name: 'Web Dev Team',
  description: 'Frontend + Backend + QA',
  members: [
    { name: 'Frontend Dev', role: 'frontend-developer', systemPrompt: 'prompt' },
    { name: 'Backend Dev', role: 'backend-developer', systemPrompt: 'prompt' },
  ],
};

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
    mockListTemplates.mockReset();
    mockGetTemplate.mockReset();
    mockMkdirSync.mockReset();
    mockWriteFileSync.mockReset();
    mockExistsSync.mockReset();
    mockExistsSync.mockReturnValue(false);
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

    it('auto-installs missing tools when autoYes is true', async () => {
      mockExecSync
        .mockImplementationOnce(() => { throw new Error('not found'); }) // which
        .mockReturnValueOnce(Buffer.from('')) // npm install
        ;

      const rl = createMockReadline([]);
      await ensureTools(rl, 'claude', true);

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('not found');
      expect(output).toContain('installed');
      // Should NOT have asked the user
      expect(rl.question).not.toHaveBeenCalled;
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
  // selectTemplate
  // -----------------------------------------------------------------------

  describe('selectTemplate', () => {
    const sampleTemplates: TeamTemplate[] = [
      {
        id: 'web-dev-team',
        name: 'Web Dev Team',
        description: 'Frontend + Backend + QA',
        members: [
          { name: 'Frontend Dev', role: 'frontend-developer', systemPrompt: 'prompt' },
          { name: 'Backend Dev', role: 'backend-developer', systemPrompt: 'prompt' },
        ],
      },
      {
        id: 'startup-team',
        name: 'Startup Team',
        description: 'PM + Dev + Generalist',
        members: [
          { name: 'PM', role: 'product-manager', systemPrompt: 'prompt' },
        ],
      },
    ];

    it('returns selected template when user picks a number', async () => {
      mockListTemplates.mockReturnValue(sampleTemplates);
      const rl = createMockReadline(['1']);
      const result = await selectTemplate(rl);
      expect(result).toBeDefined();
      expect(result!.id).toBe('web-dev-team'); // first in mock array
    });

    it('returns null when user picks skip option', async () => {
      mockListTemplates.mockReturnValue(sampleTemplates);
      const rl = createMockReadline(['3']); // 2 templates + 1 skip = 3
      const result = await selectTemplate(rl);
      expect(result).toBeNull();
    });

    it('returns null when user presses enter (empty)', async () => {
      mockListTemplates.mockReturnValue(sampleTemplates);
      const rl = createMockReadline(['']);
      const result = await selectTemplate(rl);
      expect(result).toBeNull();
    });

    it('returns null when no templates available', async () => {
      mockListTemplates.mockReturnValue([]);
      const rl = createMockReadline([]);
      const result = await selectTemplate(rl);
      expect(result).toBeNull();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('No templates available');
    });

    it('re-prompts on invalid input then accepts valid', async () => {
      mockListTemplates.mockReturnValue(sampleTemplates);
      const rl = createMockReadline(['x', '0', '1']);
      const result = await selectTemplate(rl);
      expect(result).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // scaffoldCrewlyDirectory
  // -----------------------------------------------------------------------

  describe('scaffoldCrewlyDirectory', () => {
    it('creates .crewly/ directory structure when it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = scaffoldCrewlyDirectory('/test/project');

      expect(result).toBe(true);
      expect(mockMkdirSync).toHaveBeenCalledTimes(4);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('.crewly/ directory created');
    });

    it('reports existing directory and skips creation', () => {
      mockExistsSync.mockReturnValue(true);

      const result = scaffoldCrewlyDirectory('/test/project');

      expect(result).toBe(true);
      expect(mockMkdirSync).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('already exists');
    });

    it('returns false and logs error when mkdir fails', () => {
      mockExistsSync.mockReturnValue(false);
      mockMkdirSync.mockImplementation(() => { throw new Error('permission denied'); });

      const result = scaffoldCrewlyDirectory('/test/project');

      expect(result).toBe(false);
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Failed to create');
    });

    it('creates subdirectories: docs, memory, tasks, teams', () => {
      mockExistsSync.mockReturnValue(false);

      scaffoldCrewlyDirectory('/test/project');

      const mkdirCalls = mockMkdirSync.mock.calls.map((c: unknown[]) => c[0]);
      expect(mkdirCalls).toEqual(
        expect.arrayContaining([
          expect.stringContaining('docs'),
          expect.stringContaining('memory'),
          expect.stringContaining('tasks'),
          expect.stringContaining('teams'),
        ]),
      );
    });

    it('writes config.env file', () => {
      mockExistsSync.mockReturnValue(false);

      scaffoldCrewlyDirectory('/test/project');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.env'),
        expect.stringContaining('Crewly configuration'),
      );
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
      expect(output).toContain('Next steps');
    });

    it('includes template info when a template was selected', () => {
      const template: TeamTemplate = {
        id: 'test',
        name: 'Test Team',
        description: 'desc',
        members: [
          { name: 'Dev', role: 'developer', systemPrompt: 'prompt' },
          { name: 'QA', role: 'qa', systemPrompt: 'prompt' },
        ],
      };
      printSummary(template);
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Test Team');
      expect(output).toContain('Dev, QA');
      expect(output).toContain('Setup complete');
    });

    it('does not include template info when null', () => {
      printSummary(null);
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).not.toContain('template');
      expect(output).toContain('Setup complete');
    });

    it('includes cd command when projectDir differs from cwd', () => {
      printSummary(null, '/some/other/path');
      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('cd /some/other/path');
    });
  });

  // -----------------------------------------------------------------------
  // onboardCommand (full flow)
  // -----------------------------------------------------------------------

  describe('onboardCommand', () => {
    beforeEach(() => {
      mockRlClose.mockReset();
      // Default: no templates (template step skips quickly)
      mockListTemplates.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);
    });

    it('runs the full wizard selecting skip provider', async () => {
      mockReadlineAnswers = ['4']; // skip provider; template auto-skips (no templates)
      mockReadlineAnswerIndex = 0;

      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      await onboardCommand();

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Welcome');
      expect(output).toContain('Skipped');
      expect(output).toContain('Setup complete');
      expect(mockRlClose).toHaveBeenCalled();
    });

    it('runs full wizard with template selection', async () => {
      mockListTemplates.mockReturnValue([
        {
          id: 'test-team',
          name: 'Test Team',
          description: 'A test team',
          members: [{ name: 'Dev', role: 'developer', systemPrompt: 'prompt' }],
        },
      ]);

      // Answer '4' for provider (skip), '1' for template selection
      mockReadlineAnswers = ['4', '1'];
      mockReadlineAnswerIndex = 0;

      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      await onboardCommand();

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Welcome');
      expect(output).toContain('Test Team');
      expect(output).toContain('Setup complete');
      expect(mockRlClose).toHaveBeenCalled();
    });

    it('closes readline even if an error occurs in skills', async () => {
      mockReadlineAnswers = ['1']; // claude provider; template auto-skips (no templates)
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

    it('scaffolds .crewly/ directory during interactive flow', async () => {
      mockReadlineAnswers = ['4']; // skip provider
      mockReadlineAnswerIndex = 0;
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      await onboardCommand();

      // Should have called scaffoldCrewlyDirectory (which calls mkdirSync)
      expect(mockMkdirSync).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // --yes flag (non-interactive mode)
  // -----------------------------------------------------------------------

  describe('onboardCommand with --yes flag', () => {
    beforeEach(() => {
      mockRlClose.mockReset();
      mockListTemplates.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);
    });

    it('runs non-interactive with defaults', async () => {
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });
      // which claude → found
      mockExecSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/claude'))
        .mockReturnValueOnce(Buffer.from('1.0.17'));

      await onboardCommand({ yes: true });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('non-interactive');
      expect(output).toContain('Using default: Claude Code');
      expect(output).toContain('Setup complete');
    });

    it('auto-installs missing tools in --yes mode', async () => {
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });
      // which claude → not found, then npm install succeeds
      mockExecSync
        .mockImplementationOnce(() => { throw new Error('not found'); })
        .mockReturnValueOnce(Buffer.from(''));

      await onboardCommand({ yes: true });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('not found');
      expect(output).toContain('installed');
    });

    it('uses first available template when no --template specified', async () => {
      mockListTemplates.mockReturnValue([sampleTemplate]);
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });
      mockExecSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/claude'))
        .mockReturnValueOnce(Buffer.from('1.0.17'));

      await onboardCommand({ yes: true });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Using template: Web Dev Team');
    });

    it('scaffolds .crewly/ directory in --yes mode', async () => {
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });
      mockExecSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/claude'))
        .mockReturnValueOnce(Buffer.from('1.0.17'));

      await onboardCommand({ yes: true });

      expect(mockMkdirSync).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // --template flag
  // -----------------------------------------------------------------------

  describe('onboardCommand with --template flag', () => {
    beforeEach(() => {
      mockRlClose.mockReset();
      mockListTemplates.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);
    });

    it('uses specified template in interactive mode', async () => {
      mockGetTemplate.mockReturnValue(sampleTemplate);
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      // Skip provider (step 1)
      mockReadlineAnswers = ['4'];
      mockReadlineAnswerIndex = 0;

      await onboardCommand({ template: 'web-dev-team' });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Using template: Web Dev Team');
      // Should NOT prompt for template selection
      expect(output).not.toContain('Choose a pre-built team');
    });

    it('uses specified template in --yes mode', async () => {
      mockGetTemplate.mockReturnValue(sampleTemplate);
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });
      mockExecSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/claude'))
        .mockReturnValueOnce(Buffer.from('1.0.17'));

      await onboardCommand({ yes: true, template: 'web-dev-team' });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Using template: Web Dev Team');
    });

    it('warns when template ID is not found', async () => {
      mockGetTemplate.mockReturnValue(undefined);
      mockListTemplates.mockReturnValue([sampleTemplate]);
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      mockReadlineAnswers = ['4', '']; // skip provider, skip template
      mockReadlineAnswerIndex = 0;

      await onboardCommand({ template: 'nonexistent' });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Template "nonexistent" not found');
      expect(output).toContain('Available templates: web-dev-team');
    });

    it('warns when template not found and no templates available', async () => {
      mockGetTemplate.mockReturnValue(undefined);
      mockListTemplates.mockReturnValue([]);
      mockCheckSkillsInstalled.mockResolvedValue({ installed: 10, total: 10 });

      mockReadlineAnswers = ['4'];
      mockReadlineAnswerIndex = 0;

      await onboardCommand({ template: 'nonexistent' });

      const output = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(output).toContain('Template "nonexistent" not found');
      // Should not show available templates line
      expect(output).not.toContain('Available templates:');
    });
  });
});
