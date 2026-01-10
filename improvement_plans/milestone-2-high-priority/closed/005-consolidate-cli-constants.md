# Ticket 005: Consolidate CLI Constants with Central Config

## Priority: High
## Estimated Effort: Small
## Component: CLI

---

## Problem Description

The `cli/src/constants.ts` file duplicates many values that already exist in the centralized `/config/constants.ts`. This violates DRY principle and makes maintenance harder since changes need to be made in multiple places.

---

## Files Affected

| File | Issue |
|------|-------|
| `cli/src/constants.ts` | Contains duplicate constants |
| `cli/src/commands/start.ts` | May import from local constants |
| `cli/src/commands/stop.ts` | May import from local constants |
| `cli/src/commands/status.ts` | May import from local constants |
| `cli/src/commands/logs.ts` | May import from local constants |
| `cli/src/index.ts` | May import from local constants |

---

## Duplicate Constants to Remove

| CLI Constant | Central Location |
|--------------|-----------------|
| `ORCHESTRATOR_SESSION_NAME` | `AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME` |
| `ORCHESTRATOR_DISPLAY_NAME` | `AGENTMUX_CONSTANTS.ORCHESTRATOR.DISPLAY_NAME` |
| `ORCHESTRATOR_ROLE` | `AGENTMUX_CONSTANTS.ROLES.ORCHESTRATOR` |
| `AGENTMUX_HOME_DIR` | `AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME` |
| `TEAMS_CONFIG_FILE` | `AGENTMUX_CONSTANTS.PATHS.TEAMS_FILE` |
| `AGENT_ROLES` | `AGENTMUX_CONSTANTS.ROLES` |
| `DEFAULT_WEB_PORT` | `WEB_CONSTANTS.PORTS.BACKEND` |
| `DEFAULT_MCP_PORT` | `MCP_CONSTANTS.PORTS.DEFAULT` |

---

## Detailed Instructions

### Step 1: Review Current CLI Constants

**File:** `cli/src/constants.ts`

Identify all constants and categorize:
- **Duplicate** - exists in `/config/constants.ts` → Remove
- **CLI-specific** - only used by CLI → Keep or move to `/config/cli-constants.ts`

### Step 2: Update Central Config if Needed

**File:** `/config/constants.ts`

Ensure all needed constants exist:

```typescript
export const AGENTMUX_CONSTANTS = {
  SESSIONS: {
    ORCHESTRATOR_NAME: 'agentmux-orc',
    DEFAULT_TIMEOUT: 120000,
    REGISTRATION_CHECK_INTERVAL: 5000,
  },
  PATHS: {
    AGENTMUX_HOME: '.agentmux',
    TEAMS_FILE: 'teams.json',
    PROJECTS_FILE: 'projects.json',
    CONFIG_DIR: 'config',
    PROMPTS_DIR: 'prompts',
  },
  ORCHESTRATOR: {
    DISPLAY_NAME: 'Orchestrator',
    DEFAULT_PROMPT: 'You are the orchestrator agent...',
  },
  ROLES: {
    ORCHESTRATOR: 'orchestrator',
    TPM: 'tpm',
    DEVELOPER: 'developer',
    SENIOR_DEVELOPER: 'senior-developer',
    JUNIOR_DEVELOPER: 'junior-developer',
    QA: 'qa',
  },
  AGENT_STATUSES: {
    INACTIVE: 'inactive',
    ACTIVATING: 'activating',
    ACTIVE: 'active',
  },
  WORKING_STATUSES: {
    IDLE: 'idle',
    IN_PROGRESS: 'in_progress',
  },
} as const;

export const WEB_CONSTANTS = {
  PORTS: {
    BACKEND: 3000,
    FRONTEND: 5173,
  },
  ENDPOINTS: {
    HEALTH: '/health',
    API_BASE: '/api',
  },
} as const;

export const MCP_CONSTANTS = {
  PORTS: {
    DEFAULT: 3001,
  },
  TIMEOUTS: {
    RESPONSE: 30000,
    CONNECTION: 10000,
  },
} as const;
```

### Step 3: Update CLI Constants File

**File:** `cli/src/constants.ts`

**Before:**
```typescript
// Duplicated values
export const ORCHESTRATOR_SESSION_NAME = 'agentmux-orc';
export const ORCHESTRATOR_DISPLAY_NAME = 'Orchestrator';
export const ORCHESTRATOR_ROLE = 'orchestrator';
export const AGENTMUX_HOME_DIR = '.agentmux';
export const TEAMS_CONFIG_FILE = 'teams.json';
export const DEFAULT_WEB_PORT = 3000;
export const DEFAULT_MCP_PORT = 3001;

export const AGENT_ROLES = {
  orchestrator: 'orchestrator',
  tpm: 'tpm',
  developer: 'developer',
  // ...
};
```

**After:**
```typescript
/**
 * CLI-specific constants
 *
 * For shared constants, import from the central config:
 * import { AGENTMUX_CONSTANTS, WEB_CONSTANTS, MCP_CONSTANTS } from '../../config/index.js';
 */

// Re-export from central config for convenience
export {
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  MCP_CONSTANTS,
  TIMING_CONSTANTS,
} from '../../config/index.js';

// CLI-specific constants only
export const CLI_CONSTANTS = {
  /** CLI tool name for display */
  TOOL_NAME: 'agentmux',

  /** CLI version (should match package.json) */
  VERSION: '1.0.0',

  /** Default output format */
  DEFAULT_OUTPUT_FORMAT: 'text' as const,

  /** Colors for status display */
  STATUS_COLORS: {
    SUCCESS: 'green',
    ERROR: 'red',
    WARNING: 'yellow',
    INFO: 'blue',
  },

  /** Exit codes */
  EXIT_CODES: {
    SUCCESS: 0,
    ERROR: 1,
    INVALID_ARGS: 2,
  },
} as const;

// Convenience aliases for commonly used constants
export const ORCHESTRATOR_SESSION_NAME = AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME;
export const DEFAULT_WEB_PORT = WEB_CONSTANTS.PORTS.BACKEND;
export const DEFAULT_MCP_PORT = MCP_CONSTANTS.PORTS.DEFAULT;
```

### Step 4: Update CLI Command Files

**File:** `cli/src/commands/start.ts`

**Before:**
```typescript
import {
  ORCHESTRATOR_SESSION_NAME,
  DEFAULT_WEB_PORT,
  DEFAULT_MCP_PORT
} from '../constants.js';
```

**After:**
```typescript
import {
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  MCP_CONSTANTS
} from '../../config/index.js';

const ORCHESTRATOR_SESSION_NAME = AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME;
const DEFAULT_WEB_PORT = process.env.WEB_PORT
  ? parseInt(process.env.WEB_PORT, 10)
  : WEB_CONSTANTS.PORTS.BACKEND;
const DEFAULT_MCP_PORT = process.env.MCP_PORT
  ? parseInt(process.env.MCP_PORT, 10)
  : MCP_CONSTANTS.PORTS.DEFAULT;
```

**File:** `cli/src/commands/status.ts`

Apply similar changes.

**File:** `cli/src/commands/stop.ts`

Apply similar changes.

**File:** `cli/src/commands/logs.ts`

Apply similar changes.

### Step 5: Update CLI Index File

**File:** `cli/src/index.ts`

Update any imports to use the consolidated approach.

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. Check for remaining duplicates
diff <(grep -E "^\s*export const" cli/src/constants.ts | sort) \
     <(grep -E "^\s*export const" config/constants.ts | sort)
# Expected: Only CLI-specific constants in cli/src/constants.ts

# 2. Build CLI
cd cli && npm run build
# Expected: Success

# 3. Run CLI commands
npx agentmux status
npx agentmux --help
# Expected: Commands work correctly

# 4. Verify central constants are used
grep -r "from.*config/index" cli/src/
# Expected: Matches in command files
```

### Manual Verification Checklist

- [ ] No duplicate constant definitions
- [ ] CLI commands work correctly
- [ ] Environment variables still override defaults
- [ ] CLI builds without errors
- [ ] All imports resolve correctly

---

## Testing

**File:** `cli/src/constants.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  MCP_CONSTANTS,
  CLI_CONSTANTS,
  ORCHESTRATOR_SESSION_NAME,
  DEFAULT_WEB_PORT,
  DEFAULT_MCP_PORT,
} from './constants';

describe('CLI Constants', () => {
  describe('Re-exported central constants', () => {
    it('should have AGENTMUX_CONSTANTS available', () => {
      expect(AGENTMUX_CONSTANTS).toBeDefined();
      expect(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME).toBe('agentmux-orc');
    });

    it('should have WEB_CONSTANTS available', () => {
      expect(WEB_CONSTANTS).toBeDefined();
      expect(WEB_CONSTANTS.PORTS.BACKEND).toBe(3000);
    });

    it('should have MCP_CONSTANTS available', () => {
      expect(MCP_CONSTANTS).toBeDefined();
      expect(MCP_CONSTANTS.PORTS.DEFAULT).toBe(3001);
    });
  });

  describe('CLI-specific constants', () => {
    it('should have CLI_CONSTANTS with tool name', () => {
      expect(CLI_CONSTANTS.TOOL_NAME).toBe('agentmux');
    });

    it('should have exit codes defined', () => {
      expect(CLI_CONSTANTS.EXIT_CODES.SUCCESS).toBe(0);
      expect(CLI_CONSTANTS.EXIT_CODES.ERROR).toBe(1);
    });

    it('should have status colors defined', () => {
      expect(CLI_CONSTANTS.STATUS_COLORS.SUCCESS).toBe('green');
      expect(CLI_CONSTANTS.STATUS_COLORS.ERROR).toBe('red');
    });
  });

  describe('Convenience aliases', () => {
    it('should alias ORCHESTRATOR_SESSION_NAME correctly', () => {
      expect(ORCHESTRATOR_SESSION_NAME).toBe(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
    });

    it('should alias DEFAULT_WEB_PORT correctly', () => {
      expect(DEFAULT_WEB_PORT).toBe(WEB_CONSTANTS.PORTS.BACKEND);
    });

    it('should alias DEFAULT_MCP_PORT correctly', () => {
      expect(DEFAULT_MCP_PORT).toBe(MCP_CONSTANTS.PORTS.DEFAULT);
    });
  });
});
```

---

## Rollback Plan

```bash
git checkout HEAD -- cli/src/constants.ts
git checkout HEAD -- cli/src/commands/start.ts
git checkout HEAD -- cli/src/commands/stop.ts
git checkout HEAD -- cli/src/commands/status.ts
git checkout HEAD -- cli/src/commands/logs.ts
git checkout HEAD -- cli/src/index.ts
```

---

## Dependencies

- Ticket 004 from Milestone 1 (Replace Hardcoded Values) should be completed first

## Blocks

- None
