/**
 * Tests for AutoLearningSubscriber (LEARN-1, observability-only since #1345).
 *
 * Covers:
 *   - one structured transition line per mapped event (per category)
 *   - the templated summary content (entity, transition, resolver, mission/team, ts)
 *   - nothing is ever written through `recordLearning` (the templated
 *     transition is not a learning)
 *   - V1 idempotency: a replayed event produces a single line
 *   - skip path for events without an identifying key
 *   - error isolation: a throwing logger is contained
 *   - lifecycle: start/stop is idempotent; stop detaches all subscriptions
 *   - V7 / V9 self-checks: subscriber exports zero new event-class symbols
 *
 * @module services/memory/auto-learning.subscriber.test
 */

import { EventBusService } from '../event-bus/event-bus.service.js';
import {
  AutoLearningSubscriber,
  LEARN_SUBSCRIBED_EVENTS,
} from './auto-learning.subscriber.js';
import type { AutoLearningTag } from './auto-learning.subscriber.js';
import type { IMemoryService } from './memory.service.js';
import type { ComponentLogger } from '../core/logger.service.js';
import type { AgentEvent } from '../../types/event-bus.types.js';

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

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Build a real-shaped AgentEvent. Every test that exercises a handler uses
 * this so the Sam-rule "real shape, not a partial mock" holds.
 */
function buildEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    id: 'evt-1',
    type: 'task:verified',
    timestamp: '2026-04-27T13:00:00.000Z',
    teamId: 'team-product',
    teamName: 'Crewly Product',
    memberId: 'mem-leo',
    memberName: 'Leo',
    sessionName: 'crewly-product-leo-member-n',
    previousValue: 'running',
    newValue: 'verified',
    changedField: 'taskStatus',
    workItemId: 'wi-source-1',
    missionId: 'mission-1',
    ...overrides,
  };
}

/** A transition line as the subscriber logs it. */
interface TransitionLine {
  eventType: string;
  category: AutoLearningTag;
  key: string;
  relatedTask?: string;
  summary: string;
}

/**
 * Fake memory service: every method is a spy, so the tests can assert that
 * `recordLearning` is never called.
 */
function buildFakeMemoryService(): IMemoryService {
  return {
    remember: jest.fn(),
    recall: jest.fn(),
    getFullContext: jest.fn(),
    initializeForSession: jest.fn(),
    getAgentMemoryService: jest.fn(),
    getProjectMemoryService: jest.fn(),
    recordLearning: jest.fn(),
  } as unknown as IMemoryService;
}

/**
 * Fake component logger that captures `AutoLearning transition` lines and
 * can be made to throw once (error-isolation tests).
 */
function buildFakeLogger(): { logger: ComponentLogger; transitions: TransitionLine[]; errors: unknown[]; throwNext: () => void } {
  const transitions: TransitionLine[] = [];
  const errors: unknown[] = [];
  let shouldThrow = false;
  const logger = {
    info: jest.fn((message: string, meta?: Record<string, unknown>) => {
      if (message !== 'AutoLearning transition') return;
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error('simulated logger failure');
      }
      transitions.push(meta as unknown as TransitionLine);
    }),
    warn: jest.fn(),
    error: jest.fn((_message: string, meta?: Record<string, unknown>) => {
      errors.push(meta);
    }),
    debug: jest.fn(),
  } as unknown as ComponentLogger;
  return { logger, transitions, errors, throwNext: () => { shouldThrow = true; } };
}

/** Convenience: build a subscriber wired to the given fakes. */
function buildSubscriber(memoryService: IMemoryService, eventBus: EventBusService, logger: ComponentLogger, dedupCapacity = 100) {
  return new AutoLearningSubscriber({
    eventBus,
    memoryService,
    projectPath: '/fake/project',
    dedupCapacity,
    logger,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoLearningSubscriber', () => {
  let bus: EventBusService;
  let subscriber: AutoLearningSubscriber;
  let memory: IMemoryService;
  let log: ReturnType<typeof buildFakeLogger>;

  beforeEach(() => {
    bus = new EventBusService();
    memory = buildFakeMemoryService();
    log = buildFakeLogger();
    subscriber = buildSubscriber(memory, bus, log.logger);
    subscriber.start();
  });

  afterEach(() => {
    subscriber.stop();
    bus.cleanup();
  });

  // -------------------------------------------------------------------------
  // Subscription contract
  // -------------------------------------------------------------------------

  describe('subscription contract', () => {
    it('subscribes to exactly the five LEARN_SUBSCRIBED_EVENTS', () => {
      // Pinned by the closed-set rationale on LEARN_SUBSCRIBED_EVENTS (Arch
      // N1, 2026-04-27): this list is the canonical, closed set.
      expect(LEARN_SUBSCRIBED_EVENTS).toHaveLength(5);
      expect(LEARN_SUBSCRIBED_EVENTS).toEqual([
        'task:verified',
        'task:done',
        'task:rejected',
        'task:failed',
        'mission:replanned',
      ]);
    });

    it('start() is idempotent — calling twice does not double-subscribe', async () => {
      subscriber.start();
      bus.publish(buildEvent({ type: 'task:verified' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(1);
    });

    it('stop() detaches all subscriptions', async () => {
      subscriber.stop();
      bus.publish(buildEvent({ type: 'task:verified' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(0);
    });

    it('stop() is idempotent — calling twice does not throw', () => {
      subscriber.stop();
      expect(() => subscriber.stop()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Per-event category mapping
  // -------------------------------------------------------------------------

  describe('event → category mapping', () => {
    const cases: Array<{ type: AgentEvent['type']; tag: AutoLearningTag }> = [
      { type: 'task:verified', tag: 'pattern' },
      { type: 'task:done', tag: 'pattern' },
      { type: 'task:rejected', tag: 'gotcha' },
      { type: 'task:failed', tag: 'gotcha' },
      { type: 'mission:replanned', tag: 'sop_update' },
    ];

    it.each(cases)('$type → logs one transition tagged $tag', async ({ type, tag }) => {
      bus.publish(buildEvent({ id: `evt-${type}`, type, workItemId: `wi-${type}` }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(1);
      expect(log.transitions[0].category).toBe(tag);
      expect(log.transitions[0].eventType).toBe(type);
    });
  });

  // -------------------------------------------------------------------------
  // Observability only (#1345)
  // -------------------------------------------------------------------------

  describe('observability only (#1345)', () => {
    it('never writes the templated transition through recordLearning', async () => {
      for (const type of LEARN_SUBSCRIBED_EVENTS) {
        bus.publish(buildEvent({ id: `evt-${type}`, type, workItemId: `wi-${type}`, sessionName: `s-${type}` }));
      }
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(LEARN_SUBSCRIBED_EVENTS.length);
      expect(memory.recordLearning).not.toHaveBeenCalled();
      expect(memory.remember).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Templated summary content
  // -------------------------------------------------------------------------

  describe('templated summary', () => {
    it('includes WorkItem id, transition, team/mission/resolver, timestamp', async () => {
      bus.publish(
        buildEvent({
          type: 'task:rejected',
          workItemId: 'wi-42',
          previousValue: 'running',
          newValue: 'rejected',
          teamId: 'team-X',
          missionId: 'mission-Y',
          sessionName: 'crewly-product-leo',
          timestamp: '2026-04-27T14:30:00.000Z',
        }),
      );
      await subscriber.flushPending();

      const { summary, category } = log.transitions[0];
      expect(category).toBe('gotcha');
      expect(summary).toContain('[[WorkItem-wi-42]]');
      expect(summary).toContain('task:rejected');
      expect(summary).toContain('running→rejected');
      expect(summary).toContain('team=team-X');
      expect(summary).toContain('mission=mission-Y');
      expect(summary).toContain('resolver=crewly-product-leo');
      expect(summary).toContain('timestamp=2026-04-27T14:30:00.000Z');
    });

    it('uses Mission entity prefix and missionId for mission:replanned', async () => {
      bus.publish(
        buildEvent({
          type: 'mission:replanned',
          workItemId: undefined,
          missionId: 'mission-Z',
          newValue: 'replanned',
          previousValue: '',
        }),
      );
      await subscriber.flushPending();
      expect(log.transitions[0].category).toBe('sop_update');
      expect(log.transitions[0].summary).toContain('[[Mission-mission-Z]]');
    });

    it('carries workItemId as relatedTask for task:* events', async () => {
      bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-task-link' }));
      await subscriber.flushPending();
      expect(log.transitions[0].relatedTask).toBe('wi-task-link');
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency (Arch Veto V1)
  // -------------------------------------------------------------------------

  describe('idempotency (V1)', () => {
    it('replayed task event with same workItemId does NOT log twice', async () => {
      const event = buildEvent({ type: 'task:verified', id: 'evt-A', workItemId: 'wi-1' });
      bus.publish(event);
      bus.publish({ ...event, id: 'evt-A-replay' });
      await subscriber.flushPending();

      expect(log.transitions).toHaveLength(1);
      expect(subscriber.dedupSize).toBe(1);
    });

    it('different workItemIds in the same event type produce separate lines', async () => {
      // sessionName must vary or the EventBus's (type,sessionName) debounce
      // suppresses the second publish within the dedup window.
      bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-1', sessionName: 's-A' }));
      bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-2', sessionName: 's-B' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(2);
      expect(subscriber.dedupSize).toBe(2);
    });

    it('same workItemId in different event types produces separate lines', async () => {
      bus.publish(buildEvent({ type: 'task:done', workItemId: 'wi-1' }));
      bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-1' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(2);
    });

    it('mission:replanned dedupes on missionId + eventId, not just missionId', async () => {
      bus.publish(buildEvent({ type: 'mission:replanned', id: 'replan-1', missionId: 'mission-1', workItemId: undefined, sessionName: 's-A' }));
      bus.publish(buildEvent({ type: 'mission:replanned', id: 'replan-2', missionId: 'mission-1', workItemId: undefined, sessionName: 's-B' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(2);
    });

    it('LRU cap is respected — exceeding capacity evicts oldest keys', async () => {
      const tightLog = buildFakeLogger();
      const tightSub = buildSubscriber(memory, bus, tightLog.logger, 2);
      tightSub.start();
      try {
        subscriber.stop();
        bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-A', sessionName: 's-A' }));
        bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-B', sessionName: 's-B' }));
        bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-C', sessionName: 's-C' }));
        await tightSub.flushPending();
        expect(tightSub.dedupSize).toBe(2);
        // Replay 'A' — logged again because A was evicted from the cap=2 set.
        bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-A', sessionName: 's-D' }));
        await tightSub.flushPending();
        expect(tightLog.transitions).toHaveLength(4);
      } finally {
        tightSub.stop();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases — events that should NOT log
  // -------------------------------------------------------------------------

  describe('skip paths', () => {
    it('task event without workItemId/taskId is skipped', async () => {
      bus.publish(buildEvent({ type: 'task:verified', workItemId: undefined, taskId: undefined }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(0);
    });

    it('mission event without missionId is skipped', async () => {
      bus.publish(buildEvent({ type: 'mission:replanned', missionId: undefined, workItemId: undefined }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(0);
    });

    it('task event uses taskId fallback when workItemId is absent', async () => {
      bus.publish(buildEvent({ type: 'task:verified', workItemId: undefined, taskId: 'legacy-task-id' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(1);
      expect(log.transitions[0].relatedTask).toBe('legacy-task-id');
    });

    it('events the subscriber is not subscribed to do nothing', async () => {
      bus.publish(buildEvent({ type: 'task:submitted' }));
      await subscriber.flushPending();
      expect(log.transitions).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error isolation
  // -------------------------------------------------------------------------

  describe('error isolation', () => {
    it('a throwing handler is caught — does not throw to publisher', async () => {
      log.throwNext();
      expect(() => bus.publish(buildEvent({ type: 'task:verified' }))).not.toThrow();
      await subscriber.flushPending();
      // The dedup key was still added so a replay of the same event is suppressed.
      expect(subscriber.dedupSize).toBe(1);
      expect(log.errors).toHaveLength(1);
    });

    it('a throw on one event does not prevent later events from logging', async () => {
      log.throwNext();
      bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-1', sessionName: 's-A' }));
      bus.publish(buildEvent({ type: 'task:verified', workItemId: 'wi-2', sessionName: 's-B' }));
      await subscriber.flushPending();
      expect(log.transitions.map((t) => t.relatedTask)).toEqual(['wi-2']);
    });
  });

  // -------------------------------------------------------------------------
  // Veto self-checks (V7, V9)
  // -------------------------------------------------------------------------

  describe('Arch veto self-checks', () => {
    it('exports no new event-class symbol (V7) — only the subscriber + tag type', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('./auto-learning.subscriber.js') as Record<string, unknown>;
      const exported = Object.keys(mod).sort();
      expect(exported).toEqual(
        [
          'AUTO_LEARNING_AGENT_ID',
          'AUTO_LEARNING_AGENT_ROLE',
          'AutoLearningSubscriber',
          'DEDUP_LRU_CAPACITY',
          'LEARN_SUBSCRIBED_EVENTS',
        ].sort(),
      );
    });

    it('does not inject a new memory scope (V9) — touches neither remember nor recordLearning', async () => {
      bus.publish(buildEvent({ type: 'task:verified' }));
      await subscriber.flushPending();
      expect(memory.remember).not.toHaveBeenCalled();
      expect(memory.recordLearning).not.toHaveBeenCalled();
    });
  });
});
