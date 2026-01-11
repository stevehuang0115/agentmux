# Task: Comprehensive Testing and Validation

## Priority: High
## Estimate: 3-4 days
## Dependencies: All previous tasks

## Description
Write comprehensive tests and validate the entire PTY migration works correctly.

## Test Categories

### 1. Unit Tests

#### Session Backend Interface Tests
```typescript
// backend/src/services/session/session-backend.interface.test.ts
describe('SessionOptions', () => {
  it('should require cwd and command', () => {
    const options: SessionOptions = {
      cwd: '/tmp',
      command: 'echo',
    };
    expect(options.cwd).toBe('/tmp');
    expect(options.command).toBe('echo');
  });

  it('should allow optional fields', () => {
    const options: SessionOptions = {
      cwd: '/tmp',
      command: 'echo',
      args: ['hello'],
      env: { FOO: 'bar' },
      cols: 120,
      rows: 40,
    };
    expect(options.args).toEqual(['hello']);
  });
});
```

#### PtySession Tests
```typescript
// backend/src/services/session/pty/pty-session.test.ts
describe('PtySession', () => {
  it('should spawn a process', async () => {
    const session = new PtySession('test', '/tmp', {
      cwd: '/tmp',
      command: 'echo',
      args: ['hello'],
    });

    const output: string[] = [];
    session.onData(data => output.push(data));

    await new Promise(r => setTimeout(r, 500));
    expect(output.join('')).toContain('hello');
  });

  it('should write input to process', async () => {
    const session = new PtySession('test', '/tmp', {
      cwd: '/tmp',
      command: 'cat',
    });

    const output: string[] = [];
    session.onData(data => output.push(data));

    session.write('test input\r');
    await new Promise(r => setTimeout(r, 500));

    expect(output.join('')).toContain('test input');
    session.kill();
  });

  it('should emit exit event', async () => {
    const session = new PtySession('test', '/tmp', {
      cwd: '/tmp',
      command: 'echo',
      args: ['done'],
    });

    const exitCode = await new Promise<number>(resolve => {
      session.onExit(code => resolve(code));
    });

    expect(exitCode).toBe(0);
  });

  it('should handle resize', () => {
    const session = new PtySession('test', '/tmp', {
      cwd: '/tmp',
      command: 'cat',
    });

    expect(() => session.resize(120, 40)).not.toThrow();
    session.kill();
  });
});
```

#### PtySessionBackend Tests
```typescript
// backend/src/services/session/pty/pty-session-backend.test.ts
describe('PtySessionBackend', () => {
  let backend: PtySessionBackend;

  beforeEach(() => {
    backend = new PtySessionBackend();
  });

  afterEach(async () => {
    await backend.destroy();
  });

  it('should create session', async () => {
    const session = await backend.createSession('test', {
      cwd: '/tmp',
      command: 'cat',
    });

    expect(session.name).toBe('test');
    expect(backend.sessionExists('test')).toBe(true);
  });

  it('should prevent duplicate sessions', async () => {
    await backend.createSession('test', { cwd: '/tmp', command: 'cat' });

    await expect(
      backend.createSession('test', { cwd: '/tmp', command: 'cat' })
    ).rejects.toThrow('already exists');
  });

  it('should list sessions', async () => {
    await backend.createSession('s1', { cwd: '/tmp', command: 'cat' });
    await backend.createSession('s2', { cwd: '/tmp', command: 'cat' });

    expect(backend.listSessions()).toEqual(['s1', 's2']);
  });

  it('should kill session', async () => {
    await backend.createSession('test', { cwd: '/tmp', command: 'cat' });
    await backend.killSession('test');

    expect(backend.sessionExists('test')).toBe(false);
  });

  it('should capture output', async () => {
    const session = await backend.createSession('test', {
      cwd: '/tmp',
      command: 'echo',
      args: ['hello world'],
    });

    await new Promise(r => setTimeout(r, 500));
    const output = backend.captureOutput('test', 10);

    expect(output).toContain('hello world');
  });
});
```

#### Terminal Buffer Tests
```typescript
// backend/src/services/session/pty/pty-terminal-buffer.test.ts
describe('PtyTerminalBuffer', () => {
  it('should store written data', () => {
    const buffer = new PtyTerminalBuffer();
    buffer.write('Hello\r\nWorld');

    const content = buffer.getContent(10);
    expect(content).toContain('Hello');
    expect(content).toContain('World');
  });

  it('should limit history size', () => {
    const buffer = new PtyTerminalBuffer();

    // Write more than MAX_HISTORY_SIZE
    const largeData = 'x'.repeat(1024 * 1024); // 1MB
    for (let i = 0; i < 15; i++) {
      buffer.write(largeData);
    }

    const history = buffer.getHistory();
    const totalSize = history.reduce((sum, b) => sum + b.length, 0);
    expect(totalSize).toBeLessThanOrEqual(10 * 1024 * 1024);
  });

  it('should handle resize', () => {
    const buffer = new PtyTerminalBuffer(80, 24);
    expect(() => buffer.resize(120, 40)).not.toThrow();
  });
});
```

#### State Persistence Tests
```typescript
// backend/src/services/session/session-state-persistence.test.ts
describe('SessionStatePersistence', () => {
  let persistence: SessionStatePersistence;
  let mockBackend: jest.Mocked<ISessionBackend>;

  beforeEach(() => {
    persistence = new SessionStatePersistence();
    mockBackend = {
      listSessions: jest.fn().mockReturnValue(['session1']),
      createSession: jest.fn().mockResolvedValue({} as ISession),
      // ... other mocks
    } as any;
  });

  it('should save session state', async () => {
    persistence.registerSession('session1', {
      cwd: '/tmp',
      command: 'claude',
    }, 'claude');

    await persistence.saveState(mockBackend);
    // Verify file was written (mock fs)
  });

  it('should restore sessions with --resume for Claude', async () => {
    // Mock file content
    await persistence.restoreState(mockBackend);

    expect(mockBackend.createSession).toHaveBeenCalledWith(
      'session1',
      expect.objectContaining({ args: ['--resume'] })
    );
  });
});
```

### 2. Integration Tests

```typescript
// backend/src/tests/integration/pty-backend.integration.test.ts
describe('PTY Backend Integration', () => {
  let backend: ISessionBackend;

  beforeAll(() => {
    backend = getSessionBackend();
  });

  afterAll(async () => {
    await backend.destroy();
  });

  it('should handle full session lifecycle', async () => {
    // Create
    const session = await backend.createSession('integration-test', {
      cwd: process.cwd(),
      command: 'cat',
    });

    expect(session).toBeDefined();

    // Write and read
    const output: string[] = [];
    session.onData(data => output.push(data));

    session.write('test message\r');
    await new Promise(r => setTimeout(r, 500));

    expect(output.join('')).toContain('test message');

    // Kill
    await backend.killSession('integration-test');
    expect(backend.sessionExists('integration-test')).toBe(false);
  });

  it('should handle multiple concurrent sessions', async () => {
    const sessions = await Promise.all([
      backend.createSession('multi-1', { cwd: '/tmp', command: 'cat' }),
      backend.createSession('multi-2', { cwd: '/tmp', command: 'cat' }),
      backend.createSession('multi-3', { cwd: '/tmp', command: 'cat' }),
    ]);

    expect(backend.listSessions()).toHaveLength(3);

    await Promise.all([
      backend.killSession('multi-1'),
      backend.killSession('multi-2'),
      backend.killSession('multi-3'),
    ]);

    expect(backend.listSessions()).toHaveLength(0);
  });
});
```

### 3. Input Reliability Test (Critical)

```typescript
// backend/src/tests/reliability/input-reliability.test.ts
describe('Input Reliability', () => {
  it('should not drop keystrokes under load', async () => {
    const backend = getSessionBackend();
    const session = await backend.createSession('reliability-test', {
      cwd: '/tmp',
      command: 'cat',
    });

    const received: string[] = [];
    session.onData(data => received.push(data));

    // Send 100 rapid messages
    const messageCount = 100;
    for (let i = 0; i < messageCount; i++) {
      session.write(`msg${i}\r`);
    }

    // Wait for all output
    await new Promise(r => setTimeout(r, 5000));

    const output = received.join('');

    // Verify ALL messages were received
    let missing = 0;
    for (let i = 0; i < messageCount; i++) {
      if (!output.includes(`msg${i}`)) {
        missing++;
        console.log(`Missing message: msg${i}`);
      }
    }

    await backend.killSession('reliability-test');

    expect(missing).toBe(0);
  }, 30000);

  it('should handle burst of rapid input', async () => {
    const backend = getSessionBackend();
    const session = await backend.createSession('burst-test', {
      cwd: '/tmp',
      command: 'cat',
    });

    const received: string[] = [];
    session.onData(data => received.push(data));

    // Burst: send many characters without delay
    const burstData = 'abcdefghijklmnopqrstuvwxyz'.repeat(10);
    session.write(burstData + '\r');

    await new Promise(r => setTimeout(r, 2000));

    const output = received.join('');
    expect(output).toContain(burstData);

    await backend.killSession('burst-test');
  });
});
```

### 4. MCP Tools Integration Test

```typescript
// mcp-server/src/tests/tools.integration.test.ts
describe('MCP Tools with PTY Backend', () => {
  it('should send_message via PTY', async () => {
    // Create a session via backend API
    const createRes = await fetch('http://localhost:8787/api/terminal/mcp-test', {
      method: 'POST',
      body: JSON.stringify({ cwd: '/tmp', command: 'cat' }),
    });
    expect(createRes.ok).toBe(true);

    // Send message
    const sendRes = await fetch('http://localhost:8787/api/terminal/mcp-test/write', {
      method: 'POST',
      body: JSON.stringify({ data: 'hello from MCP\r' }),
    });
    expect(sendRes.ok).toBe(true);

    // Get output
    await new Promise(r => setTimeout(r, 500));
    const outputRes = await fetch('http://localhost:8787/api/terminal/mcp-test/output');
    const { output } = await outputRes.json();

    expect(output).toContain('hello from MCP');

    // Cleanup
    await fetch('http://localhost:8787/api/terminal/mcp-test', { method: 'DELETE' });
  });
});
```

### 5. End-to-End Test

```typescript
// backend/src/tests/e2e/full-workflow.e2e.test.ts
describe('Full Workflow E2E', () => {
  it('should complete orchestrator workflow', async () => {
    // 1. Start orchestrator
    const backend = getSessionBackend();
    const orchestrator = await backend.createSession('e2e-orchestrator', {
      cwd: process.cwd(),
      command: 'claude',
      args: [],
      env: {
        TMUX_SESSION_NAME: 'e2e-orchestrator',
        AGENTMUX_ROLE: 'orchestrator',
      },
    });

    // 2. Wait for Claude to start
    await new Promise(r => setTimeout(r, 5000));

    // 3. Verify session is active
    expect(backend.sessionExists('e2e-orchestrator')).toBe(true);

    // 4. Check output contains Claude branding
    const output = backend.captureOutput('e2e-orchestrator', 50);
    expect(output.length).toBeGreaterThan(0);

    // 5. Cleanup
    await backend.killSession('e2e-orchestrator');
  }, 60000);
});
```

## Test Commands

```json
// package.json scripts
{
  "scripts": {
    "test:unit": "jest --testPathPattern='.test.ts$'",
    "test:integration": "jest --testPathPattern='.integration.test.ts$'",
    "test:e2e": "jest --testPathPattern='.e2e.test.ts$'",
    "test:reliability": "jest --testPathPattern='reliability'",
    "test:pty": "jest --testPathPattern='session/pty'",
    "test:all": "jest"
  }
}
```

## Acceptance Criteria
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Input reliability test passes (0 dropped messages in 100)
- [ ] MCP tools integration test passes
- [ ] E2E workflow completes successfully
- [ ] Test coverage > 80% for new code
