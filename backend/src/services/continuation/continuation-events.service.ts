/**
 * Continuation Event Emitter Service
 *
 * Centralized event emission for continuation detection.
 * Collects events from PTY sessions, activity monitoring, and heartbeat services,
 * normalizes them, and emits them for processing.
 *
 * @module services/continuation/continuation-events.service
 */

import { EventEmitter } from 'events';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
  ContinuationEvent,
  ContinuationTrigger,
  ContinuationEventMetadata,
  IContinuationEventEmitter,
} from '../../types/continuation.types.js';
import { CONTINUATION_CONSTANTS } from '../../constants.js';

/**
 * Interface for PTY session (minimal for event registration)
 */
interface PtySessionLike {
  name: string;
  onExit(callback: (exitCode: number) => void): void;
}

/**
 * Service that emits continuation events from various sources
 *
 * Features:
 * - Event debouncing to prevent rapid-fire events
 * - Event deduplication within a time window
 * - Integration with PTY sessions, activity monitor, and heartbeat service
 *
 * @example
 * ```typescript
 * const emitter = ContinuationEventEmitter.getInstance();
 *
 * emitter.on('continuation', (event) => {
 *   console.log(`Continuation event: ${event.trigger} for ${event.sessionName}`);
 * });
 *
 * // Register a PTY session
 * emitter.registerPtySession(ptySession, 'agent-001', '/path/to/project');
 * ```
 */
export class ContinuationEventEmitter extends EventEmitter implements IContinuationEventEmitter {
  private static instance: ContinuationEventEmitter | null = null;

  private readonly logger: ComponentLogger;
  private readonly pendingEvents: Map<string, NodeJS.Timeout> = new Map();
  private readonly recentEvents: Map<string, number> = new Map();
  private readonly registeredSessions: Set<string> = new Set();

  private readonly DEBOUNCE_MS: number;
  private readonly DEDUP_WINDOW_MS = 10000; // 10 seconds deduplication window

  /**
   * Creates a new ContinuationEventEmitter
   */
  private constructor() {
    super();
    this.logger = LoggerService.getInstance().createComponentLogger('ContinuationEventEmitter');
    this.DEBOUNCE_MS = CONTINUATION_CONSTANTS.EVENTS.DEBOUNCE_MS;

    // Clean up recent events periodically
    setInterval(() => this.cleanupRecentEvents(), 60000);
  }

  /**
   * Gets the singleton instance
   *
   * @returns The ContinuationEventEmitter instance
   */
  public static getInstance(): ContinuationEventEmitter {
    if (!ContinuationEventEmitter.instance) {
      ContinuationEventEmitter.instance = new ContinuationEventEmitter();
    }
    return ContinuationEventEmitter.instance;
  }

  /**
   * Clears the singleton instance (for testing)
   */
  public static clearInstance(): void {
    if (ContinuationEventEmitter.instance) {
      ContinuationEventEmitter.instance.removeAllListeners();
      ContinuationEventEmitter.instance.pendingEvents.forEach(timer => clearTimeout(timer));
      ContinuationEventEmitter.instance.pendingEvents.clear();
    }
    ContinuationEventEmitter.instance = null;
  }

  /**
   * Register a PTY session for exit event tracking
   *
   * @param session - PTY session to monitor
   * @param agentId - Agent identifier
   * @param projectPath - Project path
   */
  public registerPtySession(session: PtySessionLike, agentId: string, projectPath: string): void {
    if (this.registeredSessions.has(session.name)) {
      this.logger.debug('Session already registered', { sessionName: session.name });
      return;
    }

    this.registeredSessions.add(session.name);

    session.onExit((exitCode) => {
      this.logger.info('PTY session exited', { sessionName: session.name, exitCode });

      this.emitDebounced({
        trigger: 'pty_exit',
        sessionName: session.name,
        agentId,
        projectPath,
        timestamp: new Date().toISOString(),
        metadata: { exitCode },
      });
    });

    this.logger.debug('Registered PTY session for continuation events', {
      sessionName: session.name,
      agentId,
    });
  }

  /**
   * Unregister a session (call when session is destroyed)
   *
   * @param sessionName - Session name to unregister
   */
  public unregisterSession(sessionName: string): void {
    this.registeredSessions.delete(sessionName);

    // Clear any pending events for this session
    for (const key of this.pendingEvents.keys()) {
      if (key.startsWith(`${sessionName}-`)) {
        clearTimeout(this.pendingEvents.get(key)!);
        this.pendingEvents.delete(key);
      }
    }

    this.logger.debug('Unregistered session', { sessionName });
  }

  /**
   * Emit an activity idle event
   *
   * @param sessionName - Session that is idle
   * @param agentId - Agent identifier
   * @param projectPath - Project path
   * @param metadata - Additional metadata
   */
  public emitActivityIdle(
    sessionName: string,
    agentId: string,
    projectPath: string,
    metadata: Pick<ContinuationEventMetadata, 'lastOutput' | 'idleDuration' | 'idleCycles'>
  ): void {
    this.emitDebounced({
      trigger: 'activity_idle',
      sessionName,
      agentId,
      projectPath,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * Emit a heartbeat stale event
   *
   * @param sessionName - Session with stale heartbeat
   * @param agentId - Agent identifier
   * @param projectPath - Project path
   * @param lastHeartbeat - ISO timestamp of last heartbeat
   */
  public emitHeartbeatStale(
    sessionName: string,
    agentId: string,
    projectPath: string,
    lastHeartbeat: string
  ): void {
    this.emitDebounced({
      trigger: 'heartbeat_stale',
      sessionName,
      agentId,
      projectPath,
      timestamp: new Date().toISOString(),
      metadata: { lastHeartbeat },
    });
  }

  /**
   * Emit an explicit continuation request event
   *
   * @param sessionName - Session requesting continuation
   * @param agentId - Agent identifier
   * @param projectPath - Project path
   * @param reason - Reason for the request
   */
  public emitExplicitRequest(
    sessionName: string,
    agentId: string,
    projectPath: string,
    reason?: string
  ): void {
    this.emitDebounced({
      trigger: 'explicit_request',
      sessionName,
      agentId,
      projectPath,
      timestamp: new Date().toISOString(),
      metadata: { requestReason: reason },
    });
  }

  /**
   * Manually trigger a continuation event (bypasses debouncing)
   *
   * @param event - The continuation event to emit
   */
  public trigger(event: ContinuationEvent): void {
    if (this.isDuplicate(event)) {
      this.logger.debug('Skipping duplicate event', {
        sessionName: event.sessionName,
        trigger: event.trigger,
      });
      return;
    }

    this.markEventSent(event);
    this.logger.info('Emitting continuation event', {
      sessionName: event.sessionName,
      trigger: event.trigger,
    });
    this.emit('continuation', event);
  }

  /**
   * Emit an event with debouncing
   *
   * @param event - The continuation event to emit
   */
  private emitDebounced(event: ContinuationEvent): void {
    const key = this.getEventKey(event);

    // Check for duplicate
    if (this.isDuplicate(event)) {
      this.logger.debug('Skipping duplicate event (debounced)', {
        sessionName: event.sessionName,
        trigger: event.trigger,
      });
      return;
    }

    // Clear existing debounce timer
    if (this.pendingEvents.has(key)) {
      clearTimeout(this.pendingEvents.get(key)!);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.pendingEvents.delete(key);
      this.markEventSent(event);
      this.logger.info('Emitting debounced continuation event', {
        sessionName: event.sessionName,
        trigger: event.trigger,
      });
      this.emit('continuation', event);
    }, this.DEBOUNCE_MS);

    this.pendingEvents.set(key, timer);

    this.logger.debug('Scheduled continuation event', {
      sessionName: event.sessionName,
      trigger: event.trigger,
      debounceMs: this.DEBOUNCE_MS,
    });
  }

  /**
   * Get a unique key for an event (for debouncing)
   *
   * @param event - The continuation event
   * @returns Unique key string
   */
  private getEventKey(event: ContinuationEvent): string {
    return `${event.sessionName}-${event.trigger}`;
  }

  /**
   * Check if an event is a duplicate (sent recently)
   *
   * @param event - The continuation event
   * @returns True if duplicate
   */
  private isDuplicate(event: ContinuationEvent): boolean {
    const key = this.getEventKey(event);
    const lastSent = this.recentEvents.get(key);

    if (!lastSent) {
      return false;
    }

    return Date.now() - lastSent < this.DEDUP_WINDOW_MS;
  }

  /**
   * Mark an event as sent (for deduplication)
   *
   * @param event - The continuation event
   */
  private markEventSent(event: ContinuationEvent): void {
    const key = this.getEventKey(event);
    this.recentEvents.set(key, Date.now());
  }

  /**
   * Clean up old entries from recent events map
   */
  private cleanupRecentEvents(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, timestamp] of this.recentEvents.entries()) {
      if (now - timestamp > this.DEDUP_WINDOW_MS * 2) {
        this.recentEvents.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned up recent events', { count: cleaned });
    }
  }

  /**
   * Get number of pending events (for testing)
   *
   * @returns Number of pending events
   */
  public getPendingEventCount(): number {
    return this.pendingEvents.size;
  }

  /**
   * Get registered session names (for testing)
   *
   * @returns Set of registered session names
   */
  public getRegisteredSessions(): Set<string> {
    return new Set(this.registeredSessions);
  }
}
