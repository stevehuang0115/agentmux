/**
 * Tests for Role Controller
 *
 * @module controllers/settings/role.controller.test
 */

// Jest globals are available automatically
import request from 'supertest';
import express, { Express, Request, Response, NextFunction, Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { RoleService, resetRoleService } from '../../services/settings/role.service.js';
import { RoleStorageFormat, CreateRoleInput, UpdateRoleInput, RoleFilter, RoleCategory, isValidRoleCategory } from '../../types/role.types.js';

/**
 * Create a role controller router with a specific service
 */
function createRoleControllerWithService(service: RoleService): Router {
  const router = Router();

  router.get('/default', async (req, res, next) => {
    try {
      const role = await service.getDefaultRole();
      if (!role) {
        return res.status(404).json({ success: false, error: 'No default role configured' });
      }
      res.json({ success: true, data: role });
    } catch (error) { next(error); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const categoryParam = req.query.category as string | undefined;
      const filter: RoleFilter = {
        category: categoryParam && isValidRoleCategory(categoryParam) ? categoryParam as RoleCategory : undefined,
        isBuiltin: req.query.isBuiltin === 'true' ? true : req.query.isBuiltin === 'false' ? false : undefined,
        hasSkill: req.query.hasSkill as string | undefined,
        search: req.query.search as string | undefined,
      };
      const roles = await service.listRoles(filter);
      res.json({ success: true, data: roles, count: roles.length });
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const role = await service.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ success: false, error: 'Role not found' });
      }
      res.json({ success: true, data: role });
    } catch (error) { next(error); }
  });

  router.post('/', async (req, res, next) => {
    try {
      const input: CreateRoleInput = {
        name: req.body.name, displayName: req.body.displayName, description: req.body.description,
        category: req.body.category, systemPromptContent: req.body.systemPromptContent,
        assignedSkills: req.body.assignedSkills, isDefault: req.body.isDefault,
      };
      const role = await service.createRole(input);
      res.status(201).json({ success: true, data: role });
    } catch (error: unknown) {
      const err = error as Error & { errors?: string[] };
      if (err.name === 'RoleValidationError') {
        return res.status(400).json({ success: false, error: err.message, validationErrors: err.errors ?? [] });
      }
      if (err.name === 'DuplicateRoleNameError') {
        return res.status(409).json({ success: false, error: err.message });
      }
      next(error);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const input: UpdateRoleInput = {
        displayName: req.body.displayName, description: req.body.description, category: req.body.category,
        systemPromptContent: req.body.systemPromptContent, assignedSkills: req.body.assignedSkills, isDefault: req.body.isDefault,
      };
      const role = await service.updateRole(req.params.id, input);
      res.json({ success: true, data: role });
    } catch (error: unknown) {
      const err = error as Error & { errors?: string[] };
      if (err.name === 'RoleNotFoundError') return res.status(404).json({ success: false, error: err.message });
      if (err.name === 'BuiltinRoleModificationError') return res.status(403).json({ success: false, error: err.message });
      if (err.name === 'RoleValidationError') return res.status(400).json({ success: false, error: err.message, validationErrors: err.errors ?? [] });
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await service.deleteRole(req.params.id);
      res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'RoleNotFoundError') return res.status(404).json({ success: false, error: err.message });
      if (err.name === 'BuiltinRoleModificationError') return res.status(403).json({ success: false, error: err.message });
      next(error);
    }
  });

  router.post('/:id/skills', async (req, res, next) => {
    try {
      const { skillIds } = req.body;
      if (!Array.isArray(skillIds)) return res.status(400).json({ success: false, error: 'skillIds must be an array' });
      const role = await service.assignSkills(req.params.id, skillIds);
      res.json({ success: true, data: role });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'RoleNotFoundError') return res.status(404).json({ success: false, error: err.message });
      if (err.name === 'BuiltinRoleModificationError') return res.status(403).json({ success: false, error: err.message });
      next(error);
    }
  });

  router.delete('/:id/skills', async (req, res, next) => {
    try {
      const { skillIds } = req.body;
      if (!Array.isArray(skillIds)) return res.status(400).json({ success: false, error: 'skillIds must be an array' });
      const role = await service.removeSkills(req.params.id, skillIds);
      res.json({ success: true, data: role });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'RoleNotFoundError') return res.status(404).json({ success: false, error: err.message });
      if (err.name === 'BuiltinRoleModificationError') return res.status(403).json({ success: false, error: err.message });
      next(error);
    }
  });

  router.post('/:id/set-default', async (req, res, next) => {
    try {
      const role = await service.setDefaultRole(req.params.id);
      res.json({ success: true, data: role });
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'RoleNotFoundError') return res.status(404).json({ success: false, error: err.message });
      next(error);
    }
  });

  return router;
}

describe('Role Controller', () => {
  let app: Express;
  let testDir: string;
  let builtinRolesDir: string;
  let userRolesDir: string;
  let roleService: RoleService;

  beforeEach(async () => {
    // Create temporary directories for testing
    testDir = path.join(os.tmpdir(), `role-controller-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    builtinRolesDir = path.join(testDir, 'builtin');
    userRolesDir = path.join(testDir, 'user');

    await fs.mkdir(builtinRolesDir, { recursive: true });
    await fs.mkdir(userRolesDir, { recursive: true });

    // Create a sample builtin role in subdirectory structure
    // loadBuiltinRoles expects: {builtinRolesDir}/{roleName}/role.json
    const developerDir = path.join(builtinRolesDir, 'developer');
    await fs.mkdir(developerDir, { recursive: true });

    const sampleRole: RoleStorageFormat = {
      id: 'developer',
      name: 'developer',
      displayName: 'Developer',
      description: 'A software developer role',
      category: 'development',
      systemPromptFile: 'prompt.md',
      assignedSkills: [],
      isDefault: true,
      isHidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(developerDir, 'role.json'),
      JSON.stringify(sampleRole, null, 2)
    );

    await fs.writeFile(
      path.join(developerDir, 'prompt.md'),
      '# Developer Role\n\nYou are a software developer...'
    );

    // Create and initialize the role service
    roleService = new RoleService({
      builtinRolesDir,
      userRolesDir,
    });
    await roleService.initialize();

    // Create Express app with injected service
    app = express();
    app.use(express.json());
    app.use('/api/settings/roles', createRoleControllerWithService(roleService));

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
    resetRoleService();
  });

  describe('GET /api/settings/roles', () => {
    it('should return list of roles', async () => {
      const response = await request(app).get('/api/settings/roles');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/settings/roles')
        .query({ category: 'development' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach((role: { category: string }) => {
        expect(role.category).toBe('development');
      });
    });

    it('should filter by isBuiltin=true', async () => {
      const response = await request(app)
        .get('/api/settings/roles')
        .query({ isBuiltin: 'true' });

      expect(response.status).toBe(200);
      response.body.data.forEach((role: { isBuiltin: boolean }) => {
        expect(role.isBuiltin).toBe(true);
      });
    });

    it('should filter by search term', async () => {
      const response = await request(app)
        .get('/api/settings/roles')
        .query({ search: 'developer' });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-matching filter', async () => {
      const response = await request(app)
        .get('/api/settings/roles')
        .query({ category: 'sales' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });
  });

  describe('GET /api/settings/roles/default', () => {
    it('should return the default role', async () => {
      const response = await request(app).get('/api/settings/roles/default');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.isDefault).toBe(true);
    });
  });

  describe('GET /api/settings/roles/:id', () => {
    it('should return a role by ID', async () => {
      const response = await request(app).get('/api/settings/roles/developer');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('developer');
      expect(response.body.data.systemPromptContent).toBeDefined();
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app).get('/api/settings/roles/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('POST /api/settings/roles', () => {
    it('should create a new role', async () => {
      const response = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'test-role',
          displayName: 'Test Role',
          description: 'A test role',
          category: 'development',
          systemPromptContent: '# Test Role\n\nContent here',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('test-role');
      expect(response.body.data.isBuiltin).toBe(false);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/settings/roles')
        .send({
          name: '',
          displayName: '',
          description: '',
          category: 'development',
          systemPromptContent: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.validationErrors).toBeDefined();
    });

    it('should return 409 for duplicate name', async () => {
      // Create role first
      await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'duplicate-role',
          displayName: 'Duplicate Role',
          description: 'A role',
          category: 'development',
          systemPromptContent: 'Content',
        });

      // Try to create with same name
      const response = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'duplicate-role',
          displayName: 'Another Role',
          description: 'Another role',
          category: 'development',
          systemPromptContent: 'Content',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/settings/roles/:id', () => {
    let createdRoleId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'update-test-role',
          displayName: 'Update Test Role',
          description: 'A role to update',
          category: 'development',
          systemPromptContent: 'Original content',
        });
      createdRoleId = createResponse.body.data.id;
    });

    it('should update an existing role', async () => {
      const response = await request(app)
        .put(`/api/settings/roles/${createdRoleId}`)
        .send({
          displayName: 'Updated Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('Updated Name');
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .put('/api/settings/roles/non-existent')
        .send({
          displayName: 'Updated Name',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should allow updating builtin role (creates override)', async () => {
      // The service now supports updating builtin roles by creating overrides
      const response = await request(app)
        .put('/api/settings/roles/developer')
        .send({
          displayName: 'Modified Developer',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('Modified Developer');
    });
  });

  describe('DELETE /api/settings/roles/:id', () => {
    let createdRoleId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'delete-test-role',
          displayName: 'Delete Test Role',
          description: 'A role to delete',
          category: 'development',
          systemPromptContent: 'Content',
        });
      createdRoleId = createResponse.body.data.id;
    });

    it('should delete a user-created role', async () => {
      const response = await request(app)
        .delete(`/api/settings/roles/${createdRoleId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify role is deleted
      const getResponse = await request(app).get(`/api/settings/roles/${createdRoleId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .delete('/api/settings/roles/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 for builtin role', async () => {
      const response = await request(app)
        .delete('/api/settings/roles/developer');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/settings/roles/:id/skills', () => {
    let createdRoleId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'skill-test-role',
          displayName: 'Skill Test Role',
          description: 'A role for skill testing',
          category: 'development',
          systemPromptContent: 'Content',
        });
      createdRoleId = createResponse.body.data.id;
    });

    it('should assign skills to a role', async () => {
      const response = await request(app)
        .post(`/api/settings/roles/${createdRoleId}/skills`)
        .send({
          skillIds: ['skill-1', 'skill-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedSkills).toContain('skill-1');
      expect(response.body.data.assignedSkills).toContain('skill-2');
    });

    it('should return 400 if skillIds is not an array', async () => {
      const response = await request(app)
        .post(`/api/settings/roles/${createdRoleId}/skills`)
        .send({
          skillIds: 'not-an-array',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/settings/roles/:id/skills', () => {
    let createdRoleId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'remove-skill-test-role',
          displayName: 'Remove Skill Test Role',
          description: 'A role for skill removal testing',
          category: 'development',
          systemPromptContent: 'Content',
          assignedSkills: ['skill-1', 'skill-2', 'skill-3'],
        });
      createdRoleId = createResponse.body.data.id;
    });

    it('should remove skills from a role', async () => {
      const response = await request(app)
        .delete(`/api/settings/roles/${createdRoleId}/skills`)
        .send({
          skillIds: ['skill-2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.assignedSkills).toContain('skill-1');
      expect(response.body.data.assignedSkills).not.toContain('skill-2');
      expect(response.body.data.assignedSkills).toContain('skill-3');
    });
  });

  describe('POST /api/settings/roles/:id/set-default', () => {
    let createdRoleId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/settings/roles')
        .send({
          name: 'default-test-role',
          displayName: 'Default Test Role',
          description: 'A role for default testing',
          category: 'development',
          systemPromptContent: 'Content',
        });
      createdRoleId = createResponse.body.data.id;
    });

    it('should set a role as default', async () => {
      const response = await request(app)
        .post(`/api/settings/roles/${createdRoleId}/set-default`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isDefault).toBe(true);
    });

    it('should return 404 for non-existent role', async () => {
      const response = await request(app)
        .post('/api/settings/roles/non-existent/set-default');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
