/**
 * Quality Gate Service
 *
 * Executes quality gates (typecheck, tests, build, lint) to verify
 * code quality before task completion.
 *
 * @module services/quality/quality-gate.service
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parse as parseYAML } from 'yaml';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
  QualityGate,
  GateConfig,
  GateResult,
  GateRunResults,
  GateSummary,
  MAX_GATE_OUTPUT_LENGTH,
} from '../../types/quality-gate.types.js';
import { DEFAULT_GATES } from '../../../../config/quality-gates/default-gates.js';

const execAsync = promisify(exec);

/**
 * Options for running gates
 */
export interface RunOptions {
  /** Run only specific gates by name */
  gateNames?: string[];
  /** Skip optional gates */
  skipOptional?: boolean;
  /** Override parallel execution setting */
  parallel?: boolean;
  /** Override overall timeout */
  timeout?: number;
}

/**
 * Interface for the QualityGateService
 */
export interface IQualityGateService {
  /**
   * Load gate configuration from project or use defaults
   *
   * @param projectPath - Path to project directory
   * @returns Gate configuration
   */
  loadConfig(projectPath: string): Promise<GateConfig>;

  /**
   * Run all gates according to configuration
   *
   * @param projectPath - Path to project directory
   * @param options - Run options
   * @returns Complete run results
   */
  runAllGates(projectPath: string, options?: RunOptions): Promise<GateRunResults>;

  /**
   * Run a single gate
   *
   * @param gate - Gate definition
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  runGate(gate: QualityGate, projectPath: string): Promise<GateResult>;

  /**
   * Run typecheck gate
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  runTypecheck(projectPath: string): Promise<GateResult>;

  /**
   * Run tests gate
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  runTests(projectPath: string): Promise<GateResult>;

  /**
   * Run lint gate
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  runLint(projectPath: string): Promise<GateResult>;

  /**
   * Run build gate
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  runBuild(projectPath: string): Promise<GateResult>;

  /**
   * Get the default gate configuration
   *
   * @returns Default gate config
   */
  getDefaultConfig(): GateConfig;

  /**
   * Check if project has custom gate configuration
   *
   * @param projectPath - Path to project directory
   * @returns True if custom config exists
   */
  hasProjectConfig(projectPath: string): Promise<boolean>;
}

/**
 * Service for running quality gates on code changes
 *
 * @example
 * ```typescript
 * const service = QualityGateService.getInstance();
 * const results = await service.runAllGates('/path/to/project');
 * if (results.allRequiredPassed) {
 *   console.log('All gates passed!');
 * }
 * ```
 */
export class QualityGateService implements IQualityGateService {
  private static instance: QualityGateService | null = null;

  private readonly logger: ComponentLogger;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('QualityGateService');
  }

  /**
   * Gets the singleton instance
   *
   * @returns The QualityGateService instance
   */
  public static getInstance(): QualityGateService {
    if (!QualityGateService.instance) {
      QualityGateService.instance = new QualityGateService();
    }
    return QualityGateService.instance;
  }

  /**
   * Clears the singleton instance (for testing)
   */
  public static clearInstance(): void {
    QualityGateService.instance = null;
  }

  /**
   * Load gate configuration from project or use defaults
   *
   * @param projectPath - Path to project directory
   * @returns Gate configuration
   */
  public async loadConfig(projectPath: string): Promise<GateConfig> {
    const configPath = path.join(projectPath, '.agentmux', 'config', 'quality-gates.yaml');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = parseYAML(content);
      this.logger.debug('Loaded project gate config', { projectPath });
      return this.validateConfig(config);
    } catch {
      this.logger.debug('No project gate config, using defaults', { projectPath });
      return this.getDefaultConfig();
    }
  }

  /**
   * Run all gates according to configuration
   *
   * @param projectPath - Path to project directory
   * @param options - Run options
   * @returns Complete run results
   */
  public async runAllGates(projectPath: string, options?: RunOptions): Promise<GateRunResults> {
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
      gatesToRun = gatesToRun.filter((g) => options.gateNames!.includes(g.name));
    }

    // Get current branch for runOn filtering
    const currentBranch = await this.getCurrentBranch(projectPath);
    const filteredGates = gatesToRun.filter((g) => this.shouldRunGate(g, currentBranch));

    // Track skipped gates
    const skippedGates = gatesToRun.filter((g) => !this.shouldRunGate(g, currentBranch));
    for (const gate of skippedGates) {
      results.push({
        name: gate.name,
        passed: true,
        required: gate.required,
        duration: 0,
        output: '',
        exitCode: 0,
        skipped: true,
        skipReason: `Branch '${currentBranch}' does not match runOn patterns`,
      });
    }

    this.logger.info('Running quality gates', {
      projectPath,
      gates: filteredGates.map((g) => g.name),
      skipped: skippedGates.map((g) => g.name),
    });

    // Run gates
    const runInParallel = options?.parallel ?? config.settings.runInParallel;

    if (runInParallel) {
      const gatePromises = filteredGates.map((gate) => this.runGate(gate, projectPath));
      const gateResults = await Promise.all(gatePromises);
      results.push(...gateResults);
    } else {
      for (const gate of filteredGates) {
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
    const summary = this.calculateSummary(results);
    const requiredFailed = results.filter((r) => !r.passed && r.required && !r.skipped).length;

    const runResults: GateRunResults = {
      allRequiredPassed: requiredFailed === 0,
      allPassed: summary.failed === 0,
      results,
      summary,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('Quality gates completed', {
      allRequiredPassed: runResults.allRequiredPassed,
      allPassed: runResults.allPassed,
      duration: runResults.duration,
      summary,
    });

    return runResults;
  }

  /**
   * Run a single gate
   *
   * @param gate - Gate definition
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  public async runGate(gate: QualityGate, projectPath: string): Promise<GateResult> {
    const startTime = Date.now();
    this.logger.debug('Running gate', { name: gate.name, command: gate.command });

    try {
      // Build environment
      const env = {
        ...process.env,
        ...gate.env,
        CI: 'true', // Always set CI for consistent behavior
      };

      // Execute command with timeout
      const { stdout, stderr } = await execAsync(gate.command, {
        cwd: projectPath,
        timeout: gate.timeout,
        env,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const output = this.truncateOutput(stdout + stderr);
      const duration = Date.now() - startTime;

      this.logger.info('Gate passed', { name: gate.name, duration });

      return {
        name: gate.name,
        passed: true,
        required: gate.required,
        duration,
        output,
        exitCode: 0,
      };
    } catch (error: unknown) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
        killed?: boolean;
        code?: number | string;
      };

      const output = this.truncateOutput(
        (execError.stdout || '') + (execError.stderr || '') + (execError.message || '')
      );

      // Check if it's a timeout
      const isTimeout = execError.killed || execError.code === 'ETIMEDOUT';
      const duration = Date.now() - startTime;

      this.logger.warn('Gate failed', {
        name: gate.name,
        exitCode: execError.code,
        isTimeout,
        duration,
      });

      return {
        name: gate.name,
        passed: gate.allowFailure || false,
        required: gate.required,
        duration,
        output,
        exitCode: typeof execError.code === 'number' ? execError.code : 1,
        error: isTimeout ? 'Command timed out' : (execError.message || 'Unknown error'),
      };
    }
  }

  /**
   * Run typecheck gate with default settings
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  public async runTypecheck(projectPath: string): Promise<GateResult> {
    const config = this.getDefaultConfig();
    const gate = config.required.find((g) => g.name === 'typecheck');
    if (!gate) {
      throw new Error('Typecheck gate not found in default config');
    }
    return this.runGate(gate, projectPath);
  }

  /**
   * Run tests gate with default settings
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  public async runTests(projectPath: string): Promise<GateResult> {
    const config = this.getDefaultConfig();
    const gate = config.required.find((g) => g.name === 'tests');
    if (!gate) {
      throw new Error('Tests gate not found in default config');
    }
    return this.runGate(gate, projectPath);
  }

  /**
   * Run lint gate with default settings
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  public async runLint(projectPath: string): Promise<GateResult> {
    const config = this.getDefaultConfig();
    const gate = config.optional.find((g) => g.name === 'lint');
    if (!gate) {
      throw new Error('Lint gate not found in default config');
    }
    return this.runGate(gate, projectPath);
  }

  /**
   * Run build gate with default settings
   *
   * @param projectPath - Path to project directory
   * @returns Gate result
   */
  public async runBuild(projectPath: string): Promise<GateResult> {
    const config = this.getDefaultConfig();
    const gate = config.required.find((g) => g.name === 'build');
    if (!gate) {
      throw new Error('Build gate not found in default config');
    }
    return this.runGate(gate, projectPath);
  }

  /**
   * Get the default gate configuration
   *
   * @returns Default gate config
   */
  public getDefaultConfig(): GateConfig {
    return DEFAULT_GATES;
  }

  /**
   * Check if project has custom gate configuration
   *
   * @param projectPath - Path to project directory
   * @returns True if custom config exists
   */
  public async hasProjectConfig(projectPath: string): Promise<boolean> {
    const configPath = path.join(projectPath, '.agentmux', 'config', 'quality-gates.yaml');
    try {
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a gate should run based on branch patterns
   *
   * @param gate - Gate definition
   * @param currentBranch - Current git branch name
   * @returns Whether the gate should run
   */
  public shouldRunGate(gate: QualityGate, currentBranch: string): boolean {
    if (!gate.runOn || gate.runOn.length === 0) {
      return true;
    }

    return gate.runOn.some((pattern) => {
      if (pattern.includes('*')) {
        // Convert glob pattern to regex
        const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexPattern);
        return regex.test(currentBranch);
      }
      return pattern === currentBranch;
    });
  }

  /**
   * Get the current git branch
   *
   * @param projectPath - Path to project directory
   * @returns Current branch name or 'unknown'
   */
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

  /**
   * Truncate output to maximum length
   *
   * @param output - Output to truncate
   * @param maxLength - Maximum length (default: MAX_GATE_OUTPUT_LENGTH)
   * @returns Truncated output
   */
  private truncateOutput(output: string, maxLength: number = MAX_GATE_OUTPUT_LENGTH): string {
    if (output.length <= maxLength) {
      return output;
    }

    const half = Math.floor(maxLength / 2);
    return (
      output.substring(0, half) +
      '\n\n... [output truncated] ...\n\n' +
      output.substring(output.length - half)
    );
  }

  /**
   * Validate and normalize gate configuration
   *
   * @param config - Raw configuration from YAML
   * @returns Normalized gate configuration
   */
  private validateConfig(config: Record<string, unknown>): GateConfig {
    const settings = config.settings as Record<string, unknown> | undefined;
    const required = config.required as QualityGate[] | undefined;
    const optional = config.optional as QualityGate[] | undefined;
    const custom = config.custom as QualityGate[] | undefined;

    return {
      settings: {
        runInParallel: (settings?.runInParallel as boolean) ?? false,
        stopOnFirstFailure: (settings?.stopOnFirstFailure as boolean) ?? false,
        timeout: (settings?.timeout as number) ?? 300000,
      },
      required: (required || []).map((g) => ({ ...g, required: true })),
      optional: (optional || []).map((g) => ({ ...g, required: false })),
      custom: custom || [],
    };
  }

  /**
   * Calculate summary statistics from results
   *
   * @param results - Array of gate results
   * @returns Summary statistics
   */
  private calculateSummary(results: GateResult[]): GateSummary {
    const passed = results.filter((r) => r.passed && !r.skipped).length;
    const failed = results.filter((r) => !r.passed && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;

    return {
      total: results.length,
      passed,
      failed,
      skipped,
    };
  }
}
