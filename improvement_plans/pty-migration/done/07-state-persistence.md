# Task: Implement Session State Persistence

## Priority: Medium
## Estimate: 1 day
## Dependencies: 02-pty-session-implementation

## Description
Save session state on shutdown and restore on startup so agents can resume. This compensates for PTY sessions not persisting like tmux sessions do.

## Files to Create
- `backend/src/services/session/session-state-persistence.ts`
- `backend/src/services/session/session-state-persistence.test.ts`

## Implementation Details

### State File Location
`~/.agentmux/session-state.json`

### State Schema
```typescript
interface PersistedSessionInfo {
  name: string;
  cwd: string;
  command: string;
  args: string[];
  runtimeType: 'claude' | 'gemini' | 'codex';
  role?: string;
  teamId?: string;
  env?: Record<string, string>;
}

interface PersistedState {
  version: 1;
  savedAt: string;
  sessions: PersistedSessionInfo[];
}
```

### SessionStatePersistence Class
```typescript
import { homedir } from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ISessionBackend, SessionOptions } from './session-backend.interface.js';
import { LoggerService } from '../core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('SessionPersistence');

export class SessionStatePersistence {
  private readonly filePath: string;
  private sessionMetadata: Map<string, PersistedSessionInfo> = new Map();

  constructor() {
    this.filePath = path.join(homedir(), '.agentmux', 'session-state.json');
  }

  /**
   * Register session metadata for later persistence
   */
  registerSession(
    name: string,
    options: SessionOptions,
    runtimeType: 'claude' | 'gemini' | 'codex',
    role?: string,
    teamId?: string
  ): void {
    this.sessionMetadata.set(name, {
      name,
      cwd: options.cwd,
      command: options.command,
      args: options.args || [],
      runtimeType,
      role,
      teamId,
      env: options.env,
    });
  }

  /**
   * Remove session from persistence tracking
   */
  unregisterSession(name: string): void {
    this.sessionMetadata.delete(name);
  }

  /**
   * Save current session state to disk
   */
  async saveState(backend: ISessionBackend): Promise<void> {
    const activeSessions = backend.listSessions();
    const sessionsToSave: PersistedSessionInfo[] = [];

    for (const name of activeSessions) {
      const metadata = this.sessionMetadata.get(name);
      if (metadata) {
        sessionsToSave.push(metadata);
      }
    }

    const state: PersistedState = {
      version: 1,
      savedAt: new Date().toISOString(),
      sessions: sessionsToSave,
    };

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(state, null, 2));
      logger.info(`Saved ${sessionsToSave.length} sessions to state file`);
    } catch (error) {
      logger.error('Failed to save session state', { error });
    }
  }

  /**
   * Restore sessions from saved state
   */
  async restoreState(backend: ISessionBackend): Promise<number> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const state: PersistedState = JSON.parse(content);

      if (state.version !== 1) {
        logger.warn(`Unknown state version: ${state.version}`);
        return 0;
      }

      let restored = 0;
      for (const sessionInfo of state.sessions) {
        try {
          // For Claude, always use --resume to restore conversation
          const args = sessionInfo.runtimeType === 'claude'
            ? ['--resume']
            : sessionInfo.args;

          await backend.createSession(sessionInfo.name, {
            cwd: sessionInfo.cwd,
            command: sessionInfo.command,
            args,
            env: sessionInfo.env,
          });

          // Re-register metadata
          this.sessionMetadata.set(sessionInfo.name, sessionInfo);
          restored++;
          logger.info(`Restored session: ${sessionInfo.name}`);
        } catch (error) {
          logger.error(`Failed to restore session ${sessionInfo.name}`, { error });
        }
      }

      logger.info(`Restored ${restored}/${state.sessions.length} sessions`);
      return restored;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No saved session state found');
      } else {
        logger.error('Failed to restore session state', { error });
      }
      return 0;
    }
  }

  /**
   * Clear saved state file
   */
  async clearState(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
      logger.info('Cleared session state file');
    } catch {
      // File might not exist, that's ok
    }
  }
}

// Singleton instance
export const sessionStatePersistence = new SessionStatePersistence();
```

### Integration with Backend Startup/Shutdown
```typescript
// In backend/src/index.ts or startup file

import { getSessionBackend } from './services/session/index.js';
import { sessionStatePersistence } from './services/session/session-state-persistence.js';

// On startup
async function startup() {
  const backend = getSessionBackend();

  // Restore previous sessions
  const restored = await sessionStatePersistence.restoreState(backend);
  logger.info(`Startup complete, restored ${restored} sessions`);
}

// On shutdown
async function shutdown() {
  logger.info('Shutting down, saving session state...');
  await sessionStatePersistence.saveState(getSessionBackend());
  await getSessionBackend().destroy();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Integration with Session Creation
```typescript
// When creating a session, register it for persistence
async function createAgentSession(
  name: string,
  options: SessionOptions,
  runtimeType: 'claude' | 'gemini' | 'codex',
  role?: string,
  teamId?: string
): Promise<ISession> {
  const session = await getSessionBackend().createSession(name, options);

  // Register for persistence
  sessionStatePersistence.registerSession(name, options, runtimeType, role, teamId);

  return session;
}

// When killing a session, unregister it
async function killAgentSession(name: string): Promise<void> {
  await getSessionBackend().killSession(name);
  sessionStatePersistence.unregisterSession(name);
}
```

## Acceptance Criteria
- [ ] State saved on SIGTERM/SIGINT
- [ ] State restored on startup
- [ ] Claude conversations resume correctly with --resume
- [ ] Handles missing/corrupted state file gracefully
- [ ] Session metadata tracked for persistence
- [ ] Logging for save/restore operations
