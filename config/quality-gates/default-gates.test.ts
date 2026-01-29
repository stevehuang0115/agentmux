/**
 * Tests for Default Quality Gate Configuration
 *
 * @module config/quality-gates/default-gates.test
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GATES,
  MINIMAL_GATES,
  FULL_GATES,
  DEFAULT_SETTINGS,
  DEFAULT_REQUIRED_GATES,
  DEFAULT_OPTIONAL_GATES,
  TYPECHECK_GATE,
  TESTS_GATE,
  BUILD_GATE,
  LINT_GATE,
  COVERAGE_GATE,
  createGateConfig,
  createGate,
} from './default-gates.js';
import { GATE_TIMEOUTS, STANDARD_GATES } from '../../backend/src/types/quality-gate.types.js';

describe('Default Quality Gate Configuration', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have correct default settings', () => {
      expect(DEFAULT_SETTINGS.runInParallel).toBe(false);
      expect(DEFAULT_SETTINGS.stopOnFirstFailure).toBe(false);
      expect(DEFAULT_SETTINGS.timeout).toBe(GATE_TIMEOUTS.TOTAL);
    });
  });

  describe('Individual Gates', () => {
    describe('TYPECHECK_GATE', () => {
      it('should be correctly configured', () => {
        expect(TYPECHECK_GATE.name).toBe(STANDARD_GATES.TYPECHECK);
        expect(TYPECHECK_GATE.command).toBe('npm run typecheck');
        expect(TYPECHECK_GATE.timeout).toBe(GATE_TIMEOUTS.TYPECHECK);
        expect(TYPECHECK_GATE.required).toBe(true);
        expect(TYPECHECK_GATE.description).toBe('TypeScript compilation check');
      });
    });

    describe('TESTS_GATE', () => {
      it('should be correctly configured', () => {
        expect(TESTS_GATE.name).toBe(STANDARD_GATES.TESTS);
        expect(TESTS_GATE.command).toBe('npm test -- --passWithNoTests');
        expect(TESTS_GATE.timeout).toBe(GATE_TIMEOUTS.TESTS);
        expect(TESTS_GATE.required).toBe(true);
        expect(TESTS_GATE.env).toEqual({ CI: 'true' });
      });
    });

    describe('BUILD_GATE', () => {
      it('should be correctly configured', () => {
        expect(BUILD_GATE.name).toBe(STANDARD_GATES.BUILD);
        expect(BUILD_GATE.command).toBe('npm run build');
        expect(BUILD_GATE.timeout).toBe(GATE_TIMEOUTS.BUILD);
        expect(BUILD_GATE.required).toBe(true);
      });
    });

    describe('LINT_GATE', () => {
      it('should be correctly configured as optional', () => {
        expect(LINT_GATE.name).toBe(STANDARD_GATES.LINT);
        expect(LINT_GATE.command).toBe('npm run lint');
        expect(LINT_GATE.timeout).toBe(GATE_TIMEOUTS.LINT);
        expect(LINT_GATE.required).toBe(false);
        expect(LINT_GATE.allowFailure).toBe(true);
      });
    });

    describe('COVERAGE_GATE', () => {
      it('should be correctly configured with thresholds', () => {
        expect(COVERAGE_GATE.name).toBe(STANDARD_GATES.COVERAGE);
        expect(COVERAGE_GATE.required).toBe(false);
        expect(COVERAGE_GATE.threshold).toEqual({
          lines: 80,
          branches: 70,
          functions: 80,
          statements: 80,
        });
      });
    });
  });

  describe('Gate Arrays', () => {
    describe('DEFAULT_REQUIRED_GATES', () => {
      it('should contain typecheck, tests, and build', () => {
        expect(DEFAULT_REQUIRED_GATES).toHaveLength(3);
        expect(DEFAULT_REQUIRED_GATES.map(g => g.name)).toEqual([
          'typecheck',
          'tests',
          'build',
        ]);
      });

      it('should all be marked as required', () => {
        expect(DEFAULT_REQUIRED_GATES.every(g => g.required)).toBe(true);
      });
    });

    describe('DEFAULT_OPTIONAL_GATES', () => {
      it('should contain lint gate', () => {
        expect(DEFAULT_OPTIONAL_GATES).toHaveLength(1);
        expect(DEFAULT_OPTIONAL_GATES[0].name).toBe('lint');
      });

      it('should all be marked as not required', () => {
        expect(DEFAULT_OPTIONAL_GATES.every(g => !g.required)).toBe(true);
      });
    });
  });

  describe('Gate Configurations', () => {
    describe('DEFAULT_GATES', () => {
      it('should have default settings', () => {
        expect(DEFAULT_GATES.settings).toEqual(DEFAULT_SETTINGS);
      });

      it('should have required gates', () => {
        expect(DEFAULT_GATES.required).toEqual(DEFAULT_REQUIRED_GATES);
      });

      it('should have optional gates', () => {
        expect(DEFAULT_GATES.optional).toEqual(DEFAULT_OPTIONAL_GATES);
      });

      it('should have empty custom gates', () => {
        expect(DEFAULT_GATES.custom).toEqual([]);
      });
    });

    describe('MINIMAL_GATES', () => {
      it('should only have typecheck as required', () => {
        expect(MINIMAL_GATES.required).toHaveLength(1);
        expect(MINIMAL_GATES.required[0].name).toBe('typecheck');
      });

      it('should have no optional or custom gates', () => {
        expect(MINIMAL_GATES.optional).toHaveLength(0);
        expect(MINIMAL_GATES.custom).toHaveLength(0);
      });
    });

    describe('FULL_GATES', () => {
      it('should have extended timeout', () => {
        expect(FULL_GATES.settings.timeout).toBe(GATE_TIMEOUTS.TOTAL * 2);
      });

      it('should have all required gates', () => {
        expect(FULL_GATES.required).toHaveLength(3);
      });

      it('should have lint and coverage as optional', () => {
        expect(FULL_GATES.optional).toHaveLength(2);
        expect(FULL_GATES.optional.map(g => g.name)).toContain('lint');
        expect(FULL_GATES.optional.map(g => g.name)).toContain('coverage');
      });
    });
  });

  describe('createGateConfig', () => {
    it('should create config with defaults when no overrides', () => {
      const config = createGateConfig({});
      expect(config.settings).toEqual(DEFAULT_SETTINGS);
      expect(config.required).toEqual(DEFAULT_REQUIRED_GATES);
      expect(config.optional).toEqual(DEFAULT_OPTIONAL_GATES);
      expect(config.custom).toEqual([]);
    });

    it('should override settings', () => {
      const config = createGateConfig({
        settings: {
          runInParallel: true,
          stopOnFirstFailure: true,
          timeout: 600000,
        },
      });
      expect(config.settings.runInParallel).toBe(true);
      expect(config.settings.stopOnFirstFailure).toBe(true);
      expect(config.settings.timeout).toBe(600000);
    });

    it('should override required gates', () => {
      const customRequired = [TYPECHECK_GATE];
      const config = createGateConfig({ required: customRequired });
      expect(config.required).toEqual(customRequired);
    });

    it('should override optional gates', () => {
      const config = createGateConfig({ optional: [] });
      expect(config.optional).toEqual([]);
    });

    it('should add custom gates', () => {
      const customGate = createGate('custom', 'npm run custom');
      const config = createGateConfig({ custom: [customGate] });
      expect(config.custom).toHaveLength(1);
      expect(config.custom[0].name).toBe('custom');
    });
  });

  describe('createGate', () => {
    it('should create a gate with minimal options', () => {
      const gate = createGate('test', 'npm test');
      expect(gate.name).toBe('test');
      expect(gate.command).toBe('npm test');
      expect(gate.timeout).toBe(GATE_TIMEOUTS.DEFAULT);
      expect(gate.required).toBe(false);
    });

    it('should create a gate with all options', () => {
      const gate = createGate('coverage', 'npm run coverage', {
        timeout: 180000,
        required: true,
        description: 'Coverage check',
        allowFailure: false,
        env: { CI: 'true' },
        runOn: ['main'],
        threshold: { lines: 90 },
      });

      expect(gate.name).toBe('coverage');
      expect(gate.command).toBe('npm run coverage');
      expect(gate.timeout).toBe(180000);
      expect(gate.required).toBe(true);
      expect(gate.description).toBe('Coverage check');
      expect(gate.allowFailure).toBe(false);
      expect(gate.env).toEqual({ CI: 'true' });
      expect(gate.runOn).toEqual(['main']);
      expect(gate.threshold).toEqual({ lines: 90 });
    });

    it('should use default timeout when not specified', () => {
      const gate = createGate('lint', 'npm run lint');
      expect(gate.timeout).toBe(GATE_TIMEOUTS.DEFAULT);
    });

    it('should default required to false', () => {
      const gate = createGate('optional', 'npm run optional');
      expect(gate.required).toBe(false);
    });
  });
});
