# Ticket 002: Fix `any` Types in MCP Server

## Priority: Critical
## Estimated Effort: Medium
## Component: MCP Server

---

## Problem Description

The MCP server (`mcp-server/src/server.ts`) contains 25+ uses of the `any` type, which violates the project's TypeScript strict mode requirements (defined in `CLAUDE.md`). This bypasses type safety, making the code prone to runtime errors and harder to maintain.

---

## Files Affected

| File | Approximate `any` Count |
|------|------------------------|
| `mcp-server/src/server.ts` | 25+ instances |
| `mcp-server/src/types.ts` | Needs new interfaces |

---

## Detailed Instructions

### Step 1: Create New Type Definitions

**File:** `mcp-server/src/types.ts`

Add the following interfaces:

```typescript
// ============================================
// Session Types
// ============================================

export interface TmuxSession {
  sessionName: string;
  windowName?: string;
  paneId?: string;
  isAttached?: boolean;
  createdAt?: string;
}

export interface SessionListResponse {
  success: boolean;
  data?: TmuxSession[];
  error?: string;
}

// ============================================
// Team and Member Types
// ============================================

export interface TeamMember {
  id: string;
  name: string;
  sessionName: string;
  role: string;
  systemPrompt?: string;
  agentStatus: 'inactive' | 'activating' | 'active';
  workingStatus: 'idle' | 'in_progress';
  runtimeType?: 'claude-code' | 'gemini-cli' | 'codex-cli';
  currentTickets?: string[];
  readyAt?: string;
  capabilities?: string[];
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  currentProject?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamResponse {
  success: boolean;
  data?: Team;
  error?: string;
}

export interface TeamsListResponse {
  success: boolean;
  data?: Team[];
  error?: string;
}

// ============================================
// Agent Status Types
// ============================================

export interface AgentStatusParams {
  sessionName: string;
  includeOutput?: boolean;
  outputLines?: number;
}

export interface AgentStatusResult {
  sessionName: string;
  exists: boolean;
  agentStatus: 'inactive' | 'activating' | 'active';
  workingStatus: 'idle' | 'in_progress';
  teamId?: string;
  teamName?: string;
  memberName?: string;
  role?: string;
  currentTickets?: string[];
  lastActivity?: string;
  recentOutput?: string;
  error?: string;
}

export interface RegisterAgentStatusParams {
  sessionName: string;
  status: 'inactive' | 'activating' | 'active';
  workingStatus?: 'idle' | 'in_progress';
  currentTask?: string;
  progress?: string;
}

// ============================================
// Task Types
// ============================================

export interface TaskContent {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  labels?: string[];
  filePath?: string;
}

export interface InProgressTask {
  taskId: string;
  filePath: string;
  assignedTo: string;
  sessionName: string;
  teamId: string;
  projectId: string;
  startedAt: string;
  status: 'in_progress';
}

export interface TaskTrackingData {
  tasks: InProgressTask[];
  lastUpdated: string;
  version: string;
}

// ============================================
// Terminate Agent Types
// ============================================

export interface TerminateAgentParams {
  sessionName: string;
  force?: boolean;
  reason?: string;
}

export interface TerminateAgentsParams {
  sessionNames: string[];
  force?: boolean;
  reason?: string;
}

export interface TerminateResult {
  sessionName: string;
  success: boolean;
  error?: string;
}

// ============================================
// Recovery Types
// ============================================

export interface RecoveryReport {
  timestamp: string;
  sessionsChecked: number;
  sessionsRecovered: number;
  sessionsFailed: number;
  details: RecoveryDetail[];
}

export interface RecoveryDetail {
  sessionName: string;
  status: 'recovered' | 'failed' | 'skipped';
  reason?: string;
}

// ============================================
// API Response Types
// ============================================

export interface BackendHealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime?: number;
}

export interface BackendAgentResponse {
  success: boolean;
  data?: {
    agentStatus: string;
    workingStatus: string;
    currentTickets?: string[];
  };
  error?: string;
}
```

### Step 2: Update server.ts - Session Handling

**File:** `mcp-server/src/server.ts`

**Before (Line ~158):**
```typescript
const sessionNames = sessions.map((s: any) => s.sessionName);
```

**After:**
```typescript
import { TmuxSession, SessionListResponse } from './types.js';

const sessionNames = sessions.map((s: TmuxSession) => s.sessionName);
```

### Step 3: Update server.ts - Team Data Handling

**Before (Lines ~202-232):**
```typescript
let teamData: any = null;
// ...
let memberData: any = null;
// ...
team.members.find((m: any) => m.sessionName === sessionName)
```

**After:**
```typescript
import { Team, TeamMember, TeamResponse } from './types.js';

let teamData: Team | null = null;
// ...
let memberData: TeamMember | null = null;
// ...
team.members.find((m: TeamMember) => m.sessionName === sessionName)
```

### Step 4: Update server.ts - Agent Status Methods

**Before (Lines ~338-344):**
```typescript
let agentData: any = null;
let teamData: any = null;
let backendData: any = null;
```

**After:**
```typescript
import { AgentStatusResult, Team, BackendAgentResponse } from './types.js';

let agentData: AgentStatusResult | null = null;
let teamData: Team | null = null;
let backendData: BackendAgentResponse | null = null;
```

### Step 5: Update server.ts - Terminate Methods

**Before (Lines ~1662-1729):**
```typescript
async terminateAgent(params: any): Promise<any> {
  // ...
}

async terminateAgents(params: any): Promise<any> {
  // ...
}
```

**After:**
```typescript
import { TerminateAgentParams, TerminateAgentsParams, TerminateResult } from './types.js';

async terminateAgent(params: TerminateAgentParams): Promise<TerminateResult> {
  const { sessionName, force = false, reason } = params;
  // ...
  return {
    sessionName,
    success: true,
  };
}

async terminateAgents(params: TerminateAgentsParams): Promise<TerminateResult[]> {
  const { sessionNames, force = false, reason } = params;
  // ...
  return results;
}
```

### Step 6: Update server.ts - YAML Field Update

**Before (Line ~2000):**
```typescript
private updateYAMLField(content: string, field: string, value: any): string {
```

**After:**
```typescript
private updateYAMLField(content: string, field: string, value: string | number | boolean | string[]): string {
```

### Step 7: Update server.ts - Parse Task Content

**Before (Line ~2086):**
```typescript
private parseTaskContent(content: string, filePath: string): any {
```

**After:**
```typescript
import { TaskContent } from './types.js';

private parseTaskContent(content: string, filePath: string): TaskContent | null {
  // ... existing implementation
  return {
    id: parsed.id || path.basename(filePath, '.yaml'),
    title: parsed.title || 'Untitled',
    description: parsed.description,
    status: parsed.status || 'open',
    assignedTo: parsed.assigned_to,
    priority: parsed.priority,
    labels: parsed.labels,
    filePath,
  };
}
```

### Step 8: Update server.ts - Task Tracking

**Before (Lines ~2840-2905):**
```typescript
let trackingData: any = { tasks: [], lastUpdated: new Date().toISOString(), version: '1.0.0' };
```

**After:**
```typescript
import { TaskTrackingData, InProgressTask } from './types.js';

let trackingData: TaskTrackingData = {
  tasks: [],
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
};
```

### Step 9: Update server.ts - Recovery Report

**Before (Line ~700):**
```typescript
let recoveryReport: any = null;
```

**After:**
```typescript
import { RecoveryReport } from './types.js';

let recoveryReport: RecoveryReport | null = null;
```

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. TypeScript compilation should pass
cd mcp-server
npm run build
# Expected: No type errors

# 2. Check for remaining 'any' types (should be minimal/justified)
grep -n ": any" src/server.ts | wc -l
# Expected: 0 or very few with documented reasons

# 3. Run MCP server tests
npm test
# Expected: All tests pass

# 4. Type check without building
npx tsc --noEmit
# Expected: No errors
```

### Manual Verification Checklist

- [ ] All new interfaces are in `mcp-server/src/types.ts`
- [ ] No `any` types in public method parameters
- [ ] No `any` types in public method return values
- [ ] All API response types are properly typed
- [ ] TypeScript strict mode passes
- [ ] MCP server starts without errors

---

## Unit Tests to Add

**File:** `mcp-server/src/types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type {
  TmuxSession,
  Team,
  TeamMember,
  AgentStatusParams,
  AgentStatusResult,
  TaskContent,
  TaskTrackingData,
  TerminateAgentParams,
} from './types.js';

describe('MCP Server Type Definitions', () => {
  describe('TmuxSession', () => {
    it('should accept valid session data', () => {
      const session: TmuxSession = {
        sessionName: 'test-session',
        windowName: 'main',
        paneId: '%0',
        isAttached: false,
      };
      expect(session.sessionName).toBe('test-session');
    });

    it('should allow optional fields to be undefined', () => {
      const session: TmuxSession = {
        sessionName: 'minimal-session',
      };
      expect(session.windowName).toBeUndefined();
    });
  });

  describe('TeamMember', () => {
    it('should enforce required fields', () => {
      const member: TeamMember = {
        id: 'member-1',
        name: 'Developer',
        sessionName: 'dev-session',
        role: 'developer',
        agentStatus: 'active',
        workingStatus: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(member.agentStatus).toBe('active');
    });

    it('should restrict agentStatus to valid values', () => {
      const validStatuses: TeamMember['agentStatus'][] = ['inactive', 'activating', 'active'];
      validStatuses.forEach(status => {
        expect(['inactive', 'activating', 'active']).toContain(status);
      });
    });
  });

  describe('TaskContent', () => {
    it('should accept valid task data', () => {
      const task: TaskContent = {
        id: 'task-1',
        title: 'Implement feature',
        status: 'in_progress',
        priority: 'high',
      };
      expect(task.status).toBe('in_progress');
    });

    it('should restrict status to valid values', () => {
      const validStatuses: TaskContent['status'][] = ['open', 'in_progress', 'review', 'done', 'blocked'];
      expect(validStatuses).toHaveLength(5);
    });
  });

  describe('TaskTrackingData', () => {
    it('should have required structure', () => {
      const tracking: TaskTrackingData = {
        tasks: [],
        lastUpdated: new Date().toISOString(),
        version: '1.0.0',
      };
      expect(tracking.tasks).toEqual([]);
      expect(tracking.version).toBe('1.0.0');
    });
  });

  describe('TerminateAgentParams', () => {
    it('should require sessionName', () => {
      const params: TerminateAgentParams = {
        sessionName: 'session-to-terminate',
      };
      expect(params.sessionName).toBeDefined();
    });

    it('should allow optional force and reason', () => {
      const params: TerminateAgentParams = {
        sessionName: 'session-to-terminate',
        force: true,
        reason: 'User requested termination',
      };
      expect(params.force).toBe(true);
    });
  });
});
```

**File:** `mcp-server/src/server.type-safety.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMuxMCPServer } from './server.js';

describe('MCP Server Type Safety', () => {
  let server: AgentMuxMCPServer;

  beforeEach(() => {
    server = new AgentMuxMCPServer();
  });

  describe('terminateAgent', () => {
    it('should accept properly typed parameters', async () => {
      const params = {
        sessionName: 'test-session',
        force: false,
        reason: 'Testing',
      };

      // This should compile without errors
      // The actual call may fail if session doesn't exist, but type checking passes
      try {
        await server.terminateAgent(params);
      } catch (e) {
        // Expected - session doesn't exist in test
      }
    });
  });

  describe('parseTaskContent', () => {
    it('should return TaskContent or null', () => {
      // Access private method for testing (use bracket notation)
      const parseMethod = (server as any).parseTaskContent.bind(server);

      const validYaml = `
id: task-1
title: Test Task
status: open
`;
      const result = parseMethod(validYaml, '/path/to/task.yaml');

      if (result !== null) {
        expect(result.id).toBeDefined();
        expect(result.title).toBeDefined();
        expect(result.status).toBeDefined();
      }
    });
  });
});
```

---

## Rollback Plan

If issues arise:

```bash
git checkout -- mcp-server/src/server.ts
git checkout -- mcp-server/src/types.ts
```

---

## Dependencies

- None

## Blocks

- Other MCP server improvements depend on having proper types
