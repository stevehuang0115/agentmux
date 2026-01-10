# Ticket 003: Fix `any` Types in Frontend Services

## Priority: Critical
## Estimated Effort: Small
## Component: Frontend

---

## Problem Description

Several frontend service files use `any` types, bypassing TypeScript's type safety. This is particularly problematic in API services where response types should be well-defined to catch errors at compile time.

---

## Files Affected

| File | Lines with Issues |
|------|-------------------|
| `frontend/src/services/api.service.ts` | 34, 139-157 |
| `frontend/src/services/in-progress-tasks.service.ts` | 112 |

---

## Detailed Instructions

### Step 1: Update api.service.ts - Task Methods

**File:** `frontend/src/services/api.service.ts`

First, ensure proper Task type is imported or defined:

**Add/Update Types (at top of file or in types/index.ts):**

```typescript
// In frontend/src/types/index.ts or at top of api.service.ts

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  labels?: string[];
  filePath?: string;
  projectId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TasksResponse {
  success: boolean;
  data?: Task[];
  error?: string;
}

export interface TaskResponse {
  success: boolean;
  data?: Task;
  error?: string;
}
```

**Before (Lines ~139-157):**
```typescript
async getProjectTasks(projectId: string): Promise<any[]> {
  const response = await axios.get(`${API_BASE}/projects/${projectId}/tasks`);
  return response.data.data || [];
}

async createTask(projectId: string, task: any): Promise<any> {
  const response = await axios.post(`${API_BASE}/projects/${projectId}/tasks`, task);
  return response.data.data;
}

async updateTask(projectId: string, taskId: string, updates: any): Promise<any> {
  const response = await axios.patch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, updates);
  return response.data.data;
}

async deleteTask(projectId: string, taskId: string): Promise<void> {
  await axios.delete(`${API_BASE}/projects/${projectId}/tasks/${taskId}`);
}
```

**After:**
```typescript
import { Task, TasksResponse, TaskResponse } from '../types';

async getProjectTasks(projectId: string): Promise<Task[]> {
  const response = await axios.get<TasksResponse>(`${API_BASE}/projects/${projectId}/tasks`);
  return response.data.data || [];
}

async createTask(projectId: string, task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const response = await axios.post<TaskResponse>(`${API_BASE}/projects/${projectId}/tasks`, task);
  if (!response.data.data) {
    throw new Error('Failed to create task');
  }
  return response.data.data;
}

async updateTask(projectId: string, taskId: string, updates: Partial<Task>): Promise<Task> {
  const response = await axios.patch<TaskResponse>(
    `${API_BASE}/projects/${projectId}/tasks/${taskId}`,
    updates
  );
  if (!response.data.data) {
    throw new Error('Failed to update task');
  }
  return response.data.data;
}

async deleteTask(projectId: string, taskId: string): Promise<void> {
  await axios.delete(`${API_BASE}/projects/${projectId}/tasks/${taskId}`);
}
```

### Step 2: Fix Generic ApiResponse Usage

**Before (Line ~34):**
```typescript
const response = await axios.get<ApiResponse<any>>(`${API_BASE}/some-endpoint`);
```

**After:**
```typescript
// Define specific response type for each endpoint
interface SpecificDataType {
  // ... fields
}

const response = await axios.get<ApiResponse<SpecificDataType>>(`${API_BASE}/some-endpoint`);
```

### Step 3: Update in-progress-tasks.service.ts

**File:** `frontend/src/services/in-progress-tasks.service.ts`

**Before (Line ~112):**
```typescript
const member = team.members.find((m: any) => m.sessionName === sessionName);
```

**After:**
```typescript
import { TeamMember } from '../types';

interface TeamWithMembers {
  id: string;
  name: string;
  members: TeamMember[];
}

const member = team.members.find((m: TeamMember) => m.sessionName === sessionName);
```

### Step 4: Ensure TeamMember Type Exists

**File:** `frontend/src/types/index.ts`

Ensure this interface exists:

```typescript
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
```

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. TypeScript compilation should pass
cd frontend
npm run build
# Expected: No type errors

# 2. Check for remaining 'any' types in services
grep -n ": any" src/services/*.ts
# Expected: No output or minimal justified uses

# 3. Run frontend tests
npm test
# Expected: All tests pass

# 4. Type check without building
npx tsc --noEmit
# Expected: No errors
```

### Manual Verification Checklist

- [ ] All API methods have specific return types
- [ ] All callback parameters are typed
- [ ] Task interface is properly defined in types/index.ts
- [ ] TeamMember interface is properly defined
- [ ] No `any` in method parameters or returns
- [ ] Frontend builds without type errors

---

## Unit Tests to Add

**File:** `frontend/src/services/api.service.test.ts`

Add these tests to verify type safety:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { apiService } from './api.service';
import type { Task } from '../types';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('apiService - Task Methods Type Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjectTasks', () => {
    it('should return typed Task array', async () => {
      const mockTasks: Task[] = [
        {
          id: 'task-1',
          title: 'Test Task',
          status: 'open',
          priority: 'medium',
        },
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: mockTasks },
      });

      const result = await apiService.getProjectTasks('project-1');

      expect(result).toEqual(mockTasks);
      // TypeScript should infer result as Task[]
      expect(result[0].id).toBe('task-1');
      expect(result[0].title).toBe('Test Task');
    });

    it('should return empty array when data is undefined', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: undefined },
      });

      const result = await apiService.getProjectTasks('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('createTask', () => {
    it('should accept typed task input and return Task', async () => {
      const newTask = {
        title: 'New Task',
        description: 'Task description',
        status: 'open' as const,
        priority: 'high' as const,
      };

      const createdTask: Task = {
        id: 'task-new',
        ...newTask,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: createdTask },
      });

      const result = await apiService.createTask('project-1', newTask);

      expect(result.id).toBe('task-new');
      expect(result.title).toBe('New Task');
    });

    it('should throw error when response has no data', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: false, data: undefined },
      });

      await expect(
        apiService.createTask('project-1', { title: 'Test', status: 'open' })
      ).rejects.toThrow('Failed to create task');
    });
  });

  describe('updateTask', () => {
    it('should accept partial Task updates', async () => {
      const updates: Partial<Task> = {
        status: 'in_progress',
        assignedTo: 'developer-1',
      };

      const updatedTask: Task = {
        id: 'task-1',
        title: 'Existing Task',
        status: 'in_progress',
        assignedTo: 'developer-1',
      };

      mockedAxios.patch.mockResolvedValueOnce({
        data: { success: true, data: updatedTask },
      });

      const result = await apiService.updateTask('project-1', 'task-1', updates);

      expect(result.status).toBe('in_progress');
      expect(result.assignedTo).toBe('developer-1');
    });
  });
});
```

**File:** `frontend/src/services/in-progress-tasks.service.test.ts`

Add/update tests:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inProgressTasksService } from './in-progress-tasks.service';
import type { TeamMember } from '../types';

describe('inProgressTasksService - Type Safety', () => {
  describe('getTaskAssignedMemberDetails', () => {
    it('should properly type team member lookups', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        name: 'Developer',
        sessionName: 'dev-session',
        role: 'developer',
        agentStatus: 'active',
        workingStatus: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock the API call that returns teams
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ id: 'team-1', name: 'Team', members: [mockMember] }],
        }),
      } as Response);

      // The method should work with properly typed data
      // Add actual test based on the service implementation
    });
  });
});
```

---

## Rollback Plan

```bash
git checkout -- frontend/src/services/api.service.ts
git checkout -- frontend/src/services/in-progress-tasks.service.ts
git checkout -- frontend/src/types/index.ts
```

---

## Dependencies

- Ticket 001 (Fix Mixed Testing Frameworks) should be completed first

## Blocks

- None
