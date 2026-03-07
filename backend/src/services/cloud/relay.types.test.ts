/**
 * Tests for Relay Types
 *
 * Validates type guards for relay wire protocol messages.
 *
 * @module services/cloud/relay.types.test
 */

import { isRelayMessageType, isRelayMessage } from './relay.types.js';
import type {
  RelayRegisterMessage,
  RelayRegisteredMessage,
  RelayPairedMessage,
  RelayDataMessage,
  RelayHeartbeatMessage,
  RelayHeartbeatAckMessage,
  RelayErrorMessage,
  RelayPeerDisconnectedMessage,
} from './relay.types.js';

// ---------------------------------------------------------------------------
// isRelayMessageType
// ---------------------------------------------------------------------------

describe('isRelayMessageType', () => {
  it('should return true for all valid message types', () => {
    const validTypes = [
      'register',
      'registered',
      'pair',
      'paired',
      'relay',
      'heartbeat',
      'heartbeat_ack',
      'error',
      'peer_disconnected',
    ];

    for (const type of validTypes) {
      expect(isRelayMessageType(type)).toBe(true);
    }
  });

  it('should return false for invalid strings', () => {
    expect(isRelayMessageType('unknown')).toBe(false);
    expect(isRelayMessageType('REGISTER')).toBe(false);
    expect(isRelayMessageType('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isRelayMessageType(42)).toBe(false);
    expect(isRelayMessageType(null)).toBe(false);
    expect(isRelayMessageType(undefined)).toBe(false);
    expect(isRelayMessageType({})).toBe(false);
    expect(isRelayMessageType(true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRelayMessage
// ---------------------------------------------------------------------------

describe('isRelayMessage', () => {
  describe('register message', () => {
    it('should validate a correct register message', () => {
      const msg: RelayRegisterMessage = {
        type: 'register',
        role: 'agent',
        pairingCode: 'abc-123',
        token: 'tok-xyz',
      };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should reject register message missing role', () => {
      expect(isRelayMessage({ type: 'register', pairingCode: 'abc', token: 'tok' })).toBe(false);
    });

    it('should reject register message missing pairingCode', () => {
      expect(isRelayMessage({ type: 'register', role: 'agent', token: 'tok' })).toBe(false);
    });

    it('should reject register message missing token', () => {
      expect(isRelayMessage({ type: 'register', role: 'agent', pairingCode: 'abc' })).toBe(false);
    });
  });

  describe('registered message', () => {
    it('should validate a correct registered message', () => {
      const msg: RelayRegisteredMessage = { type: 'registered', sessionId: 'sess-1' };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should reject registered message missing sessionId', () => {
      expect(isRelayMessage({ type: 'registered' })).toBe(false);
    });
  });

  describe('paired message', () => {
    it('should validate a correct paired message', () => {
      const msg: RelayPairedMessage = {
        type: 'paired',
        peerSessionId: 'peer-1',
        peerRole: 'orchestrator',
      };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should reject paired message missing peerSessionId', () => {
      expect(isRelayMessage({ type: 'paired', peerRole: 'agent' })).toBe(false);
    });

    it('should reject paired message missing peerRole', () => {
      expect(isRelayMessage({ type: 'paired', peerSessionId: 'p1' })).toBe(false);
    });
  });

  describe('relay message', () => {
    it('should validate a correct relay message', () => {
      const msg: RelayDataMessage = { type: 'relay', payload: 'base64data' };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should reject relay message missing payload', () => {
      expect(isRelayMessage({ type: 'relay' })).toBe(false);
    });
  });

  describe('heartbeat messages', () => {
    it('should validate heartbeat message', () => {
      const msg: RelayHeartbeatMessage = { type: 'heartbeat' };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should validate heartbeat_ack message', () => {
      const msg: RelayHeartbeatAckMessage = { type: 'heartbeat_ack' };
      expect(isRelayMessage(msg)).toBe(true);
    });
  });

  describe('error message', () => {
    it('should validate a correct error message', () => {
      const msg: RelayErrorMessage = {
        type: 'error',
        code: 'NOT_PAIRED',
        message: 'Not paired',
      };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should reject error message missing code', () => {
      expect(isRelayMessage({ type: 'error', message: 'fail' })).toBe(false);
    });

    it('should reject error message missing message', () => {
      expect(isRelayMessage({ type: 'error', code: 'ERR' })).toBe(false);
    });
  });

  describe('peer_disconnected message', () => {
    it('should validate a correct peer_disconnected message', () => {
      const msg: RelayPeerDisconnectedMessage = {
        type: 'peer_disconnected',
        peerSessionId: 'peer-1',
      };
      expect(isRelayMessage(msg)).toBe(true);
    });

    it('should reject peer_disconnected missing peerSessionId', () => {
      expect(isRelayMessage({ type: 'peer_disconnected' })).toBe(false);
    });
  });

  describe('invalid inputs', () => {
    it('should return false for null', () => {
      expect(isRelayMessage(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isRelayMessage(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isRelayMessage('string')).toBe(false);
      expect(isRelayMessage(42)).toBe(false);
    });

    it('should return false for objects with unknown type', () => {
      expect(isRelayMessage({ type: 'unknown_type' })).toBe(false);
    });

    it('should return false for empty objects', () => {
      expect(isRelayMessage({})).toBe(false);
    });
  });
});
