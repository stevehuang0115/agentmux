# Ticket 003: Remove Deprecated Workflow Code

## Priority: Medium
## Estimated Effort: Small
## Component: Backend

---

## Problem Description

The codebase contains deprecated workflow-related code that is no longer used but still present. These endpoints return 410 (Gone) status but the code is still maintained unnecessarily.

---

## Files Affected

| File | Lines | Issue |
|------|-------|-------|
| `backend/src/routes/modules/workflows.routes.ts` | All | Deprecated routes returning 410 |
| `backend/src/controllers/api.controller.ts` | 503-514 | Deprecated workflow methods |
| `backend/src/services/core/storage.service.ts` | ~904 | Method marked @deprecated |

---

## Detailed Instructions

### Step 1: Analyze Current Usage

Before removing, verify these are truly unused:

```bash
cd backend

# Search for workflow route imports
grep -r "workflows.routes" --include="*.ts" src/

# Search for workflow controller method calls
grep -r "getWorkflowExecution\|getActiveWorkflows\|cancelWorkflowExecution" --include="*.ts" src/

# Search for any workflow-related types
grep -r "Workflow" --include="*.ts" src/types/
```

### Step 2: Remove Deprecated Routes

**File:** `backend/src/routes/modules/workflows.routes.ts`

If the entire file is deprecated, delete it:

```bash
rm backend/src/routes/modules/workflows.routes.ts
rm backend/src/routes/modules/workflows.routes.test.ts  # if exists
```

If only some routes are deprecated, remove those specific routes and keep any active ones.

### Step 3: Update Route Index

**File:** `backend/src/routes/index.ts` or similar

Remove the import and registration of workflow routes:

**Before:**
```typescript
import { workflowRoutes } from './modules/workflows.routes.js';

// In route setup
router.use('/workflows', workflowRoutes);
```

**After:**
```typescript
// Remove the import and router.use line
```

### Step 4: Remove Deprecated Controller Methods

**File:** `backend/src/controllers/api.controller.ts`

**Before (Lines 503-514):**
```typescript
public async getWorkflowExecution(req: Request, res: Response): Promise<void> {
  res.status(410).json({ success: false, error: 'Workflow execution API deprecated...' });
}

public async getActiveWorkflows(req: Request, res: Response): Promise<void> {
  res.status(410).json({ success: false, error: 'Active workflows API deprecated...' });
}

public async cancelWorkflowExecution(req: Request, res: Response): Promise<void> {
  res.status(410).json({ success: false, error: 'Workflow cancellation API deprecated...' });
}
```

**After:**
```typescript
// Remove these methods entirely
```

### Step 5: Remove Deprecated Storage Methods

**File:** `backend/src/services/core/storage.service.ts`

Find and remove any methods marked with `@deprecated`:

```typescript
// Remove this if it exists:
/**
 * @deprecated Use updateAgentStatus instead
 */
public async someDeprecatedMethod(): Promise<void> {
  // ...
}
```

### Step 6: Remove Workflow Types (If Unused)

**File:** `backend/src/types/index.ts` or `backend/src/types/workflow.ts`

If there are workflow-specific types that are no longer used:

```bash
# Check for usage first
grep -r "WorkflowExecution\|WorkflowStatus" --include="*.ts" src/

# If no matches (excluding type definitions), remove the types
```

### Step 7: Update Tests

Remove any tests that were specifically for the deprecated functionality:

```bash
# Find workflow-related test files
find backend -name "*.test.ts" | xargs grep -l "workflow"

# Review and remove tests for deleted code
```

### Step 8: Check for Dead Imports

After removing code, check for dead imports:

```bash
# Look for unused imports that might error on build
npm run build 2>&1 | grep -i "import"
```

---

## Evaluation Criteria

### Automated Verification

```bash
cd backend

# 1. No deprecated workflow routes
test -f src/routes/modules/workflows.routes.ts && echo "FAIL" || echo "PASS"

# 2. No deprecated methods in controller
grep -c "getWorkflowExecution\|getActiveWorkflows\|cancelWorkflowExecution" src/controllers/api.controller.ts
# Expected: 0

# 3. No @deprecated methods without active replacements
grep -B 5 "@deprecated" src/services/**/*.ts
# Review output - should be empty or have active alternatives noted

# 4. Build succeeds
npm run build

# 5. Tests pass
npm test

# 6. No 410 responses defined
grep -r "410" --include="*.ts" src/
# Expected: No matches for workflow-related 410s
```

### Manual Verification Checklist

- [ ] `workflows.routes.ts` deleted (if entirely deprecated)
- [ ] Deprecated controller methods removed
- [ ] Deprecated storage methods removed
- [ ] Related types removed if unused
- [ ] Related tests removed
- [ ] No dead imports remain
- [ ] Build succeeds
- [ ] All remaining tests pass
- [ ] API documentation updated (if applicable)

---

## Risk Assessment

**Risk Level:** Low-Medium

- These are already returning 410, so no active users
- May have external documentation referencing old endpoints
- Consider leaving a migration note in README if endpoints were public

---

## Migration Note (Optional)

If these endpoints were ever public, add a note to README or CHANGELOG:

```markdown
## Breaking Changes

### Removed Deprecated Workflow APIs

The following endpoints have been removed after being deprecated:
- `GET /api/workflows/:id/execution` - Use task management instead
- `GET /api/workflows/active` - Use project status endpoints
- `DELETE /api/workflows/:id` - Use task cancellation

These endpoints were returning 410 (Gone) and have now been fully removed.
```

---

## Rollback Plan

```bash
git checkout HEAD -- backend/src/routes/modules/workflows.routes.ts
git checkout HEAD -- backend/src/controllers/api.controller.ts
git checkout HEAD -- backend/src/services/core/storage.service.ts
```

---

## Dependencies

- None

## Blocks

- None
