/**
 * End-to-end integration tests for the hierarchy system.
 *
 * Tests the full reporting chain:
 * 1. Orchestrator → TL → Worker → StatusReport → TL aggregate → Orchestrator
 * 2. Worker escalation when TL is unavailable
 * 3. Event emission through the full chain
 * 4. EventBus new filter fields (taskId, hierarchyLevel, parentMemberId)
 *
 * @module services/hierarchy/hierarchy-integration.test
 */

import { EventBusService } from '../event-bus/event-bus.service.js';
import { HierarchyReportingService } from './hierarchy-reporting.service.js';
import { HierarchyEscalationService } from './hierarchy-escalation.service.js';
import type { TeamMember } from '../../types/index.js';
import type { InProgressTask } from '../../types/task-tracking.types.js';
import type { StatusReport } from '../../types/hierarchy-message.types.js';
import type { AgentEvent, CreateSubscriptionInput } from '../../types/event-bus.types.js';

// Mock logger
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

/**
 * Create a standard 3-level hierarchy for integration testing.
 */
function createIntegrationHierarchy(): TeamMember[] {
  return [
    {
      id: 'orc-member',
      name: 'Orchestrator',
      sessionName: 'crewly-orc',
      role: 'orchestrator',
      systemPrompt: '',
      agentStatus: 'active',
      workingStatus: 'idle',
      runtimeType: 'claude-code',
      createdAt: '2026-03-06T10:00:00.000Z',
      updatedAt: '2026-03-06T10:00:00.000Z',
      hierarchyLevel: 0,
      parentMemberId: undefined,
      canDelegate: true,
      subordinateIds: ['tl-member-fe'],
    },
    {
      id: 'tl-member-fe',
      name: 'FE Team Lead',
      sessionName: 'tl-fe',
      role: 'team-leader',
      systemPrompt: '',
      agentStatus: 'active',
      workingStatus: 'idle',
      runtimeType: 'claude-code',
      createdAt: '2026-03-06T10:00:00.000Z',
      updatedAt: '2026-03-06T10:00:00.000Z',
      hierarchyLevel: 1,
      parentMemberId: 'orc-member',
      canDelegate: true,
      subordinateIds: ['worker-dev1', 'worker-qa1'],
    },
    {
      id: 'worker-dev1',
      name: 'Dev1',
      sessionName: 'dev-1',
      role: 'developer',
      systemPrompt: '',
      agentStatus: 'active',
      workingStatus: 'idle',
      runtimeType: 'claude-code',
      createdAt: '2026-03-06T10:00:00.000Z',
      updatedAt: '2026-03-06T10:00:00.000Z',
      hierarchyLevel: 2,
      parentMemberId: 'tl-member-fe',
      canDelegate: false,
    },
    {
      id: 'worker-qa1',
      name: 'QA1',
      sessionName: 'qa-1',
      role: 'qa',
      systemPrompt: '',
      agentStatus: 'active',
      workingStatus: 'idle',
      runtimeType: 'claude-code',
      createdAt: '2026-03-06T10:00:00.000Z',
      updatedAt: '2026-03-06T10:00:00.000Z',
      hierarchyLevel: 2,
      parentMemberId: 'tl-member-fe',
      canDelegate: false,
    },
  ];
}

function createTestTask(overrides?: Partial<InProgressTask>): InProgressTask {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    teamId: 'team-fe',
    taskFilePath: '/path/to/task.md',
    taskName: 'Test task',
    targetRole: 'developer',
    assignedTeamMemberId: 'worker-dev1',
    assignedSessionName: 'dev-1',
    assignedAt: '2026-03-06T10:00:00.000Z',
    status: 'completed',
    ...overrides,
  };
}

describe('Hierarchy Integration Tests', () => {
  let eventBus: EventBusService;
  let reportingService: HierarchyReportingService;
  let escalationService: HierarchyEscalationService;
  let mockQueueService: any;

  beforeEach(() => {
    jest.useFakeTimers();

    // Reset singletons
    HierarchyReportingService.clearInstance();
    HierarchyEscalationService.clearInstance();

    eventBus = new EventBusService();
    mockQueueService = { enqueue: jest.fn().mockReturnValue({ id: 'msg-1' }) };
    eventBus.setMessageQueueService(mockQueueService);

    reportingService = HierarchyReportingService.getInstance();
    reportingService.setEventBus(eventBus);

    escalationService = HierarchyEscalationService.getInstance();
    escalationService.setEventBus(eventBus);
  });

  afterEach(() => {
    eventBus.cleanup();
    reportingService.clearReports();
    escalationService.clearResponseRecords();
    HierarchyReportingService.clearInstance();
    HierarchyEscalationService.clearInstance();
    jest.useRealTimers();
  });

  describe('Full reporting chain: Worker → TL → Orchestrator', () => {
    it('should flow worker reports through TL aggregation to orchestrator event', () => {
      const members = createIntegrationHierarchy();

      // Step 1: Workers complete tasks and send status reports
      const workerReport1: StatusReport = {
        type: 'status_report',
        taskId: 'subtask-1',
        state: 'completed',
        message: 'Login form implemented',
        artifacts: [
          { id: 'a1', name: 'LoginForm.tsx', type: 'file', content: 'src/LoginForm.tsx', createdAt: '2026-03-06' },
        ],
        reportedBy: 'dev-1',
      };

      const workerReport2: StatusReport = {
        type: 'status_report',
        taskId: 'subtask-2',
        state: 'completed',
        message: 'Auth tests passed',
        reportedBy: 'qa-1',
      };

      // Step 2: TL receives and stores worker reports
      reportingService.receiveWorkerReport(workerReport1, 'dev-1', 'parent-goal-1');
      reportingService.receiveWorkerReport(workerReport2, 'qa-1', 'parent-goal-1');

      // Verify reports are stored
      const storedReports = reportingService.getWorkerReports('parent-goal-1');
      expect(storedReports).toHaveLength(2);

      // Step 3: TL aggregates and reports up
      const subtasks = [
        createTestTask({ id: 'subtask-1', status: 'completed', assignedSessionName: 'dev-1', artifacts: workerReport1.artifacts }),
        createTestTask({ id: 'subtask-2', status: 'completed', assignedSessionName: 'qa-1' }),
      ];

      const teamInfo = {
        teamId: 'team-fe',
        teamName: 'Frontend Team',
        memberId: 'tl-member-fe',
        memberName: 'FE Team Lead',
      };

      const aggregated = reportingService.aggregateAndReportUp(
        'parent-goal-1',
        subtasks,
        'Frontend auth flow complete. Login form + tests all passing.',
        'tl-fe',
        teamInfo
      );

      // Step 4: Verify the aggregated report
      expect(aggregated).not.toBeNull();
      expect(aggregated!.type).toBe('aggregated_report');
      expect(aggregated!.overallState).toBe('completed');
      expect(aggregated!.subtaskSummary.total).toBe(2);
      expect(aggregated!.subtaskSummary.completed).toBe(2);
      expect(aggregated!.qualityAssessment).toBe('pass');
      expect(aggregated!.keyArtifacts).toHaveLength(1);
      expect(aggregated!.keyArtifacts![0].name).toBe('LoginForm.tsx');

      // Step 5: Verify markdown serialization
      const md = reportingService.serializeAggregatedReport(aggregated!);
      expect(md).toContain('[AGGREGATED REPORT]');
      expect(md).toContain('Parent Task: parent-goal-1');
      expect(md).toContain('Overall Status: completed');

      // Step 6: Verify stored reports were cleaned up
      expect(reportingService.getWorkerReports('parent-goal-1')).toHaveLength(0);
    });
  });

  describe('Escalation: TL unavailable, Worker → Orchestrator directly', () => {
    it('should detect inactive TL and route worker escalation to orchestrator', () => {
      const members = createIntegrationHierarchy();
      const worker = members[2]; // Dev1

      // Make TL inactive (simulating session crash)
      members[1].agentStatus = 'inactive';

      // Step 1: Worker checks escalation conditions
      const check = escalationService.checkEscalationConditions(worker, members);
      expect(check.shouldEscalate).toBe(true);
      expect(check.reason).toBe('tl_inactive');
      expect(check.targetSession).toBe('crewly-orc');

      // Step 2: Worker handles the escalation
      const result = escalationService.handleTLUnresponsive(
        'tl-fe',
        worker,
        members,
        'task-login-form',
        'TL session is inactive, escalating login form task to orchestrator',
        { teamId: 'team-fe', teamName: 'Frontend Team' }
      );

      expect(result).not.toBeNull();
      expect(result!.escalation.reason).toBe('tl_unresponsive');
      expect(result!.escalation.originalAssignedTo).toBe('tl-member-fe');
      expect(result!.target.sessionName).toBe('crewly-orc');
    });
  });

  describe('EventBus new filter fields', () => {
    it('should filter task events by taskId', () => {
      // Subscribe to events for a specific task
      const sub = eventBus.subscribe({
        eventType: 'task:completed',
        filter: { taskId: 'task-123' },
        subscriberSession: 'crewly-orc',
        oneShot: false,
        ttlMinutes: 30,
      });

      expect(sub.filter.taskId).toBe('task-123');

      // Publish matching event
      const matchingEvent: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'task:completed',
        timestamp: new Date().toISOString(),
        teamId: 'team-1',
        teamName: 'FE Team',
        memberId: 'worker-1',
        memberName: 'Dev1',
        sessionName: 'dev-1',
        previousValue: 'working',
        newValue: 'completed',
        changedField: 'taskStatus',
        taskId: 'task-123',
      };

      eventBus.publish(matchingEvent);
      jest.advanceTimersByTime(6000); // flush debounce

      expect(mockQueueService.enqueue).toHaveBeenCalled();
    });

    it('should filter task events by hierarchyLevel', () => {
      eventBus.subscribe({
        eventType: 'task:completed',
        filter: { hierarchyLevel: 2 },
        subscriberSession: 'tl-session',
        oneShot: false,
        ttlMinutes: 30,
      });

      // Publish event from level 2 worker — should match
      const workerEvent: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'task:completed',
        timestamp: new Date().toISOString(),
        teamId: 'team-1',
        teamName: 'FE Team',
        memberId: 'worker-1',
        memberName: 'Dev1',
        sessionName: 'dev-1',
        previousValue: 'working',
        newValue: 'completed',
        changedField: 'taskStatus',
        hierarchyLevel: 2,
      };

      eventBus.publish(workerEvent);
      jest.advanceTimersByTime(6000);

      expect(mockQueueService.enqueue).toHaveBeenCalled();
    });

    it('should NOT match when hierarchyLevel does not match', () => {
      eventBus.subscribe({
        eventType: 'task:completed',
        filter: { hierarchyLevel: 1 },
        subscriberSession: 'orc-session',
        oneShot: false,
        ttlMinutes: 30,
      });

      // Publish event from level 2 — should NOT match level 1 filter
      const workerEvent: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'task:completed',
        timestamp: new Date().toISOString(),
        teamId: 'team-1',
        teamName: 'FE Team',
        memberId: 'worker-1',
        memberName: 'Dev1',
        sessionName: 'dev-1',
        previousValue: 'working',
        newValue: 'completed',
        changedField: 'taskStatus',
        hierarchyLevel: 2,
      };

      eventBus.publish(workerEvent);
      jest.advanceTimersByTime(6000);

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should filter by parentMemberId to get subordinate events', () => {
      eventBus.subscribe({
        eventType: 'task:completed',
        filter: { parentMemberId: 'tl-member-fe' },
        subscriberSession: 'tl-fe',
        oneShot: false,
        ttlMinutes: 30,
      });

      // Publish event from a worker with matching parent
      const workerEvent: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'task:completed',
        timestamp: new Date().toISOString(),
        teamId: 'team-1',
        teamName: 'FE Team',
        memberId: 'worker-1',
        memberName: 'Dev1',
        sessionName: 'dev-1',
        previousValue: 'working',
        newValue: 'completed',
        changedField: 'taskStatus',
        parentMemberId: 'tl-member-fe',
      };

      eventBus.publish(workerEvent);
      jest.advanceTimersByTime(6000);

      expect(mockQueueService.enqueue).toHaveBeenCalled();
    });

    it('should NOT match when parentMemberId does not match', () => {
      eventBus.subscribe({
        eventType: 'task:completed',
        filter: { parentMemberId: 'tl-member-be' },
        subscriberSession: 'tl-be',
        oneShot: false,
        ttlMinutes: 30,
      });

      // Publish event from a worker under different TL
      const workerEvent: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'task:completed',
        timestamp: new Date().toISOString(),
        teamId: 'team-1',
        teamName: 'FE Team',
        memberId: 'worker-1',
        memberName: 'Dev1',
        sessionName: 'dev-1',
        previousValue: 'working',
        newValue: 'completed',
        changedField: 'taskStatus',
        parentMemberId: 'tl-member-fe',
      };

      eventBus.publish(workerEvent);
      jest.advanceTimersByTime(6000);

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('Task event types work with EventBus', () => {
    it('should accept all new task event types for subscription', () => {
      const taskEventTypes = [
        'task:submitted',
        'task:accepted',
        'task:working',
        'task:input_required',
        'task:verification_requested',
        'task:completed',
        'task:failed',
        'task:cancelled',
      ] as const;

      for (const eventType of taskEventTypes) {
        const sub = eventBus.subscribe({
          eventType,
          filter: {},
          subscriberSession: 'crewly-orc',
          oneShot: true,
          ttlMinutes: 5,
        });
        expect(sub.id).toBeDefined();
        expect(sub.eventType).toBe(eventType);
      }
    });

    it('should accept hierarchy event types for subscription', () => {
      const hierEventTypes = [
        'hierarchy:escalation',
        'hierarchy:delegation',
        'hierarchy:report_up',
      ] as const;

      for (const eventType of hierEventTypes) {
        const sub = eventBus.subscribe({
          eventType,
          filter: {},
          subscriberSession: 'crewly-orc',
          oneShot: true,
          ttlMinutes: 5,
        });
        expect(sub.id).toBeDefined();
        expect(sub.eventType).toBe(eventType);
      }
    });
  });
});
