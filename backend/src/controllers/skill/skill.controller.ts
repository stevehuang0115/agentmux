/**
 * Skill Controller
 *
 * REST API endpoints for skill management.
 *
 * @module controllers/skill/skill.controller
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSkillService } from '../../services/skill/skill.service.js';
import { getSkillExecutorService } from '../../services/skill/skill-executor.service.js';
import type {
  CreateSkillInput,
  UpdateSkillInput,
  SkillFilter,
  SkillExecutionContext,
  SkillCategory,
  SkillExecutionType,
} from '../../types/skill.types.js';

const router = Router();

/**
 * GET /api/skills
 * List all skills with optional filtering
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: SkillFilter = {
      category: req.query.category as SkillCategory | undefined,
      executionType: req.query.executionType as SkillExecutionType | undefined,
      roleId: req.query.roleId as string | undefined,
      isBuiltin:
        req.query.isBuiltin === 'true'
          ? true
          : req.query.isBuiltin === 'false'
            ? false
            : undefined,
      isEnabled:
        req.query.isEnabled === 'true'
          ? true
          : req.query.isEnabled === 'false'
            ? false
            : undefined,
      search: req.query.search as string | undefined,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
    };

    const skillService = getSkillService();
    const skills = await skillService.listSkills(filter);

    res.json({
      success: true,
      data: skills,
      count: skills.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/skills/match
 * Find skills matching a query
 * Note: This route must be defined before /:id to avoid route conflicts
 */
router.get('/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, roleId, limit } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
      });
    }

    const skillService = getSkillService();
    const skills = await skillService.matchSkills(
      query as string,
      roleId as string | undefined,
      limit ? parseInt(limit as string, 10) : 5
    );

    res.json({
      success: true,
      data: skills,
      count: skills.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/skills/role/:roleId
 * Get skills assigned to a specific role
 */
router.get('/role/:roleId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillService = getSkillService();
    const skills = await skillService.getSkillsForRole(req.params.roleId);

    res.json({
      success: true,
      data: skills,
      count: skills.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/skills/refresh
 * Refresh skills from disk
 */
router.post('/refresh', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const skillService = getSkillService();
    await skillService.refresh();

    res.json({
      success: true,
      message: 'Skills refreshed from disk',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/skills/:id
 * Get a single skill by ID with full prompt content
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillService = getSkillService();
    const skill = await skillService.getSkill(req.params.id);

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: 'Skill not found',
      });
    }

    res.json({
      success: true,
      data: skill,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/skills
 * Create a new user-defined skill
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: CreateSkillInput = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      promptContent: req.body.promptContent,
      execution: req.body.execution,
      environment: req.body.environment,
      assignableRoles: req.body.assignableRoles,
      triggers: req.body.triggers,
      tags: req.body.tags,
    };

    const skillService = getSkillService();
    const skill = await skillService.createSkill(input);

    res.status(201).json({
      success: true,
      data: skill,
    });
  } catch (error) {
    if ((error as Error).name === 'SkillValidationError') {
      const validationError = error as Error & { errors?: string[] };
      return res.status(400).json({
        success: false,
        error: validationError.message,
        validationErrors: validationError.errors,
      });
    }
    next(error);
  }
});

/**
 * PUT /api/skills/:id
 * Update an existing skill
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: UpdateSkillInput = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      promptContent: req.body.promptContent,
      execution: req.body.execution,
      environment: req.body.environment,
      assignableRoles: req.body.assignableRoles,
      triggers: req.body.triggers,
      tags: req.body.tags,
      isEnabled: req.body.isEnabled,
    };

    const skillService = getSkillService();
    const skill = await skillService.updateSkill(req.params.id, input);

    res.json({
      success: true,
      data: skill,
    });
  } catch (error) {
    if ((error as Error).name === 'SkillNotFoundError') {
      return res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
    if ((error as Error).name === 'BuiltinSkillModificationError') {
      return res.status(403).json({
        success: false,
        error: (error as Error).message,
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/skills/:id
 * Delete a user-created skill
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillService = getSkillService();
    await skillService.deleteSkill(req.params.id);

    res.json({
      success: true,
      message: 'Skill deleted successfully',
    });
  } catch (error) {
    if ((error as Error).name === 'SkillNotFoundError') {
      return res.status(404).json({
        success: false,
        error: (error as Error).message,
      });
    }
    if ((error as Error).name === 'BuiltinSkillModificationError') {
      return res.status(403).json({
        success: false,
        error: (error as Error).message,
      });
    }
    next(error);
  }
});

/**
 * POST /api/skills/:id/execute
 * Execute a skill
 */
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context: SkillExecutionContext = {
      agentId: req.body.agentId || 'api-user',
      roleId: req.body.roleId || 'default',
      projectId: req.body.projectId,
      taskId: req.body.taskId,
      userInput: req.body.userInput,
      metadata: req.body.metadata,
    };

    const executor = getSkillExecutorService();
    const result = await executor.executeSkill(req.params.id, context);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/skills/:id/enable
 * Enable a skill
 */
router.put('/:id/enable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillService = getSkillService();
    const skill = await skillService.setSkillEnabled(req.params.id, true);

    res.json({
      success: true,
      data: skill,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/skills/:id/disable
 * Disable a skill
 */
router.put('/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const skillService = getSkillService();
    const skill = await skillService.setSkillEnabled(req.params.id, false);

    res.json({
      success: true,
      data: skill,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
