/**
 * Desktop App Control Skill Tests
 *
 * Tests for the agent-browser wrapper skill that controls
 * Electron desktop apps and Chrome browsers via CDP.
 *
 * @module config/skills/agent/desktop-app-control/tests/desktop-app-control.test
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const SKILL_DIR = join(__dirname, '..');
const EXECUTE_SH = join(SKILL_DIR, 'execute.sh');

/**
 * Run execute.sh with args and return stdout.
 *
 * @param args - Command line arguments
 * @param expectFailure - If true, capture stderr on non-zero exit
 * @returns stdout + stderr output
 */
function runSkill(args: string, expectFailure = false): string {
  try {
    return execSync(`bash "${EXECUTE_SH}" ${args}`, {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, HOME: process.env.HOME },
    }).trim();
  } catch (error: unknown) {
    if (expectFailure) {
      const err = error as { stdout?: string; stderr?: string };
      return (err.stdout || '') + (err.stderr || '');
    }
    throw error;
  }
}

// =============================================================================
// Skill Structure
// =============================================================================

describe('Skill Structure', () => {
  it('should have execute.sh', () => {
    expect(existsSync(EXECUTE_SH)).toBe(true);
  });

  it('should have skill.json', () => {
    expect(existsSync(join(SKILL_DIR, 'skill.json'))).toBe(true);
  });

  it('should have instructions.md', () => {
    expect(existsSync(join(SKILL_DIR, 'instructions.md'))).toBe(true);
  });
});

// =============================================================================
// Skill Metadata
// =============================================================================

describe('Skill Metadata', () => {
  let metadata: Record<string, unknown>;

  beforeAll(() => {
    const content = readFileSync(join(SKILL_DIR, 'skill.json'), 'utf-8');
    metadata = JSON.parse(content);
  });

  it('should have id "desktop-app-control"', () => {
    expect(metadata.id).toBe('desktop-app-control');
  });

  it('should have execution type "script"', () => {
    const exec = metadata.execution as Record<string, unknown>;
    expect(exec.type).toBe('script');
  });

  it('should include key triggers', () => {
    const triggers = metadata.triggers as string[];
    expect(triggers).toContain('electron');
    expect(triggers).toContain('agent-browser');
    expect(triggers).toContain('cdp');
  });

  it('should document dependencies', () => {
    const deps = metadata.dependencies as Record<string, unknown>;
    expect(deps.required).toContain('agent-browser');
  });
});

// =============================================================================
// Syntax
// =============================================================================

describe('Shell Script Syntax', () => {
  it('execute.sh should pass bash syntax check', () => {
    const result = execSync(`bash -n "${EXECUTE_SH}" 2>&1`, {
      encoding: 'utf-8',
    });
    expect(result.trim()).toBe('');
  });
});

// =============================================================================
// Help Output
// =============================================================================

describe('Help Output', () => {
  it('should show usage when no subcommand given', () => {
    const output = runSkill('', true);
    expect(output).toContain('Usage');
    expect(output).toContain('scan');
    expect(output).toContain('snapshot');
    expect(output).toContain('click');
    expect(output).toContain('connect');
  });
});

// =============================================================================
// Error Handling
// =============================================================================

describe('Error Handling', () => {
  it('should error on unknown subcommand', () => {
    const output = runSkill('nonexistent', true);
    expect(output).toContain('error');
    expect(output).toContain('Unknown subcommand');
  });

  it('should error when --port missing for connect', () => {
    const output = runSkill('connect', true);
    expect(output).toContain('error');
    expect(output).toContain('--port');
  });

  it('should error when --ref missing for click', () => {
    const output = runSkill('click', true);
    expect(output).toContain('error');
    expect(output).toContain('--ref');
  });

  it('should error when --ref missing for fill', () => {
    const output = runSkill('fill', true);
    expect(output).toContain('error');
    expect(output).toContain('--ref');
  });

  it('should error when --key missing for press', () => {
    const output = runSkill('press', true);
    expect(output).toContain('error');
    expect(output).toContain('--key');
  });

  it('should error when --text missing for type-text', () => {
    const output = runSkill('type-text', true);
    expect(output).toContain('error');
    expect(output).toContain('--text');
  });

  it('should error when --ref missing for get-text', () => {
    const output = runSkill('get-text', true);
    expect(output).toContain('error');
    expect(output).toContain('--ref');
  });

  it('should error when --code missing for eval', () => {
    const output = runSkill('eval', true);
    expect(output).toContain('error');
    expect(output).toContain('--code');
  });

  it('should error when --app missing for launch', () => {
    const output = runSkill('launch', true);
    expect(output).toContain('error');
    expect(output).toContain('--app');
  });
});

// =============================================================================
// Integration: scan
// =============================================================================

describe('Integration: scan', () => {
  it('should return valid JSON with apps array', () => {
    const output = runSkill('scan');
    const data = JSON.parse(output);
    expect(data.success).toBe(true);
    expect(data.action).toBe('scan');
    expect(Array.isArray(data.apps)).toBe(true);
  });

  it('should detect at least one Electron app', () => {
    const output = runSkill('scan');
    const data = JSON.parse(output);
    const electronApps = data.apps.filter((a: { type: string }) => a.type === 'electron');
    expect(electronApps.length).toBeGreaterThan(0);
  });

  it('should include required fields for each app', () => {
    const output = runSkill('scan');
    const data = JSON.parse(output);
    for (const app of data.apps) {
      expect(app.name).toBeDefined();
      expect(app.type).toBeDefined();
      expect(typeof app.installed).toBe('boolean');
      expect(typeof app.running).toBe('boolean');
      expect(typeof app.cdpActive).toBe('boolean');
    }
  });

  it('should have activeCdpPorts array', () => {
    const output = runSkill('scan');
    const data = JSON.parse(output);
    expect(Array.isArray(data.activeCdpPorts)).toBe(true);
  });
});

// =============================================================================
// Integration: status
// =============================================================================

describe('Integration: status', () => {
  it('should return agent-browser version', () => {
    const output = runSkill('status');
    const data = JSON.parse(output);
    expect(data.success).toBe(true);
    expect(data.action).toBe('status');
    expect(data.version).toContain('agent-browser');
  });
});

// =============================================================================
// Audit Logging
// =============================================================================

describe('Audit Logging', () => {
  const logFile = join(process.env.HOME || '', '.crewly', 'logs', 'desktop-app-control.log');

  it('should write to audit log file', () => {
    // Run scan to trigger logging
    runSkill('scan');
    runSkill('status');
    expect(existsSync(logFile)).toBe(true);
  });

  it('should include timestamps in log', () => {
    const content = readFileSync(logFile, 'utf-8');
    expect(content).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
  });
});

// =============================================================================
// Instructions Documentation
// =============================================================================

describe('Instructions Documentation', () => {
  let instructions: string;

  beforeAll(() => {
    instructions = readFileSync(join(SKILL_DIR, 'instructions.md'), 'utf-8');
  });

  it('should document all subcommands', () => {
    const cmds = [
      'scan', 'launch', 'connect', 'snapshot', 'click', 'fill',
      'press', 'screenshot', 'get-text', 'scroll', 'tabs', 'close', 'status',
    ];
    for (const cmd of cmds) {
      expect(instructions).toContain(cmd);
    }
  });

  it('should document safety rules', () => {
    expect(instructions).toContain('Safety Rules');
    expect(instructions).toContain('NEVER close or kill');
  });

  it('should document multi-app sessions', () => {
    expect(instructions).toContain('--session');
    expect(instructions).toContain('Multi-App');
  });

  it('should document requirements', () => {
    expect(instructions).toContain('agent-browser');
    expect(instructions).toContain('npm install');
  });
});
