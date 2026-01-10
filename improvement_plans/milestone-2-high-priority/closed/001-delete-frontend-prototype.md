# Ticket 001: Delete Unused frontend_prototype Directory

## Priority: High
## Estimated Effort: Small
## Component: Frontend

---

## Problem Description

The `frontend_prototype/` directory contains 49 files (~5,000 lines) that are not referenced anywhere in the build system or package.json. This is dead code that adds confusion and maintenance burden.

---

## Files to Delete

**Entire directory:** `/Users/yellowsunhy/Desktop/projects/agentmux/frontend_prototype/`

Contents include:
- `index.tsx`, `App.tsx`, `types.ts`
- Components: `TeamModal.tsx`, `TaskDetailModal.tsx`, etc.
- Pages: `Projects.tsx`, `Dashboard.tsx`, `TeamDetail.tsx`, etc.
- Total: 49 files, ~5,000 lines of code

---

## Detailed Instructions

### Step 1: Verify No References Exist

Before deleting, confirm the directory is not referenced:

```bash
# Search for any imports from frontend_prototype
grep -r "frontend_prototype" --include="*.ts" --include="*.tsx" --include="*.json" .

# Search in package.json files
grep -r "frontend_prototype" package.json */package.json

# Search in build configs
grep -r "frontend_prototype" *.config.* */*.config.*
```

**Expected:** No matches found.

### Step 2: Create Backup (Optional Safety Step)

```bash
# Create a backup archive before deletion
tar -czvf frontend_prototype_backup.tar.gz frontend_prototype/
```

### Step 3: Delete the Directory

```bash
# Remove the directory
rm -rf frontend_prototype/

# Verify deletion
ls -la frontend_prototype/
# Expected: "No such file or directory"
```

### Step 4: Update .gitignore if Needed

Check if `frontend_prototype/` was in `.gitignore`. If so, the entry can be removed:

```bash
grep "frontend_prototype" .gitignore
```

If found, remove the line from `.gitignore`.

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. Directory should not exist
test -d frontend_prototype && echo "FAIL: Directory still exists" || echo "PASS: Directory deleted"

# 2. No references remain in codebase
grep -r "frontend_prototype" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" .
# Expected: No matches (or only this ticket file)

# 3. Build should still work
npm run build
# Expected: Success

# 4. Tests should still pass
npm test
# Expected: All tests pass
```

### Manual Verification Checklist

- [ ] `frontend_prototype/` directory no longer exists
- [ ] No import statements reference `frontend_prototype`
- [ ] Project builds successfully
- [ ] All tests pass
- [ ] Frontend application runs correctly

---

## Risk Assessment

**Risk Level:** Low

- The directory is completely isolated
- No imports from the main codebase
- Not included in any build configuration
- Deletion will not affect any functionality

---

## Rollback Plan

If issues arise (unlikely):

```bash
# Restore from backup
tar -xzvf frontend_prototype_backup.tar.gz

# Or restore from git
git checkout HEAD -- frontend_prototype/
```

---

## Dependencies

- None

## Blocks

- None
