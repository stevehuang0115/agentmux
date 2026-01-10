# Ticket 004: Remove Unused Exports and Imports

## Priority: Medium
## Estimated Effort: Small
## Component: Frontend, Backend

---

## Problem Description

Several files contain exports that are never imported anywhere, and some files have imports that aren't used. This creates confusion and increases bundle size unnecessarily.

---

## Files Affected

### Unused Exports

| File | Export | Issue |
|------|--------|-------|
| `frontend/src/types/index.ts` | `UITeam` interface | Never used |
| `frontend/src/utils/api.ts` | `safeApiRequest` function | Never imported |
| `frontend/src/hooks/useResponsive.ts` | All 3 hooks | Never imported |
| `frontend/src/hooks/useOptimizedData.ts` | `useOptimizedData` hook | Only in tests |
| `backend/src/services/index.ts` | `TmuxOrchestrationService` alias | Legacy, never used |

### Unused Barrel Files

| File | Issue |
|------|-------|
| `frontend/src/components/Editor/index.ts` | Barrel never imported |
| `frontend/src/components/Kanban/index.ts` | Barrel never imported |

---

## Detailed Instructions

### Step 1: Remove UITeam from Types

**File:** `frontend/src/types/index.ts`

```bash
# Verify it's unused
grep -r "UITeam" --include="*.ts" --include="*.tsx" frontend/src/ | grep -v "index.ts"
# Expected: No matches
```

**Before:**
```typescript
export interface UITeam {
  // ... properties
}
```

**After:**
```typescript
// Remove the entire UITeam interface
```

### Step 2: Remove safeApiRequest from Utils

**File:** `frontend/src/utils/api.ts`

```bash
# Verify it's unused
grep -r "safeApiRequest" --include="*.ts" --include="*.tsx" frontend/src/ | grep -v "api.ts"
# Expected: No matches
```

**Before:**
```typescript
export function safeApiRequest<T>(/* ... */): Promise<T> {
  // ...
}

export function safeParseJSON(/* ... */) {
  // ...
}
```

**After:**
```typescript
// Remove safeApiRequest, keep safeParseJSON if used
export function safeParseJSON(/* ... */) {
  // ...
}
```

### Step 3: Remove Unused Responsive Hooks

**File:** `frontend/src/hooks/useResponsive.ts`

```bash
# Verify hooks are unused
grep -r "useResponsive\|useResponsiveValue\|useResponsiveGrid" --include="*.ts" --include="*.tsx" frontend/src/ | grep -v "useResponsive.ts" | grep -v ".test."
# Expected: No matches
```

**Decision:** If all hooks are unused:
```bash
rm frontend/src/hooks/useResponsive.ts
rm frontend/src/hooks/useResponsive.test.ts
```

If keeping the file for future use, add a comment:
```typescript
/**
 * @fileoverview Responsive hooks for future use
 * Currently not used in the application but kept for planned responsive features.
 * TODO: Integrate with responsive UI work or remove if not needed
 */
```

### Step 4: Handle useOptimizedData Hook

**File:** `frontend/src/hooks/useOptimizedData.ts`

```bash
# Check if only used in tests
grep -r "useOptimizedData" --include="*.ts" --include="*.tsx" frontend/src/ | grep -v "useOptimizedData.ts" | grep -v ".test."
```

If only used in tests:
- Either remove both hook and tests
- Or keep with documentation about intended future use

### Step 5: Remove Legacy TmuxOrchestrationService Alias

**File:** `backend/src/services/index.ts`

```bash
# Verify the alias is unused
grep -r "TmuxOrchestrationService" --include="*.ts" backend/src/ | grep -v "index.ts"
# Expected: No matches
```

**Before:**
```typescript
export { TmuxService } from './agent/tmux.service.js';
export { TmuxService as TmuxOrchestrationService } from './agent/tmux.service.js';
```

**After:**
```typescript
export { TmuxService } from './agent/tmux.service.js';
// Removed legacy alias TmuxOrchestrationService
```

### Step 6: Handle Unused Barrel Files

**File:** `frontend/src/components/Editor/index.ts`

```bash
# Check if the barrel is imported
grep -r "from.*components/Editor'" --include="*.ts" --include="*.tsx" frontend/src/ | grep -v "index.ts"
grep -r "from.*components/Editor\"" --include="*.ts" --include="*.tsx" frontend/src/ | grep -v "index.ts"
```

Options:
1. **If components are used directly:** Keep barrel, it's just a convenience
2. **If components are unused:** Delete entire directory
3. **If barrel unused but components used:** Delete barrel file only

**File:** `frontend/src/components/Kanban/index.ts`

Apply same analysis.

### Step 7: Run Import Cleanup

After removing exports, check for any newly broken imports:

```bash
cd frontend
npm run build 2>&1 | grep -i "cannot find\|not found\|error"

cd ../backend
npm run build 2>&1 | grep -i "cannot find\|not found\|error"
```

### Step 8: Update Hook Index (If Applicable)

**File:** `frontend/src/hooks/index.ts`

If there's a hooks barrel file, remove exports for deleted hooks:

```typescript
// Remove these if hooks were deleted
export { useResponsive, useResponsiveValue, useResponsiveGrid } from './useResponsive';
export { useOptimizedData } from './useOptimizedData';
```

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. UITeam removed
grep -c "UITeam" frontend/src/types/index.ts
# Expected: 0

# 2. safeApiRequest removed
grep -c "safeApiRequest" frontend/src/utils/api.ts
# Expected: 0

# 3. TmuxOrchestrationService alias removed
grep -c "TmuxOrchestrationService" backend/src/services/index.ts
# Expected: 0

# 4. Builds succeed
npm run build

# 5. Tests pass
npm test

# 6. No dead exports (use ts-prune or similar if available)
npx ts-prune frontend/src 2>/dev/null || echo "ts-prune not available"
```

### Manual Verification Checklist

- [ ] `UITeam` interface removed
- [ ] `safeApiRequest` function removed
- [ ] Responsive hooks removed or documented
- [ ] `useOptimizedData` removed or documented
- [ ] `TmuxOrchestrationService` alias removed
- [ ] Unused barrel files handled
- [ ] No broken imports
- [ ] All builds pass
- [ ] All tests pass

---

## Optional: Install Dead Code Detection

For ongoing maintenance, consider adding a dead code detection tool:

```bash
# Install ts-prune
npm install -D ts-prune

# Add to package.json scripts
"scripts": {
  "check:unused": "ts-prune"
}

# Run periodically
npm run check:unused
```

---

## Rollback Plan

```bash
git checkout HEAD -- frontend/src/types/index.ts
git checkout HEAD -- frontend/src/utils/api.ts
git checkout HEAD -- frontend/src/hooks/useResponsive.ts
git checkout HEAD -- frontend/src/hooks/useOptimizedData.ts
git checkout HEAD -- backend/src/services/index.ts
```

---

## Dependencies

- None

## Blocks

- None
