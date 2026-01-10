# Ticket 006: Fix Empty Catch Blocks

## Priority: High
## Estimated Effort: Small
## Component: Frontend

---

## Problem Description

Several files contain empty catch blocks that silently swallow errors, making debugging difficult. These should either log the error, handle it appropriately, or be removed if the error is intentionally ignored (with a comment explaining why).

---

## Files Affected

| File | Line | Current Code |
|------|------|--------------|
| `frontend/src/pages/Teams.tsx` | ~37-39 | `catch (e) { // ignore }` |
| `frontend/src/components/ProjectDetail/TasksView.tsx` | ~132-134 | `catch (e) { // ignore }` |

---

## Detailed Instructions

### Step 1: Fix Teams.tsx

**File:** `frontend/src/pages/Teams.tsx`

First, understand the context of the try-catch:

**Before (Lines ~35-40):**
```typescript
try {
  // Some operation
} catch (e) {
  // ignore
}
```

**After (Option A - Log the error):**
```typescript
try {
  // Some operation
} catch (error) {
  console.warn('Failed to perform operation:', error);
  // Optionally: show user-friendly error toast/notification
}
```

**After (Option B - Handle gracefully with explanation):**
```typescript
try {
  // Some operation that may fail on first load
} catch (error) {
  // Intentionally ignored: This operation is non-critical and may fail
  // when the component mounts before data is available. The UI handles
  // the missing data gracefully by showing a loading state.
  if (process.env.NODE_ENV === 'development') {
    console.debug('Non-critical operation failed:', error);
  }
}
```

**After (Option C - Use error boundary or state):**
```typescript
const [error, setError] = useState<Error | null>(null);

try {
  // Some operation
} catch (error) {
  setError(error instanceof Error ? error : new Error(String(error)));
}

// In JSX:
{error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}
```

### Step 2: Fix TasksView.tsx

**File:** `frontend/src/components/ProjectDetail/TasksView.tsx`

**Before (Lines ~130-135):**
```typescript
try {
  // Fetch assignment details or similar
} catch (e) {
  // ignore
}
```

**After:**
```typescript
try {
  // Fetch assignment details
  const assignmentDetails = await inProgressTasksService.getTaskAssignedMemberDetails(ticket.filePath);
  // ... use assignmentDetails
} catch (error) {
  // Assignment details are optional - ticket still displays without them
  // Log in development for debugging purposes
  if (process.env.NODE_ENV === 'development') {
    console.debug(`Could not fetch assignment details for ${ticket.filePath}:`, error);
  }
  // Continue with default/empty assignment info
}
```

### Step 3: Create Error Handling Utility (Optional Enhancement)

**File:** `frontend/src/utils/error-handling.ts`

```typescript
/**
 * Logs non-critical errors in development only.
 * Use for operations where failure is acceptable but should be visible during development.
 *
 * @param context - Description of what operation failed
 * @param error - The caught error
 */
export function logNonCriticalError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Non-critical] ${context}:`, error);
  }
}

/**
 * Logs and optionally reports errors.
 * Use for operations that should be tracked but don't need to crash the UI.
 *
 * @param context - Description of what operation failed
 * @param error - The caught error
 * @param options - Additional options
 */
export function handleError(
  context: string,
  error: unknown,
  options: {
    silent?: boolean;
    report?: boolean;
  } = {}
): void {
  const { silent = false, report = false } = options;

  if (!silent) {
    console.error(`[Error] ${context}:`, error);
  }

  if (report) {
    // Send to error tracking service (e.g., Sentry)
    // errorTrackingService.captureError(error, { context });
  }
}

/**
 * Type guard to check if error has a message property
 */
export function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}
```

**File:** `frontend/src/utils/error-handling.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logNonCriticalError,
  handleError,
  isErrorWithMessage,
  getErrorMessage,
} from './error-handling';

describe('error-handling utilities', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logNonCriticalError', () => {
    it('should log in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      logNonCriticalError('Test context', new Error('Test error'));

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[Non-critical] Test context:',
        expect.any(Error)
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not log in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      logNonCriticalError('Test context', new Error('Test error'));

      expect(consoleDebugSpy).not.toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('handleError', () => {
    it('should log error by default', () => {
      handleError('Test context', new Error('Test error'));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error] Test context:',
        expect.any(Error)
      );
    });

    it('should not log when silent is true', () => {
      handleError('Test context', new Error('Test error'), { silent: true });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('isErrorWithMessage', () => {
    it('should return true for Error objects', () => {
      expect(isErrorWithMessage(new Error('test'))).toBe(true);
    });

    it('should return true for objects with message property', () => {
      expect(isErrorWithMessage({ message: 'test' })).toBe(true);
    });

    it('should return false for strings', () => {
      expect(isErrorWithMessage('error string')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isErrorWithMessage(null)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error', () => {
      expect(getErrorMessage(new Error('test message'))).toBe('test message');
    });

    it('should convert non-Error to string', () => {
      expect(getErrorMessage('plain string')).toBe('plain string');
      expect(getErrorMessage(123)).toBe('123');
    });
  });
});
```

### Step 4: Update Files to Use Utility

**File:** `frontend/src/pages/Teams.tsx`

```typescript
import { logNonCriticalError } from '../utils/error-handling';

// In the catch block:
try {
  // operation
} catch (error) {
  logNonCriticalError('Failed to load team data', error);
}
```

**File:** `frontend/src/components/ProjectDetail/TasksView.tsx`

```typescript
import { logNonCriticalError } from '../../utils/error-handling';

// In the catch block:
try {
  const assignmentDetails = await inProgressTasksService.getTaskAssignedMemberDetails(ticket.filePath);
  // ...
} catch (error) {
  logNonCriticalError(`Failed to fetch assignment for ${ticket.filePath}`, error);
}
```

---

## Evaluation Criteria

### Automated Verification

```bash
cd frontend

# 1. Search for empty catch blocks
grep -rn "catch.*{" --include="*.ts" --include="*.tsx" -A 2 src/ | grep -E "//\s*(ignore|empty)"
# Expected: No matches

# 2. Search for catch blocks with only comments
grep -rn "catch.*{$" --include="*.ts" --include="*.tsx" -A 3 src/ | grep -B 1 -A 1 "^\s*}\s*$"
# Review any matches to ensure they have proper handling

# 3. Build succeeds
npm run build

# 4. Tests pass
npm test
```

### Manual Verification Checklist

- [ ] No empty catch blocks remain
- [ ] All catch blocks either:
  - Log the error appropriately
  - Handle the error with state/UI
  - Have a clear comment explaining why ignoring is intentional
- [ ] Error handling utility created and tested
- [ ] Application behavior unchanged (errors that were ignored are still handled gracefully)
- [ ] Development console shows helpful debug messages

---

## Guidelines for Catch Block Handling

| Scenario | Recommended Approach |
|----------|---------------------|
| Network requests that may fail | Log warning, show user notification |
| Optional data fetching | Log debug (dev only), continue with defaults |
| Validation that may throw | Handle error, show validation message |
| Critical operations | Log error, show error UI, optionally report |
| Known non-issues | Comment explaining why, debug log in dev |

---

## Rollback Plan

```bash
git checkout HEAD -- frontend/src/pages/Teams.tsx
git checkout HEAD -- frontend/src/components/ProjectDetail/TasksView.tsx
rm -f frontend/src/utils/error-handling.ts
rm -f frontend/src/utils/error-handling.test.ts
```

---

## Dependencies

- None

## Blocks

- None
