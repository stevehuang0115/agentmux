/**
 * Tests for Auto-Assignment Type Definitions
 *
 * @module types/auto-assign.types.test
 */

import {
  AssignmentStrategy,
  RoleMatchRule,
  LoadBalancingConfig,
  DependencyConfig,
  TaskAssignmentResult,
  QueuedTask,
  TaskAssignment,
  TaskQueue,
  AssignmentEvent,
  NotificationConfig,
  AssignmentLimits,
  AutoAssignConfig,
  FindNextTaskParams,
  FindNextTaskResult,
  AUTO_ASSIGN_CONSTANTS,
  DEFAULT_ROLE_MATCHING,
  DEFAULT_ASSIGNMENT_STRATEGY,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_ASSIGNMENT_LIMITS,
  DEFAULT_AUTO_ASSIGN_CONFIG,
} from './auto-assign.types.js';

describe('Auto-Assignment Types', () => {
  describe('RoleMatchRule interface', () => {
    it('should define a basic role match rule', () => {
      const rule: RoleMatchRule = {
        role: 'developer',
        taskTypes: ['feature', 'fix'],
        priority: 1,
      };

      expect(rule.role).toBe('developer');
      expect(rule.taskTypes).toContain('feature');
      expect(rule.priority).toBe(1);
    });

    it('should define an exclusive role match rule', () => {
      const rule: RoleMatchRule = {
        role: 'qa',
        taskTypes: ['test', 'verify'],
        priority: 1,
        exclusive: true,
      };

      expect(rule.exclusive).toBe(true);
    });
  });

  describe('LoadBalancingConfig interface', () => {
    it('should define load balancing configuration', () => {
      const config: LoadBalancingConfig = {
        enabled: true,
        maxConcurrentTasks: 1,
        preferIdleAgents: true,
      };

      expect(config.enabled).toBe(true);
      expect(config.maxConcurrentTasks).toBe(1);
    });
  });

  describe('DependencyConfig interface', () => {
    it('should define dependency configuration', () => {
      const config: DependencyConfig = {
        respectBlocking: true,
        waitForDependencies: true,
      };

      expect(config.respectBlocking).toBe(true);
      expect(config.waitForDependencies).toBe(true);
    });
  });

  describe('AssignmentStrategy interface', () => {
    it('should define complete assignment strategy', () => {
      const strategy: AssignmentStrategy = {
        prioritization: 'priority',
        roleMatching: [
          { role: 'developer', taskTypes: ['feature'], priority: 1 },
        ],
        loadBalancing: {
          enabled: true,
          maxConcurrentTasks: 1,
          preferIdleAgents: true,
        },
        dependencies: {
          respectBlocking: true,
          waitForDependencies: true,
        },
      };

      expect(strategy.prioritization).toBe('priority');
      expect(strategy.roleMatching).toHaveLength(1);
    });

    it('should support different prioritization strategies', () => {
      const strategies: AssignmentStrategy['prioritization'][] = [
        'fifo',
        'priority',
        'deadline',
        'custom',
      ];

      expect(strategies).toHaveLength(4);
    });
  });

  describe('TaskAssignmentResult interface', () => {
    it('should define a task assignment result', () => {
      const result: TaskAssignmentResult = {
        taskId: 'task-123',
        taskPath: '/project/tasks/open/task-123.md',
        agentId: 'agent-001',
        sessionName: 'dev-session',
        assignedAt: '2026-01-29T00:00:00Z',
      };

      expect(result.taskId).toBe('task-123');
      expect(result.agentId).toBe('agent-001');
    });

    it('should support estimated completion', () => {
      const result: TaskAssignmentResult = {
        taskId: 'task-123',
        taskPath: '/project/tasks/task.md',
        agentId: 'agent-001',
        sessionName: 'dev-session',
        assignedAt: '2026-01-29T00:00:00Z',
        estimatedCompletion: '2026-01-29T02:00:00Z',
      };

      expect(result.estimatedCompletion).toBeDefined();
    });
  });

  describe('QueuedTask interface', () => {
    it('should define a queued task', () => {
      const task: QueuedTask = {
        taskId: 'task-123',
        taskPath: '/project/tasks/open/task-123.md',
        title: 'Implement feature X',
        priority: 2,
        taskType: 'feature',
        requiredRole: 'developer',
        dependencies: [],
        blockedBy: [],
        createdAt: '2026-01-29T00:00:00Z',
      };

      expect(task.taskId).toBe('task-123');
      expect(task.priority).toBe(2);
      expect(task.taskType).toBe('feature');
    });

    it('should support dependencies and blockers', () => {
      const task: QueuedTask = {
        taskId: 'task-456',
        taskPath: '/project/tasks/task.md',
        title: 'Dependent task',
        priority: 5,
        dependencies: ['task-123', 'task-234'],
        blockedBy: ['task-123'],
        createdAt: '2026-01-29T00:00:00Z',
      };

      expect(task.dependencies).toHaveLength(2);
      expect(task.blockedBy).toHaveLength(1);
    });
  });

  describe('TaskAssignment interface', () => {
    it('should define a task assignment', () => {
      const assignment: TaskAssignment = {
        taskId: 'task-123',
        agentId: 'agent-001',
        sessionName: 'dev-session',
        assignedAt: '2026-01-29T00:00:00Z',
        status: 'active',
      };

      expect(assignment.status).toBe('active');
    });

    it('should support all assignment statuses', () => {
      const statuses: TaskAssignment['status'][] = [
        'active',
        'completed',
        'failed',
        'reassigned',
      ];

      expect(statuses).toHaveLength(4);
    });

    it('should support completed assignment', () => {
      const assignment: TaskAssignment = {
        taskId: 'task-123',
        agentId: 'agent-001',
        sessionName: 'dev-session',
        assignedAt: '2026-01-29T00:00:00Z',
        status: 'completed',
        completedAt: '2026-01-29T02:00:00Z',
        iterations: 3,
      };

      expect(assignment.completedAt).toBeDefined();
      expect(assignment.iterations).toBe(3);
    });
  });

  describe('TaskQueue interface', () => {
    it('should define a task queue', () => {
      const queue: TaskQueue = {
        projectPath: '/project',
        tasks: [],
        assignments: [],
        config: DEFAULT_ASSIGNMENT_STRATEGY,
        lastUpdated: '2026-01-29T00:00:00Z',
      };

      expect(queue.projectPath).toBe('/project');
      expect(queue.tasks).toHaveLength(0);
    });
  });

  describe('AssignmentEvent interface', () => {
    it('should define assignment events', () => {
      const event: AssignmentEvent = {
        type: 'task_assigned',
        agentId: 'agent-001',
        sessionName: 'dev-session',
        taskId: 'task-123',
        timestamp: '2026-01-29T00:00:00Z',
      };

      expect(event.type).toBe('task_assigned');
      expect(event.taskId).toBe('task-123');
    });

    it('should support all event types', () => {
      const eventTypes: AssignmentEvent['type'][] = [
        'task_assigned',
        'task_completed',
        'task_failed',
        'agent_idle',
        'no_tasks',
        'assignment_skipped',
      ];

      expect(eventTypes).toHaveLength(6);
    });

    it('should support metadata', () => {
      const event: AssignmentEvent = {
        type: 'task_failed',
        agentId: 'agent-001',
        sessionName: 'dev-session',
        timestamp: '2026-01-29T00:00:00Z',
        metadata: { reason: 'quality_gate_failed', iterations: 5 },
      };

      expect(event.metadata).toHaveProperty('reason');
    });
  });

  describe('NotificationConfig interface', () => {
    it('should define notification configuration', () => {
      const config: NotificationConfig = {
        notifyOnIdle: true,
        idleThresholdMinutes: 5,
        notifyOnNoTasks: true,
      };

      expect(config.idleThresholdMinutes).toBe(5);
    });
  });

  describe('AssignmentLimits interface', () => {
    it('should define assignment limits', () => {
      const limits: AssignmentLimits = {
        maxAssignmentsPerDay: 50,
        cooldownBetweenTasks: 60,
      };

      expect(limits.maxAssignmentsPerDay).toBe(50);
      expect(limits.cooldownBetweenTasks).toBe(60);
    });
  });

  describe('AutoAssignConfig interface', () => {
    it('should define complete auto-assign configuration', () => {
      const config: AutoAssignConfig = {
        enabled: true,
        strategy: DEFAULT_ASSIGNMENT_STRATEGY,
        notifications: DEFAULT_NOTIFICATION_CONFIG,
        limits: DEFAULT_ASSIGNMENT_LIMITS,
      };

      expect(config.enabled).toBe(true);
    });
  });

  describe('FindNextTaskParams interface', () => {
    it('should define find next task parameters', () => {
      const params: FindNextTaskParams = {
        sessionName: 'dev-session',
        role: 'developer',
        projectPath: '/project',
        preferredTaskTypes: ['feature', 'fix'],
      };

      expect(params.role).toBe('developer');
      expect(params.preferredTaskTypes).toContain('feature');
    });
  });

  describe('FindNextTaskResult interface', () => {
    it('should define successful find result', () => {
      const result: FindNextTaskResult = {
        found: true,
        task: {
          taskId: 'task-123',
          taskPath: '/project/tasks/task.md',
          title: 'Test task',
          priority: 2,
          dependencies: [],
          blockedBy: [],
          createdAt: '2026-01-29T00:00:00Z',
        },
      };

      expect(result.found).toBe(true);
      expect(result.task).toBeDefined();
    });

    it('should define unsuccessful find result', () => {
      const result: FindNextTaskResult = {
        found: false,
        reason: 'no_tasks',
      };

      expect(result.found).toBe(false);
      expect(result.reason).toBe('no_tasks');
    });

    it('should support all failure reasons', () => {
      const reasons: NonNullable<FindNextTaskResult['reason']>[] = [
        'no_tasks',
        'all_blocked',
        'role_mismatch',
        'at_limit',
        'cooldown',
      ];

      expect(reasons).toHaveLength(5);
    });
  });

  describe('AUTO_ASSIGN_CONSTANTS', () => {
    describe('DEFAULTS', () => {
      it('should have correct default values', () => {
        expect(AUTO_ASSIGN_CONSTANTS.DEFAULTS.MAX_CONCURRENT_TASKS).toBe(1);
        expect(AUTO_ASSIGN_CONSTANTS.DEFAULTS.MAX_ASSIGNMENTS_PER_DAY).toBe(50);
        expect(AUTO_ASSIGN_CONSTANTS.DEFAULTS.COOLDOWN_BETWEEN_TASKS).toBe(60);
        expect(AUTO_ASSIGN_CONSTANTS.DEFAULTS.IDLE_THRESHOLD_MINUTES).toBe(5);
      });
    });

    describe('TASK_TYPES', () => {
      it('should define task type categories', () => {
        expect(AUTO_ASSIGN_CONSTANTS.TASK_TYPES.DEVELOPMENT).toContain('feature');
        expect(AUTO_ASSIGN_CONSTANTS.TASK_TYPES.TESTING).toContain('test');
        expect(AUTO_ASSIGN_CONSTANTS.TASK_TYPES.FRONTEND).toContain('ui');
        expect(AUTO_ASSIGN_CONSTANTS.TASK_TYPES.BACKEND).toContain('api');
        expect(AUTO_ASSIGN_CONSTANTS.TASK_TYPES.MANAGEMENT).toContain('planning');
      });
    });

    describe('PRIORITY', () => {
      it('should define priority levels', () => {
        expect(AUTO_ASSIGN_CONSTANTS.PRIORITY.CRITICAL).toBe(1);
        expect(AUTO_ASSIGN_CONSTANTS.PRIORITY.HIGH).toBe(2);
        expect(AUTO_ASSIGN_CONSTANTS.PRIORITY.MEDIUM).toBe(5);
        expect(AUTO_ASSIGN_CONSTANTS.PRIORITY.LOW).toBe(10);
        expect(AUTO_ASSIGN_CONSTANTS.PRIORITY.BACKLOG).toBe(20);
      });
    });

    describe('PATHS', () => {
      it('should define config paths', () => {
        expect(AUTO_ASSIGN_CONSTANTS.PATHS.CONFIG_FILE).toBe('auto-assign.yaml');
        expect(AUTO_ASSIGN_CONSTANTS.PATHS.CONFIG_DIR).toBe('.agentmux/config');
      });
    });
  });

  describe('DEFAULT_ROLE_MATCHING', () => {
    it('should contain rules for all primary roles', () => {
      const roles = DEFAULT_ROLE_MATCHING.map((r) => r.role);

      expect(roles).toContain('developer');
      expect(roles).toContain('frontend-developer');
      expect(roles).toContain('backend-developer');
      expect(roles).toContain('qa');
      expect(roles).toContain('pm');
    });

    it('should mark QA as exclusive for certain task types', () => {
      const qaRule = DEFAULT_ROLE_MATCHING.find((r) => r.role === 'qa');

      expect(qaRule?.exclusive).toBe(true);
    });

    it('should have at least 9 role rules', () => {
      expect(DEFAULT_ROLE_MATCHING.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('DEFAULT_ASSIGNMENT_STRATEGY', () => {
    it('should use priority-based prioritization', () => {
      expect(DEFAULT_ASSIGNMENT_STRATEGY.prioritization).toBe('priority');
    });

    it('should enable load balancing', () => {
      expect(DEFAULT_ASSIGNMENT_STRATEGY.loadBalancing.enabled).toBe(true);
      expect(DEFAULT_ASSIGNMENT_STRATEGY.loadBalancing.maxConcurrentTasks).toBe(1);
    });

    it('should respect dependencies', () => {
      expect(DEFAULT_ASSIGNMENT_STRATEGY.dependencies.respectBlocking).toBe(true);
      expect(DEFAULT_ASSIGNMENT_STRATEGY.dependencies.waitForDependencies).toBe(true);
    });
  });

  describe('DEFAULT_NOTIFICATION_CONFIG', () => {
    it('should enable notifications', () => {
      expect(DEFAULT_NOTIFICATION_CONFIG.notifyOnIdle).toBe(true);
      expect(DEFAULT_NOTIFICATION_CONFIG.notifyOnNoTasks).toBe(true);
    });

    it('should have correct idle threshold', () => {
      expect(DEFAULT_NOTIFICATION_CONFIG.idleThresholdMinutes).toBe(5);
    });
  });

  describe('DEFAULT_ASSIGNMENT_LIMITS', () => {
    it('should have correct default limits', () => {
      expect(DEFAULT_ASSIGNMENT_LIMITS.maxAssignmentsPerDay).toBe(50);
      expect(DEFAULT_ASSIGNMENT_LIMITS.cooldownBetweenTasks).toBe(60);
    });
  });

  describe('DEFAULT_AUTO_ASSIGN_CONFIG', () => {
    it('should be enabled by default', () => {
      expect(DEFAULT_AUTO_ASSIGN_CONFIG.enabled).toBe(true);
    });

    it('should include all sub-configurations', () => {
      expect(DEFAULT_AUTO_ASSIGN_CONFIG.strategy).toBe(DEFAULT_ASSIGNMENT_STRATEGY);
      expect(DEFAULT_AUTO_ASSIGN_CONFIG.notifications).toBe(DEFAULT_NOTIFICATION_CONFIG);
      expect(DEFAULT_AUTO_ASSIGN_CONFIG.limits).toBe(DEFAULT_ASSIGNMENT_LIMITS);
    });
  });
});
