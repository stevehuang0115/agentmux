# Task 70: Fix Dashboard Stuck at Loading

## Priority: Critical

## Problem

The Dashboard page (`/`) is stuck at the "Loading dashboard..." state indefinitely, even though the API calls to `/api/projects` and `/api/teams` return HTTP 200 OK successfully.

### Observed Behavior
- Dashboard shows spinner with "Loading dashboard..."
- Network requests show successful responses (200 OK)
- No console errors
- Loading state never resolves

### Expected Behavior
- Dashboard should display Projects and Teams cards after API success
- Or show error message if something goes wrong

## Root Cause Analysis

Likely issues:
1. **State not being updated after fetch** - The `setLoading(false)` may not be reached
2. **isMountedRef issue** - The ref might be set to false before data loads
3. **Promise.all rejection** - One promise failing silently
4. **Data parsing issue** - Response format doesn't match expected types
5. **React StrictMode double-render** - Causing race conditions

## Investigation Steps

### 1. Check API Response Format

```typescript
// Expected format from Dashboard.tsx:
const [projectsData, teamsData] = await Promise.all([
  apiService.getProjects(),  // Should return Project[]
  apiService.getTeams(),     // Should return Team[]
]);
```

### 2. Verify apiService Implementation

Check `frontend/src/services/api.service.ts`:
- Does `getProjects()` return `Project[]` directly or wrapped?
- Does the response parsing handle errors correctly?
- Are there any async/await issues?

### 3. Add Debug Logging

```typescript
const fetchData = useCallback(async () => {
  console.log('Dashboard: Starting fetch...');
  setLoading(true);
  setError(null);

  try {
    console.log('Dashboard: Calling APIs...');
    const [projectsData, teamsData] = await Promise.all([
      apiService.getProjects(),
      apiService.getTeams(),
    ]);
    console.log('Dashboard: API responses:', { projectsData, teamsData });

    if (isMountedRef.current) {
      console.log('Dashboard: Setting state...');
      setProjects(projectsData.slice(0, MAX_ITEMS_PER_SECTION));
      setTeams(teamsData.slice(0, MAX_ITEMS_PER_SECTION));
    }
  } catch (err) {
    console.error('Dashboard: Fetch error:', err);
    // ...
  } finally {
    console.log('Dashboard: Finally block, isMounted:', isMountedRef.current);
    if (isMountedRef.current) {
      setLoading(false);
    }
  }
}, []);
```

## Implementation Fix

### Option A: Fix isMountedRef Pattern

The current pattern has a bug - the ref is set to false on cleanup, but this happens on EVERY re-render in StrictMode, not just unmount.

```typescript
// Current (buggy):
useEffect(() => {
  fetchData();
  return () => {
    isMountedRef.current = false;  // This runs on every re-render!
  };
}, [fetchData]);

// Fixed:
useEffect(() => {
  let isMounted = true;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsData, teamsData] = await Promise.all([
        apiService.getProjects(),
        apiService.getTeams(),
      ]);

      if (isMounted) {
        setProjects(projectsData.slice(0, MAX_ITEMS_PER_SECTION));
        setTeams(teamsData.slice(0, MAX_ITEMS_PER_SECTION));
        setLoading(false);
      }
    } catch (err) {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to load');
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => {
    isMounted = false;
  };
}, []);
```

### Option B: Use AbortController

```typescript
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsData, teamsData] = await Promise.all([
        apiService.getProjects({ signal: controller.signal }),
        apiService.getTeams({ signal: controller.signal }),
      ]);

      setProjects(projectsData.slice(0, MAX_ITEMS_PER_SECTION));
      setTeams(teamsData.slice(0, MAX_ITEMS_PER_SECTION));
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  fetchData();

  return () => controller.abort();
}, []);
```

## Files to Modify

1. `frontend/src/pages/Dashboard.tsx` - Fix the loading state logic
2. `frontend/src/services/api.service.ts` - Verify response format (if needed)

## Testing Requirements

1. Dashboard loads and displays Projects section
2. Dashboard loads and displays Teams section
3. Empty state shows when no projects/teams
4. Error state shows on API failure
5. No infinite loading states
6. Works correctly with React StrictMode

## Acceptance Criteria

- [ ] Dashboard loads successfully after page refresh
- [ ] Projects section shows cards or empty state
- [ ] Teams section shows cards or empty state
- [ ] Loading spinner disappears after data loads
- [ ] Error state displays on API failure
- [ ] No console errors during normal operation
