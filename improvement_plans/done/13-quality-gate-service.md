---
id: 13-quality-gate-service
title: Implement QualityGateService
phase: 3
priority: P1
status: open
estimatedHours: 10
dependencies: [12-quality-gate-design]
blocks: [14-complete-task-enhancement]
---

# Task: Implement QualityGateService

## Objective
Create the service that runs quality gates and returns results.

## Background
The QualityGateService executes shell commands to verify code quality before task completion.

## Deliverables

### 1. QualityGateService Class

**Location:** `backend/src/services/quality/quality-gate.service.ts`

```typescript
interface IQualityGateService {
  // Load configuration
  loadConfig(projectPath: string): Promise<GateConfig>;

  // Run gates
  runAllGates(projectPath: string, options?: RunOptions): Promise<GateRunResults>;
  runGate(gate: QualityGate, projectPath: string): Promise<GateResult>;

  // Check specific gates
  runTypecheck(projectPath: string): Promise<GateResult>;
  runTests(projectPath: string): Promise<GateResult>;
  runLint(projectPath: string): Promise<GateResult>;
  runBuild(projectPath: string): Promise<GateResult>;

  // Configuration
  getDefaultConfig(): GateConfig;
  hasProjectConfig(projectPath: string): Promise<boolean>;
}

interface RunOptions {
  gateNames?: string[];      // Run only specific gates
  skipOptional?: boolean;    // Skip optional gates
  parallel?: boolean;        // Override parallel setting
}
```

### 2. Implementation

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';

const execAsync = promisify(exec);

class QualityGateService implements IQualityGateService {
  private static instance: QualityGateService;
  private logger: Logger;

  private constructor() {
    this.logger = LoggerService.getInstance().createLogger('QualityGateService');
  }

  static getInstance(): QualityGateService {
    if (!QualityGateService.instance) {
      QualityGateService.instance = new QualityGateService();
    }
    return QualityGateService.instance;
  }

  async loadConfig(projectPath: string): Promise<GateConfig> {
    const configPath = path.join(projectPath, '.crewly', 'config', 'quality-gates.yaml');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(content);
      return this.validateConfig(config);
    } catch (error) {
      this.logger.debug('No project gate config, using defaults', { projectPath });
      return this.getDefaultConfig();
    }
  }

  async runAllGates(projectPath: string, options?: RunOptions): Promise<GateRunResults> {
    const startTime = Date.now();
    const config = await this.loadConfig(projectPath);
    const results: GateResult[] = [];

    // Collect gates to run
    let gatesToRun: QualityGate[] = [
      ...config.required,
      ...(options?.skipOptional ? [] : config.optional),
      ...config.custom,
    ];

    // Filter if specific gates requested
    if (options?.gateNames?.length) {
      gatesToRun = gatesToRun.filter(g => options.gateNames!.includes(g.name));
    }

    // Get current branch for runOn filtering
    const currentBranch = await this.getCurrentBranch(projectPath);
    gatesToRun = gatesToRun.filter(g => this.shouldRunGate(g, currentBranch));

    this.logger.info('Running quality gates', {
      projectPath,
      gates: gatesToRun.map(g => g.name),
    });

    // Run gates
    const runInParallel = options?.parallel ?? config.settings.runInParallel;

    if (runInParallel) {
      const gatePromises = gatesToRun.map(gate => this.runGate(gate, projectPath));
      const gateResults = await Promise.all(gatePromises);
      results.push(...gateResults);
    } else {
      for (const gate of gatesToRun) {
        const result = await this.runGate(gate, projectPath);
        results.push(result);

        // Stop on first failure if configured
        if (config.settings.stopOnFirstFailure && !result.passed && gate.required) {
          this.logger.warn('Stopping on first failure', { gate: gate.name });
          break;
        }
      }
    }

    // Calculate summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const requiredFailed = results.filter(r => !r.passed && r.required).length;

    return {
      allRequiredPassed: requiredFailed === 0,
      allPassed: failed === 0,
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        skipped: gatesToRun.length - results.length,
      },
      duration: Date.now() - startTime,
    };
  }

  async runGate(gate: QualityGate, projectPath: string): Promise<GateResult> {
    const startTime = Date.now();
    this.logger.debug('Running gate', { name: gate.name, command: gate.command });

    try {
      // Build environment
      const env = {
        ...process.env,
        ...gate.env,
        CI: 'true',  // Always set CI for consistent behavior
      };

      // Execute command with timeout
      const { stdout, stderr } = await execAsync(gate.command, {
        cwd: projectPath,
        timeout: gate.timeout,
        env,
        maxBuffer: 10 * 1024 * 1024,  // 10MB buffer
      });

      const output = this.truncateOutput(stdout + stderr);

      this.logger.info('Gate passed', { name: gate.name, duration: Date.now() - startTime });

      return {
        name: gate.name,
        passed: true,
        required: gate.required,
        duration: Date.now() - startTime,
        output,
        exitCode: 0,
      };
    } catch (error: any) {
      const output = this.truncateOutput(
        (error.stdout || '') + (error.stderr || '') + (error.message || '')
      );

      // Check if it's a timeout
      const isTimeout = error.killed || error.code === 'ETIMEDOUT';

      this.logger.warn('Gate failed', {
        name: gate.name,
        exitCode: error.code,
        isTimeout,
        duration: Date.now() - startTime,
      });

      return {
        name: gate.name,
        passed: gate.allowFailure || false,
        required: gate.required,
        duration: Date.now() - startTime,
        output,
        exitCode: typeof error.code === 'number' ? error.code : 1,
        error: isTimeout ? 'Command timed out' : error.message,
      };
    }
  }

  // Convenience methods
  async runTypecheck(projectPath: string): Promise<GateResult> {
    return this.runGate({
      name: 'typecheck',
      command: 'npm run typecheck',
      timeout: 60000,
      required: true,
    }, projectPath);
  }

  async runTests(projectPath: string): Promise<GateResult> {
    return this.runGate({
      name: 'tests',
      command: 'npm test -- --passWithNoTests',
      timeout: 120000,
      required: true,
    }, projectPath);
  }

  async runLint(projectPath: string): Promise<GateResult> {
    return this.runGate({
      name: 'lint',
      command: 'npm run lint',
      timeout: 30000,
      required: false,
    }, projectPath);
  }

  async runBuild(projectPath: string): Promise<GateResult> {
    return this.runGate({
      name: 'build',
      command: 'npm run build',
      timeout: 180000,
      required: true,
    }, projectPath);
  }

  private shouldRunGate(gate: QualityGate, currentBranch: string): boolean {
    if (!gate.runOn || gate.runOn.length === 0) {
      return true;
    }

    return gate.runOn.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        return regex.test(currentBranch);
      }
      return pattern === currentBranch;
    });
  }

  private async getCurrentBranch(projectPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
      });
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  private truncateOutput(output: string, maxLength: number = 5000): string {
    if (output.length <= maxLength) {
      return output;
    }

    const half = Math.floor(maxLength / 2);
    return output.substring(0, half) +
      '\n\n... [output truncated] ...\n\n' +
      output.substring(output.length - half);
  }

  private validateConfig(config: any): GateConfig {
    // Add validation logic
    return {
      settings: {
        runInParallel: config.settings?.runInParallel ?? false,
        stopOnFirstFailure: config.settings?.stopOnFirstFailure ?? false,
        timeout: config.settings?.timeout ?? 300000,
      },
      required: (config.required || []).map((g: any) => ({ ...g, required: true })),
      optional: (config.optional || []).map((g: any) => ({ ...g, required: false })),
      custom: config.custom || [],
    };
  }

  getDefaultConfig(): GateConfig {
    return DEFAULT_GATES;
  }

  async hasProjectConfig(projectPath: string): Promise<boolean> {
    const configPath = path.join(projectPath, '.crewly', 'config', 'quality-gates.yaml');
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 3. File Structure

```
backend/src/services/quality/
├── quality-gate.service.ts
├── quality-gate.service.test.ts
├── quality-gate.types.ts
└── index.ts

config/quality-gates/
├── default-gates.ts
└── README.md
```

## Implementation Steps

1. **Create service class**
   - Singleton pattern
   - Logger integration

2. **Implement config loading**
   - Read YAML config
   - Fall back to defaults
   - Validate config

3. **Implement gate runner**
   - Execute shell commands
   - Handle timeouts
   - Capture output

4. **Implement runAllGates**
   - Sequential/parallel execution
   - Stop on first failure option
   - Branch filtering

5. **Add convenience methods**
   - runTypecheck, runTests, etc.

6. **Add output handling**
   - Truncate long output
   - Combine stdout/stderr

7. **Write tests**
   - Mock exec for unit tests
   - Integration tests with real commands

## Acceptance Criteria

- [ ] Service implemented with all methods
- [ ] Config loading works (project or default)
- [ ] Gates execute correctly
- [ ] Timeouts handled
- [ ] Output truncated appropriately
- [ ] Branch filtering works
- [ ] Tests passing

## Notes

- Set CI=true for consistent behavior
- Large output buffer for verbose tests
- Log gate execution for debugging
- Consider caching results within same run
