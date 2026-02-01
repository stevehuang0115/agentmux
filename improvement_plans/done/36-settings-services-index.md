# Task: Create Settings Services Index Export

## Overview

Create the missing index.ts file for the settings services directory and add the exports to the main services index. Currently, RoleService and SettingsService exist but are not properly exported.

## Priority

**Critical** - Services cannot be imported without proper exports

## Dependencies

- `24-role-service.md` - Role service must exist
- `25-settings-service.md` - Settings service must exist

## Gap Identified

The settings services (RoleService, SettingsService) exist at:
- `backend/src/services/settings/role.service.ts`
- `backend/src/services/settings/settings.service.ts`

But there is no `index.ts` to export them, and they are not included in `backend/src/services/index.ts`.

## Files to Create/Modify

### 1. Create `backend/src/services/settings/index.ts`

```typescript
/**
 * Settings Services
 *
 * Exports for role and application settings management services.
 *
 * @module services/settings
 */

// Role Service exports
export {
  RoleService,
  RoleServiceOptions,
  getRoleService,
  resetRoleService,
  RoleNotFoundError,
  RoleValidationError,
  BuiltinRoleModificationError,
  DuplicateRoleNameError,
} from './role.service.js';

// Settings Service exports
export {
  SettingsService,
  SettingsServiceOptions,
  getSettingsService,
  resetSettingsService,
  SettingsValidationError,
} from './settings.service.js';
```

### 2. Update `backend/src/services/index.ts`

Add the following to the existing exports:

```typescript
// Settings Services
export {
  RoleService,
  RoleServiceOptions,
  getRoleService,
  resetRoleService,
  RoleNotFoundError,
  RoleValidationError,
  BuiltinRoleModificationError,
  DuplicateRoleNameError,
  SettingsService,
  SettingsServiceOptions,
  getSettingsService,
  resetSettingsService,
  SettingsValidationError,
} from './settings/index.js';
```

## Verification

After making changes, verify:

```bash
# Check TypeScript compilation
cd backend && npm run typecheck

# Verify exports work
node -e "import('./dist/services/index.js').then(m => console.log('RoleService:', !!m.RoleService, 'SettingsService:', !!m.SettingsService))"
```

## Acceptance Criteria

- [ ] `backend/src/services/settings/index.ts` file created
- [ ] All service classes and functions exported
- [ ] All error classes exported
- [ ] `backend/src/services/index.ts` updated with settings exports
- [ ] TypeScript compilation passes
- [ ] Exports are accessible from main services barrel

## Testing Requirements

- Verify imports work from consuming code
- Ensure no circular dependency issues

## Estimated Effort

5 minutes

## Notes

- Follow the same export pattern as `skill/index.ts` and `chat/index.ts`
- Include all public classes, functions, and error types
- Use `.js` extension for ES module imports
