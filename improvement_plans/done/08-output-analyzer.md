---
id: 08-output-analyzer
title: Implement Terminal Output Analyzer
phase: 2
priority: P0
status: open
estimatedHours: 10
dependencies: [07-continuation-detection]
blocks: [09-continuation-service]
---

# Task: Implement Terminal Output Analyzer

## Objective
Create a service that analyzes terminal output to determine the agent's state and whether continuation is needed.

## Background
When an agent stops or goes idle, we need to analyze the terminal output to understand:
- Did the agent complete its task?
- Is it waiting for input?
- Did it hit an error?
- Should we continue or intervene?

## Deliverables

### 1. OutputAnalyzer Service

**Location:** `backend/src/services/continuation/output-analyzer.service.ts`

```typescript
interface IOutputAnalyzer {
  // Analyze terminal output to determine state
  analyze(params: AnalyzeParams): Promise<AgentStateAnalysis>;

  // Check for specific patterns
  detectCompletionSignals(output: string): CompletionSignals;
  detectErrorPatterns(output: string): ErrorPatterns;
  detectWaitingSignals(output: string): WaitingSignals;
}

interface AnalyzeParams {
  sessionName: string;
  output: string;               // Terminal output to analyze
  currentTask?: TaskInfo;       // Current assigned task
  exitCode?: number;            // If PTY exited
  previousAnalysis?: AgentStateAnalysis;
}

interface CompletionSignals {
  taskMarkedComplete: boolean;  // Agent called complete_task
  testsAllPassed: boolean;      // Test output shows all pass
  buildSucceeded: boolean;      // Build completed
  commitMade: boolean;          // Git commit detected
  prCreated: boolean;           // PR creation detected
  explicitDone: boolean;        // Agent said "done" or similar
}

interface ErrorPatterns {
  hasError: boolean;
  errorType?: 'compile' | 'test' | 'runtime' | 'permission' | 'unknown';
  errorMessage?: string;
  stackTrace?: string;
  suggestedFix?: string;
}

interface WaitingSignals {
  waitingForInput: boolean;
  waitingForApproval: boolean;
  askingQuestion: boolean;
  waitingForOtherAgent: boolean;
  waitingReason?: string;
}
```

### 2. Pattern Definitions

```typescript
// Pattern matchers for different signals

const COMPLETION_PATTERNS = {
  // Task completion
  taskComplete: [
    /task\s+(completed?|done|finished)/i,
    /successfully\s+completed/i,
    /\[complete_task\]/i,
  ],

  // Test success
  testsPass: [
    /(\d+)\s+pass(ed|ing)?,?\s*0\s+fail/i,
    /all\s+tests\s+pass(ed)?/i,
    /test\s+suite(s)?\s+passed/i,
    /✓.*passed/i,
  ],

  // Build success
  buildSuccess: [
    /build\s+(succeeded|successful|complete)/i,
    /compiled?\s+successfully/i,
    /webpack.*compiled/i,
    /vite.*built/i,
  ],

  // Git operations
  commitMade: [
    /\[\w+\s+[a-f0-9]{7,}\]/,          // [main abc1234]
    /create mode \d+ /,
    /files? changed,/,
  ],

  prCreated: [
    /pull request.*created/i,
    /gh pr create/i,
    /https:\/\/github\.com\/.*\/pull\/\d+/,
  ],
};

const ERROR_PATTERNS = {
  // Compile errors
  compile: [
    /error TS\d+:/i,                    // TypeScript
    /SyntaxError:/i,
    /Cannot find module/i,
    /Module not found/i,
  ],

  // Test failures
  test: [
    /\d+\s+fail(ed|ing)?/i,
    /FAIL\s+/,
    /AssertionError/i,
    /Expected.*but (got|received)/i,
  ],

  // Runtime errors
  runtime: [
    /Error:/i,
    /Exception:/i,
    /fatal:/i,
    /ENOENT:/i,
    /EACCES:/i,
  ],

  // Permission errors
  permission: [
    /permission denied/i,
    /EACCES/i,
    /sudo/i,
  ],
};

const WAITING_PATTERNS = {
  // Waiting for input
  input: [
    /waiting\s+for/i,
    /please\s+provide/i,
    /need\s+more\s+info/i,
    /\?\s*$/m,                          // Ends with question mark
  ],

  // Waiting for approval
  approval: [
    /waiting\s+for\s+(approval|review)/i,
    /please\s+(confirm|approve)/i,
    /ready\s+for\s+review/i,
  ],

  // Waiting for other agent
  otherAgent: [
    /waiting\s+for\s+\w+-\w+/i,         // Session name pattern
    /blocked\s+by/i,
    /depends\s+on/i,
  ],
};

const IDLE_PATTERNS = {
  // Shell prompt (agent returned to shell)
  shellPrompt: [
    /\$\s*$/m,
    />\s*$/m,
    /❯\s*$/m,
  ],

  // Claude Code specific
  claudeIdle: [
    /Claude\s+(Code\s+)?exited/i,
    /Session\s+ended/i,
  ],
};
```

### 3. Analysis Logic

```typescript
class OutputAnalyzer implements IOutputAnalyzer {
  async analyze(params: AnalyzeParams): Promise<AgentStateAnalysis> {
    const { output, currentTask, exitCode } = params;

    // Detect all signals
    const completion = this.detectCompletionSignals(output);
    const errors = this.detectErrorPatterns(output);
    const waiting = this.detectWaitingSignals(output);
    const isIdle = this.detectIdleState(output);

    // Get iteration info
    const iterations = currentTask?.iterations || 0;
    const maxIterations = currentTask?.maxIterations || CONTINUATION_CONSTANTS.DEFAULT_MAX_ITERATIONS;

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

    return analysis;
  }

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
        evidence.push(`Message: ${signals.errors.errorMessage}`);
      }
      conclusion = 'STUCK_OR_ERROR';
      confidence = 0.8;
      recommendation = 'retry_with_hints';
    }
    // Check for waiting state
    else if (signals.waiting.waitingForInput || signals.waiting.askingQuestion) {
      evidence.push('Agent appears to be waiting for input');
      conclusion = 'WAITING_INPUT';
      confidence = 0.75;
      recommendation = 'notify_owner';
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

    return {
      conclusion,
      confidence,
      evidence,
      recommendation,
      iterations: signals.iterations,
      maxIterations: signals.maxIterations,
    };
  }

  detectCompletionSignals(output: string): CompletionSignals {
    return {
      taskMarkedComplete: this.matchAny(output, COMPLETION_PATTERNS.taskComplete),
      testsAllPassed: this.matchAny(output, COMPLETION_PATTERNS.testsPass),
      buildSucceeded: this.matchAny(output, COMPLETION_PATTERNS.buildSuccess),
      commitMade: this.matchAny(output, COMPLETION_PATTERNS.commitMade),
      prCreated: this.matchAny(output, COMPLETION_PATTERNS.prCreated),
      explicitDone: /\b(done|finished|completed)\b/i.test(output),
    };
  }

  detectErrorPatterns(output: string): ErrorPatterns {
    for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
      if (this.matchAny(output, patterns)) {
        const errorMessage = this.extractErrorMessage(output, patterns);
        return {
          hasError: true,
          errorType: type as ErrorPatterns['errorType'],
          errorMessage,
          suggestedFix: this.getSuggestedFix(type, errorMessage),
        };
      }
    }
    return { hasError: false };
  }

  private matchAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(text));
  }

  private extractErrorMessage(output: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        // Get the line containing the match plus context
        const lines = output.split('\n');
        const matchIndex = lines.findIndex(l => pattern.test(l));
        if (matchIndex >= 0) {
          return lines.slice(matchIndex, matchIndex + 3).join('\n');
        }
      }
    }
    return undefined;
  }
}
```

### 4. File Structure

```
backend/src/services/continuation/
├── continuation-events.service.ts  (from Task 07)
├── output-analyzer.service.ts      (this task)
├── output-analyzer.service.test.ts
├── patterns/
│   ├── completion-patterns.ts
│   ├── error-patterns.ts
│   └── waiting-patterns.ts
└── index.ts
```

## Implementation Steps

1. **Define pattern files**
   - Completion patterns
   - Error patterns
   - Waiting patterns
   - Idle patterns

2. **Implement OutputAnalyzer class**
   - Pattern matching methods
   - Signal detection methods
   - Conclusion determination

3. **Implement error extraction**
   - Extract error messages
   - Suggest fixes where possible

4. **Implement confidence scoring**
   - Weight different signals
   - Combine for overall confidence

5. **Write comprehensive tests**
   - Test each pattern category
   - Test conclusion logic
   - Test edge cases

6. **Add pattern extensibility**
   - Allow custom patterns per project
   - Pattern priority system

## Acceptance Criteria

- [ ] All pattern categories implemented
- [ ] Conclusion logic handles all cases
- [ ] Confidence scoring is reasonable
- [ ] Error extraction works
- [ ] Tests cover 90%+ of patterns
- [ ] Edge cases handled gracefully

## Notes

- Patterns may need tuning based on real agent output
- Consider adding learning capability (patterns from learnings)
- Keep patterns maintainable and documented
- Log pattern matches for debugging
