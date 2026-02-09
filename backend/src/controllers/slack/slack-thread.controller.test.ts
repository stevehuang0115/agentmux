/**
 * Tests for Slack Thread Controller
 *
 * @module controllers/slack/slack-thread.controller.test
 */

import { Request, Response } from 'express';
import { registerAgentThread } from './slack-thread.controller.js';

// Mock terminal gateway
const mockGetActiveConversationId = jest.fn();
jest.mock('../../websocket/terminal.gateway.js', () => ({
  getTerminalGateway: () => ({
    getActiveConversationId: mockGetActiveConversationId,
  }),
}));

// Mock thread store
const mockRegisterAgent = jest.fn();
jest.mock('../../services/slack/slack-thread-store.service.js', () => ({
  getSlackThreadStore: () => ({
    registerAgent: mockRegisterAgent,
  }),
}));

describe('registerAgentThread', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = { body: {} };
    res = { json: jsonMock, status: statusMock };
    jest.clearAllMocks();
  });

  it('should return 400 if agentSession is missing', async () => {
    req.body = {};
    await registerAgentThread(req as Request, res as Response);
    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('should return registered=false when no active slack conversation', async () => {
    req.body = { agentSession: 'team-joe' };
    mockGetActiveConversationId.mockReturnValue('chat-conv-123');
    await registerAgentThread(req as Request, res as Response);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, registered: false })
    );
  });

  it('should return registered=false when conversation id is null', async () => {
    req.body = { agentSession: 'team-joe' };
    mockGetActiveConversationId.mockReturnValue(null);
    await registerAgentThread(req as Request, res as Response);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, registered: false })
    );
  });

  it('should parse slack conversation id and register agent', async () => {
    req.body = { agentSession: 'team-joe-abc', agentName: 'Joe' };
    mockGetActiveConversationId.mockReturnValue('slack-C0123456789:1707432600.000001');
    mockRegisterAgent.mockResolvedValue(undefined);

    await registerAgentThread(req as Request, res as Response);

    expect(mockRegisterAgent).toHaveBeenCalledWith(
      'team-joe-abc',
      'Joe',
      'C0123456789',
      '1707432600.000001'
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        registered: true,
        channelId: 'C0123456789',
        threadTs: '1707432600.000001',
      })
    );
  });

  it('should use agentSession as agentName when agentName not provided', async () => {
    req.body = { agentSession: 'team-joe-abc' };
    mockGetActiveConversationId.mockReturnValue('slack-C123:1707.001');
    mockRegisterAgent.mockResolvedValue(undefined);

    await registerAgentThread(req as Request, res as Response);

    expect(mockRegisterAgent).toHaveBeenCalledWith(
      'team-joe-abc',
      'team-joe-abc',
      'C123',
      '1707.001'
    );
  });

  it('should return registered=false for invalid format (no colon)', async () => {
    req.body = { agentSession: 'team-joe' };
    mockGetActiveConversationId.mockReturnValue('slack-C123');

    await registerAgentThread(req as Request, res as Response);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, registered: false })
    );
  });

  it('should return 500 when registerAgent throws', async () => {
    req.body = { agentSession: 'team-joe-abc', agentName: 'Joe' };
    mockGetActiveConversationId.mockReturnValue('slack-C123:1707.001');
    mockRegisterAgent.mockRejectedValue(new Error('disk full'));

    await registerAgentThread(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
