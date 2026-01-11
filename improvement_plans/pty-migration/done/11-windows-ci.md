# Task: Add Windows CI Pipeline

## Priority: Medium
## Estimate: 1-2 days
## Dependencies: 10-testing-validation

## Description
Add Windows runner to GitHub Actions to ensure cross-platform compatibility for the PTY backend.

## Files to Create/Modify
- `.github/workflows/ci.yml`

## Implementation

### GitHub Actions Workflow
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build-and-test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [20.x]

    runs-on: ${{ matrix.os }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run unit tests
        run: npm run test:unit

      - name: Run PTY-specific tests
        run: npm run test:pty

      # Integration tests only on Linux (needs full environment)
      - name: Run integration tests
        if: matrix.os == 'ubuntu-latest'
        run: npm run test:integration

  # Separate job for reliability tests (longer timeout)
  reliability-tests:
    runs-on: ubuntu-latest
    needs: build-and-test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Run reliability tests
        run: npm run test:reliability
        timeout-minutes: 10

  # Windows-specific PTY tests
  windows-pty-tests:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      # Windows needs build tools for node-pty
      - name: Setup Windows build tools
        run: |
          npm install -g windows-build-tools
        shell: powershell
        continue-on-error: true

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run PTY unit tests
        run: npm run test:pty

      - name: Run basic PTY spawn test
        run: |
          node -e "
            const pty = require('node-pty');
            const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
            const proc = pty.spawn(shell, [], {
              name: 'xterm-256color',
              cols: 80,
              rows: 24,
              cwd: process.cwd(),
            });
            proc.onData(data => console.log('Data:', data.slice(0, 50)));
            setTimeout(() => {
              proc.kill();
              console.log('PTY test passed!');
              process.exit(0);
            }, 2000);
          "
```

### Windows-Specific Considerations

#### Path Handling
```typescript
// Use path.join() everywhere
import * as path from 'path';

// Good
const sessionPath = path.join(homedir(), '.agentmux', 'session-state.json');

// Bad - won't work on Windows
const sessionPath = `${homedir()}/.agentmux/session-state.json`;
```

#### Shell Differences
```typescript
// In SessionOptions, default shell varies by platform
function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}
```

#### Environment Variables
```typescript
// Windows uses different env var syntax
const env = {
  ...process.env,
  // Use cross-platform env var names
  HOME: process.env.HOME || process.env.USERPROFILE,
};
```

#### node-pty on Windows
- node-pty uses conpty on Windows 10+
- Requires Windows SDK for compilation (prebuild usually available)
- Set `useConpty: true` for better Windows Terminal integration

```typescript
// Windows-specific pty options
const ptyOptions: pty.IPtyForkOptions = {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: options.cwd,
  env: options.env,
  // Windows-specific
  ...(process.platform === 'win32' && {
    useConpty: true,
  }),
};
```

### Test Script for Windows
```typescript
// scripts/test-windows-pty.ts
import * as pty from 'node-pty';

async function testWindowsPty() {
  console.log('Testing PTY on Windows...');
  console.log('Platform:', process.platform);

  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';

  const proc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    useConpty: process.platform === 'win32',
  });

  console.log('PTY spawned, PID:', proc.pid);

  let output = '';
  proc.onData(data => {
    output += data;
    process.stdout.write(data);
  });

  // Send a command
  if (process.platform === 'win32') {
    proc.write('echo Hello from Windows PTY\r\n');
  } else {
    proc.write('echo Hello from PTY\n');
  }

  await new Promise(r => setTimeout(r, 2000));

  proc.kill();

  if (output.includes('Hello')) {
    console.log('\n✅ PTY test PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ PTY test FAILED');
    process.exit(1);
  }
}

testWindowsPty().catch(console.error);
```

### Package.json Scripts
```json
{
  "scripts": {
    "test:windows-pty": "ts-node scripts/test-windows-pty.ts",
    "prebuild": "node scripts/check-platform.js"
  }
}
```

### Platform Check Script
```javascript
// scripts/check-platform.js
const os = require('os');

console.log('=== Platform Info ===');
console.log('Platform:', os.platform());
console.log('Arch:', os.arch());
console.log('Node:', process.version);
console.log('====================');

if (os.platform() === 'win32') {
  console.log('Windows detected - node-pty will use conpty');
  console.log('Ensure Windows SDK is installed for native compilation');
}
```

## Acceptance Criteria
- [ ] CI runs on Windows, macOS, and Linux
- [ ] All unit tests pass on all platforms
- [ ] PTY-specific tests pass on Windows
- [ ] node-pty installs successfully (prebuild or compile)
- [ ] Basic PTY spawn/write/read works on Windows
- [ ] Path handling uses platform-agnostic methods
- [ ] Documentation for Windows developers
