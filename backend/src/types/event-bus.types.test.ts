/**
 * Tests for Event Bus Types Module
 *
 * @module types/event-bus.test
 */

import {
  EVENT_TYPES,
  isValidEventType,
  isValidCreateSubscriptionInput,
} from './event-bus.types.js';
import type {
  EventType,
  CreateSubscriptionInput,
} from './event-bus.types.js';

describe('Event Bus Types', () => {
  describe('Constants', () => {
    it('should have correct event types', () => {
      expect(EVENT_TYPES).toEqual([
        'agent:status_changed',
        'agent:idle',
        'agent:busy',
        'agent:active',
        'agent:inactive',
      ]);
    });
  });

  describe('isValidEventType', () => {
    it('should return true for valid event types', () => {
      expect(isValidEventType('agent:status_changed')).toBe(true);
      expect(isValidEventType('agent:idle')).toBe(true);
      expect(isValidEventType('agent:busy')).toBe(true);
      expect(isValidEventType('agent:active')).toBe(true);
      expect(isValidEventType('agent:inactive')).toBe(true);
    });

    it('should return false for invalid event types', () => {
      expect(isValidEventType('agent:unknown')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType(null)).toBe(false);
      expect(isValidEventType(undefined)).toBe(false);
      expect(isValidEventType(123)).toBe(false);
      expect(isValidEventType('idle')).toBe(false);
    });
  });

  describe('isValidCreateSubscriptionInput', () => {
    const validInput: CreateSubscriptionInput = {
      eventType: 'agent:idle',
      filter: { sessionName: 'agent-joe' },
      subscriberSession: 'agentmux-orc',
    };

    it('should return true for valid input with single event type', () => {
      expect(isValidCreateSubscriptionInput(validInput)).toBe(true);
    });

    it('should return true for valid input with array of event types', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        eventType: ['agent:idle', 'agent:busy'],
      })).toBe(true);
    });

    it('should return true for valid input with all optional fields', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        oneShot: true,
        ttlMinutes: 60,
        messageTemplate: 'Agent {memberName} is now {newValue}',
      })).toBe(true);
    });

    it('should return false for null or non-object', () => {
      expect(isValidCreateSubscriptionInput(null)).toBe(false);
      expect(isValidCreateSubscriptionInput(undefined)).toBe(false);
      expect(isValidCreateSubscriptionInput('string')).toBe(false);
      expect(isValidCreateSubscriptionInput(123)).toBe(false);
    });

    it('should return false for invalid eventType', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        eventType: 'agent:unknown',
      })).toBe(false);
    });

    it('should return false for empty eventType array', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        eventType: [],
      })).toBe(false);
    });

    it('should return false for array with invalid event types', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        eventType: ['agent:idle', 'invalid'],
      })).toBe(false);
    });

    it('should return false for missing filter', () => {
      expect(isValidCreateSubscriptionInput({
        eventType: 'agent:idle',
        subscriberSession: 'orc',
      })).toBe(false);
    });

    it('should return false for non-object filter', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        filter: 'not-object',
      })).toBe(false);
    });

    it('should return false for empty subscriberSession', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        subscriberSession: '',
      })).toBe(false);
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        subscriberSession: '   ',
      })).toBe(false);
    });

    it('should return false for non-string subscriberSession', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        subscriberSession: 123,
      })).toBe(false);
    });

    it('should return false for invalid ttlMinutes', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        ttlMinutes: 0,
      })).toBe(false);
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        ttlMinutes: -5,
      })).toBe(false);
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        ttlMinutes: 'thirty',
      })).toBe(false);
    });

    it('should return false for non-boolean oneShot', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        oneShot: 'true',
      })).toBe(false);
    });

    it('should return false for non-string messageTemplate', () => {
      expect(isValidCreateSubscriptionInput({
        ...validInput,
        messageTemplate: 123,
      })).toBe(false);
    });
  });
});
