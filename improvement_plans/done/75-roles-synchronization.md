# Task 75: Synchronize Roles Between Settings and Team Dropdown

## Priority: Low (May already be resolved)

## Problem Statement
The roles available in the Settings > Roles page should match the roles shown in the Team creation dropdown (when assigning roles to agents).

## Current State (Verified 2026-02-01)

### Settings > Roles page shows (ALL 6 roles):
- UI/UX Designer (Design category)
- Developer (Development category)
- Product Manager (Management category)
- QA Engineer (Quality category)
- Sales Representative (Sales category)
- Customer Support (Support category)

### Team > Add Agent dropdown shows:
- UI/UX Designer
- Developer
- Product Manager
- QA Engineer
- Sales Representative
- Customer Support

**STATUS: ROLES ARE SYNCHRONIZED - Both show 6 roles**

## Expected Behavior
Both locations should show the same set of roles. The roles should come from a single source of truth.

## Technical Investigation Needed
1. Where are roles defined for Settings page?
2. Where are roles defined for Team dropdown?
3. Are they using different data sources?

## Solution Options

### Option A: Unified Role Source
- Create a single roles configuration that both UI components read from
- Update Settings page to add/edit roles in this shared source
- Update Team dropdown to read from the same source

### Option B: Sync on Change
- Keep separate definitions but sync when Settings roles change
- Add validation to prevent using deleted roles

## Files to Investigate
- `frontend/src/pages/Settings.tsx`
- `frontend/src/components/Settings/RolesTab.tsx`
- `frontend/src/components/Teams/CreateTeamModal.tsx` or `AddAgentModal.tsx`
- `backend/src/services/settings/role.service.ts` (if exists)
- Any role configuration files in `config/roles/`

## Testing Steps
1. Open Settings > Roles and note available roles
2. Go to Teams > Create/Edit Team > Add Agent
3. Compare dropdown roles with Settings roles
4. After fix: verify both show identical role lists
5. Add a new role in Settings and verify it appears in Team dropdown
