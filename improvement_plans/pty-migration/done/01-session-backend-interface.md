# Task: Define Session Backend Interface

## Priority: High
## Estimate: 1-2 days
## Dependencies: None

## Description
Create the abstraction layer interfaces that both PTY and tmux backends will implement.

## Files to Create
- `backend/src/services/session/session-backend.interface.ts`
- `backend/src/services/session/session-backend.factory.ts`
- `backend/src/services/session/index.ts`

## Implementation Details

### ISession Interface
```typescript
export interface ISession {
  readonly name: string;
  readonly pid: number;
  readonly cwd: string;

  onData(callback: (data: string) => void): () => void;
  onExit(callback: (code: number) => void): () => void;

  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}
```

### ISessionBackend Interface
```typescript
export interface ISessionBackend {
  createSession(name: string, options: SessionOptions): Promise<ISession>;
  getSession(name: string): ISession | undefined;
  killSession(name: string): Promise<void>;
  listSessions(): string[];
  sessionExists(name: string): boolean;
  captureOutput(name: string, lines?: number): string;
  getTerminalBuffer(name: string): string;
  destroy(): Promise<void>;
}
```

### SessionOptions Interface
```typescript
export interface SessionOptions {
  cwd: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}
```

### Factory Pattern
```typescript
export type SessionBackendType = 'pty' | 'tmux';

export function createSessionBackend(type?: SessionBackendType): ISessionBackend;
export function getSessionBackend(): ISessionBackend;  // Singleton
```

## Acceptance Criteria
- [ ] Interfaces defined with full TypeScript types
- [ ] Factory exports singleton getter
- [ ] JSDoc comments on all public methods
- [ ] Unit tests for factory
