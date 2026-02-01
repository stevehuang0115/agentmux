# Task 62: Fix Roles API 500 Error

## Overview

The Roles tab in Settings returns a 500 Internal Server Error when trying to load roles.

## Problem

When accessing Settings > Roles tab, the UI displays:
```
Error loading roles: Request failed with status code 500
```

## Root Cause Investigation

Check the following potential causes:

1. **Role Service not properly initialized**
2. **Roles directory doesn't exist** (`config/roles/`)
3. **Role controller not registered in routes**
4. **Database/file permission issues**

## Debugging Steps

```bash
# Test the API directly
curl http://localhost:8787/api/roles

# Check if roles directory exists
ls -la config/roles/

# Check backend logs for error details
```

## Expected Behavior

The Roles tab should load and display:
- List of available roles (built-in and custom)
- "Create Role" button
- Role cards with edit/delete options

## Implementation

### 1. Verify Role Controller Registration

Check `backend/src/controllers/index.ts`:
```typescript
import roleRouter from './settings/role.controller.js';
// ...
app.use('/api/roles', roleRouter);
```

### 2. Verify Role Service Initialization

Check `backend/src/services/settings/role.service.ts`:
```typescript
// Ensure singleton is properly exported
export function getRoleService(): RoleService {
  if (!roleServiceInstance) {
    roleServiceInstance = new RoleService();
  }
  return roleServiceInstance;
}
```

### 3. Create Default Roles Directory

If missing, create `config/roles/` with at least one default role:

```
config/roles/
├── developer/
│   ├── role.json
│   └── prompt.md
└── orchestrator/
    ├── role.json
    └── prompt.md
```

### 4. Add Error Handling

Ensure the role controller returns helpful errors:
```typescript
router.get('/', async (req, res) => {
  try {
    const roleService = getRoleService();
    const roles = await roleService.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error('Failed to load roles:', error);
    res.status(500).json({
      error: 'Failed to load roles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

## Files to Check/Modify

| File | Action |
|------|--------|
| `backend/src/controllers/settings/role.controller.ts` | Verify endpoint works |
| `backend/src/controllers/index.ts` | Verify route registered |
| `backend/src/services/settings/role.service.ts` | Check initialization |
| `config/roles/` | Create if missing |

## Acceptance Criteria

- [ ] `GET /api/roles` returns 200 with roles array
- [ ] Settings > Roles tab loads without error
- [ ] At least default roles are displayed
- [ ] Error messages are helpful if issues occur

## Priority

**Critical** - Blocks role management functionality

## Testing

```bash
# API test
curl -X GET http://localhost:8787/api/roles
# Should return: [{ id: "...", name: "...", ... }]

# Frontend test
# Navigate to Settings > Roles tab
# Should display role cards without error
```
