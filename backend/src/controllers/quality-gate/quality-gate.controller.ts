/**
 * Quality Gate REST Controller
 *
 * Exposes quality gate operations via REST API for orchestrator bash skills.
 * Wraps the QualityGateService to provide an HTTP endpoint for running
 * quality gates (typecheck, tests, build, lint) against a project.
 *
 * @module controllers/quality-gate/quality-gate.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { QualityGateService } from '../../services/quality/quality-gate.service.js';
import type { GateRunResults } from '../../types/quality-gate.types.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('QualityGateController');

/**
 * POST /api/quality-gates/check
 *
 * Run quality gates against a project directory. Executes configured quality
 * gates (typecheck, tests, build, lint) and returns pass/fail results for each.
 *
 * @param req - Express request with body: { projectPath?, gates?, skipOptional? }
 * @param res - Express response returning { success, data: GateRunResults }
 * @param next - Express next function for error propagation
 *
 * @example
 * ```
 * POST /api/quality-gates/check
 * {
 *   "projectPath": "/path/to/project",
 *   "gates": ["typecheck", "tests"],
 *   "skipOptional": true
 * }
 * ```
 */
export async function checkQualityGates(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { projectPath, gates, skipOptional } = req.body;

    const resolvedPath = projectPath || process.cwd();

    const service = QualityGateService.getInstance();
    const results: GateRunResults = await service.runAllGates(resolvedPath, {
      gateNames: gates,
      skipOptional,
    });

    logger.info('Quality gates executed via REST', {
      projectPath: resolvedPath,
      allPassed: results.allPassed,
      allRequiredPassed: results.allRequiredPassed,
      summary: results.summary,
    });

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to run quality gates', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
