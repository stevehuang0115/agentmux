# Task: Implement PTY Session Backend

## Priority: High
## Estimate: 3-4 days
## Dependencies: 01-session-backend-interface

## Description
Implement the PTY session backend using node-pty, managing sessions in-memory with a Map.

## Files to Create
- `backend/src/services/session/pty/pty-session.ts`
- `backend/src/services/session/pty/pty-session-backend.ts`
- `backend/src/services/session/pty/pty-session.test.ts`
- `backend/src/services/session/pty/pty-session-backend.test.ts`

## Implementation Details

### PtySession Class
```typescript
import * as pty from 'node-pty';

export class PtySession implements ISession {
  private ptyProcess: pty.IPty;
  private dataListeners: ((data: string) => void)[] = [];
  private exitListeners: ((code: number) => void)[] = [];

  constructor(
    public readonly name: string,
    public readonly cwd: string,
    options: SessionOptions
  ) {
    this.ptyProcess = pty.spawn(options.command, options.args || [], {
      name: 'xterm-256color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
    });

    this.ptyProcess.onData(data => {
      this.dataListeners.forEach(cb => cb(data));
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.exitListeners.forEach(cb => cb(exitCode));
    });
  }

  get pid() { return this.ptyProcess.pid; }

  write(data: string): void {
    this.ptyProcess.write(data);
  }

  onData(callback: (data: string) => void): () => void {
    this.dataListeners.push(callback);
    return () => {
      const index = this.dataListeners.indexOf(callback);
      if (index > -1) this.dataListeners.splice(index, 1);
    };
  }

  onExit(callback: (code: number) => void): () => void {
    this.exitListeners.push(callback);
    return () => {
      const index = this.exitListeners.indexOf(callback);
      if (index > -1) this.exitListeners.splice(index, 1);
    };
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
  }

  kill(): void {
    this.ptyProcess.kill();
  }
}
```

### PtySessionBackend Class
```typescript
export class PtySessionBackend implements ISessionBackend {
  private sessions: Map<string, PtySession> = new Map();
  private terminals: Map<string, Terminal> = new Map();  // @xterm/headless

  async createSession(name: string, options: SessionOptions): Promise<ISession> {
    if (this.sessions.has(name)) {
      throw new Error(`Session ${name} already exists`);
    }

    const session = new PtySession(name, options.cwd, options);
    const terminal = new Terminal({ cols: options.cols, rows: options.rows });

    session.onData(data => terminal.write(data));

    this.sessions.set(name, session);
    this.terminals.set(name, terminal);

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
      this.terminals.delete(name);
    }
  }

  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  sessionExists(name: string): boolean {
    return this.sessions.has(name);
  }

  captureOutput(name: string, lines = 100): string {
    const terminal = this.terminals.get(name);
    if (!terminal) return '';
    // Extract lines from terminal buffer
    return this.getTerminalContent(terminal, lines);
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

## Acceptance Criteria
- [ ] Can spawn Claude Code process
- [ ] Can write input and receive output
- [ ] Proper cleanup on session kill
- [ ] Memory-bounded output buffer (max 10MB)
- [ ] All unit tests pass
