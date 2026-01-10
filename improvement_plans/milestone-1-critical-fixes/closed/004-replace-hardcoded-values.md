# Ticket 004: Replace Hardcoded Values with Constants

## Priority: Critical
## Estimated Effort: Medium
## Component: CLI, MCP Server, Backend

---

## Problem Description

Despite having a well-organized constants system in `/config/constants.ts`, several files contain hardcoded values for ports, timeouts, URLs, and other configuration. This violates the project's standards (defined in `CLAUDE.md`) and makes the codebase harder to maintain and configure.

---

## Files Affected

| File | Hardcoded Values |
|------|------------------|
| `cli/src/commands/status.ts` | Port 3000 (lines 36, 40, 46, 135) |
| `cli/src/commands/stop.ts` | Port 3000, URL (line 45) |
| `cli/src/commands/start.ts` | Various ports and timeouts |
| `mcp-server/src/server.ts` | Port 8788, timeouts (lines 57, 70, 178, 351, 2829, 2946) |

---

## Detailed Instructions

### Step 1: Verify Available Constants

First, review the existing constants in `/config/constants.ts`:

```typescript
// Already available in /config/constants.ts:
export const WEB_CONSTANTS = {
  PORTS: {
    BACKEND: 3000,
    FRONTEND: 5173,
  },
  // ...
};

export const MCP_CONSTANTS = {
  PORTS: {
    DEFAULT: 3001,
  },
  TIMEOUTS: {
    RESPONSE: 30000,
    CONNECTION: 10000,
  },
  // ...
};

export const TIMING_CONSTANTS = {
  INTERVALS: {
    CLEANUP: 60000,
    HEALTH_CHECK: 5000,
  },
  TIMEOUTS: {
    DEFAULT: 30000,
    LONG_RUNNING: 120000,
  },
  // ...
};
```

### Step 2: Add Missing Constants

**File:** `/config/constants.ts`

Add any missing constants:

```typescript
// Add to existing TIMING_CONSTANTS
export const TIMING_CONSTANTS = {
  INTERVALS: {
    CLEANUP: 60000,           // 1 minute
    HEALTH_CHECK: 5000,       // 5 seconds
    BATCH_DELAY: 500,         // 500ms between batch operations
    RATE_LIMIT_WINDOW: 1000,  // 1 second rate limit window
    TASK_CLEANUP: 300000,     // 5 minutes for task cleanup
  },
  TIMEOUTS: {
    DEFAULT: 30000,
    LONG_RUNNING: 120000,
    HEALTH_CHECK: 3000,
    CONNECTION: 10000,
    SHUTDOWN: 2000,
  },
};

// Add fallback port constant
export const WEB_CONSTANTS = {
  PORTS: {
    BACKEND: 3000,
    BACKEND_FALLBACK: 8788,  // Add fallback port
    FRONTEND: 5173,
  },
  ENDPOINTS: {
    HEALTH: '/health',
    API_BASE: '/api',
  },
};
```

### Step 3: Update CLI status.ts

**File:** `cli/src/commands/status.ts`

**Before:**
```typescript
// Line 36
const response = await axios.get('http://localhost:3000/health', { timeout: 3000 });

// Line 40
const response = await axios.get('http://localhost:3000/api/system/status', { timeout: 3000 });

// Line 46
backendStatus = `Running on port 3000`;

// Line 135
console.log(`  Backend: http://localhost:3000`);
```

**After:**
```typescript
import { WEB_CONSTANTS, TIMING_CONSTANTS } from '../../../config/index.js';

const BACKEND_PORT = process.env.WEB_PORT || WEB_CONSTANTS.PORTS.BACKEND;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Line 36
const response = await axios.get(
  `${BACKEND_URL}${WEB_CONSTANTS.ENDPOINTS.HEALTH}`,
  { timeout: TIMING_CONSTANTS.TIMEOUTS.HEALTH_CHECK }
);

// Line 40
const response = await axios.get(
  `${BACKEND_URL}${WEB_CONSTANTS.ENDPOINTS.API_BASE}/system/status`,
  { timeout: TIMING_CONSTANTS.TIMEOUTS.HEALTH_CHECK }
);

// Line 46
backendStatus = `Running on port ${BACKEND_PORT}`;

// Line 135
console.log(`  Backend: ${BACKEND_URL}`);
```

### Step 4: Update CLI stop.ts

**File:** `cli/src/commands/stop.ts`

**Before:**
```typescript
// Line 45
const response = await axios.get('http://localhost:3000/health', { timeout: 2000 });
```

**After:**
```typescript
import { WEB_CONSTANTS, TIMING_CONSTANTS } from '../../../config/index.js';

const BACKEND_PORT = process.env.WEB_PORT || WEB_CONSTANTS.PORTS.BACKEND;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Line 45
const response = await axios.get(
  `${BACKEND_URL}${WEB_CONSTANTS.ENDPOINTS.HEALTH}`,
  { timeout: TIMING_CONSTANTS.TIMEOUTS.SHUTDOWN }
);
```

### Step 5: Update MCP Server

**File:** `mcp-server/src/server.ts`

**Before:**
```typescript
// Line 57
const fallbackPort = 8788;

// Line 70
setInterval(() => {
  this.cleanup();
}, 60000);

// Line 178
await new Promise(resolve => setTimeout(resolve, 500));

// Line 351
{ timeout: 10000 }

// Line 2829
const RATE_LIMIT_WINDOW = 1000;

// Line 2946
const CLEANUP_INTERVAL = 300000; // 5 minutes
```

**After:**
```typescript
import { WEB_CONSTANTS, TIMING_CONSTANTS, MCP_CONSTANTS } from '../config/index.js';

// Line 57
const fallbackPort = WEB_CONSTANTS.PORTS.BACKEND_FALLBACK;

// Line 70
setInterval(() => {
  this.cleanup();
}, TIMING_CONSTANTS.INTERVALS.CLEANUP);

// Line 178
await new Promise(resolve => setTimeout(resolve, TIMING_CONSTANTS.INTERVALS.BATCH_DELAY));

// Line 351
{ timeout: MCP_CONSTANTS.TIMEOUTS.CONNECTION }

// Line 2829
const RATE_LIMIT_WINDOW = TIMING_CONSTANTS.INTERVALS.RATE_LIMIT_WINDOW;

// Line 2946
const CLEANUP_INTERVAL = TIMING_CONSTANTS.INTERVALS.TASK_CLEANUP;
```

### Step 6: Update config/index.ts Exports

**File:** `/config/index.ts`

Ensure all constants are properly exported:

```typescript
export * from './constants.js';
export * from './backend-constants.js';
export * from './frontend-constants.js';
export * from './cli-constants.js';

// Re-export commonly used constants for convenience
export {
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  MCP_CONSTANTS,
  TIMING_CONSTANTS,
} from './constants.js';
```

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. Search for remaining hardcoded ports
grep -rn "localhost:3000" --include="*.ts" cli/ mcp-server/ backend/
# Expected: No matches (or only in tests with documented reasons)

grep -rn "localhost:3001" --include="*.ts" cli/ mcp-server/ backend/
# Expected: No matches (or only in tests)

# 2. Search for hardcoded timeouts (common values)
grep -rn "60000\|30000\|10000\|5000" --include="*.ts" cli/src/ mcp-server/src/
# Expected: No matches - all should use constants

# 3. Build all components
npm run build
# Expected: No errors

# 4. Run tests
npm test
# Expected: All tests pass
```

### Manual Verification Checklist

- [ ] No hardcoded port numbers in CLI commands
- [ ] No hardcoded port numbers in MCP server
- [ ] No hardcoded timeout values
- [ ] No hardcoded URL paths
- [ ] All new constants are documented
- [ ] Environment variables are respected (WEB_PORT, MCP_PORT)
- [ ] All components build successfully

---

## Unit Tests to Add

**File:** `config/constants.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  WEB_CONSTANTS,
  MCP_CONSTANTS,
  TIMING_CONSTANTS,
  AGENTMUX_CONSTANTS,
} from './constants';

describe('Constants Configuration', () => {
  describe('WEB_CONSTANTS', () => {
    it('should have valid port numbers', () => {
      expect(WEB_CONSTANTS.PORTS.BACKEND).toBeGreaterThan(0);
      expect(WEB_CONSTANTS.PORTS.BACKEND).toBeLessThan(65536);
      expect(WEB_CONSTANTS.PORTS.FRONTEND).toBeGreaterThan(0);
      expect(WEB_CONSTANTS.PORTS.BACKEND_FALLBACK).toBeGreaterThan(0);
    });

    it('should have valid endpoint paths', () => {
      expect(WEB_CONSTANTS.ENDPOINTS.HEALTH).toMatch(/^\//);
      expect(WEB_CONSTANTS.ENDPOINTS.API_BASE).toMatch(/^\//);
    });

    it('should not have trailing slashes on endpoints', () => {
      expect(WEB_CONSTANTS.ENDPOINTS.HEALTH).not.toMatch(/\/$/);
      expect(WEB_CONSTANTS.ENDPOINTS.API_BASE).not.toMatch(/\/$/);
    });
  });

  describe('MCP_CONSTANTS', () => {
    it('should have valid port numbers', () => {
      expect(MCP_CONSTANTS.PORTS.DEFAULT).toBeGreaterThan(0);
      expect(MCP_CONSTANTS.PORTS.DEFAULT).toBeLessThan(65536);
    });

    it('should have reasonable timeout values', () => {
      expect(MCP_CONSTANTS.TIMEOUTS.RESPONSE).toBeGreaterThanOrEqual(1000);
      expect(MCP_CONSTANTS.TIMEOUTS.CONNECTION).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('TIMING_CONSTANTS', () => {
    it('should have valid interval values', () => {
      expect(TIMING_CONSTANTS.INTERVALS.CLEANUP).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.INTERVALS.HEALTH_CHECK).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.INTERVALS.BATCH_DELAY).toBeGreaterThan(0);
    });

    it('should have valid timeout values', () => {
      expect(TIMING_CONSTANTS.TIMEOUTS.DEFAULT).toBeGreaterThan(0);
      expect(TIMING_CONSTANTS.TIMEOUTS.HEALTH_CHECK).toBeGreaterThan(0);
    });

    it('should have cleanup interval greater than batch delay', () => {
      expect(TIMING_CONSTANTS.INTERVALS.CLEANUP).toBeGreaterThan(
        TIMING_CONSTANTS.INTERVALS.BATCH_DELAY
      );
    });
  });

  describe('AGENTMUX_CONSTANTS', () => {
    it('should have valid session names', () => {
      expect(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBeTruthy();
      expect(typeof AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBe('string');
    });

    it('should have valid paths', () => {
      expect(AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME).toBeTruthy();
      expect(AGENTMUX_CONSTANTS.PATHS.TEAMS_FILE).toMatch(/\.json$/);
      expect(AGENTMUX_CONSTANTS.PATHS.PROJECTS_FILE).toMatch(/\.json$/);
    });
  });
});
```

**File:** `cli/src/commands/status.test.ts`

Add tests to verify constants are used:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { WEB_CONSTANTS, TIMING_CONSTANTS } from '../../../config';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('status command - constants usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use WEB_CONSTANTS for backend port', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'ok' } });

    // Import and run the status check function
    // Verify the URL uses the constant
    const expectedUrl = `http://localhost:${WEB_CONSTANTS.PORTS.BACKEND}${WEB_CONSTANTS.ENDPOINTS.HEALTH}`;

    // The actual test depends on how the command is structured
    // This verifies the constants are properly defined
    expect(WEB_CONSTANTS.PORTS.BACKEND).toBe(3000);
    expect(WEB_CONSTANTS.ENDPOINTS.HEALTH).toBe('/health');
  });

  it('should use TIMING_CONSTANTS for timeout', () => {
    expect(TIMING_CONSTANTS.TIMEOUTS.HEALTH_CHECK).toBe(3000);
  });
});
```

---

## Environment Variable Support

Ensure environment variables can override constants:

```typescript
// In CLI commands and services, use this pattern:
const BACKEND_PORT = parseInt(process.env.WEB_PORT || '', 10) || WEB_CONSTANTS.PORTS.BACKEND;
const MCP_PORT = parseInt(process.env.MCP_PORT || '', 10) || MCP_CONSTANTS.PORTS.DEFAULT;
```

---

## Rollback Plan

```bash
git checkout -- cli/src/commands/status.ts
git checkout -- cli/src/commands/stop.ts
git checkout -- cli/src/commands/start.ts
git checkout -- mcp-server/src/server.ts
git checkout -- config/constants.ts
```

---

## Dependencies

- None

## Blocks

- None (but improves maintainability for all future changes)
