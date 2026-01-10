# Ticket 002: Delete Unused Frontend Components

## Priority: High
## Estimated Effort: Small
## Component: Frontend

---

## Problem Description

Several frontend components are defined but never imported or used anywhere in the application. These include a duplicate Dashboard component and several components that are only imported by that unused Dashboard.

---

## Files to Delete

| File | Reason |
|------|--------|
| `frontend/src/components/Dashboard.tsx` | Not imported; `pages/Dashboard.tsx` is used |
| `frontend/src/components/TeamMemberCard.tsx` | Only referenced in tests, not actually used |
| `frontend/src/components/TeamList.tsx` | Only imported by unused `components/Dashboard.tsx` |
| `frontend/src/components/TeamCreator.tsx` | Only imported by unused `components/Dashboard.tsx` |
| `frontend/src/components/ProjectSelector.tsx` | Only imported by unused `components/Dashboard.tsx` |
| `frontend/src/components/ErrorDashboard/ErrorDashboard.tsx` | Never imported anywhere |
| `frontend/src/components/LoadingStates.tsx` | Never imported anywhere |

Also delete associated test files:
| Test File | Reason |
|-----------|--------|
| `frontend/src/components/Dashboard.test.tsx` | Tests for deleted component |
| `frontend/src/components/TeamMemberCard.test.tsx` | Tests for deleted component |
| `frontend/src/components/TeamList.test.tsx` | Tests for deleted component |
| `frontend/src/components/TeamCreator.test.tsx` | Tests for deleted component |
| `frontend/src/components/ProjectSelector.test.tsx` | Tests for deleted component |
| `frontend/src/components/ErrorDashboard/ErrorDashboard.test.tsx` | Tests for deleted component |
| `frontend/src/components/LoadingStates.test.tsx` | Tests for deleted component |

---

## Detailed Instructions

### Step 1: Verify Components Are Unused

Run these searches to confirm no imports exist:

```bash
cd frontend

# Check Dashboard component (not the page)
grep -r "from.*components/Dashboard" --include="*.ts" --include="*.tsx" src/
grep -r "from.*\/Dashboard'" --include="*.ts" --include="*.tsx" src/pages/ src/App.tsx

# Check TeamMemberCard
grep -r "TeamMemberCard" --include="*.ts" --include="*.tsx" src/ | grep -v "\.test\." | grep -v "TeamMemberCard.tsx"

# Check TeamList
grep -r "from.*TeamList" --include="*.ts" --include="*.tsx" src/ | grep -v "\.test\."

# Check TeamCreator
grep -r "from.*TeamCreator" --include="*.ts" --include="*.tsx" src/ | grep -v "\.test\."

# Check ProjectSelector
grep -r "from.*ProjectSelector" --include="*.ts" --include="*.tsx" src/ | grep -v "\.test\."

# Check ErrorDashboard
grep -r "ErrorDashboard" --include="*.ts" --include="*.tsx" src/ | grep -v "\.test\." | grep -v "ErrorDashboard.tsx"

# Check LoadingStates
grep -r "LoadingStates" --include="*.ts" --include="*.tsx" src/ | grep -v "\.test\." | grep -v "LoadingStates.tsx"
```

**Expected:** No matches (excluding the component files themselves and their tests).

### Step 2: Delete the Components and Their Tests

```bash
cd frontend/src/components

# Delete unused components
rm -f Dashboard.tsx Dashboard.test.tsx
rm -f TeamMemberCard.tsx TeamMemberCard.test.tsx
rm -f TeamList.tsx TeamList.test.tsx
rm -f TeamCreator.tsx TeamCreator.test.tsx
rm -f ProjectSelector.tsx ProjectSelector.test.tsx
rm -f LoadingStates.tsx LoadingStates.test.tsx

# Delete ErrorDashboard directory if empty after removal
rm -f ErrorDashboard/ErrorDashboard.tsx ErrorDashboard/ErrorDashboard.test.tsx
rmdir ErrorDashboard 2>/dev/null || true  # Remove dir if empty
```

### Step 3: Check for Index Barrel Files

If there's an `index.ts` barrel file that exports these components, update it:

```bash
# Check for barrel exports
grep -l "Dashboard\|TeamMemberCard\|TeamList\|TeamCreator\|ProjectSelector\|ErrorDashboard\|LoadingStates" src/components/index.ts
```

If found, remove the export lines for deleted components.

### Step 4: Verify Build and Tests

```bash
cd frontend

# Build should succeed
npm run build

# Tests should pass (fewer tests now)
npm test
```

---

## Evaluation Criteria

### Automated Verification

```bash
cd frontend

# 1. Deleted files should not exist
for file in \
  "src/components/Dashboard.tsx" \
  "src/components/TeamMemberCard.tsx" \
  "src/components/TeamList.tsx" \
  "src/components/TeamCreator.tsx" \
  "src/components/ProjectSelector.tsx" \
  "src/components/ErrorDashboard/ErrorDashboard.tsx" \
  "src/components/LoadingStates.tsx"; do
  test -f "$file" && echo "FAIL: $file still exists" || echo "PASS: $file deleted"
done

# 2. No broken imports
npm run build
# Expected: Success with no "Module not found" errors

# 3. Tests pass
npm test
# Expected: All remaining tests pass

# 4. Application runs
npm run dev
# Expected: App starts without errors
```

### Manual Verification Checklist

- [ ] All 7 component files deleted
- [ ] All 7 test files deleted
- [ ] No broken imports in remaining code
- [ ] Frontend builds successfully
- [ ] Frontend tests pass
- [ ] Application runs and pages load correctly
- [ ] `pages/Dashboard.tsx` still works (the one we kept)

---

## Files to Keep (Do NOT Delete)

Make sure NOT to delete these similarly-named but actively used files:

- `frontend/src/pages/Dashboard.tsx` - **KEEP** (this is the actual dashboard page)
- `frontend/src/components/Teams/` - **KEEP** (different from TeamList/TeamCreator)
- `frontend/src/components/ProjectDetail/` - **KEEP** (different from ProjectSelector)

---

## Risk Assessment

**Risk Level:** Low

- These components have no imports from active code
- The application already works without them
- Tests will have fewer files but same functionality coverage

---

## Rollback Plan

```bash
git checkout HEAD -- frontend/src/components/Dashboard.tsx
git checkout HEAD -- frontend/src/components/TeamMemberCard.tsx
git checkout HEAD -- frontend/src/components/TeamList.tsx
git checkout HEAD -- frontend/src/components/TeamCreator.tsx
git checkout HEAD -- frontend/src/components/ProjectSelector.tsx
git checkout HEAD -- frontend/src/components/ErrorDashboard/
git checkout HEAD -- frontend/src/components/LoadingStates.tsx
```

---

## Dependencies

- None

## Blocks

- None
