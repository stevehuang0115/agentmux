# Task 78: Improve Project Assignment UX for Teams

## Priority: Medium

## Problem

Project assignment for teams has UX issues:
1. Projects can only be assigned when starting a team (in the "Start Team" dialog)
2. The "Edit Team" dialog has no option to change the assigned project
3. The "Assigned Project" section on team details page shows "No Project Assigned" but is not clickable to assign one

### Current Flow
1. User creates team → No project assignment option
2. User clicks "Edit Team" → No project assignment option
3. User clicks "Start Team" → Can finally assign project here
4. After team is started → Cannot change project assignment

### Expected Flow
Users should be able to assign/change projects from multiple places:
1. During team creation
2. From team details page (click "No Project Assigned" or "Assigned Project" section)
3. From Edit Team dialog
4. When starting a team (current behavior - keep this)

## Implementation Plan

### Option A: Add Project Assignment to Edit Team Dialog

```tsx
// In EditTeamModal.tsx
<FormSection title="Project Assignment">
  <Select
    label="Assigned Project"
    value={team.projectId}
    onChange={handleProjectChange}
    options={projects}
  />
</FormSection>
```

### Option B: Make "Assigned Project" Section Clickable

```tsx
// In TeamDetail.tsx
<section className="assigned-project" onClick={openProjectSelector}>
  <h3>Assigned Project</h3>
  {team.projectId ? (
    <ProjectCard project={project} />
  ) : (
    <EmptyState
      message="No Project Assigned"
      action="Click to assign a project"
    />
  )}
</section>
```

### Option C: Both (Recommended)

Implement both options for maximum flexibility.

## Files to Modify

1. `frontend/src/components/Teams/EditTeamModal.tsx` - Add project field
2. `frontend/src/pages/TeamDetail.tsx` - Make assigned project clickable
3. `frontend/src/components/Teams/ProjectSelector.tsx` - Create reusable selector
4. `backend/src/controllers/team.controller.ts` - Add update project endpoint

## API Changes

```typescript
// New endpoint or update existing
PATCH /api/teams/:id/project
{
  projectId: string | null  // null to unassign
}
```

## Testing Requirements

1. Can assign project during team creation
2. Can assign project from Edit Team dialog
3. Can assign project by clicking "Assigned Project" section
4. Can change project after team is started
5. Can unassign project
6. Project assignment persists after page refresh

## Acceptance Criteria

- [ ] Project can be assigned/changed from Edit Team dialog
- [ ] "Assigned Project" section is clickable when empty
- [ ] Project can be changed after team is started
- [ ] UI provides clear feedback when project is assigned
- [ ] API supports project assignment updates
