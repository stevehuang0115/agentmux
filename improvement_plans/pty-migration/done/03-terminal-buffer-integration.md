# Task: Integrate @xterm/headless for State Detection

## Priority: High
## Estimate: 2 days
## Dependencies: 02-pty-session-implementation

## Description
Integrate @xterm/headless virtual terminal for parsing ANSI sequences and detecting agent state.

## Files to Create
- `backend/src/services/session/pty/pty-terminal-buffer.ts`
- `backend/src/services/session/pty/pty-terminal-buffer.test.ts`

## Implementation Details

### Terminal Buffer Manager
```typescript
import { Terminal } from '@xterm/headless';

export class PtyTerminalBuffer {
  private terminal: Terminal;
  private outputHistory: Buffer[] = [];
  private readonly MAX_HISTORY_SIZE = 10 * 1024 * 1024;  // 10MB

  constructor(cols = 80, rows = 24) {
    this.terminal = new Terminal({
      cols,
      rows,
      allowProposedApi: true,
    });
  }

  write(data: string): void {
    this.terminal.write(data);
    this.appendHistory(data);
  }

  getContent(maxLines = 100): string {
    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];
    for (let i = Math.max(0, buffer.length - maxLines); i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join('\n');
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  private appendHistory(data: string): void {
    const buf = Buffer.from(data, 'utf8');
    this.outputHistory.push(buf);

    // Trim if exceeds max size
    let total = this.outputHistory.reduce((sum, b) => sum + b.length, 0);
    while (total > this.MAX_HISTORY_SIZE && this.outputHistory.length > 0) {
      const removed = this.outputHistory.shift();
      if (removed) total -= removed.length;
    }
  }

  getHistory(): Buffer[] {
    return this.outputHistory;
  }

  getHistoryAsString(): string {
    return Buffer.concat(this.outputHistory).toString('utf8');
  }

  clear(): void {
    this.outputHistory = [];
    this.terminal.reset();
  }
}
```

### Integration with PtySession
```typescript
// In PtySessionBackend, update createSession:
async createSession(name: string, options: SessionOptions): Promise<ISession> {
  const session = new PtySession(name, options.cwd, options);
  const terminalBuffer = new PtyTerminalBuffer(options.cols, options.rows);

  session.onData(data => {
    terminalBuffer.write(data);
  });

  this.sessions.set(name, session);
  this.terminalBuffers.set(name, terminalBuffer);

  return session;
}
```

## Acceptance Criteria
- [ ] Terminal buffer correctly parses ANSI sequences
- [ ] Can extract last N lines of content
- [ ] Output history bounded to 10MB
- [ ] Resize updates terminal dimensions
- [ ] History can be retrieved as string for replay
