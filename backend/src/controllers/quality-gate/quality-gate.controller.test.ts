/**
 * Tests for Quality Gate Controller
 *
 * Validates the REST handler for the quality gate check endpoint
 * including input handling, service delegation, and error propagation.
 *
 * @module controllers/quality-gate/quality-gate.controller.test
 */

import { checkQualityGates } from './quality-gate.controller.js';
import type { GateRunResults } from '../../types/quality-gate.types.js';

// Mock LoggerService before any imports that use it
jest.mock('../../services/core/logger.service.js', () => ({
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

// Mock QualityGateService
const mockRunAllGates = jest.fn();

jest.mock('../../services/quality/quality-gate.service.js', () => ({
  QualityGateService: {
    getInstance: () => ({
      runAllGates: mockRunAllGates,
    }),
  },
}));

describe('QualityGateController', () => {
  let mockRes: { json: jest.Mock; status: jest.Mock };
  let mockNext: jest.Mock;

  const sampleResults: GateRunResults = {
    allRequiredPassed: true,
    allPassed: true,
    results: [
      {
        name: 'typecheck',
        passed: true,
        required: true,
        duration: 5000,
        output: 'No errors found',
        exitCode: 0,
      },
    ],
    summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
    duration: 5200,
    timestamp: '2026-02-12T10:00:00.000Z',
  };

  beforeEach(() => {
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    mockRunAllGates.mockReset();
  });

  // ========================= checkQualityGates =========================

  describe('checkQualityGates', () => {
    it('should run all gates and return results', async () => {
      mockRunAllGates.mockResolvedValue(sampleResults);

      await checkQualityGates(
        { body: { projectPath: '/path/to/project' } } as any,
        mockRes as any,
        mockNext
      );

      expect(mockRunAllGates).toHaveBeenCalledWith('/path/to/project', {
        gateNames: undefined,
        skipOptional: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: sampleResults,
      });
    });

    it('should default projectPath to process.cwd() when not provided', async () => {
      mockRunAllGates.mockResolvedValue(sampleResults);

      await checkQualityGates(
        { body: {} } as any,
        mockRes as any,
        mockNext
      );

      expect(mockRunAllGates).toHaveBeenCalledWith(process.cwd(), {
        gateNames: undefined,
        skipOptional: undefined,
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: sampleResults,
      });
    });

    it('should pass gates filter to service', async () => {
      mockRunAllGates.mockResolvedValue(sampleResults);

      await checkQualityGates(
        {
          body: {
            projectPath: '/project',
            gates: ['typecheck', 'lint'],
            skipOptional: true,
          },
        } as any,
        mockRes as any,
        mockNext
      );

      expect(mockRunAllGates).toHaveBeenCalledWith('/project', {
        gateNames: ['typecheck', 'lint'],
        skipOptional: true,
      });
    });

    it('should propagate errors via next()', async () => {
      const error = new Error('Gate execution failed');
      mockRunAllGates.mockRejectedValue(error);

      await checkQualityGates(
        { body: { projectPath: '/project' } } as any,
        mockRes as any,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
