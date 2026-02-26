/**
 * SlackMessengerAdapter Tests
 *
 * Tests for the Slack messenger adapter which delegates to the
 * existing SlackService.
 *
 * @module slack-messenger-adapter.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockSendMessage = jest.fn();
const mockIsConnected = jest.fn();
const mockGetStatus = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('../../slack/slack.service.js', () => ({
  getSlackService: jest.fn(() => ({
    isConnected: mockIsConnected,
    sendMessage: mockSendMessage,
    getStatus: mockGetStatus,
    disconnect: mockDisconnect,
  })),
}));

import { SlackMessengerAdapter } from './slack-messenger.adapter.js';

describe('SlackMessengerAdapter', () => {
  let adapter: SlackMessengerAdapter;

  beforeEach(() => {
    adapter = new SlackMessengerAdapter();
    jest.clearAllMocks();
  });

  it('should have platform set to slack', () => {
    expect(adapter.platform).toBe('slack');
  });

  describe('initialize', () => {
    it('should resolve without error (no-op)', async () => {
      await expect(adapter.initialize({})).resolves.toBeUndefined();
    });
  });

  describe('sendMessage', () => {
    it('should throw when Slack is not connected', async () => {
      mockIsConnected.mockReturnValue(false);
      await expect(adapter.sendMessage('ch', 'hello')).rejects.toThrow('Slack is not connected');
    });

    it('should delegate to SlackService when connected', async () => {
      mockIsConnected.mockReturnValue(true);
      mockSendMessage.mockResolvedValue(undefined as never);
      await adapter.sendMessage('channel-1', 'text', { threadTs: 'ts-1' });
      expect(mockSendMessage).toHaveBeenCalledWith({
        channelId: 'channel-1',
        text: 'text',
        threadTs: 'ts-1',
      });
    });

    it('should pass undefined threadTs when not provided', async () => {
      mockIsConnected.mockReturnValue(true);
      mockSendMessage.mockResolvedValue(undefined as never);
      await adapter.sendMessage('ch', 'msg');
      expect(mockSendMessage).toHaveBeenCalledWith({
        channelId: 'ch',
        text: 'msg',
        threadTs: undefined,
      });
    });
  });

  describe('getStatus', () => {
    it('should return status from SlackService', () => {
      mockIsConnected.mockReturnValue(true);
      mockGetStatus.mockReturnValue({ connected: true, teamId: 'T123' });
      const status = adapter.getStatus();
      expect(status.connected).toBe(true);
      expect(status.platform).toBe('slack');
    });
  });

  describe('disconnect', () => {
    it('should delegate disconnect to SlackService', async () => {
      mockDisconnect.mockResolvedValue(undefined as never);
      await adapter.disconnect();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
