/**
 * Skill Controller Tests
 *
 * Integration tests for the skill REST API controller.
 *
 * @module controllers/skill/skill.controller.test
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction, Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { SkillService, resetSkillService } from '../../services/skill/skill.service.js';
import type {
  CreateSkillInput,
  UpdateSkillInput,
  SkillFilter,
  SkillCategory,
  SkillExecutionType,
} from '../../types/skill.types.js';
import { isValidSkillCategory, isValidExecutionType } from '../../types/skill.types.js';

/**
 * Create a skill controller router with a specific service
 */
function createSkillControllerWithService(service: SkillService): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const categoryParam = req.query.category as string | undefined;
      const executionTypeParam = req.query.executionType as string | undefined;

      const filter: SkillFilter = {
        category: categoryParam && isValidSkillCategory(categoryParam)
          ? categoryParam as SkillCategory
          : undefined,
        executionType: executionTypeParam && isValidExecutionType(executionTypeParam)
          ? executionTypeParam as SkillExecutionType
          : undefined,
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

      const skills = await service.listSkills(filter);
      res.json({ success: true, data: skills, count: skills.length });
    } catch (error) {
      next(error);
    }
  });

  router.get('/match', async (req, res, next) => {
    try {
      const { query, roleId, limit } = req.query;
      if (!query) {
        return res.status(400).json({ success: false, error: 'Query parameter is required' });
      }
      const skills = await service.matchSkills(
        query as string,
        roleId as string | undefined,
        limit ? parseInt(limit as string, 10) : 5
      );
      res.json({ success: true, data: skills, count: skills.length });
    } catch (error) {
      next(error);
    }
  });

  router.get('/role/:roleId', async (req, res, next) => {
    try {
      const skills = await service.getSkillsForRole(req.params.roleId);
      res.json({ success: true, data: skills, count: skills.length });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (_req, res, next) => {
    try {
      await service.refresh();
      res.json({ success: true, message: 'Skills refreshed from disk' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const skill = await service.getSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ success: false, error: 'Skill not found' });
      }
      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
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
      const skill = await service.createSkill(input);
      res.status(201).json({ success: true, data: skill });
    } catch (error: unknown) {
      const err = error as Error & { errors?: string[] };
      if (err.name === 'SkillValidationError') {
        return res.status(400).json({
          success: false,
          error: err.message,
          validationErrors: err.errors ?? [],
        });
      }
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
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
      const skill = await service.updateSkill(req.params.id, input);
      res.json({ success: true, data: skill });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'SkillNotFoundError') {
        return res.status(404).json({ success: false, error: err.message });
      }
      if (err.name === 'BuiltinSkillModificationError') {
        return res.status(403).json({ success: false, error: err.message });
      }
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await service.deleteSkill(req.params.id);
      res.json({ success: true, message: 'Skill deleted successfully' });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'SkillNotFoundError') {
        return res.status(404).json({ success: false, error: err.message });
      }
      if (err.name === 'BuiltinSkillModificationError') {
        return res.status(403).json({ success: false, error: err.message });
      }
      next(error);
    }
  });

  router.put('/:id/enable', async (req, res, next) => {
    try {
      const skill = await service.setSkillEnabled(req.params.id, true);
      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/disable', async (req, res, next) => {
    try {
      const skill = await service.setSkillEnabled(req.params.id, false);
      res.json({ success: true, data: skill });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

describe('Skill Controller', () => {
  let app: Express;
  let testDir: string;
  let builtinSkillsDir: string;
  let userSkillsDir: string;
  let skillService: SkillService;

  beforeEach(async () => {
    // Create temporary directories for testing
    testDir = path.join(
      os.tmpdir(),
      `skill-controller-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    builtinSkillsDir = path.join(testDir, 'builtin');
    userSkillsDir = path.join(testDir, 'user');

    await fs.mkdir(builtinSkillsDir, { recursive: true });
    await fs.mkdir(userSkillsDir, { recursive: true });

    // Create a sample builtin skill
    const sampleSkillDir = path.join(builtinSkillsDir, 'code-review');
    await fs.mkdir(sampleSkillDir, { recursive: true });

    const sampleSkill = {
      id: 'code-review',
      name: 'Code Review',
      description: 'Reviews code for quality and best practices',
      category: 'development',
      promptFile: 'instructions.md',
      execution: { type: 'prompt-only' },
      assignableRoles: ['developer'],
      triggers: ['review'],
      tags: ['code', 'review', 'quality'],
      version: '1.0.0',
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(sampleSkillDir, 'skill.json'),
      JSON.stringify(sampleSkill, null, 2)
    );

    await fs.writeFile(
      path.join(sampleSkillDir, 'instructions.md'),
      '# Code Review\n\nReview the code for quality issues...'
    );

    // Create and initialize the skill service
    skillService = new SkillService({
      builtinSkillsDir,
      userSkillsDir,
    });
    await skillService.initialize();

    // Create Express app with injected service
    app = express();
    app.use(express.json());
    app.use('/api/skills', createSkillControllerWithService(skillService));

    // Error handler
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetSkillService();
  });

  describe('GET /api/skills', () => {
    it('should return list of skills', async () => {
      const response = await request(app).get('/api/skills');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ category: 'development' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((skill: { category: string }) => {
        expect(skill.category).toBe('development');
      });
    });

    it('should filter by isBuiltin=true', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ isBuiltin: 'true' });

      expect(response.status).toBe(200);
      response.body.data.forEach((skill: { isBuiltin: boolean }) => {
        expect(skill.isBuiltin).toBe(true);
      });
    });

    it('should filter by search term', async () => {
      const response = await request(app)
        .get('/api/skills')
        .query({ search: 'review' });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/skills/match', () => {
    it('should find matching skills', async () => {
      const response = await request(app)
        .get('/api/skills/match')
        .query({ query: 'code review' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 400 when query is missing', async () => {
      const response = await request(app).get('/api/skills/match');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Query parameter is required');
    });
  });

  describe('GET /api/skills/role/:roleId', () => {
    it('should return skills for a role', async () => {
      const response = await request(app).get('/api/skills/role/developer');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/skills/refresh', () => {
    it('should refresh skills from disk', async () => {
      const response = await request(app).post('/api/skills/refresh');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Skills refreshed from disk');
    });
  });

  describe('GET /api/skills/:id', () => {
    it('should return a skill by ID', async () => {
      const response = await request(app).get('/api/skills/code-review');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('code-review');
      expect(response.body.data.name).toBe('Code Review');
      expect(response.body.data.promptContent).toBeDefined();
    });

    it('should return 404 for non-existent skill', async () => {
      const response = await request(app).get('/api/skills/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/skills', () => {
    it('should create a new skill', async () => {
      const response = await request(app).post('/api/skills').send({
        name: 'Test Skill',
        description: 'A test skill',
        category: 'development',
        promptContent: '# Test\n\nInstructions here',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Skill');
      expect(response.body.data.isBuiltin).toBe(false);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app).post('/api/skills').send({
        name: '',
        description: '',
        category: 'development',
        promptContent: '',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.validationErrors).toBeDefined();
    });
  });

  describe('PUT /api/skills/:id', () => {
    let createdSkillId: string;

    beforeEach(async () => {
      const createResponse = await request(app).post('/api/skills').send({
        name: 'Update Test Skill',
        description: 'A skill to update',
        category: 'development',
        promptContent: 'Original content',
      });
      createdSkillId = createResponse.body.data.id;
    });

    it('should update an existing skill', async () => {
      const response = await request(app)
        .put(`/api/skills/${createdSkillId}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should return 404 for non-existent skill', async () => {
      const response = await request(app)
        .put('/api/skills/non-existent')
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for builtin skill', async () => {
      const response = await request(app).put('/api/skills/code-review').send({
        name: 'Modified Code Review',
      });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/skills/:id', () => {
    let createdSkillId: string;

    beforeEach(async () => {
      const createResponse = await request(app).post('/api/skills').send({
        name: 'Delete Test Skill',
        description: 'A skill to delete',
        category: 'development',
        promptContent: 'Content',
      });
      createdSkillId = createResponse.body.data.id;
    });

    it('should delete a user-created skill', async () => {
      const response = await request(app).delete(`/api/skills/${createdSkillId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify skill is deleted
      const getResponse = await request(app).get(`/api/skills/${createdSkillId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent skill', async () => {
      const response = await request(app).delete('/api/skills/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for builtin skill', async () => {
      const response = await request(app).delete('/api/skills/code-review');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/skills/:id/enable', () => {
    let createdSkillId: string;

    beforeEach(async () => {
      const createResponse = await request(app).post('/api/skills').send({
        name: 'Enable Test Skill',
        description: 'A skill to enable/disable',
        category: 'development',
        promptContent: 'Content',
      });
      createdSkillId = createResponse.body.data.id;

      // Disable it first
      await request(app).put(`/api/skills/${createdSkillId}/disable`);
    });

    it('should enable a skill', async () => {
      const response = await request(app).put(`/api/skills/${createdSkillId}/enable`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isEnabled).toBe(true);
    });
  });

  describe('PUT /api/skills/:id/disable', () => {
    let createdSkillId: string;

    beforeEach(async () => {
      const createResponse = await request(app).post('/api/skills').send({
        name: 'Disable Test Skill',
        description: 'A skill to disable',
        category: 'development',
        promptContent: 'Content',
      });
      createdSkillId = createResponse.body.data.id;
    });

    it('should disable a skill', async () => {
      const response = await request(app).put(`/api/skills/${createdSkillId}/disable`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isEnabled).toBe(false);
    });
  });
});
