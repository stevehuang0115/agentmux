# Task: Create Settings and Role Controllers

## Overview

Create Express.js controllers for the Settings API endpoints. These controllers expose the role management and settings services to the frontend via REST API.

## Priority

**Sprint 1** - Foundation (Settings + Roles)

## Dependencies

- `23-role-types.md` - Role type definitions
- `24-role-service.md` - Role service implementation
- `25-settings-service.md` - Settings service implementation

## Files to Create

### 1. `backend/src/controllers/settings/role.controller.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { getRoleService } from '../../services/settings/role.service.js';
import {
  CreateRoleInput,
  UpdateRoleInput,
  RoleFilter,
} from '../../types/role.types.js';

const router = Router();

/**
 * GET /api/settings/roles
 * List all roles with optional filtering
 *
 * Query params:
 * - category: Filter by role category
 * - isBuiltin: Filter by builtin status (true/false)
 * - hasSkill: Filter roles that have a specific skill assigned
 * - search: Search in name and description
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter: RoleFilter = {
      category: req.query.category as string | undefined,
      isBuiltin: req.query.isBuiltin === 'true' ? true :
                 req.query.isBuiltin === 'false' ? false : undefined,
      hasSkill: req.query.hasSkill as string | undefined,
      search: req.query.search as string | undefined,
    };

    const roleService = getRoleService();
    const roles = await roleService.listRoles(filter);

    res.json({
      success: true,
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/roles/:id
 * Get a single role by ID with full prompt content
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleService = getRoleService();
    const role = await roleService.getRole(req.params.id);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/settings/roles/default
 * Get the current default role
 */
router.get('/default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleService = getRoleService();
    const role = await roleService.getDefaultRole();

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'No default role configured',
      });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/roles
 * Create a new user-defined role
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: CreateRoleInput = {
      name: req.body.name,
      displayName: req.body.displayName,
      description: req.body.description,
      category: req.body.category,
      systemPromptContent: req.body.systemPromptContent,
      assignedSkills: req.body.assignedSkills,
      isDefault: req.body.isDefault,
    };

    const roleService = getRoleService();
    const role = await roleService.createRole(input);

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    if (error.name === 'RoleValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
        validationErrors: error.errors,
      });
    }
    if (error.name === 'DuplicateRoleNameError') {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * PUT /api/settings/roles/:id
 * Update an existing role
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: UpdateRoleInput = {
      displayName: req.body.displayName,
      description: req.body.description,
      category: req.body.category,
      systemPromptContent: req.body.systemPromptContent,
      assignedSkills: req.body.assignedSkills,
      isDefault: req.body.isDefault,
    };

    const roleService = getRoleService();
    const role = await roleService.updateRole(req.params.id, input);

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    if (error.name === 'BuiltinRoleModificationError') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/settings/roles/:id
 * Delete a user-created role
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleService = getRoleService();
    await roleService.deleteRole(req.params.id);

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    if (error.name === 'RoleNotFoundError') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    if (error.name === 'BuiltinRoleModificationError') {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

/**
 * POST /api/settings/roles/:id/skills
 * Assign skills to a role
 */
router.post('/:id/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skillIds } = req.body;

    if (!Array.isArray(skillIds)) {
      return res.status(400).json({
        success: false,
        error: 'skillIds must be an array',
      });
    }

    const roleService = getRoleService();
    const role = await roleService.assignSkills(req.params.id, skillIds);

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/settings/roles/:id/skills
 * Remove skills from a role
 */
router.delete('/:id/skills', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { skillIds } = req.body;

    if (!Array.isArray(skillIds)) {
      return res.status(400).json({
        success: false,
        error: 'skillIds must be an array',
      });
    }

    const roleService = getRoleService();
    const role = await roleService.removeSkills(req.params.id, skillIds);

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/roles/:id/set-default
 * Set a role as the default
 */
router.post('/:id/set-default', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleService = getRoleService();
    const role = await roleService.setDefaultRole(req.params.id);

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 2. `backend/src/controllers/settings/settings.controller.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { getSettingsService } from '../../services/settings/settings.service.js';
import { UpdateSettingsInput, CrewlySettings } from '../../types/settings.types.js';

const router = Router();

/**
 * GET /api/settings
 * Get current application settings
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 * Update application settings (partial update supported)
 */
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: UpdateSettingsInput = req.body;

    const settingsService = getSettingsService();
    const settings = await settingsService.updateSettings(input);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    if (error.name === 'SettingsValidationError') {
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
 * POST /api/settings/validate
 * Validate settings without saving
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: UpdateSettingsInput = req.body;

    const settingsService = getSettingsService();
    const result = await settingsService.validateSettingsInput(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/reset
 * Reset all settings to defaults
 */
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.resetSettings();

    res.json({
      success: true,
      data: settings,
      message: 'Settings reset to defaults',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/reset/:section
 * Reset a specific settings section to defaults
 */
router.post('/reset/:section', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = req.params.section as keyof CrewlySettings;

    if (!['general', 'chat', 'skills'].includes(section)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid section. Must be one of: general, chat, skills',
      });
    }

    const settingsService = getSettingsService();
    const settings = await settingsService.resetSection(section);

    res.json({
      success: true,
      data: settings,
      message: `${section} settings reset to defaults`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/export
 * Export settings to a downloadable file
 */
router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=crewly-settings.json');
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/import
 * Import settings from uploaded file
 */
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const importedSettings = req.body;

    if (!importedSettings || typeof importedSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings format',
      });
    }

    const settingsService = getSettingsService();

    // Validate first
    const validation = await settingsService.validateSettingsInput(importedSettings);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings',
        validationErrors: validation.errors,
      });
    }

    const settings = await settingsService.updateSettings(importedSettings);

    res.json({
      success: true,
      data: settings,
      message: 'Settings imported successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 3. `backend/src/controllers/settings/index.ts`

```typescript
import { Router } from 'express';
import roleController from './role.controller.js';
import settingsController from './settings.controller.js';

const router = Router();

// Mount sub-controllers
router.use('/roles', roleController);
router.use('/', settingsController);

export default router;
```

### 4. Update `backend/src/controllers/index.ts`

Add the settings controllers to the main router:

```typescript
import settingsController from './settings/index.js';

// ... existing code ...

router.use('/settings', settingsController);
```

## API Endpoints Summary

### Role Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/roles` | List all roles with optional filtering |
| GET | `/api/settings/roles/default` | Get the default role |
| GET | `/api/settings/roles/:id` | Get a single role by ID |
| POST | `/api/settings/roles` | Create a new role |
| PUT | `/api/settings/roles/:id` | Update an existing role |
| DELETE | `/api/settings/roles/:id` | Delete a role |
| POST | `/api/settings/roles/:id/skills` | Assign skills to a role |
| DELETE | `/api/settings/roles/:id/skills` | Remove skills from a role |
| POST | `/api/settings/roles/:id/set-default` | Set as default role |

### Settings Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get current settings |
| PUT | `/api/settings` | Update settings |
| POST | `/api/settings/validate` | Validate settings |
| POST | `/api/settings/reset` | Reset all settings |
| POST | `/api/settings/reset/:section` | Reset a section |
| POST | `/api/settings/export` | Export settings |
| POST | `/api/settings/import` | Import settings |

## Response Format

All responses follow a consistent format:

```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
  message?: string;
  count?: number;
}
```

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": "developer",
    "name": "developer",
    "displayName": "Developer",
    "category": "development"
  }
}
```

### Error Response Example

```json
{
  "success": false,
  "error": "Role validation failed",
  "validationErrors": [
    "Name is required",
    "Category is invalid"
  ]
}
```

## Testing Requirements

Create test files for each controller:

### `backend/src/controllers/settings/role.controller.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import roleController from './role.controller.js';
import { getRoleService, resetRoleService } from '../../services/settings/role.service.js';

describe('Role Controller', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/settings/roles', roleController);
    // Mock error handler
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    resetRoleService();
  });

  describe('GET /api/settings/roles', () => {
    it('should return list of roles', async () => {
      const response = await request(app).get('/api/settings/roles');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/settings/roles')
        .query({ category: 'development' });

      expect(response.status).toBe(200);
      response.body.data.forEach((role: any) => {
        expect(role.category).toBe('development');
      });
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
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/settings/roles')
        .send({
          name: '',
          displayName: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  // Add more tests for PUT, DELETE, skills endpoints...
});
```

### `backend/src/controllers/settings/settings.controller.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import settingsController from './settings.controller.js';
import { resetSettingsService } from '../../services/settings/settings.service.js';

describe('Settings Controller', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/settings', settingsController);
  });

  afterEach(() => {
    resetSettingsService();
  });

  describe('GET /api/settings', () => {
    it('should return current settings', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('general');
      expect(response.body.data).toHaveProperty('chat');
      expect(response.body.data).toHaveProperty('skills');
    });
  });

  describe('PUT /api/settings', () => {
    it('should update settings', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({
          general: { defaultRuntime: 'gemini-cli' },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.general.defaultRuntime).toBe('gemini-cli');
    });

    it('should return 400 for invalid settings', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({
          general: { checkInIntervalMinutes: -5 },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/settings/reset', () => {
    it('should reset all settings to defaults', async () => {
      // First modify settings
      await request(app)
        .put('/api/settings')
        .send({ general: { defaultRuntime: 'gemini-cli' } });

      // Then reset
      const response = await request(app).post('/api/settings/reset');

      expect(response.status).toBe(200);
      expect(response.body.data.general.defaultRuntime).toBe('claude-code');
    });
  });

  // Add more tests for validate, export, import...
});
```

## Acceptance Criteria

- [ ] All role endpoints are implemented and tested
- [ ] All settings endpoints are implemented and tested
- [ ] Proper error handling with consistent response format
- [ ] HTTP status codes are used correctly
- [ ] Controllers are properly integrated with main router
- [ ] Request validation is in place
- [ ] Comprehensive test coverage for all endpoints
- [ ] JSDoc comments on all route handlers

## Notes

- Use async/await for all route handlers
- Wrap handlers in try/catch with next(error) for error handling
- Use express-validator or similar for request validation (optional enhancement)
- Consider rate limiting for create/update endpoints
- Log errors appropriately for debugging
