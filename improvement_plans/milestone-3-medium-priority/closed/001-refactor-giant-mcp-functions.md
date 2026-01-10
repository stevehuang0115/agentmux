# Ticket 001: Refactor Giant Functions in MCP Server

## Priority: Medium
## Estimated Effort: Large
## Component: MCP Server

---

## Problem Description

The MCP server contains several functions that are too long and handle multiple responsibilities, making them hard to test, maintain, and understand. The main offenders are:

- `getAgentStatus` (Lines 314-538, 224 lines)
- `registerAgentStatus` (Lines 624-766, 142 lines)

These should be broken down into smaller, focused methods following the Single Responsibility Principle.

---

## Files Affected

| File | Function | Lines | Responsibilities |
|------|----------|-------|------------------|
| `mcp-server/src/server.ts` | `getAgentStatus` | 314-538 | Parameter validation, API calls, tmux checking, output capture, status mapping, report building |
| `mcp-server/src/server.ts` | `registerAgentStatus` | 624-766 | Validation, backend update, tmux verification, status broadcast, logging |

---

## Detailed Instructions

### Part A: Refactor getAgentStatus

**Current Structure (224 lines doing everything):**
```typescript
async getAgentStatus(params: AgentStatusParams): Promise<AgentStatusResult> {
  // 1. Parameter validation (10 lines)
  // 2. Backend API calls with retry (50 lines)
  // 3. Tmux session checking (30 lines)
  // 4. Pane output capture (40 lines)
  // 5. Status mapping logic (30 lines)
  // 6. Progress analysis (30 lines)
  // 7. Report building (34 lines)
}
```

**Target Structure (main function ~30 lines, helpers do the work):**

```typescript
// Type definitions
interface AgentStatusContext {
  sessionName: string;
  includeOutput: boolean;
  outputLines: number;
}

interface BackendAgentData {
  agentStatus: AgentStatus;
  workingStatus: WorkingStatus;
  currentTickets?: string[];
  teamId?: string;
  memberName?: string;
  role?: string;
}

interface TmuxSessionInfo {
  exists: boolean;
  paneId?: string;
  recentOutput?: string;
}

// Main function - orchestration only
async getAgentStatus(params: AgentStatusParams): Promise<AgentStatusResult> {
  const context = this.validateAndBuildContext(params);

  const [backendData, tmuxInfo] = await Promise.all([
    this.fetchBackendAgentData(context.sessionName),
    this.checkTmuxSession(context),
  ]);

  const status = this.determineAgentStatus(backendData, tmuxInfo);
  const progress = this.analyzeProgress(backendData, tmuxInfo);

  return this.buildAgentStatusReport(context, backendData, tmuxInfo, status, progress);
}

// Helper: Validate parameters and build context
private validateAndBuildContext(params: AgentStatusParams): AgentStatusContext {
  if (!params.sessionName) {
    throw new Error('sessionName is required');
  }

  return {
    sessionName: params.sessionName,
    includeOutput: params.includeOutput ?? false,
    outputLines: params.outputLines ?? 50,
  };
}

// Helper: Fetch data from backend API
private async fetchBackendAgentData(sessionName: string): Promise<BackendAgentData | null> {
  const backendPort = process.env.WEB_PORT || WEB_CONSTANTS.PORTS.BACKEND;
  const url = `http://localhost:${backendPort}/api/agents/${sessionName}/status`;

  try {
    const response = await axios.get(url, {
      timeout: MCP_CONSTANTS.TIMEOUTS.CONNECTION,
    });

    if (response.data?.success && response.data?.data) {
      return response.data.data as BackendAgentData;
    }
    return null;
  } catch (error) {
    this.logger.debug(`Backend status check failed for ${sessionName}:`, error);
    return null;
  }
}

// Helper: Check tmux session status
private async checkTmuxSession(context: AgentStatusContext): Promise<TmuxSessionInfo> {
  const { sessionName, includeOutput, outputLines } = context;

  try {
    // Check if session exists
    const sessions = await this.listTmuxSessions();
    const exists = sessions.some(s => s.sessionName === sessionName);

    if (!exists) {
      return { exists: false };
    }

    // Get pane info
    const paneId = await this.getTmuxPaneId(sessionName);

    // Capture output if requested
    let recentOutput: string | undefined;
    if (includeOutput && paneId) {
      recentOutput = await this.captureTmuxOutput(sessionName, paneId, outputLines);
    }

    return { exists: true, paneId, recentOutput };
  } catch (error) {
    this.logger.debug(`Tmux check failed for ${sessionName}:`, error);
    return { exists: false };
  }
}

// Helper: Determine final agent status
private determineAgentStatus(
  backendData: BackendAgentData | null,
  tmuxInfo: TmuxSessionInfo
): AgentStatus {
  // If backend has status, trust it
  if (backendData?.agentStatus) {
    return backendData.agentStatus;
  }

  // Infer from tmux session
  if (tmuxInfo.exists) {
    return 'active';
  }

  return 'inactive';
}

// Helper: Analyze progress from available data
private analyzeProgress(
  backendData: BackendAgentData | null,
  tmuxInfo: TmuxSessionInfo
): ProgressInfo {
  const progress: ProgressInfo = {
    hasActivity: false,
    ticketCount: 0,
  };

  if (backendData?.currentTickets) {
    progress.ticketCount = backendData.currentTickets.length;
    progress.hasActivity = progress.ticketCount > 0;
  }

  if (tmuxInfo.recentOutput) {
    progress.hasActivity = true;
    progress.lastOutputLength = tmuxInfo.recentOutput.length;
  }

  return progress;
}

// Helper: Build the final report
private buildAgentStatusReport(
  context: AgentStatusContext,
  backendData: BackendAgentData | null,
  tmuxInfo: TmuxSessionInfo,
  status: AgentStatus,
  progress: ProgressInfo
): AgentStatusResult {
  return {
    sessionName: context.sessionName,
    exists: tmuxInfo.exists,
    agentStatus: status,
    workingStatus: backendData?.workingStatus ?? 'idle',
    teamId: backendData?.teamId,
    memberName: backendData?.memberName,
    role: backendData?.role,
    currentTickets: backendData?.currentTickets,
    recentOutput: tmuxInfo.recentOutput,
    hasActivity: progress.hasActivity,
    ticketCount: progress.ticketCount,
  };
}
```

### Part B: Refactor registerAgentStatus

**Target Structure:**

```typescript
async registerAgentStatus(params: RegisterAgentStatusParams): Promise<RegisterResult> {
  this.validateRegistrationParams(params);

  const currentState = await this.getCurrentAgentState(params.sessionName);
  const updates = this.buildStatusUpdates(params, currentState);

  await this.persistStatusUpdates(params.sessionName, updates);
  await this.broadcastStatusChange(params.sessionName, updates);

  return this.buildRegistrationResult(params.sessionName, updates);
}

private validateRegistrationParams(params: RegisterAgentStatusParams): void {
  if (!params.sessionName) {
    throw new Error('sessionName is required');
  }

  const validStatuses: AgentStatus[] = ['inactive', 'activating', 'active'];
  if (!validStatuses.includes(params.status)) {
    throw new Error(`Invalid status: ${params.status}`);
  }
}

private async getCurrentAgentState(sessionName: string): Promise<AgentState | null> {
  // Fetch current state from backend
  // ...
}

private buildStatusUpdates(
  params: RegisterAgentStatusParams,
  currentState: AgentState | null
): StatusUpdates {
  return {
    agentStatus: params.status,
    workingStatus: params.workingStatus ?? currentState?.workingStatus ?? 'idle',
    currentTask: params.currentTask,
    progress: params.progress,
    updatedAt: new Date().toISOString(),
  };
}

private async persistStatusUpdates(sessionName: string, updates: StatusUpdates): Promise<void> {
  const backendPort = process.env.WEB_PORT || WEB_CONSTANTS.PORTS.BACKEND;
  await axios.patch(
    `http://localhost:${backendPort}/api/agents/${sessionName}/status`,
    updates,
    { timeout: MCP_CONSTANTS.TIMEOUTS.CONNECTION }
  );
}

private async broadcastStatusChange(sessionName: string, updates: StatusUpdates): Promise<void> {
  // Emit WebSocket event for real-time updates
  // ...
}

private buildRegistrationResult(sessionName: string, updates: StatusUpdates): RegisterResult {
  return {
    success: true,
    sessionName,
    newStatus: updates.agentStatus,
    timestamp: updates.updatedAt,
  };
}
```

---

## Evaluation Criteria

### Automated Verification

```bash
cd mcp-server

# 1. Build should succeed
npm run build

# 2. Type check should pass
npx tsc --noEmit

# 3. Tests should pass
npm test

# 4. Check function lengths (rough check)
# Main functions should be under 50 lines each
wc -l src/server.ts
# Should see reduced overall complexity

# 5. No new any types introduced
grep -c ": any" src/server.ts
```

### Code Metrics

| Metric | Before | After Target |
|--------|--------|--------------|
| `getAgentStatus` lines | 224 | <50 (main) + helpers |
| `registerAgentStatus` lines | 142 | <30 (main) + helpers |
| Cyclomatic complexity | High | Low per function |
| Test coverage | Partial | Full (each helper testable) |

### Manual Verification Checklist

- [ ] Main functions are under 50 lines each
- [ ] Each helper has a single responsibility
- [ ] Helper methods are private (internal use only)
- [ ] All helpers have proper TypeScript types
- [ ] No functionality changed (same behavior)
- [ ] Error handling preserved
- [ ] Logging preserved

---

## Unit Tests to Add

**File:** `mcp-server/src/server.agent-status.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentMuxMCPServer } from './server.js';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('AgentMuxMCPServer - getAgentStatus', () => {
  let server: AgentMuxMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new AgentMuxMCPServer();
  });

  describe('validateAndBuildContext', () => {
    it('should throw if sessionName is missing', () => {
      expect(() => {
        (server as any).validateAndBuildContext({});
      }).toThrow('sessionName is required');
    });

    it('should set default values for optional params', () => {
      const context = (server as any).validateAndBuildContext({
        sessionName: 'test-session',
      });

      expect(context.includeOutput).toBe(false);
      expect(context.outputLines).toBe(50);
    });
  });

  describe('fetchBackendAgentData', () => {
    it('should return data on successful API call', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            agentStatus: 'active',
            workingStatus: 'idle',
          },
        },
      });

      const result = await (server as any).fetchBackendAgentData('test-session');

      expect(result).toEqual({
        agentStatus: 'active',
        workingStatus: 'idle',
      });
    });

    it('should return null on API error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await (server as any).fetchBackendAgentData('test-session');

      expect(result).toBeNull();
    });
  });

  describe('determineAgentStatus', () => {
    it('should use backend status when available', () => {
      const status = (server as any).determineAgentStatus(
        { agentStatus: 'activating' },
        { exists: true }
      );

      expect(status).toBe('activating');
    });

    it('should infer active from tmux when no backend data', () => {
      const status = (server as any).determineAgentStatus(
        null,
        { exists: true }
      );

      expect(status).toBe('active');
    });

    it('should return inactive when no session', () => {
      const status = (server as any).determineAgentStatus(
        null,
        { exists: false }
      );

      expect(status).toBe('inactive');
    });
  });

  describe('getAgentStatus (integration)', () => {
    it('should return complete status report', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            agentStatus: 'active',
            workingStatus: 'in_progress',
            teamId: 'team-1',
            memberName: 'Developer',
          },
        },
      });

      // Mock tmux commands
      vi.spyOn(server as any, 'listTmuxSessions').mockResolvedValue([
        { sessionName: 'test-session' },
      ]);

      const result = await server.getAgentStatus({ sessionName: 'test-session' });

      expect(result.sessionName).toBe('test-session');
      expect(result.agentStatus).toBe('active');
      expect(result.exists).toBe(true);
    });
  });
});

describe('AgentMuxMCPServer - registerAgentStatus', () => {
  let server: AgentMuxMCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new AgentMuxMCPServer();
  });

  describe('validateRegistrationParams', () => {
    it('should throw if sessionName is missing', () => {
      expect(() => {
        (server as any).validateRegistrationParams({ status: 'active' });
      }).toThrow('sessionName is required');
    });

    it('should throw for invalid status', () => {
      expect(() => {
        (server as any).validateRegistrationParams({
          sessionName: 'test',
          status: 'invalid',
        });
      }).toThrow('Invalid status');
    });

    it('should accept valid params', () => {
      expect(() => {
        (server as any).validateRegistrationParams({
          sessionName: 'test',
          status: 'active',
        });
      }).not.toThrow();
    });
  });

  describe('buildStatusUpdates', () => {
    it('should use provided values', () => {
      const updates = (server as any).buildStatusUpdates(
        {
          sessionName: 'test',
          status: 'active',
          workingStatus: 'in_progress',
          currentTask: 'task-1',
        },
        null
      );

      expect(updates.agentStatus).toBe('active');
      expect(updates.workingStatus).toBe('in_progress');
      expect(updates.currentTask).toBe('task-1');
    });

    it('should use defaults when not provided', () => {
      const updates = (server as any).buildStatusUpdates(
        { sessionName: 'test', status: 'active' },
        null
      );

      expect(updates.workingStatus).toBe('idle');
    });
  });
});
```

---

## Rollback Plan

```bash
git checkout HEAD -- mcp-server/src/server.ts
```

---

## Dependencies

- Ticket 002 from Milestone 1 (Fix MCP Server Any Types) should be completed first

## Blocks

- None
