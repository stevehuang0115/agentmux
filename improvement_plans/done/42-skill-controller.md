# Task: Create Skill Controller (Optional)

## Overview

Create a REST API controller for skill management. Currently, skills are only accessible via MCP tools. Adding a REST controller enables direct API access for the frontend and external integrations.

## Priority

**Low** - Optional enhancement; MCP tools provide basic functionality

## Dependencies

- `29-skill-service.md` - Skill service must exist
- `30-skill-executor-service.md` - Skill executor service must exist

## Gap Identified

Skills can only be managed through MCP tools. There's no REST API controller like there is for roles and settings.

## Files to Create

### 1. Create `backend/src/controllers/skill/skill.controller.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { getSkillService } from '../../services/skill/skill.service.js';
import { getSkillExecutorService } from '../../services/skill/skill-executor.service.js';
import {
  CreateSkillInput,
  UpdateSkillInput,
  SkillFilter,
  SkillExecutionContext,
} from '../../types/skill.types.js';

const router = Router();

/**
 * GET /api/skills
 * List all skills with optional filtering
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: SkillFilter = {
      category: req.query.category as string | undefined,
      executionType: req.query.executionType as string | undefined,
      roleId: req.query.roleId as string | undefined,
      isBuiltin: req.query.isBuiltin === 'true' ? true :
                 req.query.isBuiltin === 'false' ? false : undefined,
      isEnabled: req.query.isEnabled === 'true' ? true :
                 req.query.isEnabled === 'false' ? false : undefined,
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
 * GET /api/skills/match
 * Find skills matching a query
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
      limit ? parseInt(limit as string) : 5
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
    if (error.name === 'SkillValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
        validationErrors: error.errors,
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
    if (error.name === 'SkillNotFoundError') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    if (error.name === 'BuiltinSkillModificationError') {
      return res.status(403).json({
        success: false,
        error: error.message,
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
    if (error.name === 'SkillNotFoundError') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    if (error.name === 'BuiltinSkillModificationError') {
      return res.status(403).json({
        success: false,
        error: error.message,
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
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
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

export default router;
```

### 2. Create `backend/src/controllers/skill/index.ts`

```typescript
import { Router } from 'express';
import skillController from './skill.controller.js';

export function createSkillRouter(): Router {
  return skillController;
}

export default skillController;
```

### 3. Create `backend/src/controllers/skill/skill.controller.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import skillController from './skill.controller.js';
import { resetSkillService } from '../../services/skill/skill.service.js';
import { resetSkillExecutorService } from '../../services/skill/skill-executor.service.js';

describe('Skill Controller', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/skills', skillController);
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    resetSkillService();
    resetSkillExecutorService();
  });

  describe('GET /api/skills', () => {
    it('should return list of skills', async () => {
      const response = await request(app).get('/api/skills');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ category: 'development' });

      expect(response.status).toBe(200);
      response.body.data.forEach((skill: any) => {
        expect(skill.category).toBe('development');
      });
    });
  });

  describe('POST /api/skills', () => {
    it('should create a new skill', async () => {
      const response = await request(app)
        .post('/api/skills')
        .send({
          name: 'Test Skill',
          description: 'A test skill',
          category: 'development',
          promptContent: '# Test\n\nInstructions here',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Skill');
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/skills')
        .send({
          name: '',
          category: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // Add more tests for PUT, DELETE, execute, etc.
});
```

### 4. Update `backend/src/controllers/index.ts`

Add the skill router:

```typescript
import { createSkillRouter } from './skill/index.js';

// In createApiRouter function:
router.use('/skills', createSkillRouter());
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills with filtering |
| GET | `/api/skills/:id` | Get skill by ID with prompt |
| GET | `/api/skills/match` | Find matching skills |
| POST | `/api/skills` | Create a new skill |
| PUT | `/api/skills/:id` | Update a skill |
| DELETE | `/api/skills/:id` | Delete a skill |
| POST | `/api/skills/:id/execute` | Execute a skill |
| PUT | `/api/skills/:id/enable` | Enable a skill |
| PUT | `/api/skills/:id/disable` | Disable a skill |
| GET | `/api/skills/role/:roleId` | Get skills for a role |
| POST | `/api/skills/refresh` | Reload skills from disk |

## Acceptance Criteria

- [ ] Skill controller created with all endpoints
- [ ] Index file exports router correctly
- [ ] Controller integrated into main router
- [ ] Comprehensive test coverage
- [ ] Error handling with proper status codes
- [ ] TypeScript compilation passes

## Testing Requirements

- Integration tests for all endpoints
- Error handling tests
- Permission tests (builtin vs custom)
- Execution tests

## Estimated Effort

30 minutes (optional task)

## Notes

- This is an optional enhancement
- MCP tools already provide skill management
- REST API is useful for frontend direct access
- Consider rate limiting for execute endpoint
