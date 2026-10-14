import type { NextFunction, Request, Response } from 'express';
import { agentMessageDedupe } from './agent-message-dedupe.middleware.js';
import { resetAgentMessageDedupeForTesting } from '../utils/duplicate-creation.utils.js';

jest.mock('../services/core/logger.service.js', () => ({
  LoggerService: { getInstance: () => ({ createComponentLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) }) },
}));
jest.mock('../utils/agent-caller.utils.js', () => ({
  readAgentSessionHeader: (req: { headers: Record<string, string> }) => req.headers['x-agent-session'],
}));

const TEXT = 'Lyra, no Sam step needed: crewly-web auto-releases on merge';

function call(sender: string | undefined, body: Record<string, unknown>, target = 'lyra') {
  const req = { headers: sender ? { 'x-agent-session': sender } : {}, params: { sessionName: target }, body } as unknown as Request;
  const json = jest.fn();
  const res = { status: jest.fn().mockReturnThis(), json } as unknown as Response;
  const next = jest.fn() as NextFunction;
  agentMessageDedupe(req, res, next);
  return { json, next };
}

describe('agentMessageDedupe', () => {
  beforeEach(() => resetAgentMessageDedupeForTesting());

  it('lets the first message through and answers the identical resend as a duplicate', () => {
    expect(call('ella', { mode: 'message', data: TEXT }).next).toHaveBeenCalled();
    const second = call('ella', { mode: 'message', data: `${TEXT}\n[TRACE:tr-20261014-abcd1234]` });
    expect(second.next).not.toHaveBeenCalled();
    expect(second.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, duplicate: true, delivered: false }));
  });

  it('covers the deliver endpoint body too', () => {
    call('ella', { message: TEXT });
    expect(call('ella', { message: TEXT }).next).not.toHaveBeenCalled();
  });

  it('never touches owner writes (no agent header) or raw keystroke writes', () => {
    call(undefined, { mode: 'message', data: TEXT });
    expect(call(undefined, { mode: 'message', data: TEXT }).next).toHaveBeenCalled();
    call('ella', { data: TEXT });
    expect(call('ella', { data: TEXT }).next).toHaveBeenCalled();
  });
});
