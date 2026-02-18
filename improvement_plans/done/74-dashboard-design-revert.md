# Task 74: Revert Dashboard to Original Design

## Priority: High

## Problem

The Dashboard design has changed from the original implementation and needs to be reverted. The current Dashboard differs from the previous design that was more effective.

### Observed Behavior
- Dashboard layout has been modified from the original design
- Some components or sections may have been rearranged or removed
- Visual appearance differs from original specifications

### Expected Behavior
- Dashboard should match the original design from specs/frontend-design.md
- Original card layouts and sections should be restored
- Visual consistency with the original UI/UX vision

## Investigation Steps

### 1. Check Git History for Dashboard Changes

```bash
# View recent changes to Dashboard.tsx
git log --oneline -20 -- frontend/src/pages/Dashboard.tsx

# View the diff of recent changes
git diff HEAD~10 -- frontend/src/pages/Dashboard.tsx

# See what Dashboard looked like before chat-centric changes
git show HEAD~5:frontend/src/pages/Dashboard.tsx
```

### 2. Identify the Commit to Revert To

Look for commits before these changes:
- `61-chat-centric-dashboard.md` - This task may have changed the dashboard
- `67-restore-original-dashboard.md` - This should have restored it
- `68-dedicated-chat-page.md` - Chat was moved to its own page

### 3. Review Original Design Spec

Check `specs/frontend-design.md` for the original dashboard design:
- Projects section with cards
- Teams section with cards
- Recent activity or quick actions
- Navigation layout

## Implementation Plan

### Option A: Git Revert to Specific Commit

```bash
# Find the last good commit
git log --oneline -- frontend/src/pages/Dashboard.tsx

# Revert to that specific version
git checkout <commit-hash> -- frontend/src/pages/Dashboard.tsx
```

### Option B: Manual Restoration

If multiple changes have been layered, manually restore:

1. Review original design requirements
2. Compare current implementation with spec
3. Restore missing components
4. Fix layout issues
5. Ensure dark theme consistency

### Original Dashboard Components (from spec)

```tsx
// Expected Dashboard sections
<Dashboard>
  {/* Header with title */}
  <header>Crewly Dashboard</header>

  {/* Projects Overview */}
  <section>
    <h2>Projects</h2>
    <ProjectCards projects={projects} />
    <CreateProjectCard />
  </section>

  {/* Teams Overview */}
  <section>
    <h2>Teams</h2>
    <TeamCards teams={teams} />
    <CreateTeamCard />
  </section>

  {/* Quick Actions or Status */}
  <section>
    <h2>Quick Actions</h2>
    {/* Start orchestrator, view logs, etc. */}
  </section>
</Dashboard>
```

## Files to Investigate

1. `frontend/src/pages/Dashboard.tsx` - Main dashboard component
2. `frontend/src/pages/Dashboard.css` - Dashboard styles
3. `specs/frontend-design.md` - Original design specification
4. Git history of Dashboard changes

## Files to Modify

1. `frontend/src/pages/Dashboard.tsx` - Revert/restore original layout
2. `frontend/src/pages/Dashboard.css` - Restore original styles if needed

## Testing Requirements

1. Dashboard displays Projects section with cards
2. Dashboard displays Teams section with cards
3. Create New Project/Team cards are visible
4. Layout matches original design specification
5. Dark theme is consistent
6. Navigation to other pages works correctly
7. Loading and error states work properly

## Acceptance Criteria

- [ ] Dashboard layout matches original design from specs
- [ ] Projects section displays correctly
- [ ] Teams section displays correctly
- [ ] Create cards are visible and functional
- [ ] Dark theme is consistent throughout
- [ ] No regressions in functionality
- [ ] Git history shows clean revert/fix commit
