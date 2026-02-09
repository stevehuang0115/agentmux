/**
 * Event Bus Service
 *
 * Central pub/sub service for agent lifecycle events. Agents publish events
 * (idle, busy, active, inactive) and subscribers receive notifications when
 * matching events occur. Notifications are delivered via the MessageQueueService
 * to the orchestrator terminal.
 *
 * @module services/event-bus/event-bus
 */

import { EventEmitter } from 'events';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { EVENT_BUS_CONSTANTS } from '../../constants.js';
import type { MessageQueueService } from '../messaging/message-queue.service.js';
import type { SlackThreadStoreService } from '../slack/slack-thread-store.service.js';
import type {
  AgentEvent,
  EventType,
  EventFilter,
  EventSubscription,
  CreateSubscriptionInput,
} from '../../types/event-bus.types.js';
import { isValidCreateSubscriptionInput } from '../../types/event-bus.types.js';

/**
 * EventBusService manages event subscriptions and publishes agent lifecycle
 * events. When an event matches a subscription, a notification message is
 * enqueued into the MessageQueueService for delivery to the subscriber.
 *
 * @example
 * ```typescript
 * const eventBus = new EventBusService();
 * eventBus.setMessageQueueService(queueService);
 *
 * eventBus.subscribe({
 *   eventType: 'agent:idle',
 *   filter: { sessionName: 'agent-joe' },
 *   subscriberSession: 'agentmux-orc',
 *   oneShot: true,
 * });
 *
 * eventBus.publish(agentIdleEvent);
 * ```
 */
export class EventBusService extends EventEmitter {
  private logger: ComponentLogger;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private messageQueueService: MessageQueueService | null = null;
  private slackThreadStore: SlackThreadStoreService | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private deliveryCount = 0;

  constructor() {
    super();
    this.logger = LoggerService.getInstance().createComponentLogger('EventBus');
    this.startCleanup();
  }

  /**
   * Set the MessageQueueService instance for delivering notifications.
   *
   * @param service - The MessageQueueService instance
   */
  setMessageQueueService(service: MessageQueueService): void {
    this.messageQueueService = service;
  }

  /**
   * Set the SlackThreadStoreService for enriching notifications with thread paths.
   *
   * @param store - The SlackThreadStoreService instance
   */
  setSlackThreadStore(store: SlackThreadStoreService): void {
    this.slackThreadStore = store;
  }

  /**
   * Create a new event subscription.
   *
   * @param input - Subscription configuration
   * @returns The created EventSubscription
   * @throws Error if input is invalid or limits are exceeded
   */
  subscribe(input: CreateSubscriptionInput): EventSubscription {
    if (!isValidCreateSubscriptionInput(input)) {
      throw new Error('Invalid subscription input');
    }

    // Check per-session limit
    const sessionCount = this.getSubscriptionCountForSession(input.subscriberSession);
    if (sessionCount >= EVENT_BUS_CONSTANTS.MAX_SUBSCRIPTIONS_PER_SESSION) {
      throw new Error(
        `Subscription limit reached for session ${input.subscriberSession} (max ${EVENT_BUS_CONSTANTS.MAX_SUBSCRIPTIONS_PER_SESSION})`
      );
    }

    // Check total limit
    if (this.subscriptions.size >= EVENT_BUS_CONSTANTS.MAX_TOTAL_SUBSCRIPTIONS) {
      throw new Error(
        `Total subscription limit reached (max ${EVENT_BUS_CONSTANTS.MAX_TOTAL_SUBSCRIPTIONS})`
      );
    }

    const ttlMinutes = Math.min(
      input.ttlMinutes ?? EVENT_BUS_CONSTANTS.DEFAULT_SUBSCRIPTION_TTL_MINUTES,
      EVENT_BUS_CONSTANTS.MAX_SUBSCRIPTION_TTL_MINUTES
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const subscription: EventSubscription = {
      id: crypto.randomUUID(),
      eventType: input.eventType,
      filter: input.filter,
      oneShot: input.oneShot ?? true,
      subscriberSession: input.subscriberSession,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      messageTemplate: input.messageTemplate,
    };

    this.subscriptions.set(subscription.id, subscription);

    this.logger.info('Subscription created', {
      subscriptionId: subscription.id,
      eventType: subscription.eventType,
      subscriber: subscription.subscriberSession,
      oneShot: subscription.oneShot,
      ttlMinutes,
    });

    return subscription;
  }

  /**
   * Remove a subscription by ID.
   *
   * @param subscriptionId - ID of the subscription to remove
   * @returns True if the subscription was found and removed
   */
  unsubscribe(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    if (removed) {
      this.logger.info('Subscription removed', { subscriptionId });
    }
    return removed;
  }

  /**
   * Publish an event to all matching subscriptions.
   * For each match, formats a notification message and enqueues it
   * into the MessageQueueService for delivery to the subscriber.
   *
   * @param event - The agent lifecycle event to publish
   */
  publish(event: AgentEvent): void {
    this.logger.info('Event published', {
      eventId: event.id,
      type: event.type,
      sessionName: event.sessionName,
      changedField: event.changedField,
      previousValue: event.previousValue,
      newValue: event.newValue,
    });

    const toRemove: string[] = [];

    for (const [id, sub] of this.subscriptions) {
      // Check expiration
      if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
        toRemove.push(id);
        continue;
      }

      if (!this.matchesSubscription(event, sub)) {
        continue;
      }

      // Format and deliver notification
      const message = this.formatNotification(event, sub);
      this.deliverNotification(sub, message);
      this.deliveryCount++;

      this.emit('event_delivered', {
        subscriptionId: sub.id,
        eventId: event.id,
        eventType: event.type,
      });

      if (sub.oneShot) {
        toRemove.push(id);
      }
    }

    // Clean up one-shot and expired subscriptions
    for (const id of toRemove) {
      this.subscriptions.delete(id);
    }
  }

  /**
   * List subscriptions, optionally filtered by subscriber session.
   *
   * @param subscriberSession - Optional session name to filter by
   * @returns Array of matching subscriptions
   */
  listSubscriptions(subscriberSession?: string): EventSubscription[] {
    const all = Array.from(this.subscriptions.values());
    if (subscriberSession) {
      return all.filter((sub) => sub.subscriberSession === subscriberSession);
    }
    return all;
  }

  /**
   * Get a specific subscription by ID.
   *
   * @param subscriptionId - ID of the subscription
   * @returns The subscription or undefined
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Get event bus statistics.
   *
   * @returns Stats object with subscription and delivery counts
   */
  getStats(): { subscriptionCount: number; deliveryCount: number } {
    return {
      subscriptionCount: this.subscriptions.size,
      deliveryCount: this.deliveryCount,
    };
  }

  /**
   * Stop the cleanup timer and clear all subscriptions.
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.subscriptions.clear();
    this.logger.info('EventBusService cleaned up');
  }

  /**
   * Check if an event matches a subscription's type and filter criteria.
   *
   * @param event - The event to check
   * @param sub - The subscription to match against
   * @returns True if the event matches the subscription
   */
  private matchesSubscription(event: AgentEvent, sub: EventSubscription): boolean {
    // Match event type
    const types = Array.isArray(sub.eventType) ? sub.eventType : [sub.eventType];
    if (!types.includes(event.type)) {
      return false;
    }

    // Match filter criteria
    const { filter } = sub;
    if (filter.sessionName && filter.sessionName !== event.sessionName) {
      return false;
    }
    if (filter.memberId && filter.memberId !== event.memberId) {
      return false;
    }
    if (filter.teamId && filter.teamId !== event.teamId) {
      return false;
    }

    return true;
  }

  /**
   * Format a notification message for an event and subscription.
   *
   * @param event - The event that triggered the notification
   * @param sub - The subscription that matched
   * @returns Formatted notification message string
   */
  private formatNotification(event: AgentEvent, sub: EventSubscription): string {
    if (sub.messageTemplate) {
      return sub.messageTemplate
        .replace(/\{memberName\}/g, event.memberName)
        .replace(/\{sessionName\}/g, event.sessionName)
        .replace(/\{eventType\}/g, event.type)
        .replace(/\{previousValue\}/g, event.previousValue)
        .replace(/\{newValue\}/g, event.newValue)
        .replace(/\{teamName\}/g, event.teamName)
        .replace(/\{teamId\}/g, event.teamId)
        .replace(/\{memberId\}/g, event.memberId);
    }

    const prefix = `[${EVENT_BUS_CONSTANTS.EVENT_MESSAGE_PREFIX}:${sub.id}:${event.type}]`;
    let baseMessage = `${prefix} Agent "${event.memberName}" (session: ${event.sessionName}) is now ${event.newValue} (was: ${event.previousValue}). Team: ${event.teamName}.`;

    // Enrich with Slack thread file paths so orchestrator can route notifications
    if (this.slackThreadStore) {
      const threads = this.slackThreadStore.findThreadsForAgent(event.sessionName);
      if (threads.length > 0) {
        baseMessage += ` [Slack thread files: ${threads.map((t) => t.filePath).join(', ')}]`;
      }
    }

    return baseMessage;
  }

  /**
   * Deliver a notification message to the subscriber via the message queue.
   *
   * @param sub - The subscription whose subscriber should receive the message
   * @param message - The formatted notification message
   */
  private deliverNotification(sub: EventSubscription, message: string): void {
    if (!this.messageQueueService) {
      this.logger.warn('MessageQueueService not set, cannot deliver event notification', {
        subscriptionId: sub.id,
      });
      return;
    }

    try {
      this.messageQueueService.enqueue({
        content: message,
        conversationId: 'system',
        source: 'system_event',
      });

      this.logger.debug('Event notification enqueued', {
        subscriptionId: sub.id,
        subscriber: sub.subscriberSession,
      });
    } catch (error) {
      this.logger.error('Failed to enqueue event notification', {
        subscriptionId: sub.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the number of subscriptions for a given subscriber session.
   *
   * @param subscriberSession - Session name to count
   * @returns Number of subscriptions
   */
  private getSubscriptionCountForSession(subscriberSession: string): number {
    let count = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.subscriberSession === subscriberSession) {
        count++;
      }
    }
    return count;
  }

  /**
   * Start the periodic cleanup timer to remove expired subscriptions.
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, EVENT_BUS_CONSTANTS.CLEANUP_INTERVAL);
  }

  /**
   * Remove all expired subscriptions.
   */
  private cleanupExpired(): void {
    const now = new Date();
    let removed = 0;

    for (const [id, sub] of this.subscriptions) {
      if (sub.expiresAt && new Date(sub.expiresAt) < now) {
        this.subscriptions.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug('Cleaned up expired subscriptions', { removed });
    }
  }
}
