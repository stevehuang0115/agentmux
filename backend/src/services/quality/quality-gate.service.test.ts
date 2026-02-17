/**
 * Tests for QualityGateService
 *
 * @module services/quality/quality-gate.service.test
 */

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import { QualityGateService } from './quality-gate.service.js';
import { QualityGate, GateConfig } from '../../types/quality-gate.types.js';

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn(),
}));

// Mock logger
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));

describe('QualityGateService', () => {
  let service: QualityGateService;
  const mockExec = exec as unknown as jest.Mock;
  const mockReadFile = fs.readFile as unknown as jest.Mock;
  const mockAccess = fs.access as unknown as jest.Mock;

  beforeEach(() => {
    QualityGateService.clearInstance();
    service = QualityGateService.getInstance();
    jest.clearAllMocks();

    // Default mock for git branch
    mockExec.mockImplementation((cmd: string, _options: unknown, callback?: Function) => {
      if (cmd.includes('git rev-parse')) {
        if (callback) {
          callback(null, { stdout: 'main\n', stderr: '' });
        }
        return;
      }
      // Default success for other commands
      if (callback) {
        callback(null, { stdout: 'Success', stderr: '' });
      }
    });
  });

  afterEach(() => {
    QualityGateService.clearInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QualityGateService.getInstance();
      const instance2 = QualityGateService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after clearInstance', () => {
      const instance1 = QualityGateService.getInstance();
      QualityGateService.clearInstance();
      const instance2 = QualityGateService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default gate configuration', () => {
      const config = service.getDefaultConfig();

      expect(config.settings).toBeDefined();
      expect(config.required).toBeDefined();
      expect(config.optional).toBeDefined();
      expect(config.custom).toBeDefined();
    });

    it('should include typecheck, tests, and build as required', () => {
      const config = service.getDefaultConfig();
      const gateNames = config.required.map((g) => g.name);

      expect(gateNames).toContain('typecheck');
      expect(gateNames).toContain('tests');
      expect(gateNames).toContain('build');
    });

    it('should include lint as optional', () => {
      const config = service.getDefaultConfig();
      const gateNames = config.optional.map((g) => g.name);

      expect(gateNames).toContain('lint');
    });
  });

  describe('loadConfig', () => {
    it('should load project config when available', async () => {
      const projectConfig = {
        settings: {
          runInParallel: true,
          stopOnFirstFailure: true,
          timeout: 600000,
        },
        required: [{ name: 'custom-check', command: 'npm run check', timeout: 30000 }],
        optional: [],
        custom: [],
      };

      mockReadFile.mockResolvedValue(
        `settings:\n  runInParallel: true\n  stopOnFirstFailure: true\n  timeout: 600000\nrequired:\n  - name: custom-check\n    command: npm run check\n    timeout: 30000`
      );

      const config = await service.loadConfig('/test/project');

      expect(config.settings.runInParallel).toBe(true);
      expect(config.settings.stopOnFirstFailure).toBe(true);
    });

    it('should return default config when project config not found', async () => {
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const config = await service.loadConfig('/test/project');
      const defaultConfig = service.getDefaultConfig();

      expect(config.settings).toEqual(defaultConfig.settings);
    });
  });

  describe('hasProjectConfig', () => {
    it('should return true when config exists', async () => {
      mockAccess.mockResolvedValue(undefined);

      const result = await service.hasProjectConfig('/test/project');

      expect(result).toBe(true);
    });

    it('should return false when config does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'));

      const result = await service.hasProjectConfig('/test/project');

      expect(result).toBe(false);
    });
  });

  describe('shouldRunGate', () => {
    it('should return true when no runOn patterns specified', () => {
      const gate: QualityGate = {
        name: 'test',
        command: 'npm test',
        timeout: 60000,
        required: true,
      };

      expect(service.shouldRunGate(gate, 'main')).toBe(true);
      expect(service.shouldRunGate(gate, 'feature/test')).toBe(true);
    });

    it('should return true when branch matches exact pattern', () => {
      const gate: QualityGate = {
        name: 'test',
        command: 'npm test',
        timeout: 60000,
        required: true,
        runOn: ['main', 'develop'],
      };

      expect(service.shouldRunGate(gate, 'main')).toBe(true);
      expect(service.shouldRunGate(gate, 'develop')).toBe(true);
      expect(service.shouldRunGate(gate, 'feature/test')).toBe(false);
    });

    it('should return true when branch matches glob pattern', () => {
      const gate: QualityGate = {
        name: 'test',
        command: 'npm test',
        timeout: 60000,
        required: true,
        runOn: ['feature/*', 'release/*'],
      };

      expect(service.shouldRunGate(gate, 'feature/test')).toBe(true);
      expect(service.shouldRunGate(gate, 'feature/new-feature')).toBe(true);
      expect(service.shouldRunGate(gate, 'release/1.0')).toBe(true);
      expect(service.shouldRunGate(gate, 'main')).toBe(false);
    });

    it('should return false when branch does not match any pattern', () => {
      const gate: QualityGate = {
        name: 'test',
        command: 'npm test',
        timeout: 60000,
        required: true,
        runOn: ['main'],
      };

      expect(service.shouldRunGate(gate, 'develop')).toBe(false);
    });
  });

  describe('runGate', () => {
    it('should return passed result on successful execution', async () => {
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (callback) {
            callback(null, { stdout: 'Test output', stderr: '' });
          }
        }
      );

      const gate: QualityGate = {
        name: 'test-gate',
        command: 'npm test',
        timeout: 60000,
        required: true,
      };

      const result = await service.runGate(gate, '/test/project');

      expect(result.passed).toBe(true);
      expect(result.name).toBe('test-gate');
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Test output');
    });

    it('should return failed result on command failure', async () => {
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: Error & { code?: number; stdout?: string; stderr?: string }) => void) => {
          if (cmd.includes('git rev-parse')) {
            if (callback) {
              callback(null as unknown as Error & { code?: number; stdout?: string; stderr?: string });
            }
            return;
          }
          const error = new Error('Command failed') as Error & {
            code?: number;
            stdout?: string;
            stderr?: string;
          };
          error.code = 1;
          error.stdout = '';
          error.stderr = 'Error output';
          if (callback) {
            callback(error);
          }
        }
      );

      const gate: QualityGate = {
        name: 'test-gate',
        command: 'npm test',
        timeout: 60000,
        required: true,
      };

      const result = await service.runGate(gate, '/test/project');

      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBeDefined();
    });

    it('should pass when allowFailure is true and command fails', async () => {
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: Error & { code?: number; stdout?: string; stderr?: string }) => void) => {
          if (cmd.includes('git rev-parse')) {
            if (callback) {
              callback(null as unknown as Error & { code?: number; stdout?: string; stderr?: string });
            }
            return;
          }
          const error = new Error('Command failed') as Error & {
            code?: number;
            stdout?: string;
            stderr?: string;
          };
          error.code = 1;
          if (callback) {
            callback(error);
          }
        }
      );

      const gate: QualityGate = {
        name: 'lint',
        command: 'npm run lint',
        timeout: 30000,
        required: false,
        allowFailure: true,
      };

      const result = await service.runGate(gate, '/test/project');

      expect(result.passed).toBe(true);
    });

    it('should handle timeout errors', async () => {
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: Error & { killed?: boolean; code?: string }) => void) => {
          if (cmd.includes('git rev-parse')) {
            if (callback) {
              callback(null as unknown as Error & { killed?: boolean; code?: string });
            }
            return;
          }
          const error = new Error('Timed out') as Error & {
            killed?: boolean;
            code?: string;
          };
          error.killed = true;
          error.code = 'ETIMEDOUT';
          if (callback) {
            callback(error);
          }
        }
      );

      const gate: QualityGate = {
        name: 'slow-gate',
        command: 'npm run slow',
        timeout: 1000,
        required: true,
      };

      const result = await service.runGate(gate, '/test/project');

      expect(result.passed).toBe(false);
      expect(result.error).toBe('Command timed out');
    });

    it('should set CI environment variable', async () => {
      let capturedEnv: Record<string, string> | undefined;

      mockExec.mockImplementation(
        (cmd: string, options: { env?: Record<string, string> }, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (!cmd.includes('git')) {
            capturedEnv = options.env;
          }
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
      );

      const gate: QualityGate = {
        name: 'test',
        command: 'npm test',
        timeout: 60000,
        required: true,
      };

      await service.runGate(gate, '/test/project');

      expect(capturedEnv?.CI).toBe('true');
    });

    it('should include custom environment variables', async () => {
      let capturedEnv: Record<string, string> | undefined;

      mockExec.mockImplementation(
        (cmd: string, options: { env?: Record<string, string> }, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (!cmd.includes('git')) {
            capturedEnv = options.env;
          }
          if (callback) {
            callback(null, { stdout: '', stderr: '' });
          }
        }
      );

      const gate: QualityGate = {
        name: 'test',
        command: 'npm test',
        timeout: 60000,
        required: true,
        env: { NODE_ENV: 'test', CUSTOM_VAR: 'value' },
      };

      await service.runGate(gate, '/test/project');

      expect(capturedEnv?.NODE_ENV).toBe('test');
      expect(capturedEnv?.CUSTOM_VAR).toBe('value');
    });
  });

  describe('runAllGates', () => {
    beforeEach(() => {
      // Mock successful execution for all commands
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (callback) {
            callback(null, { stdout: 'Success', stderr: '' });
          }
        }
      );
      mockReadFile.mockRejectedValue(new Error('ENOENT'));
    });

    it('should run all required and optional gates by default', async () => {
      const results = await service.runAllGates('/test/project');

      expect(results.results.length).toBeGreaterThan(0);
      expect(results.allRequiredPassed).toBe(true);
      expect(results.allPassed).toBe(true);
    });

    it('should skip optional gates when skipOptional is true', async () => {
      const results = await service.runAllGates('/test/project', {
        skipOptional: true,
      });

      const lintResult = results.results.find((r) => r.name === 'lint');
      expect(lintResult).toBeUndefined();
    });

    it('should run only specified gates when gateNames provided', async () => {
      const results = await service.runAllGates('/test/project', {
        gateNames: ['typecheck'],
      });

      expect(results.results.length).toBe(1);
      expect(results.results[0].name).toBe('typecheck');
    });

    it('should include summary statistics', async () => {
      const results = await service.runAllGates('/test/project');

      expect(results.summary).toBeDefined();
      expect(results.summary.total).toBeGreaterThan(0);
      expect(results.summary.passed).toBeGreaterThanOrEqual(0);
      expect(results.summary.failed).toBeGreaterThanOrEqual(0);
      expect(results.summary.skipped).toBeGreaterThanOrEqual(0);
    });

    it('should include duration and timestamp', async () => {
      const results = await service.runAllGates('/test/project');

      expect(results.duration).toBeGreaterThanOrEqual(0);
      expect(results.timestamp).toBeDefined();
      expect(new Date(results.timestamp).getTime()).not.toBeNaN();
    });

    it('should stop on first failure when configured', async () => {
      let callCount = 0;
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: Error | null, result?: { stdout: string; stderr: string }) => void) => {
          if (cmd.includes('git rev-parse')) {
            if (callback) {
              callback(null, { stdout: 'main\n', stderr: '' });
            }
            return;
          }

          callCount++;
          if (callCount === 1) {
            // First gate fails
            const error = new Error('Failed') as Error & { code: number };
            error.code = 1;
            if (callback) {
              callback(error);
            }
          } else {
            if (callback) {
              callback(null, { stdout: 'Success', stderr: '' });
            }
          }
        }
      );

      mockReadFile.mockResolvedValue(
        `settings:\n  stopOnFirstFailure: true\nrequired:\n  - name: first\n    command: npm run first\n    timeout: 30000\n  - name: second\n    command: npm run second\n    timeout: 30000`
      );

      const results = await service.runAllGates('/test/project');

      // Should have stopped after first failure
      expect(results.results.filter((r) => !r.skipped).length).toBe(1);
      expect(results.allRequiredPassed).toBe(false);
    });

    it('should mark gates as skipped based on branch patterns', async () => {
      mockReadFile.mockResolvedValue(
        `settings:\n  runInParallel: false\nrequired:\n  - name: main-only\n    command: npm run main\n    timeout: 30000\n    runOn:\n      - main\ncustom:\n  - name: feature-only\n    command: npm run feature\n    timeout: 30000\n    required: false\n    runOn:\n      - feature/*`
      );

      // Mock being on 'develop' branch
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (cmd.includes('git rev-parse')) {
            if (callback) {
              callback(null, { stdout: 'develop\n', stderr: '' });
            }
            return;
          }
          if (callback) {
            callback(null, { stdout: 'Success', stderr: '' });
          }
        }
      );

      const results = await service.runAllGates('/test/project');

      const mainOnlyResult = results.results.find((r) => r.name === 'main-only');
      const featureOnlyResult = results.results.find((r) => r.name === 'feature-only');

      expect(mainOnlyResult?.skipped).toBe(true);
      expect(featureOnlyResult?.skipped).toBe(true);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (callback) {
            callback(null, { stdout: 'Success', stderr: '' });
          }
        }
      );
    });

    it('runTypecheck should run typecheck gate', async () => {
      const result = await service.runTypecheck('/test/project');

      expect(result.name).toBe('typecheck');
      expect(result.passed).toBe(true);
    });

    it('runTests should run tests gate', async () => {
      const result = await service.runTests('/test/project');

      expect(result.name).toBe('tests');
      expect(result.passed).toBe(true);
    });

    it('runLint should run lint gate', async () => {
      const result = await service.runLint('/test/project');

      expect(result.name).toBe('lint');
      expect(result.passed).toBe(true);
    });

    it('runBuild should run build gate', async () => {
      const result = await service.runBuild('/test/project');

      expect(result.name).toBe('build');
      expect(result.passed).toBe(true);
    });
  });

  describe('output truncation', () => {
    it('should truncate long output', async () => {
      const longOutput = 'x'.repeat(20000);

      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (callback) {
            callback(null, { stdout: longOutput, stderr: '' });
          }
        }
      );

      const gate: QualityGate = {
        name: 'verbose-gate',
        command: 'npm run verbose',
        timeout: 60000,
        required: true,
      };

      const result = await service.runGate(gate, '/test/project');

      expect(result.output.length).toBeLessThan(longOutput.length);
      expect(result.output).toContain('... [output truncated] ...');
    });

    it('should not truncate short output', async () => {
      const shortOutput = 'Short output';

      mockExec.mockImplementation(
        (cmd: string, options: unknown, callback?: (err: null, result: { stdout: string; stderr: string }) => void) => {
          if (callback) {
            callback(null, { stdout: shortOutput, stderr: '' });
          }
        }
      );

      const gate: QualityGate = {
        name: 'brief-gate',
        command: 'npm run brief',
        timeout: 60000,
        required: true,
      };

      const result = await service.runGate(gate, '/test/project');

      expect(result.output).toBe(shortOutput);
      expect(result.output).not.toContain('truncated');
    });
  });
});
