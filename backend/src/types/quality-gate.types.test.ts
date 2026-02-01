/**
 * Tests for Quality Gate Type Definitions
 *
 * @module types/quality-gate.types.test
 */

// Jest globals are available automatically
import {
  QualityGate,
  GateSettings,
  GateConfig,
  GateResult,
  GateSummary,
  GateRunResults,
  GATE_TIMEOUTS,
  STANDARD_GATES,
  MAX_GATE_OUTPUT_LENGTH,
} from './quality-gate.types.js';

describe('Quality Gate Types', () => {
  describe('QualityGate interface', () => {
    it('should define a minimal gate', () => {
      const gate: QualityGate = {
        name: 'test-gate',
        command: 'npm test',
        timeout: 60000,
        required: true,
      };

      expect(gate.name).toBe('test-gate');
      expect(gate.command).toBe('npm test');
      expect(gate.timeout).toBe(60000);
      expect(gate.required).toBe(true);
    });

    it('should define a gate with all optional fields', () => {
      const gate: QualityGate = {
        name: 'coverage',
        command: 'npm run coverage',
        timeout: 120000,
        required: false,
        description: 'Code coverage check',
        allowFailure: true,
        env: { CI: 'true', NODE_ENV: 'test' },
        runOn: ['main', 'feature/*'],
        threshold: { lines: 80, branches: 70 },
      };

      expect(gate.description).toBe('Code coverage check');
      expect(gate.allowFailure).toBe(true);
      expect(gate.env).toEqual({ CI: 'true', NODE_ENV: 'test' });
      expect(gate.runOn).toEqual(['main', 'feature/*']);
      expect(gate.threshold).toEqual({ lines: 80, branches: 70 });
    });
  });

  describe('GateSettings interface', () => {
    it('should define gate execution settings', () => {
      const settings: GateSettings = {
        runInParallel: false,
        stopOnFirstFailure: true,
        timeout: 300000,
      };

      expect(settings.runInParallel).toBe(false);
      expect(settings.stopOnFirstFailure).toBe(true);
      expect(settings.timeout).toBe(300000);
    });
  });

  describe('GateConfig interface', () => {
    it('should define a complete gate configuration', () => {
      const config: GateConfig = {
        settings: {
          runInParallel: false,
          stopOnFirstFailure: false,
          timeout: 300000,
        },
        required: [
          { name: 'typecheck', command: 'npm run typecheck', timeout: 60000, required: true },
          { name: 'tests', command: 'npm test', timeout: 120000, required: true },
        ],
        optional: [
          { name: 'lint', command: 'npm run lint', timeout: 30000, required: false },
        ],
        custom: [],
      };

      expect(config.required).toHaveLength(2);
      expect(config.optional).toHaveLength(1);
      expect(config.custom).toHaveLength(0);
    });
  });

  describe('GateResult interface', () => {
    it('should define a passing gate result', () => {
      const result: GateResult = {
        name: 'typecheck',
        passed: true,
        required: true,
        duration: 5000,
        output: 'No errors found',
        exitCode: 0,
      };

      expect(result.passed).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should define a failing gate result', () => {
      const result: GateResult = {
        name: 'tests',
        passed: false,
        required: true,
        duration: 10000,
        output: 'FAILED src/test.ts',
        exitCode: 1,
        error: 'Tests failed: 2 failures',
      };

      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('Tests failed: 2 failures');
    });

    it('should define a skipped gate result', () => {
      const result: GateResult = {
        name: 'e2e',
        passed: true,
        required: false,
        duration: 0,
        output: '',
        exitCode: 0,
        skipped: true,
        skipReason: 'Branch does not match runOn pattern',
      };

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBeDefined();
    });
  });

  describe('GateSummary interface', () => {
    it('should define gate summary statistics', () => {
      const summary: GateSummary = {
        total: 5,
        passed: 3,
        failed: 1,
        skipped: 1,
      };

      expect(summary.total).toBe(5);
      expect(summary.passed + summary.failed + summary.skipped).toBeLessThanOrEqual(summary.total);
    });
  });

  describe('GateRunResults interface', () => {
    it('should define complete run results when all pass', () => {
      const results: GateRunResults = {
        allRequiredPassed: true,
        allPassed: true,
        results: [
          { name: 'typecheck', passed: true, required: true, duration: 5000, output: '', exitCode: 0 },
          { name: 'tests', passed: true, required: true, duration: 10000, output: '', exitCode: 0 },
        ],
        summary: { total: 2, passed: 2, failed: 0, skipped: 0 },
        duration: 15000,
        timestamp: new Date().toISOString(),
      };

      expect(results.allRequiredPassed).toBe(true);
      expect(results.allPassed).toBe(true);
    });

    it('should define run results with failures', () => {
      const results: GateRunResults = {
        allRequiredPassed: false,
        allPassed: false,
        results: [
          { name: 'typecheck', passed: true, required: true, duration: 5000, output: '', exitCode: 0 },
          { name: 'tests', passed: false, required: true, duration: 10000, output: 'Error', exitCode: 1 },
        ],
        summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
        duration: 15000,
        timestamp: new Date().toISOString(),
      };

      expect(results.allRequiredPassed).toBe(false);
      expect(results.summary.failed).toBe(1);
    });
  });

  describe('GATE_TIMEOUTS constants', () => {
    it('should have correct timeout values', () => {
      expect(GATE_TIMEOUTS.TYPECHECK).toBe(60000);
      expect(GATE_TIMEOUTS.TESTS).toBe(120000);
      expect(GATE_TIMEOUTS.BUILD).toBe(180000);
      expect(GATE_TIMEOUTS.LINT).toBe(30000);
      expect(GATE_TIMEOUTS.DEFAULT).toBe(60000);
      expect(GATE_TIMEOUTS.TOTAL).toBe(300000);
    });

    it('should have immutable values (as const)', () => {
      // TypeScript prevents mutation at compile time
      // At runtime, we verify the values are numbers
      expect(typeof GATE_TIMEOUTS.TYPECHECK).toBe('number');
      expect(typeof GATE_TIMEOUTS.TOTAL).toBe('number');
    });
  });

  describe('STANDARD_GATES constants', () => {
    it('should have all standard gate names', () => {
      expect(STANDARD_GATES.TYPECHECK).toBe('typecheck');
      expect(STANDARD_GATES.TESTS).toBe('tests');
      expect(STANDARD_GATES.BUILD).toBe('build');
      expect(STANDARD_GATES.LINT).toBe('lint');
      expect(STANDARD_GATES.COVERAGE).toBe('coverage');
      expect(STANDARD_GATES.E2E).toBe('e2e');
      expect(STANDARD_GATES.SECURITY).toBe('security');
    });
  });

  describe('MAX_GATE_OUTPUT_LENGTH constant', () => {
    it('should be 10000 characters', () => {
      expect(MAX_GATE_OUTPUT_LENGTH).toBe(10000);
    });
  });
});
