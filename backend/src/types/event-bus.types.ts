/**
 * Event Bus Types Module
 *
 * Type definitions for the agent event bus (pub/sub) system.
 * Agents publish lifecycle events (idle, busy, active, inactive),
 * and subscribers receive notifications when matching events occur.
 *
 * @module types/event-bus
 */

// =============================================================================
// Enums and Constants
// =============================================================================

/**
 * Valid agent lifecycle event types
 */
export const EVENT_TYPES = [
  'agent:status_changed',
  'agent:idle',
  'agent:busy',
  'agent:active',
  'agent:inactive',
  'agent:context_warning',
  'agent:context_critical',
] as const;

/**
 * An agent lifecycle event type
 */
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Fields that can trigger events when changed
 */
export type ChangedField = 'agentStatus' | 'workingStatus' | 'contextUsage';

// =============================================================================
// Event Interfaces
// =============================================================================

/**
 * An agent lifecycle event published to the event bus
 */
export interface AgentEvent {
  /** Unique event ID */
  id: string;

  /** Type of event */
  type: EventType;

  /** ISO timestamp when event occurred */
  timestamp: string;

  /** Team ID where the change occurred */
  teamId: string;

  /** Human-readable team name */
  teamName: string;

  /** Team member ID */
  memberId: string;

  /** Human-readable member name */
  memberName: string;

  /** PTY session name of the agent */
  sessionName: string;

  /** Previous field value */
  previousValue: string;

  /** New field value */
  newValue: string;

  /** Which field changed to trigger this event */
  changedField: ChangedField;
}

// =============================================================================
// Subscription Interfaces
// =============================================================================

/**
 * Filter criteria for matching events to subscriptions
 */
export interface EventFilter {
  /** Match events for a specific session name */
  sessionName?: string;

  /** Match events for a specific team member ID */
  memberId?: string;

  /** Match events for a specific team ID */
  teamId?: string;
}

/**
 * A stored event subscription
 */
export interface EventSubscription {
  /** Unique subscription ID */
  id: string;

  /** Event type(s) to subscribe to */
  eventType: EventType | EventType[];

  /** Filter criteria for matching events */
  filter: EventFilter;

  /** If true, subscription is removed after first match */
  oneShot: boolean;

  /** Session name of the subscriber (who receives notifications) */
  subscriberSession: string;

  /** ISO timestamp when subscription was created */
  createdAt: string;

  /** ISO timestamp when subscription expires (optional) */
  expiresAt?: string;

  /** Custom notification template with placeholders */
  messageTemplate?: string;
}

/**
 * Input for creating a new subscription
 */
export interface CreateSubscriptionInput {
  /** Event type(s) to subscribe to */
  eventType: EventType | EventType[];

  /** Filter criteria for matching events */
  filter: EventFilter;

  /** If true, subscription is removed after first match (default: true) */
  oneShot?: boolean;

  /** Time-to-live in minutes (default: 30) */
  ttlMinutes?: number;

  /** Session name of the subscriber */
  subscriberSession: string;

  /** Custom notification template with placeholders */
  messageTemplate?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid EventType
 *
 * @param value - Value to check
 * @returns True if value is a valid EventType
 */
export function isValidEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPES.includes(value as EventType);
}

/**
 * Check if an object is a valid CreateSubscriptionInput
 *
 * @param value - Value to check
 * @returns True if value is a valid CreateSubscriptionInput
 */
export function isValidCreateSubscriptionInput(value: unknown): value is CreateSubscriptionInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const input = value as Record<string, unknown>;

  // Validate eventType: single string or array of strings
  if (Array.isArray(input.eventType)) {
    if (input.eventType.length === 0) {
      return false;
    }
    if (!input.eventType.every((t: unknown) => isValidEventType(t))) {
      return false;
    }
  } else if (!isValidEventType(input.eventType)) {
    return false;
  }

  // Validate filter
  if (!input.filter || typeof input.filter !== 'object') {
    return false;
  }

  // Validate subscriberSession
  if (typeof input.subscriberSession !== 'string' || input.subscriberSession.trim().length === 0) {
    return false;
  }

  // Validate optional ttlMinutes
  if (input.ttlMinutes !== undefined) {
    if (typeof input.ttlMinutes !== 'number' || input.ttlMinutes <= 0) {
      return false;
    }
  }

  // Validate optional oneShot
  if (input.oneShot !== undefined && typeof input.oneShot !== 'boolean') {
    return false;
  }

  // Validate optional messageTemplate
  if (input.messageTemplate !== undefined && typeof input.messageTemplate !== 'string') {
    return false;
  }

  return true;
}
