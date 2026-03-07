import type {
  TaskAssignment,
  StatusReport,
  VerificationRequest,
  VerificationResult,
  HierarchyMessage,
  HierarchyMessageType,
} from './hierarchy-message.types';

describe('Hierarchy Message Types', () => {
  describe('TaskAssignment', () => {
    it('should accept a complete task assignment', () => {
      const msg: TaskAssignment = {
        type: 'task_assignment',
        taskId: 'task-001',
        title: 'Implement login form',
        description: 'Create a React login form with email and password fields',
        priority: 'high',
        parentTaskId: 'goal-001',
        expectedArtifacts: ['LoginForm.tsx', 'LoginForm.test.tsx'],
        contextFiles: ['specs/auth.md', 'src/types/user.ts'],
        deadlineHint: '2026-03-07',
        delegatedBy: 'tl-session-1',
      };

      expect(msg.type).toBe('task_assignment');
      expect(msg.priority).toBe('high');
      expect(msg.expectedArtifacts).toHaveLength(2);
    });

    it('should accept minimal task assignment', () => {
      const msg: TaskAssignment = {
        type: 'task_assignment',
        taskId: 'task-002',
        title: 'Quick fix',
        description: 'Fix typo in README',
        priority: 'low',
        delegatedBy: 'crewly-orc',
      };

      expect(msg.parentTaskId).toBeUndefined();
      expect(msg.expectedArtifacts).toBeUndefined();
      expect(msg.contextFiles).toBeUndefined();
      expect(msg.deadlineHint).toBeUndefined();
    });

    it('should accept all priority values', () => {
      const priorities: TaskAssignment['priority'][] = ['low', 'medium', 'high', 'critical'];
      priorities.forEach(priority => {
        const msg: TaskAssignment = {
          type: 'task_assignment',
          taskId: 'task-p',
          title: 'Test',
          description: 'Test',
          priority,
          delegatedBy: 'tl-1',
        };
        expect(msg.priority).toBe(priority);
      });
    });
  });

  describe('StatusReport', () => {
    it('should accept a complete status report', () => {
      const msg: StatusReport = {
        type: 'status_report',
        taskId: 'task-001',
        state: 'working',
        progress: 75,
        message: 'Login form implemented, working on validation',
        artifacts: [
          { id: 'a1', name: 'LoginForm.tsx', type: 'file', content: 'src/LoginForm.tsx', createdAt: '2026-03-06' },
        ],
        blockers: ['Waiting for API spec'],
        reportedBy: 'worker-session-1',
      };

      expect(msg.type).toBe('status_report');
      expect(msg.state).toBe('working');
      expect(msg.progress).toBe(75);
      expect(msg.artifacts).toHaveLength(1);
      expect(msg.blockers).toHaveLength(1);
    });

    it('should accept minimal status report', () => {
      const msg: StatusReport = {
        type: 'status_report',
        taskId: 'task-002',
        state: 'completed',
        message: 'Done',
        reportedBy: 'worker-1',
      };

      expect(msg.progress).toBeUndefined();
      expect(msg.artifacts).toBeUndefined();
      expect(msg.blockers).toBeUndefined();
    });

    it('should accept all A2A-inspired states', () => {
      const states: StatusReport['state'][] = [
        'assigned', 'active', 'blocked', 'pending_assignment', 'completed',
        'submitted', 'working', 'input_required', 'verifying', 'failed', 'cancelled',
      ];
      states.forEach(state => {
        const msg: StatusReport = {
          type: 'status_report',
          taskId: 't',
          state,
          message: 'test',
          reportedBy: 'w',
        };
        expect(msg.state).toBe(state);
      });
    });
  });

  describe('VerificationRequest', () => {
    it('should accept a complete verification request', () => {
      const msg: VerificationRequest = {
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

      expect(msg.type).toBe('verification_request');
      expect(msg.artifacts).toHaveLength(2);
      expect(msg.testResults).toContain('92%');
    });

    it('should accept minimal verification request', () => {
      const msg: VerificationRequest = {
        type: 'verification_request',
        taskId: 'task-002',
        artifacts: [],
        summary: 'Task completed',
        requestedBy: 'worker-1',
      };

      expect(msg.testResults).toBeUndefined();
      expect(msg.artifacts).toHaveLength(0);
    });
  });

  describe('VerificationResult', () => {
    it('should accept all verdict types', () => {
      const verdicts: VerificationResult['verdict'][] = ['approved', 'rejected', 'revision_needed'];
      verdicts.forEach(verdict => {
        const msg: VerificationResult = {
          type: 'verification_result',
          taskId: 'task-001',
          verdict,
          verifiedBy: 'tl-1',
        };
        expect(msg.verdict).toBe(verdict);
      });
    });

    it('should accept optional feedback', () => {
      const msg: VerificationResult = {
        type: 'verification_result',
        taskId: 'task-001',
        verdict: 'revision_needed',
        feedback: 'Missing unit tests for edge cases',
        verifiedBy: 'tl-session-1',
      };

      expect(msg.feedback).toBe('Missing unit tests for edge cases');
    });
  });

  describe('HierarchyMessage union type', () => {
    it('should accept all 4 message types', () => {
      const messages: HierarchyMessage[] = [
        { type: 'task_assignment', taskId: 't1', title: 'T', description: 'D', priority: 'medium', delegatedBy: 'x' },
        { type: 'status_report', taskId: 't2', state: 'working', message: 'M', reportedBy: 'y' },
        { type: 'verification_request', taskId: 't3', artifacts: [], summary: 'S', requestedBy: 'z' },
        { type: 'verification_result', taskId: 't4', verdict: 'approved', verifiedBy: 'w' },
      ];

      expect(messages).toHaveLength(4);
      const types = messages.map(m => m.type);
      expect(types).toContain('task_assignment');
      expect(types).toContain('status_report');
      expect(types).toContain('verification_request');
      expect(types).toContain('verification_result');
    });
  });

  describe('HierarchyMessageType', () => {
    it('should include all 4 message type identifiers', () => {
      const types: HierarchyMessageType[] = [
        'task_assignment', 'status_report', 'verification_request', 'verification_result',
      ];
      expect(types).toHaveLength(4);
    });
  });
});
