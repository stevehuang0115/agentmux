/**
 * Tests for Hierarchy Escalation Service
 *
 * Covers:
 * - Escalation condition checks (TL inactive, TL unresponsive, security)
 * - Parent routing along hierarchy chain
 * - TL unresponsive handling with event emission
 * - Escalation chain traversal
 * - TL response recording
 *
 * @module services/hierarchy/hierarchy-escalation.test
 */

import { HierarchyEscalationService } from './hierarchy-escalation.service.js';
import type { EscalationMessage } from './hierarchy-escalation.service.js';
import type { TeamMember } from '../../types/index.js';

// Mock EventBusService
const mockPublish = jest.fn();
const mockEventBus = {
  publish: mockPublish,
} as any;

/**
 * Create a test TeamMember with hierarchy fields.
 */
function createTestMember(overrides?: Partial<TeamMember>): TeamMember {
  return {
    id: 'member-1',
    name: 'Dev Worker',
    sessionName: 'dev-session-1',
    role: 'developer',
    systemPrompt: 'You are a developer',
    agentStatus: 'active',
    workingStatus: 'idle',
    runtimeType: 'claude-code',
    createdAt: '2026-03-06T10:00:00.000Z',
    updatedAt: '2026-03-06T10:00:00.000Z',
    hierarchyLevel: 2,
    parentMemberId: 'tl-member-1',
    canDelegate: false,
    ...overrides,
  };
}

/**
 * Create a standard 3-level hierarchy for testing.
 */
function createTestHierarchy(): TeamMember[] {
  return [
    createTestMember({
      id: 'orc-member',
      name: 'Orchestrator',
      sessionName: 'crewly-orc',
      role: 'orchestrator',
      hierarchyLevel: 0,
      parentMemberId: undefined,
      canDelegate: true,
      subordinateIds: ['tl-member-1'],
    }),
    createTestMember({
      id: 'tl-member-1',
      name: 'Frontend TL',
      sessionName: 'tl-fe-session',
      role: 'team-leader',
      hierarchyLevel: 1,
      parentMemberId: 'orc-member',
      canDelegate: true,
      subordinateIds: ['worker-1', 'worker-2'],
    }),
    createTestMember({
      id: 'worker-1',
      name: 'Dev1',
      sessionName: 'dev-1',
      role: 'developer',
      hierarchyLevel: 2,
      parentMemberId: 'tl-member-1',
      canDelegate: false,
    }),
    createTestMember({
      id: 'worker-2',
      name: 'Dev2',
      sessionName: 'dev-2',
      role: 'developer',
      hierarchyLevel: 2,
      parentMemberId: 'tl-member-1',
      canDelegate: false,
    }),
  ];
}

describe('HierarchyEscalationService', () => {
  let service: HierarchyEscalationService;

  beforeEach(() => {
    HierarchyEscalationService.clearInstance();
    service = HierarchyEscalationService.getInstance();
    service.setEventBus(mockEventBus);
    mockPublish.mockClear();
  });

  afterEach(() => {
    service.clearResponseRecords();
    HierarchyEscalationService.clearInstance();
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = HierarchyEscalationService.getInstance();
      const b = HierarchyEscalationService.getInstance();
      expect(a).toBe(b);
    });

    it('should return new instance after clearInstance', () => {
      const a = HierarchyEscalationService.getInstance();
      HierarchyEscalationService.clearInstance();
      const b = HierarchyEscalationService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('checkEscalationConditions', () => {
    it('should not escalate when TL is active and responsive', () => {
      const members = createTestHierarchy();
      const worker = members[2]; // worker-1

      const result = service.checkEscalationConditions(worker, members);
      expect(result.shouldEscalate).toBe(false);
    });

    it('should escalate when TL is inactive — route to orchestrator', () => {
      const members = createTestHierarchy();
      // Make TL inactive
      members[1].agentStatus = 'inactive';
      const worker = members[2]; // worker-1

      const result = service.checkEscalationConditions(worker, members);
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toBe('tl_inactive');
      expect(result.targetSession).toBe('crewly-orc');
      expect(result.targetMemberId).toBe('orc-member');
    });

    it('should escalate when TL is unresponsive — route to orchestrator', () => {
      jest.useFakeTimers();
      try {
        const members = createTestHierarchy();
        const worker = members[2]; // worker-1

        // Record a TL response at current fake time
        service.recordTLResponse('tl-fe-session');

        // Set timeout to 5000ms and advance time past it
        service.setUnresponsiveTimeout(5000);
        jest.advanceTimersByTime(6000);

        const result = service.checkEscalationConditions(worker, members);
        expect(result.shouldEscalate).toBe(true);
        expect(result.reason).toBe('tl_unresponsive');
        expect(result.targetSession).toBe('crewly-orc');
      } finally {
        jest.useRealTimers();
      }
    });

    it('should escalate for security-flagged tasks — route to root', () => {
      const members = createTestHierarchy();
      const worker = members[2]; // worker-1

      const result = service.checkEscalationConditions(worker, members, true);
      expect(result.shouldEscalate).toBe(true);
      expect(result.reason).toBe('security');
      expect(result.targetSession).toBe('crewly-orc');
    });

    it('should not escalate when worker has no parent', () => {
      const members = createTestHierarchy();
      const orc = members[0]; // orchestrator (no parent)

      const result = service.checkEscalationConditions(orc, members);
      expect(result.shouldEscalate).toBe(false);
    });

    it('should not consider TL unresponsive if no response has been recorded', () => {
      const members = createTestHierarchy();
      const worker = members[2];

      // No response ever recorded — TL just started, shouldn't escalate
      const result = service.checkEscalationConditions(worker, members);
      expect(result.shouldEscalate).toBe(false);
    });
  });

  describe('routeToParent', () => {
    it('should find parent of worker', () => {
      const members = createTestHierarchy();
      const worker = members[2]; // worker-1

      const parent = service.routeToParent(worker, members);
      expect(parent).not.toBeNull();
      expect(parent!.id).toBe('tl-member-1');
      expect(parent!.role).toBe('team-leader');
    });

    it('should find parent of TL (orchestrator)', () => {
      const members = createTestHierarchy();
      const tl = members[1]; // TL

      const parent = service.routeToParent(tl, members);
      expect(parent).not.toBeNull();
      expect(parent!.id).toBe('orc-member');
    });

    it('should return null for root member', () => {
      const members = createTestHierarchy();
      const orc = members[0]; // orchestrator

      const parent = service.routeToParent(orc, members);
      expect(parent).toBeNull();
    });
  });

  describe('handleTLUnresponsive', () => {
    it('should create escalation and route to orchestrator', () => {
      const members = createTestHierarchy();
      const worker = members[2]; // worker-1
      const teamInfo = { teamId: 'team-1', teamName: 'FE Team' };

      const result = service.handleTLUnresponsive(
        'tl-fe-session',
        worker,
        members,
        'task-001',
        'TL has not responded for 15 minutes',
        teamInfo
      );

      expect(result).not.toBeNull();
      expect(result!.escalation.type).toBe('escalation');
      expect(result!.escalation.reason).toBe('tl_unresponsive');
      expect(result!.escalation.taskId).toBe('task-001');
      expect(result!.escalation.originalAssignedTo).toBe('tl-member-1');
      expect(result!.escalation.escalatedBy).toBe('dev-1');
      expect(result!.target.id).toBe('orc-member');
    });

    it('should emit hierarchy:escalation event', () => {
      const members = createTestHierarchy();
      const worker = members[2];
      const teamInfo = { teamId: 'team-1', teamName: 'FE Team' };

      service.handleTLUnresponsive(
        'tl-fe-session',
        worker,
        members,
        'task-001',
        'TL unresponsive',
        teamInfo
      );

      expect(mockPublish).toHaveBeenCalledTimes(1);
      const event = mockPublish.mock.calls[0][0];
      expect(event.type).toBe('hierarchy:escalation');
      expect(event.taskId).toBe('task-001');
      expect(event.sessionName).toBe('dev-1');
      expect(event.previousValue).toBe('tl-fe-session');
      expect(event.newValue).toBe('crewly-orc');
    });

    it('should return null when TL session is not found', () => {
      const members = createTestHierarchy();
      const worker = members[2];

      const result = service.handleTLUnresponsive(
        'nonexistent-session',
        worker,
        members,
        'task-001',
        'Test'
      );

      expect(result).toBeNull();
    });

    it('should return null when TL has no parent', () => {
      // Create a flat hierarchy where TL is the root
      const members = [
        createTestMember({
          id: 'tl-root',
          name: 'Root TL',
          sessionName: 'tl-root-session',
          role: 'team-leader',
          hierarchyLevel: 0,
          parentMemberId: undefined,
        }),
        createTestMember({
          id: 'worker-1',
          name: 'Worker',
          sessionName: 'dev-1',
          parentMemberId: 'tl-root',
          hierarchyLevel: 1,
        }),
      ];

      const result = service.handleTLUnresponsive(
        'tl-root-session',
        members[1],
        members,
        'task-001',
        'Test'
      );

      expect(result).toBeNull();
    });
  });

  describe('getEscalationChain', () => {
    it('should return full chain from worker to root', () => {
      const members = createTestHierarchy();
      const worker = members[2]; // worker-1

      const chain = service.getEscalationChain(worker, members);
      expect(chain).toHaveLength(2);
      expect(chain[0].id).toBe('tl-member-1');    // immediate parent
      expect(chain[1].id).toBe('orc-member');      // grandparent (root)
    });

    it('should return single entry from TL to root', () => {
      const members = createTestHierarchy();
      const tl = members[1]; // TL

      const chain = service.getEscalationChain(tl, members);
      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe('orc-member');
    });

    it('should return empty chain for root member', () => {
      const members = createTestHierarchy();
      const orc = members[0]; // orchestrator

      const chain = service.getEscalationChain(orc, members);
      expect(chain).toHaveLength(0);
    });

    it('should handle broken parent chain gracefully', () => {
      const members = [
        createTestMember({
          id: 'worker-orphan',
          name: 'Orphan Worker',
          sessionName: 'orphan',
          parentMemberId: 'nonexistent-parent',
          hierarchyLevel: 2,
        }),
      ];

      const chain = service.getEscalationChain(members[0], members);
      expect(chain).toHaveLength(0);
    });
  });

  describe('recordTLResponse', () => {
    it('should record response and prevent unresponsive detection', () => {
      const members = createTestHierarchy();
      const worker = members[2];

      // Record very recent TL response
      service.recordTLResponse('tl-fe-session');

      const result = service.checkEscalationConditions(worker, members);
      expect(result.shouldEscalate).toBe(false);
    });

    it('should update response time on subsequent calls', () => {
      service.recordTLResponse('tl-session-1');
      service.recordTLResponse('tl-session-1');

      // Should not throw and should track latest
      const members = createTestHierarchy();
      const worker = members[2];
      const result = service.checkEscalationConditions(worker, members);
      expect(result.shouldEscalate).toBe(false);
    });
  });
});
