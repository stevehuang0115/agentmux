# Ticket 005: Optimize Dynamic Imports in MCP Server

## Priority: Medium
## Estimated Effort: Small
## Component: MCP Server

---

## Problem Description

The MCP server repeatedly uses dynamic imports (`await import(...)`) for standard Node.js modules in methods that are called frequently. This adds unnecessary overhead since these modules could be imported once at the top of the file.

---

## Files Affected

| File | Lines | Dynamic Imports |
|------|-------|-----------------|
| `mcp-server/src/server.ts` | 2842-2844 | `fs/promises`, `path`, `os` |
| `mcp-server/src/server.ts` | 2897-2900 | `fs/promises`, `path`, `os` |
| `mcp-server/src/server.ts` | 2939 | `fs/promises` |
| `mcp-server/src/server.ts` | 2962 | `fs/promises`, `path` |

---

## Detailed Instructions

### Step 1: Identify All Dynamic Imports

```bash
cd mcp-server

# Find all dynamic imports
grep -n "await import(" src/server.ts
```

Expected output showing lines like:
```
2842: const fs = await import('fs/promises');
2843: const path = await import('path');
2844: const os = await import('os');
```

### Step 2: Move to Static Imports

**File:** `mcp-server/src/server.ts`

**Before (at various method locations):**
```typescript
async addTaskToInProgressTracking(/* ... */) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
  // ...
}

async removeTaskFromInProgressTracking(/* ... */) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');

  const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
  // ...
}
```

**After (at top of file):**
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ... later in the file ...

async addTaskToInProgressTracking(/* ... */) {
  const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
  // ... use fs, path, os directly
}

async removeTaskFromInProgressTracking(/* ... */) {
  const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
  // ... use fs, path, os directly
}
```

### Step 3: Check for ESM Compatibility

Since this is a TypeScript project with ES modules, ensure the imports work correctly:

**tsconfig.json should have:**
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    // or
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

**For Node.js built-in modules with ESM:**
```typescript
// Option 1: Namespace import (recommended for consistency)
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Option 2: Named imports
import { readFile, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';

// Option 3: With node: prefix (explicit, recommended for Node 16+)
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
```

### Step 4: Refactor Repeated Path Construction

If the same path is constructed multiple times, extract it:

```typescript
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { AGENTMUX_CONSTANTS } from '../config/index.js';

class AgentMuxMCPServer {
  // Compute once
  private readonly agentmuxHome = path.join(
    os.homedir(),
    AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME
  );

  private readonly inProgressTasksPath = path.join(
    this.agentmuxHome,
    'in_progress_tasks.json'
  );

  async addTaskToInProgressTracking(/* ... */) {
    // Use this.inProgressTasksPath directly
    const content = await fs.readFile(this.inProgressTasksPath, 'utf-8');
    // ...
  }

  async removeTaskFromInProgressTracking(/* ... */) {
    // Use this.inProgressTasksPath directly
    const content = await fs.readFile(this.inProgressTasksPath, 'utf-8');
    // ...
  }
}
```

### Step 5: Update All Occurrences

Search and replace pattern:

```bash
# Find all occurrences to update
grep -n "const fs = await import\|const path = await import\|const os = await import" src/server.ts
```

For each occurrence:
1. Remove the dynamic import line
2. Use the static import at the top of the file
3. Ensure the module is imported at the top

### Step 6: Verify No Other Dynamic Imports Needed

Some dynamic imports might be intentional (e.g., optional dependencies). Review each one:

```bash
# List all remaining dynamic imports
grep -n "await import(" src/server.ts
```

Keep dynamic imports only for:
- Optional dependencies that might not be installed
- Conditional loading based on configuration
- Code splitting (if applicable)

---

## Evaluation Criteria

### Automated Verification

```bash
cd mcp-server

# 1. No dynamic imports for standard modules
grep -c "await import('fs\|await import('path\|await import('os" src/server.ts
# Expected: 0

# 2. Static imports at top of file
head -30 src/server.ts | grep "import.*from.*fs\|import.*from.*path\|import.*from.*os"
# Expected: Matches for fs, path, os imports

# 3. Build succeeds
npm run build

# 4. Tests pass
npm test

# 5. Type check passes
npx tsc --noEmit
```

### Performance Verification

You can add a simple benchmark to verify the improvement:

```typescript
// In a test file or temporary script
const iterations = 10000;

// Before: Dynamic import
console.time('dynamic');
for (let i = 0; i < iterations; i++) {
  const fs = await import('fs/promises');
  const exists = await fs.access('/tmp').then(() => true).catch(() => false);
}
console.timeEnd('dynamic');

// After: Static import (already imported at top)
console.time('static');
for (let i = 0; i < iterations; i++) {
  const exists = await fs.access('/tmp').then(() => true).catch(() => false);
}
console.timeEnd('static');
```

### Manual Verification Checklist

- [ ] All standard Node.js modules imported statically
- [ ] Imports at top of server.ts file
- [ ] No remaining unnecessary dynamic imports
- [ ] Common paths extracted to class properties
- [ ] Build succeeds
- [ ] All tests pass
- [ ] MCP server starts correctly

---

## Code Organization

After refactoring, the top of `server.ts` should look like:

```typescript
// Node.js built-in modules
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// Third-party dependencies
import axios from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Local imports
import { logger } from './logger.js';
import {
  AGENTMUX_CONSTANTS,
  WEB_CONSTANTS,
  MCP_CONSTANTS,
} from '../config/index.js';
import type {
  AgentStatusParams,
  AgentStatusResult,
  // ... other types
} from './types.js';

// ... class definition
```

---

## Rollback Plan

```bash
git checkout HEAD -- mcp-server/src/server.ts
```

---

## Dependencies

- Ticket 002 from Milestone 1 (Fix MCP Server Any Types) - for proper type imports
- Ticket 004 from Milestone 1 (Replace Hardcoded Values) - for path constants

## Blocks

- None
