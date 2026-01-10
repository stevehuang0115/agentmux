# Ticket 003: Fix Skipped Tests

## Priority: High
## Estimated Effort: Medium
## Component: Backend, Integration Tests

---

## Problem Description

12 tests are currently skipped across the codebase. Skipped tests indicate incomplete functionality, technical debt, or tests that need maintenance. Each skipped test should either be fixed and enabled, or removed with documented justification.

---

## Files Affected

| File | Skipped Tests | Reason |
|------|---------------|--------|
| `backend/src/services/ai/context-loader.service.test.ts` | 8 tests | FS mock incomplete |
| `backend/src/services/workflow/message-scheduler.service.test.ts` | 3 tests | Async queue timing |
| `tests/integration/orchestrator-workflow.test.ts` | 1 test | WebSocket complexity |

---

## Detailed Instructions

### Part A: Fix context-loader.service.test.ts (8 skipped tests)

**File:** `backend/src/services/ai/context-loader.service.test.ts`

The tests are skipped because file system mocking is incomplete. Fix by implementing proper mocks.

**Step 1:** Identify the skipped tests (Lines 32, 74, 91, 118, 149, 180, 226, 377)

**Step 2:** Implement proper fs mocks

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ContextLoaderService } from './context-loader.service.js';

// Mock fs/promises
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('ContextLoaderService', () => {
  let service: ContextLoaderService;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContextLoaderService();

    // Setup default mock behaviors
    mockFs.access.mockResolvedValue(undefined); // File exists by default
    mockFs.readFile.mockResolvedValue('mock file content');
    mockFs.readdir.mockResolvedValue([]);
    mockFs.stat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 100,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Previously skipped test - Line 32
  it('should load project context from specs directory', async () => {
    const mockSpecContent = '# Project Specification\n\nThis is a test spec.';

    mockFs.readdir.mockResolvedValueOnce(['spec.md', 'requirements.md'] as any);
    mockFs.readFile
      .mockResolvedValueOnce(mockSpecContent)
      .mockResolvedValueOnce('# Requirements');

    const context = await service.loadProjectContext(testProjectPath);

    expect(context).toBeDefined();
    expect(mockFs.readdir).toHaveBeenCalled();
  });

  // Previously skipped test - Line 74
  it('should handle missing specs directory gracefully', async () => {
    mockFs.access.mockRejectedValueOnce(new Error('ENOENT'));

    const context = await service.loadProjectContext(testProjectPath);

    // Should return empty or default context, not throw
    expect(context).toBeDefined();
  });

  // Previously skipped test - Line 91
  it('should filter files by extension', async () => {
    mockFs.readdir.mockResolvedValueOnce([
      'spec.md',
      'notes.txt',
      'image.png',
      'config.yaml',
    ] as any);

    const context = await service.loadProjectContext(testProjectPath, {
      extensions: ['.md', '.yaml'],
    });

    // Should only read .md and .yaml files
    expect(mockFs.readFile).toHaveBeenCalledTimes(2);
  });

  // Previously skipped test - Line 118
  it('should respect maxFileSize option', async () => {
    mockFs.stat.mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1000000, // 1MB - larger than typical limit
    } as any);

    const context = await service.loadProjectContext(testProjectPath, {
      maxFileSize: 100000, // 100KB limit
    });

    // Large files should be skipped
    expect(mockFs.readFile).not.toHaveBeenCalled();
  });

  // Previously skipped test - Line 149
  it('should handle read errors for individual files', async () => {
    mockFs.readdir.mockResolvedValueOnce(['good.md', 'bad.md'] as any);
    mockFs.readFile
      .mockResolvedValueOnce('Good content')
      .mockRejectedValueOnce(new Error('Permission denied'));

    // Should not throw, should continue with other files
    const context = await service.loadProjectContext(testProjectPath);

    expect(context).toBeDefined();
  });

  // Previously skipped test - Line 180
  it('should recursively load from subdirectories', async () => {
    mockFs.readdir
      .mockResolvedValueOnce([
        { name: 'spec.md', isDirectory: () => false },
        { name: 'subdir', isDirectory: () => true },
      ] as any)
      .mockResolvedValueOnce([
        { name: 'nested.md', isDirectory: () => false },
      ] as any);

    mockFs.readFile
      .mockResolvedValueOnce('Root spec')
      .mockResolvedValueOnce('Nested spec');

    const context = await service.loadProjectContext(testProjectPath, {
      recursive: true,
    });

    expect(mockFs.readdir).toHaveBeenCalledTimes(2);
  });

  // Previously skipped test - Line 226
  it('should merge context from multiple sources', async () => {
    const specsDir = path.join(testProjectPath, '.agentmux', 'specs');
    const memoryDir = path.join(testProjectPath, '.agentmux', 'memory');

    mockFs.access.mockResolvedValue(undefined);
    mockFs.readdir
      .mockResolvedValueOnce(['spec.md'] as any)
      .mockResolvedValueOnce(['context.md'] as any);
    mockFs.readFile
      .mockResolvedValueOnce('Spec content')
      .mockResolvedValueOnce('Memory content');

    const context = await service.loadProjectContext(testProjectPath, {
      includeSources: ['specs', 'memory'],
    });

    expect(context).toContain('Spec content');
    expect(context).toContain('Memory content');
  });

  // Previously skipped test - Line 377
  it('should cache loaded context when caching is enabled', async () => {
    mockFs.readdir.mockResolvedValue(['spec.md'] as any);
    mockFs.readFile.mockResolvedValue('Cached content');

    // First load
    await service.loadProjectContext(testProjectPath, { useCache: true });

    // Second load should use cache
    await service.loadProjectContext(testProjectPath, { useCache: true });

    // readFile should only be called once due to caching
    expect(mockFs.readFile).toHaveBeenCalledTimes(1);
  });
});
```

**Step 3:** Remove `.skip` from all tests and verify they pass.

---

### Part B: Fix message-scheduler.service.test.ts (3 skipped tests)

**File:** `backend/src/services/workflow/message-scheduler.service.test.ts`

The tests are skipped due to async queue timing issues. Fix using controlled async testing.

**Step 1:** Implement timing-controlled tests

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageSchedulerService } from './message-scheduler.service.js';

describe('MessageSchedulerService - Queue Processing', () => {
  let service: MessageSchedulerService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new MessageSchedulerService();
  });

  afterEach(() => {
    vi.useRealTimers();
    service.cleanup();
  });

  // Previously skipped test - Line 507
  it('should process multiple auto-assignment messages sequentially', async () => {
    const processedOrder: string[] = [];

    const mockProcessor = vi.fn().mockImplementation(async (msg: any) => {
      processedOrder.push(msg.id);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    service.setMessageProcessor(mockProcessor);

    // Queue multiple messages
    service.queueMessage({ id: 'msg-1', type: 'auto-assign' });
    service.queueMessage({ id: 'msg-2', type: 'auto-assign' });
    service.queueMessage({ id: 'msg-3', type: 'auto-assign' });

    // Process first message
    await vi.advanceTimersByTimeAsync(100);
    expect(processedOrder).toContain('msg-1');

    // Process remaining messages
    await vi.advanceTimersByTimeAsync(200);
    expect(processedOrder).toEqual(['msg-1', 'msg-2', 'msg-3']);
  });

  // Previously skipped test - Line 557
  it('should add delay between sequential executions', async () => {
    const executionTimes: number[] = [];
    const startTime = Date.now();

    vi.setSystemTime(startTime);

    const mockProcessor = vi.fn().mockImplementation(async () => {
      executionTimes.push(Date.now() - startTime);
    });

    service.setMessageProcessor(mockProcessor);
    service.setDelayBetweenMessages(500); // 500ms delay

    service.queueMessage({ id: 'msg-1' });
    service.queueMessage({ id: 'msg-2' });

    // Process first immediately
    await vi.advanceTimersByTimeAsync(0);

    // Advance past delay
    await vi.advanceTimersByTimeAsync(500);

    // Second message should be processed after delay
    expect(executionTimes[1] - executionTimes[0]).toBeGreaterThanOrEqual(500);
  });

  // Previously skipped test - Line 586
  it('should log queue processing information', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const mockProcessor = vi.fn().mockResolvedValue(undefined);
    service.setMessageProcessor(mockProcessor);
    service.enableLogging(true);

    service.queueMessage({ id: 'msg-1' });

    await vi.advanceTimersByTimeAsync(0);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Processing message')
    );

    logSpy.mockRestore();
  });
});
```

**Step 2:** Remove `.skip` and verify tests pass.

---

### Part C: Fix orchestrator-workflow.test.ts (1 skipped test)

**File:** `tests/integration/orchestrator-workflow.test.ts`

The WebSocket test is skipped due to connection complexity. Fix with proper WS mocking.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

describe('Orchestrator Workflow - WebSocket', () => {
  let ioServer: Server;
  let clientSocket: any;
  const TEST_PORT = 3099;

  beforeEach((done) => {
    ioServer = new Server(TEST_PORT);
    clientSocket = Client(`http://localhost:${TEST_PORT}`);
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    ioServer.close();
    clientSocket.close();
  });

  // Previously skipped test - Line 532
  it('should establish WebSocket connection with capabilities', (done) => {
    const expectedCapabilities = ['terminal-streaming', 'file-watching', 'agent-status'];

    ioServer.on('connection', (socket) => {
      socket.emit('capabilities', expectedCapabilities);
    });

    clientSocket.on('capabilities', (caps: string[]) => {
      expect(caps).toEqual(expectedCapabilities);
      expect(caps).toContain('terminal-streaming');
      expect(caps).toContain('file-watching');
      expect(caps).toContain('agent-status');
      done();
    });
  });
});
```

---

## Evaluation Criteria

### Automated Verification

```bash
# 1. Search for remaining skipped tests
grep -rn "\.skip\|it\.skip\|describe\.skip\|test\.skip" --include="*.test.ts" backend/ tests/
# Expected: No matches (or documented exceptions)

# 2. Run the previously skipped tests
npm test -- --grep "context-loader"
npm test -- --grep "message-scheduler"
npm test -- --grep "WebSocket connection"
# Expected: All tests pass

# 3. Full test suite
npm test
# Expected: All tests pass
```

### Manual Verification Checklist

- [ ] All 8 context-loader tests enabled and passing
- [ ] All 3 message-scheduler tests enabled and passing
- [ ] WebSocket integration test enabled and passing
- [ ] No new test failures introduced
- [ ] Test coverage maintained or improved

---

## Decision: Skip vs Fix vs Remove

For each skipped test, apply this decision tree:

1. **Is the feature implemented?**
   - Yes → Fix the test
   - No → Remove test or add TODO issue

2. **Can the test be reliably fixed?**
   - Yes → Fix it
   - No → Document why and create follow-up issue

3. **Is the test valuable?**
   - Yes → Fix or rewrite
   - No → Remove with documentation

---

## Rollback Plan

```bash
git checkout HEAD -- backend/src/services/ai/context-loader.service.test.ts
git checkout HEAD -- backend/src/services/workflow/message-scheduler.service.test.ts
git checkout HEAD -- tests/integration/orchestrator-workflow.test.ts
```

---

## Dependencies

- Ticket 001 from Milestone 1 (Fix Mixed Testing Frameworks) if tests use Vitest

## Blocks

- None
