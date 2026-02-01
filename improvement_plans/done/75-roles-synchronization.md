# Task 75: Synchronize Roles Between Settings and Team Dropdown

## Priority: High

## Problem

There is a mismatch between the roles shown in the Settings page and the roles available in the Team creation dropdown.

### Settings Page Roles
- UI/UX Designer
- Developer
- Product Manager

### Team Creation Dropdown Roles
- Technical Product Manager
- System Architect
- Frontend Developer
- Backend Developer
- Fullstack Developer
- QA Engineer
- Designer

### Expected Behavior
Both locations should show the same set of roles, loaded from a single source of truth.

## Root Cause Analysis

Two possible sources of role data:
1. **Settings Page**: Uses `useRoles()` hook which calls `/api/settings/roles`
2. **Team Creation**: May be using a different source (hardcoded list or different endpoint)

Check these files:
- `frontend/src/hooks/useRoles.ts` - Role fetching hook
- `frontend/src/components/Teams/CreateTeamModal.tsx` or similar - Team creation form
- `backend/src/services/settings/role.service.ts` - Backend role service
- `config/roles/` - Default role configurations

## Investigation Steps

### 1. Find Team Creation Component

```bash
# Search for role dropdown in team creation
grep -r "role" frontend/src/components/Teams/
grep -r "Frontend Developer\|Backend Developer" frontend/src/
```

### 2. Check Role Data Sources

```typescript
// Settings roles endpoint
GET /api/settings/roles

// Team creation roles - where does this come from?
// Check if using different endpoint or hardcoded
```

### 3. Verify Backend Role Service

Check `backend/src/services/settings/role.service.ts`:
- What roles does it return?
- Are there multiple role lists?

### 4. Check Config Files

Look in `config/roles/` for default role configurations.

## Implementation Plan

### Option A: Use Single Role Source

Make team creation use the same roles API as Settings:

```typescript
// In CreateTeamModal.tsx or similar
const { roles } = useRoles();

// Render dropdown with fetched roles
<select>
  {roles.map(role => (
    <option key={role.id} value={role.id}>{role.name}</option>
  ))}
</select>
```

### Option B: Update Default Roles

If team creation has the correct roles, update Settings to match:

```typescript
// config/roles/ - Update default roles to include:
const DEFAULT_ROLES = [
  'Technical Product Manager',
  'System Architect',
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Developer',
  'QA Engineer',
  'Designer'
];
```

### Option C: Merge Both Sets

Combine both role sets into a comprehensive list:

```typescript
const COMPLETE_ROLES = [
  // Development
  'Frontend Developer',
  'Backend Developer',
  'Fullstack Developer',
  'System Architect',

  // Design
  'Designer',
  'UI/UX Designer',

  // Management
  'Product Manager',
  'Technical Product Manager',

  // Quality
  'QA Engineer',
];
```

## Files to Investigate

1. `frontend/src/hooks/useRoles.ts` - Roles hook
2. `frontend/src/components/Teams/` - Team creation components
3. `backend/src/services/settings/role.service.ts` - Role service
4. `config/roles/` - Role configuration files
5. `backend/src/controllers/settings/role.controller.ts` - Role API

## Files to Modify

1. Update role source to be consistent across all components
2. Update default roles configuration if needed
3. Fix any hardcoded role lists in team components

## Testing Requirements

1. Settings page shows complete role list
2. Team creation dropdown shows same roles as Settings
3. Roles can be selected and assigned in team creation
4. Existing teams with old roles continue to work
5. API returns consistent role data

## Acceptance Criteria

- [ ] Settings page and Team dropdown show identical roles
- [ ] Single source of truth for role definitions
- [ ] No hardcoded role lists in components
- [ ] All roles from both lists are available
- [ ] Role selection works in team creation
- [ ] Existing team data is not broken
