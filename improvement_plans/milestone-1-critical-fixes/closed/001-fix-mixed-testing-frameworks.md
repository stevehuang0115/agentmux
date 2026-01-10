# Ticket 001: Fix Mixed Testing Frameworks in Frontend

## Priority: Critical
## Estimated Effort: Small
## Component: Frontend

---

## Problem Description

The frontend uses **Vitest** as its test framework (configured in `frontend/vitest.config.ts`), but several test files incorrectly use **Jest** syntax (`jest.fn()`, `jest.mock()`, `jest.clearAllMocks()`). This causes runtime errors or silent test failures because Jest globals are not available in the Vitest environment.

---

## Files Affected

| File | Lines with Issues |
|------|-------------------|
| `frontend/src/services/websocket.service.test.ts` | 163 |
| `frontend/src/components/Layout/AppLayout.test.tsx` | 9, 13, 18, 22 |
| `frontend/src/components/Assignments/EnhancedAssignmentsList.test.tsx` | 66, 69 |
| `frontend/src/components/Modals/TaskDetailModal.test.tsx` | 22, 37, 46, 60, 64, 78, 92 |
| `frontend/src/components/Modals/CreateTaskModal.test.tsx` | (check for jest usage) |

---

## Detailed Instructions

### Step 1: Update `websocket.service.test.ts`

**File:** `frontend/src/services/websocket.service.test.ts`

**Before (Line ~163):**
```typescript
const errorCallback = jest.fn(() => {
  // error handling
});
```

**After:**
```typescript
import { vi } from 'vitest';

const errorCallback = vi.fn(() => {
  // error handling
});
```

### Step 2: Update `AppLayout.test.tsx`

**File:** `frontend/src/components/Layout/AppLayout.test.tsx`

**Before:**
```typescript
jest.mock('./Navigation', () => ({
  Navigation: () => <div data-testid="navigation">Navigation</div>
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Outlet: () => <div data-testid="outlet">Outlet Content</div>
}));
```

**After:**
```typescript
import { vi } from 'vitest';

vi.mock('./Navigation', () => ({
  Navigation: () => <div data-testid="navigation">Navigation</div>
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>
  };
});
```

### Step 3: Update `EnhancedAssignmentsList.test.tsx`

**File:** `frontend/src/components/Assignments/EnhancedAssignmentsList.test.tsx`

**Before:**
```typescript
const mockOnMemberClick = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});
```

**After:**
```typescript
import { vi, beforeEach } from 'vitest';

const mockOnMemberClick = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});
```

### Step 4: Update `TaskDetailModal.test.tsx`

**File:** `frontend/src/components/Modals/TaskDetailModal.test.tsx`

**Before:**
```typescript
const mockOnClose = jest.fn();
const mockOnStatusChange = jest.fn();
const mockOnDelete = jest.fn();
```

**After:**
```typescript
import { vi } from 'vitest';

const mockOnClose = vi.fn();
const mockOnStatusChange = vi.fn();
const mockOnDelete = vi.fn();
```

### Step 5: Search for Any Remaining Jest Usage

Run this command to find any other occurrences:

```bash
cd frontend && grep -r "jest\." --include="*.test.ts" --include="*.test.tsx" src/
```

Fix any additional occurrences found using the same pattern.

---

## Conversion Reference Table

| Jest | Vitest |
|------|--------|
| `jest.fn()` | `vi.fn()` |
| `jest.mock()` | `vi.mock()` |
| `jest.spyOn()` | `vi.spyOn()` |
| `jest.clearAllMocks()` | `vi.clearAllMocks()` |
| `jest.resetAllMocks()` | `vi.resetAllMocks()` |
| `jest.restoreAllMocks()` | `vi.restoreAllMocks()` |
| `jest.requireActual()` | `await vi.importActual()` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `jest.useRealTimers()` | `vi.useRealTimers()` |
| `jest.advanceTimersByTime()` | `vi.advanceTimersByTime()` |

---

## Evaluation Criteria

### Automated Verification

Run the following commands to verify the fix:

```bash
# 1. Ensure no jest references remain in test files
cd frontend
grep -r "jest\." --include="*.test.ts" --include="*.test.tsx" src/
# Expected: No output (no matches)

# 2. Run the frontend test suite
npm test
# Expected: All tests pass without "jest is not defined" errors

# 3. Run specific affected test files
npm test -- --run websocket.service.test.ts
npm test -- --run AppLayout.test.tsx
npm test -- --run EnhancedAssignmentsList.test.tsx
npm test -- --run TaskDetailModal.test.tsx
# Expected: All tests pass
```

### Manual Verification Checklist

- [ ] No `jest.` references in any frontend test file
- [ ] All mock functions use `vi.fn()`
- [ ] All module mocks use `vi.mock()`
- [ ] `import { vi } from 'vitest'` added where needed
- [ ] Frontend test suite passes completely

---

## Unit Tests to Add

Create a test utilities verification file to ensure Vitest is properly configured:

**File:** `frontend/src/test-utils/vitest-setup.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Vitest Configuration Verification', () => {
  it('should have vi.fn() available', () => {
    const mockFn = vi.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should have vi.spyOn() available', () => {
    const obj = { method: () => 'original' };
    const spy = vi.spyOn(obj, 'method').mockReturnValue('mocked');
    expect(obj.method()).toBe('mocked');
    spy.mockRestore();
  });

  it('should support vi.clearAllMocks()', () => {
    const mockFn = vi.fn();
    mockFn();
    expect(mockFn).toHaveBeenCalled();
    vi.clearAllMocks();
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should support timer mocking', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    setTimeout(callback, 1000);
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

---

## Rollback Plan

If issues arise, revert the changes with:

```bash
git checkout -- frontend/src/services/websocket.service.test.ts
git checkout -- frontend/src/components/Layout/AppLayout.test.tsx
git checkout -- frontend/src/components/Assignments/EnhancedAssignmentsList.test.tsx
git checkout -- frontend/src/components/Modals/TaskDetailModal.test.tsx
```

---

## Dependencies

- None (this is a foundational fix)

## Blocks

- All other frontend test-related tickets depend on this being completed first
