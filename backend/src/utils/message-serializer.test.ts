import {
  serializeTaskAssignment,
  serializeStatusReport,
  serializeVerificationRequest,
  serializeVerificationResult,
  parseTaskAssignment,
  parseStatusReport,
  parseVerificationRequest,
  parseVerificationResult,
  detectMessageType,
} from './message-serializer';
import type {
  TaskAssignment,
  StatusReport,
  VerificationRequest,
  VerificationResult,
} from '../types/hierarchy-message.types';

describe('Message Serializer', () => {
  // =========================================================================
  // TaskAssignment
  // =========================================================================
  describe('TaskAssignment serialization', () => {
    const fullMsg: TaskAssignment = {
      type: 'task_assignment',
      taskId: 'task-001',
      title: 'Implement login form',
      description: 'Create a React login form with email and password fields.\nUse controlled components.',
      priority: 'high',
      parentTaskId: 'goal-001',
      expectedArtifacts: ['LoginForm.tsx', 'LoginForm.test.tsx'],
      contextFiles: ['specs/auth.md', 'src/types/user.ts'],
      deadlineHint: '2026-03-07',
      delegatedBy: 'tl-session-1',
    };

    it('should serialize to markdown with [TASK ASSIGNMENT] header', () => {
      const md = serializeTaskAssignment(fullMsg);

      expect(md).toContain('[TASK ASSIGNMENT]');
      expect(md).toContain('Task ID: task-001');
      expect(md).toContain('Title: Implement login form');
      expect(md).toContain('Priority: high');
      expect(md).toContain('Delegated by: tl-session-1');
      expect(md).toContain('Parent Task: goal-001');
      expect(md).toContain('## Instructions');
      expect(md).toContain('Create a React login form');
      expect(md).toContain('## Expected Deliverables');
      expect(md).toContain('- LoginForm.tsx');
      expect(md).toContain('## Context');
      expect(md).toContain('- specs/auth.md');
      expect(md).toContain('**Deadline hint**: 2026-03-07');
    });

    it('should serialize minimal message without optional sections', () => {
      const minMsg: TaskAssignment = {
        type: 'task_assignment',
        taskId: 'task-002',
        title: 'Quick fix',
        description: 'Fix the bug',
        priority: 'low',
        delegatedBy: 'orc',
      };

      const md = serializeTaskAssignment(minMsg);

      expect(md).toContain('[TASK ASSIGNMENT]');
      expect(md).toContain('Parent Task: none');
      expect(md).not.toContain('## Expected Deliverables');
      expect(md).not.toContain('## Context');
      expect(md).not.toContain('Deadline hint');
    });

    it('should roundtrip through serialize → parse', () => {
      const md = serializeTaskAssignment(fullMsg);
      const parsed = parseTaskAssignment(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('task_assignment');
      expect(parsed!.taskId).toBe('task-001');
      expect(parsed!.title).toBe('Implement login form');
      expect(parsed!.priority).toBe('high');
      expect(parsed!.delegatedBy).toBe('tl-session-1');
      expect(parsed!.parentTaskId).toBe('goal-001');
      expect(parsed!.description).toContain('Create a React login form');
      expect(parsed!.expectedArtifacts).toContain('LoginForm.tsx');
      expect(parsed!.expectedArtifacts).toContain('LoginForm.test.tsx');
      expect(parsed!.contextFiles).toContain('specs/auth.md');
      expect(parsed!.deadlineHint).toBe('2026-03-07');
    });

    it('should roundtrip minimal message', () => {
      const minMsg: TaskAssignment = {
        type: 'task_assignment',
        taskId: 'task-min',
        title: 'Minimal task',
        description: 'Do the thing',
        priority: 'medium',
        delegatedBy: 'orc',
      };

      const md = serializeTaskAssignment(minMsg);
      const parsed = parseTaskAssignment(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.taskId).toBe('task-min');
      expect(parsed!.parentTaskId).toBeUndefined();
      expect(parsed!.expectedArtifacts).toBeUndefined();
      expect(parsed!.contextFiles).toBeUndefined();
      expect(parsed!.deadlineHint).toBeUndefined();
    });
  });

  describe('TaskAssignment parsing', () => {
    it('should return null for non-TaskAssignment text', () => {
      expect(parseTaskAssignment('Hello world')).toBeNull();
      expect(parseTaskAssignment('[STATUS REPORT]\nTask ID: t1')).toBeNull();
    });

    it('should return null for malformed header', () => {
      const bad = '---\n[TASK ASSIGNMENT]\n---\n## Instructions\nTest';
      expect(parseTaskAssignment(bad)).toBeNull();
    });
  });

  // =========================================================================
  // StatusReport
  // =========================================================================
  describe('StatusReport serialization', () => {
    const fullMsg: StatusReport = {
      type: 'status_report',
      taskId: 'task-001',
      state: 'working',
      progress: 75,
      message: 'Login form implemented, working on validation',
      artifacts: [
        { id: 'a1', name: 'LoginForm.tsx', type: 'file', content: 'src/LoginForm.tsx', createdAt: '2026-03-06' },
      ],
      blockers: ['Waiting for API spec', 'Need design review'],
      reportedBy: 'worker-session-1',
    };

    it('should serialize to markdown with [STATUS REPORT] header', () => {
      const md = serializeStatusReport(fullMsg);

      expect(md).toContain('[STATUS REPORT]');
      expect(md).toContain('Task ID: task-001');
      expect(md).toContain('State: working');
      expect(md).toContain('Progress: 75%');
      expect(md).toContain('Reported by: worker-session-1');
      expect(md).toContain('## Status');
      expect(md).toContain('Login form implemented');
      expect(md).toContain('## Artifacts');
      expect(md).toContain('**LoginForm.tsx** (file)');
      expect(md).toContain('## Blockers');
      expect(md).toContain('- Waiting for API spec');
    });

    it('should serialize minimal message', () => {
      const minMsg: StatusReport = {
        type: 'status_report',
        taskId: 'task-002',
        state: 'completed',
        message: 'Done',
        reportedBy: 'w1',
      };

      const md = serializeStatusReport(minMsg);

      expect(md).toContain('[STATUS REPORT]');
      expect(md).not.toContain('Progress:');
      expect(md).not.toContain('## Artifacts');
      expect(md).not.toContain('## Blockers');
    });

    it('should roundtrip through serialize → parse', () => {
      const md = serializeStatusReport(fullMsg);
      const parsed = parseStatusReport(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('status_report');
      expect(parsed!.taskId).toBe('task-001');
      expect(parsed!.state).toBe('working');
      expect(parsed!.progress).toBe(75);
      expect(parsed!.reportedBy).toBe('worker-session-1');
      expect(parsed!.message).toContain('Login form implemented');
      expect(parsed!.artifacts).toHaveLength(1);
      expect(parsed!.artifacts![0].name).toBe('LoginForm.tsx');
      expect(parsed!.blockers).toContain('Waiting for API spec');
      expect(parsed!.blockers).toContain('Need design review');
    });
  });

  describe('StatusReport parsing', () => {
    it('should return null for non-StatusReport text', () => {
      expect(parseStatusReport('Hello')).toBeNull();
    });
  });

  // =========================================================================
  // VerificationRequest
  // =========================================================================
  describe('VerificationRequest serialization', () => {
    const fullMsg: VerificationRequest = {
      type: 'verification_request',
      taskId: 'task-001',
      artifacts: [
        { id: 'a1', name: 'main.ts', type: 'file', content: 'src/main.ts', createdAt: '2026-03-06' },
        { id: 'a2', name: 'main.test.ts', type: 'file', content: 'src/main.test.ts', createdAt: '2026-03-06' },
      ],
      summary: 'Implemented the main module with full test coverage',
      testResults: 'Tests: 15 passed, 0 failed\nCoverage: 92%',
      requestedBy: 'worker-session-1',
    };

    it('should serialize to markdown with [VERIFICATION REQUEST] header', () => {
      const md = serializeVerificationRequest(fullMsg);

      expect(md).toContain('[VERIFICATION REQUEST]');
      expect(md).toContain('Task ID: task-001');
      expect(md).toContain('Requested by: worker-session-1');
      expect(md).toContain('## Summary');
      expect(md).toContain('Implemented the main module');
      expect(md).toContain('## Artifacts');
      expect(md).toContain('**main.ts** (file)');
      expect(md).toContain('## Test Results');
      expect(md).toContain('Coverage: 92%');
    });

    it('should roundtrip through serialize → parse', () => {
      const md = serializeVerificationRequest(fullMsg);
      const parsed = parseVerificationRequest(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('verification_request');
      expect(parsed!.taskId).toBe('task-001');
      expect(parsed!.requestedBy).toBe('worker-session-1');
      expect(parsed!.summary).toContain('Implemented the main module');
      expect(parsed!.artifacts).toHaveLength(2);
      expect(parsed!.testResults).toContain('Coverage: 92%');
    });

    it('should roundtrip without optional test results', () => {
      const minMsg: VerificationRequest = {
        type: 'verification_request',
        taskId: 'task-min',
        artifacts: [],
        summary: 'Task done',
        requestedBy: 'w1',
      };

      const md = serializeVerificationRequest(minMsg);
      const parsed = parseVerificationRequest(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.testResults).toBeUndefined();
      expect(parsed!.artifacts).toHaveLength(0);
    });
  });

  // =========================================================================
  // VerificationResult
  // =========================================================================
  describe('VerificationResult serialization', () => {
    it('should serialize with feedback', () => {
      const msg: VerificationResult = {
        type: 'verification_result',
        taskId: 'task-001',
        verdict: 'revision_needed',
        feedback: 'Missing unit tests for edge cases.\nPlease add tests for null input.',
        verifiedBy: 'tl-session-1',
      };

      const md = serializeVerificationResult(msg);

      expect(md).toContain('[VERIFICATION RESULT]');
      expect(md).toContain('Task ID: task-001');
      expect(md).toContain('Verdict: revision_needed');
      expect(md).toContain('Verified by: tl-session-1');
      expect(md).toContain('## Feedback');
      expect(md).toContain('Missing unit tests');
    });

    it('should serialize without feedback (approved)', () => {
      const msg: VerificationResult = {
        type: 'verification_result',
        taskId: 'task-002',
        verdict: 'approved',
        verifiedBy: 'tl-1',
      };

      const md = serializeVerificationResult(msg);

      expect(md).toContain('Verdict: approved');
      expect(md).not.toContain('## Feedback');
    });

    it('should roundtrip through serialize → parse', () => {
      const msg: VerificationResult = {
        type: 'verification_result',
        taskId: 'task-003',
        verdict: 'rejected',
        feedback: 'Does not meet acceptance criteria',
        verifiedBy: 'tl-2',
      };

      const md = serializeVerificationResult(msg);
      const parsed = parseVerificationResult(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('verification_result');
      expect(parsed!.taskId).toBe('task-003');
      expect(parsed!.verdict).toBe('rejected');
      expect(parsed!.feedback).toBe('Does not meet acceptance criteria');
      expect(parsed!.verifiedBy).toBe('tl-2');
    });

    it('should roundtrip without feedback', () => {
      const msg: VerificationResult = {
        type: 'verification_result',
        taskId: 'task-ok',
        verdict: 'approved',
        verifiedBy: 'tl-1',
      };

      const md = serializeVerificationResult(msg);
      const parsed = parseVerificationResult(md);

      expect(parsed).not.toBeNull();
      expect(parsed!.feedback).toBeUndefined();
    });
  });

  // =========================================================================
  // detectMessageType
  // =========================================================================
  describe('detectMessageType', () => {
    it('should detect task_assignment', () => {
      expect(detectMessageType('---\n[TASK ASSIGNMENT]\nTask ID: t1\n---')).toBe('task_assignment');
    });

    it('should detect status_report', () => {
      expect(detectMessageType('---\n[STATUS REPORT]\nTask ID: t1\n---')).toBe('status_report');
    });

    it('should detect verification_request', () => {
      expect(detectMessageType('---\n[VERIFICATION REQUEST]\nTask ID: t1\n---')).toBe('verification_request');
    });

    it('should detect verification_result', () => {
      expect(detectMessageType('---\n[VERIFICATION RESULT]\nTask ID: t1\n---')).toBe('verification_result');
    });

    it('should return null for unrecognized text', () => {
      expect(detectMessageType('Hello world')).toBeNull();
      expect(detectMessageType('')).toBeNull();
    });

    it('should return null for free-text task messages (backwards compat)', () => {
      expect(detectMessageType('New task from orchestrator (priority: high):\n\nImplement login')).toBeNull();
    });
  });

  // =========================================================================
  // Backwards compatibility
  // =========================================================================
  describe('Backwards compatibility', () => {
    it('should not parse free-text messages as any type', () => {
      const freeText = 'New task from orchestrator (priority: high):\n\nPlease implement the login form.\n\nWhen done, report back.';

      expect(parseTaskAssignment(freeText)).toBeNull();
      expect(parseStatusReport(freeText)).toBeNull();
      expect(parseVerificationRequest(freeText)).toBeNull();
      expect(parseVerificationResult(freeText)).toBeNull();
    });

    it('should not parse legacy report-status messages', () => {
      const legacyStatus = '[DONE] Agent dev-sam: Implemented auth module with tests';

      expect(parseStatusReport(legacyStatus)).toBeNull();
      expect(detectMessageType(legacyStatus)).toBeNull();
    });
  });
});
