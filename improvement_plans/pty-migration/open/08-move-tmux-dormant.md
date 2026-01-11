# Task: Move tmux Code to Dormant State

## Priority: Low
## Estimate: 1 day
## Dependencies: 04-refactor-services, 06-mcp-tools-update

## Description
Reorganize tmux code into a dormant folder structure for future re-enablement. The code should be preserved but not actively used.

## Current File Locations
```
backend/src/services/agent/
├── tmux.service.ts           # Main tmux facade (884 lines)
├── tmux-command.service.ts   # Low-level commands (1,080 lines)
└── ...

config/runtime_scripts/
├── tmux_robosend.sh
├── initialize_tmux.sh
└── initialize_claude.sh
```

## Target File Locations
```
backend/src/services/session/tmux/
├── tmux-session.ts           # ISession adapter
├── tmux-session-backend.ts   # ISessionBackend implementation
├── tmux-command.service.ts   # Moved from agent/
└── tmux-session-backend.test.ts

config/runtime_scripts/        # Keep unchanged (dormant)
├── tmux_robosend.sh
├── initialize_tmux.sh
└── initialize_claude.sh
```

## Implementation

### TmuxSession Adapter
```typescript
// backend/src/services/session/tmux/tmux-session.ts
import { ISession } from '../session-backend.interface.js';
import { TmuxCommandService } from './tmux-command.service.js';

export class TmuxSession implements ISession {
  private dataCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((code: number) => void)[] = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastOutput = '';

  constructor(
    public readonly name: string,
    public readonly cwd: string,
    private readonly tmuxCommand: TmuxCommandService
  ) {
    // Start polling for output changes (tmux doesn't have events)
    this.startPolling();
  }

  get pid(): number {
    // tmux doesn't expose PID directly, return -1
    return -1;
  }

  onData(callback: (data: string) => void): () => void {
    this.dataCallbacks.push(callback);
    return () => {
      const index = this.dataCallbacks.indexOf(callback);
      if (index > -1) this.dataCallbacks.splice(index, 1);
    };
  }

  onExit(callback: (code: number) => void): () => void {
    this.exitCallbacks.push(callback);
    return () => {
      const index = this.exitCallbacks.indexOf(callback);
      if (index > -1) this.exitCallbacks.splice(index, 1);
    };
  }

  write(data: string): void {
    this.tmuxCommand.sendMessage(this.name, data);
  }

  resize(cols: number, rows: number): void {
    // tmux resize would require different approach
    // Not implemented for dormant backend
  }

  kill(): void {
    this.stopPolling();
    this.tmuxCommand.killSession(this.name);
    this.exitCallbacks.forEach(cb => cb(0));
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        const output = await this.tmuxCommand.capturePane(this.name, 50);
        if (output !== this.lastOutput) {
          const newContent = this.getNewContent(output);
          if (newContent) {
            this.dataCallbacks.forEach(cb => cb(newContent));
          }
          this.lastOutput = output;
        }
      } catch {
        // Session might be gone
        this.stopPolling();
        this.exitCallbacks.forEach(cb => cb(1));
      }
    }, 1000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private getNewContent(current: string): string {
    // Simple diff - find new content
    if (current.startsWith(this.lastOutput)) {
      return current.slice(this.lastOutput.length);
    }
    return current;
  }
}
```

### TmuxSessionBackend
```typescript
// backend/src/services/session/tmux/tmux-session-backend.ts
import { ISession, ISessionBackend, SessionOptions } from '../session-backend.interface.js';
import { TmuxSession } from './tmux-session.js';
import { TmuxCommandService } from './tmux-command.service.js';

export class TmuxSessionBackend implements ISessionBackend {
  private sessions: Map<string, TmuxSession> = new Map();
  private tmuxCommand = TmuxCommandService.getInstance();

  async createSession(name: string, options: SessionOptions): Promise<ISession> {
    if (this.sessions.has(name)) {
      throw new Error(`Session ${name} already exists`);
    }

    await this.tmuxCommand.createSession(name, options.cwd);

    // Start the command in the session
    const command = `${options.command} ${(options.args || []).join(' ')}`;
    await this.tmuxCommand.sendMessage(name, command);
    await this.tmuxCommand.sendKeys(name, 'Enter');

    const session = new TmuxSession(name, options.cwd, this.tmuxCommand);
    this.sessions.set(name, session);

    return session;
  }

  getSession(name: string): ISession | undefined {
    return this.sessions.get(name);
  }

  async killSession(name: string): Promise<void> {
    const session = this.sessions.get(name);
    if (session) {
      session.kill();
      this.sessions.delete(name);
    }
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  sessionExists(name: string): boolean {
    return this.sessions.has(name) || this.tmuxCommand.sessionExists(name);
  }

  captureOutput(name: string, lines = 100): string {
    return this.tmuxCommand.capturePane(name, lines);
  }

  getTerminalBuffer(name: string): string {
    return this.captureOutput(name, 100);
  }

  async destroy(): Promise<void> {
    for (const name of this.sessions.keys()) {
      await this.killSession(name);
    }
  }
}
```

### Update Factory
```typescript
// backend/src/services/session/session-backend.factory.ts

import { ISessionBackend } from './session-backend.interface.js';
import { PtySessionBackend } from './pty/pty-session-backend.js';
// Uncomment to re-enable tmux:
// import { TmuxSessionBackend } from './tmux/tmux-session-backend.js';

export type SessionBackendType = 'pty' | 'tmux';

export function createSessionBackend(
  type: SessionBackendType = 'pty'
): ISessionBackend {
  switch (type) {
    case 'pty':
      return new PtySessionBackend();

    case 'tmux':
      // To re-enable tmux support:
      // 1. Uncomment the import above
      // 2. Uncomment the line below
      // return new TmuxSessionBackend();
      throw new Error(
        'tmux backend is currently disabled. ' +
        'To re-enable, see session-backend.factory.ts'
      );

    default:
      throw new Error(`Unknown session backend: ${type}`);
  }
}
```

### Update Tests
```typescript
// Mark tmux tests as skipped
describe.skip('TmuxSessionBackend', () => {
  // ... existing tests
});
```

## Files to Keep Unchanged
- `config/runtime_scripts/tmux_robosend.sh` - Keep for future use
- `config/runtime_scripts/initialize_tmux.sh` - Keep for future use
- `config/runtime_scripts/initialize_claude.sh` - Keep for future use

## Acceptance Criteria
- [ ] All tmux code moved to session/tmux/ folder
- [ ] TmuxSessionBackend implements ISessionBackend
- [ ] TmuxSession implements ISession (with polling adapter)
- [ ] Factory can instantiate tmux backend (commented out)
- [ ] tmux tests marked as skipped
- [ ] Runtime scripts preserved but unused
- [ ] Documentation on how to re-enable tmux
