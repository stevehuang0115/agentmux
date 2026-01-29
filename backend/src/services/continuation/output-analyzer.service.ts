/**
 * Output Analyzer Service
 *
 * Analyzes terminal output to determine the agent's state
 * and whether continuation is needed.
 *
 * @module services/continuation/output-analyzer.service
 */

import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
  AgentStateAnalysis,
  AgentConclusion,
  ContinuationAction,
  TaskInfo,
  IOutputAnalyzer,
  OutputAnalysisContext,
} from '../../types/continuation.types.js';
import { CONTINUATION_CONSTANTS } from '../../constants.js';
import { COMPLETION_PATTERNS } from './patterns/completion-patterns.js';
import { ERROR_PATTERNS, ERROR_FIXES, ErrorType } from './patterns/error-patterns.js';
import { WAITING_PATTERNS } from './patterns/waiting-patterns.js';
import { IDLE_PATTERNS } from './patterns/idle-patterns.js';

/**
 * Signals indicating task completion
 */
export interface CompletionSignals {
  /** Agent called complete_task tool */
  taskMarkedComplete: boolean;
  /** Test output shows all tests pass */
  testsAllPassed: boolean;
  /** Build completed successfully */
  buildSucceeded: boolean;
  /** Git commit was made */
  commitMade: boolean;
  /** PR was created */
  prCreated: boolean;
  /** Agent explicitly said done/finished */
  explicitDone: boolean;
}

/**
 * Signals indicating errors
 */
export interface ErrorSignals {
  /** Whether any error was detected */
  hasError: boolean;
  /** Type of error if detected */
  errorType?: ErrorType;
  /** Extracted error message */
  errorMessage?: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Suggested fix for the error */
  suggestedFix?: string;
}

/**
 * Signals indicating agent is waiting
 */
export interface WaitingSignals {
  /** Agent is waiting for input */
  waitingForInput: boolean;
  /** Agent is waiting for approval */
  waitingForApproval: boolean;
  /** Agent is asking a question */
  askingQuestion: boolean;
  /** Agent is waiting for another agent */
  waitingForOtherAgent: boolean;
  /** Reason for waiting if detectable */
  waitingReason?: string;
}

/**
 * Combined signals for analysis
 */
interface AllSignals {
  completion: CompletionSignals;
  errors: ErrorSignals;
  waiting: WaitingSignals;
  isIdle: boolean;
  exitCode?: number;
  iterations: number;
  maxIterations: number;
}

/**
 * Parameters for output analysis
 */
export interface AnalyzeParams {
  /** Session name being analyzed */
  sessionName: string;
  /** Terminal output to analyze */
  output: string;
  /** Current assigned task */
  currentTask?: TaskInfo;
  /** PTY exit code if applicable */
  exitCode?: number;
  /** Previous analysis for context */
  previousAnalysis?: AgentStateAnalysis;
  /** Number of iterations so far */
  iterations?: number;
}

/**
 * Service that analyzes terminal output to determine agent state
 *
 * Features:
 * - Pattern matching for completion, error, waiting, and idle signals
 * - Confidence scoring based on signal strength
 * - Error extraction and fix suggestions
 * - Iteration tracking integration
 *
 * @example
 * ```typescript
 * const analyzer = OutputAnalyzer.getInstance();
 *
 * const analysis = await analyzer.analyze({
 *   sessionName: 'team-dev',
 *   output: terminalOutput,
 *   currentTask: { id: '1', title: 'Fix bug' },
 * });
 *
 * if (analysis.conclusion === 'TASK_COMPLETE') {
 *   // Move to next task
 * }
 * ```
 */
export class OutputAnalyzer implements IOutputAnalyzer {
  private static instance: OutputAnalyzer | null = null;

  private readonly logger: ComponentLogger;

  /**
   * Creates a new OutputAnalyzer
   */
  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('OutputAnalyzer');
  }

  /**
   * Gets the singleton instance
   *
   * @returns The OutputAnalyzer instance
   */
  public static getInstance(): OutputAnalyzer {
    if (!OutputAnalyzer.instance) {
      OutputAnalyzer.instance = new OutputAnalyzer();
    }
    return OutputAnalyzer.instance;
  }

  /**
   * Clears the singleton instance (for testing)
   */
  public static clearInstance(): void {
    OutputAnalyzer.instance = null;
  }

  /**
   * Analyze terminal output to determine agent state
   *
   * @param sessionName - Session to analyze
   * @param output - Terminal output to analyze
   * @param context - Additional context for analysis
   * @returns Analysis result with conclusion and recommendation
   */
  public async analyze(
    sessionName: string,
    output: string,
    context?: OutputAnalysisContext
  ): Promise<AgentStateAnalysis> {
    const params: AnalyzeParams = {
      sessionName,
      output,
      currentTask: context?.currentTask,
      iterations: context?.iterations,
    };

    return this.analyzeWithParams(params);
  }

  /**
   * Analyze terminal output with full parameters
   *
   * @param params - Analysis parameters
   * @returns Analysis result with conclusion and recommendation
   */
  public async analyzeWithParams(params: AnalyzeParams): Promise<AgentStateAnalysis> {
    const { output, currentTask, exitCode, iterations = 0 } = params;

    this.logger.debug('Analyzing output', {
      sessionName: params.sessionName,
      outputLength: output.length,
      hasTask: !!currentTask,
      exitCode,
    });

    // Detect all signals
    const completion = this.detectCompletionSignals(output);
    const errors = this.detectErrorPatterns(output);
    const waiting = this.detectWaitingSignals(output);
    const isIdle = this.detectIdleState(output);

    // Get iteration limits
    const maxIterations = CONTINUATION_CONSTANTS.ITERATIONS.DEFAULT_MAX;

    // Determine conclusion
    const analysis = this.determineConclusion({
      completion,
      errors,
      waiting,
      isIdle,
      exitCode,
      iterations,
      maxIterations,
    });

    // Add current task info if available
    if (currentTask) {
      analysis.currentTask = currentTask;
    }

    this.logger.info('Analysis complete', {
      sessionName: params.sessionName,
      conclusion: analysis.conclusion,
      confidence: analysis.confidence,
      recommendation: analysis.recommendation,
    });

    return analysis;
  }

  /**
   * Detect completion signals in output
   *
   * @param output - Terminal output to analyze
   * @returns Completion signals found
   */
  public detectCompletionSignals(output: string): CompletionSignals {
    return {
      taskMarkedComplete: this.matchAny(output, COMPLETION_PATTERNS.taskComplete),
      testsAllPassed: this.matchAny(output, COMPLETION_PATTERNS.testsPass),
      buildSucceeded: this.matchAny(output, COMPLETION_PATTERNS.buildSuccess),
      commitMade: this.matchAny(output, COMPLETION_PATTERNS.commitMade),
      prCreated: this.matchAny(output, COMPLETION_PATTERNS.prCreated),
      explicitDone: this.matchAny(output, COMPLETION_PATTERNS.explicitDone),
    };
  }

  /**
   * Detect error patterns in output
   *
   * @param output - Terminal output to analyze
   * @returns Error signals found
   */
  public detectErrorPatterns(output: string): ErrorSignals {
    // Check patterns in specific order: compile, test, permission, runtime
    // Permission must be checked before runtime since EACCES appears in both
    const orderedTypes: ErrorType[] = ['compile', 'test', 'permission', 'runtime'];

    for (const type of orderedTypes) {
      const patterns = ERROR_PATTERNS[type];

      if (this.matchAny(output, patterns)) {
        const errorMessage = this.extractErrorMessage(output, patterns);
        const stackTrace = this.extractStackTrace(output);
        const suggestedFix = this.getSuggestedFix(type, errorMessage);

        return {
          hasError: true,
          errorType: type,
          errorMessage,
          stackTrace,
          suggestedFix,
        };
      }
    }

    return { hasError: false };
  }

  /**
   * Detect waiting signals in output
   *
   * @param output - Terminal output to analyze
   * @returns Waiting signals found
   */
  public detectWaitingSignals(output: string): WaitingSignals {
    const waitingForInput = this.matchAny(output, WAITING_PATTERNS.input);
    const waitingForApproval = this.matchAny(output, WAITING_PATTERNS.approval);
    const askingQuestion = this.matchAny(output, WAITING_PATTERNS.question);
    const waitingForOtherAgent = this.matchAny(output, WAITING_PATTERNS.otherAgent);

    let waitingReason: string | undefined;
    if (waitingForInput) waitingReason = 'Waiting for user input';
    else if (waitingForApproval) waitingReason = 'Waiting for approval';
    else if (waitingForOtherAgent) waitingReason = 'Waiting for another agent';
    else if (askingQuestion) waitingReason = 'Asking a question';

    return {
      waitingForInput,
      waitingForApproval,
      askingQuestion,
      waitingForOtherAgent,
      waitingReason,
    };
  }

  /**
   * Detect idle state in output
   *
   * @param output - Terminal output to analyze
   * @returns Whether the agent appears idle
   */
  public detectIdleState(output: string): boolean {
    // Check last few lines of output for idle indicators
    const lastLines = output.split('\n').slice(-10).join('\n');

    return (
      this.matchAny(lastLines, IDLE_PATTERNS.shellPrompt) ||
      this.matchAny(output, IDLE_PATTERNS.claudeIdle) ||
      this.matchAny(output, IDLE_PATTERNS.processComplete)
    );
  }

  /**
   * Determine the overall conclusion from signals
   *
   * @param signals - All detected signals
   * @returns Analysis result with conclusion and recommendation
   */
  private determineConclusion(signals: AllSignals): AgentStateAnalysis {
    const evidence: string[] = [];
    let conclusion: AgentConclusion = 'UNKNOWN';
    let confidence = 0.5;
    let recommendation: ContinuationAction = 'no_action';

    // Check iteration limit first
    if (signals.iterations >= signals.maxIterations) {
      return {
        conclusion: 'MAX_ITERATIONS',
        confidence: 1.0,
        evidence: [`Reached ${signals.iterations}/${signals.maxIterations} iterations`],
        recommendation: 'notify_owner',
        iterations: signals.iterations,
        maxIterations: signals.maxIterations,
      };
    }

    // Check for clear task completion
    if (signals.completion.taskMarkedComplete) {
      evidence.push('Agent called complete_task tool');
      conclusion = 'TASK_COMPLETE';
      confidence = 0.95;
      recommendation = 'assign_next_task';
    }
    // Check for successful completion signals
    else if (signals.completion.testsAllPassed && signals.completion.buildSucceeded) {
      evidence.push('All tests passed');
      evidence.push('Build succeeded');
      if (signals.completion.commitMade) {
        evidence.push('Commit made');
        conclusion = 'TASK_COMPLETE';
        confidence = 0.85;
        recommendation = 'assign_next_task';
      } else {
        conclusion = 'INCOMPLETE';
        confidence = 0.7;
        recommendation = 'inject_prompt';
        evidence.push('No commit detected - may need to commit');
      }
    }
    // Check for errors
    else if (signals.errors.hasError) {
      evidence.push(`Error detected: ${signals.errors.errorType}`);
      if (signals.errors.errorMessage) {
        evidence.push(`Message: ${signals.errors.errorMessage.slice(0, 100)}`);
      }
      conclusion = 'STUCK_OR_ERROR';
      confidence = 0.8;
      recommendation = 'retry_with_hints';
    }
    // Check for waiting state
    else if (signals.waiting.waitingForInput || signals.waiting.askingQuestion) {
      evidence.push(signals.waiting.waitingReason || 'Agent appears to be waiting for input');
      conclusion = 'WAITING_INPUT';
      confidence = 0.75;
      recommendation = 'notify_owner';
    }
    else if (signals.waiting.waitingForApproval) {
      evidence.push('Agent is waiting for approval');
      conclusion = 'WAITING_INPUT';
      confidence = 0.8;
      recommendation = 'notify_owner';
    }
    else if (signals.waiting.waitingForOtherAgent) {
      evidence.push('Agent is waiting for another agent');
      conclusion = 'WAITING_INPUT';
      confidence = 0.7;
      recommendation = 'no_action';
    }
    // Check for idle state
    else if (signals.isIdle) {
      evidence.push('Session appears idle (shell prompt or Claude exited)');
      conclusion = 'INCOMPLETE';
      confidence = 0.6;
      recommendation = 'inject_prompt';
    }
    // Exit code analysis
    else if (signals.exitCode !== undefined) {
      if (signals.exitCode === 0) {
        evidence.push('Process exited with code 0');
        conclusion = 'INCOMPLETE';
        confidence = 0.5;
        recommendation = 'inject_prompt';
      } else {
        evidence.push(`Process exited with code ${signals.exitCode}`);
        conclusion = 'STUCK_OR_ERROR';
        confidence = 0.7;
        recommendation = 'retry_with_hints';
      }
    }

    // Apply confidence threshold
    if (confidence < CONTINUATION_CONSTANTS.CONFIDENCE.ACTION_THRESHOLD) {
      recommendation = 'no_action';
    }

    return {
      conclusion,
      confidence,
      evidence,
      recommendation,
      iterations: signals.iterations,
      maxIterations: signals.maxIterations,
    };
  }

  /**
   * Check if any pattern matches the text
   *
   * @param text - Text to search
   * @param patterns - Patterns to match
   * @returns True if any pattern matches
   */
  private matchAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(text));
  }

  /**
   * Extract error message from output
   *
   * @param output - Terminal output
   * @param patterns - Patterns that matched
   * @returns Extracted error message
   */
  private extractErrorMessage(output: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        // Get the line containing the match plus context
        const lines = output.split('\n');
        const matchIndex = lines.findIndex((l) => pattern.test(l));
        if (matchIndex >= 0) {
          return lines.slice(matchIndex, matchIndex + 3).join('\n');
        }
      }
    }
    return undefined;
  }

  /**
   * Extract stack trace from output
   *
   * @param output - Terminal output
   * @returns Extracted stack trace
   */
  private extractStackTrace(output: string): string | undefined {
    // Look for common stack trace patterns
    const stackTracePattern = /^\s*at\s+.+\(.+:\d+:\d+\)/gm;
    const matches = output.match(stackTracePattern);

    if (matches && matches.length > 0) {
      return matches.slice(0, 10).join('\n');
    }

    return undefined;
  }

  /**
   * Get suggested fix for an error type
   *
   * @param errorType - Type of error
   * @param errorMessage - Error message if available
   * @returns Suggested fix
   */
  private getSuggestedFix(errorType: ErrorType, errorMessage?: string): string {
    const fixes = ERROR_FIXES[errorType] || ERROR_FIXES.unknown;

    // Try to find a more specific fix based on the error message
    if (errorMessage) {
      if (errorMessage.includes('Cannot find module') || errorMessage.includes('Module not found')) {
        return 'Run npm install to ensure all dependencies are installed';
      }
      if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
        return 'Check file permissions or try with elevated privileges';
      }
      if (errorMessage.includes('ENOENT')) {
        return 'The file or directory does not exist - check the path';
      }
    }

    // Return the first general suggestion
    return fixes[0] || 'Review the error message and investigate';
  }
}
