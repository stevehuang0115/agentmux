# Task: Update Frontend Types Index Exports

## Overview

Update the frontend types index.ts to export the new type modules (role, settings, chat, skill). Currently, these type files exist but are not exported from the barrel file.

## Priority

**Medium** - Required for clean imports across the frontend

## Dependencies

- `39-frontend-skill-types.md` - Skill types must be created first

## Gap Identified

The following type files exist but are not exported from `frontend/src/types/index.ts`:
- `frontend/src/types/role.types.ts`
- `frontend/src/types/settings.types.ts`
- `frontend/src/types/chat.types.ts`
- `frontend/src/types/skill.types.ts` (after task 39)

Current `index.ts` only exports:
- Core types (Team, Project, etc.)
- Factory types

## Files to Modify

### Update `frontend/src/types/index.ts`

Add the following exports at the end of the file:

```typescript
// Frontend types (mirrors backend types exactly)
export interface TeamMember {
  // ... existing code ...
}

// ... other existing exports ...

// Re-export factory types
export * from './factory.types';

// Re-export role types
export * from './role.types';

// Re-export settings types
export * from './settings.types';

// Re-export chat types
export * from './chat.types';

// Re-export skill types
export * from './skill.types';
```

## Full Updated File

```typescript
// Frontend types (mirrors backend types exactly)
export interface TeamMember {
  id: string;
  name: string;
  sessionName: string;
  role: string;
  avatar?: string;
  systemPrompt: string;
  agentStatus: 'inactive' | 'activating' | 'active';
  workingStatus: 'idle' | 'in_progress';
  runtimeType: 'claude-code' | 'gemini-cli' | 'codex-cli';
  currentTickets?: string[];
  readyAt?: string;
  capabilities?: string[];
  lastActivityCheck?: string;
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

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  teams: Record<string, string[]>;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels?: string[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledCheck {
  id: string;
  targetSession: string;
  message: string;
  scheduledFor: string;
  intervalMinutes?: number;
  isRecurring: boolean;
  createdAt: string;
}

export interface TerminalOutput {
  sessionName: string;
  content: string;
  timestamp: string;
  type: 'stdout' | 'stderr';
}

export interface WebSocketMessage {
  type: 'terminal_output' | 'file_change' | 'team_status' | 'schedule_update';
  payload: any;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Re-export factory types
export * from './factory.types';

// Re-export role types
export * from './role.types';

// Re-export settings types
export * from './settings.types';

// Re-export chat types
export * from './chat.types';

// Re-export skill types
export * from './skill.types';
```

## Verification

After making changes:

```bash
# Check TypeScript compilation
cd frontend && npm run typecheck

# Verify exports work
node -e "import('./src/types/index.ts').then(m => console.log(Object.keys(m).slice(0, 20)))"
```

## Acceptance Criteria

- [ ] `frontend/src/types/index.ts` exports role types
- [ ] `frontend/src/types/index.ts` exports settings types
- [ ] `frontend/src/types/index.ts` exports chat types
- [ ] `frontend/src/types/index.ts` exports skill types
- [ ] TypeScript compilation passes
- [ ] All types importable from `@/types` or `../types`

## Testing Requirements

- Verify imports work from components
- Check no naming conflicts between type modules
- Ensure tree-shaking works properly

## Estimated Effort

2 minutes

## Notes

- Use `export *` for re-exports to keep barrel file clean
- Ensure no circular dependencies
- Follow existing export patterns in the file
