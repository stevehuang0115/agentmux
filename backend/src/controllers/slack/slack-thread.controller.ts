/**
 * Slack Thread Controller
 *
 * HTTP endpoint for registering agent-to-thread associations.
 * Called by the MCP server after delegate_task to link an agent
 * session to the originating Slack thread.
 *
 * @module controllers/slack/slack-thread
 */

import { Request, Response } from 'express';
import { getTerminalGateway } from '../../websocket/terminal.gateway.js';
import { getSlackThreadStore } from '../../services/slack/slack-thread-store.service.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('SlackThreadController');

/**
 * Register an agent's association with the current active Slack thread.
 *
 * Checks the terminal gateway's active conversation ID — if it starts
 * with "slack-", parses the channelId and threadTs from it and registers
 * the agent in the thread store.
 *
 * @param req - Express request with body { agentSession, agentName }
 * @param res - Express response
 */
export async function registerAgentThread(req: Request, res: Response): Promise<void> {
  const { agentSession, agentName } = req.body;

  if (!agentSession) {
    res.status(400).json({ success: false, error: 'agentSession is required' });
    return;
  }

  const activeConvId = getTerminalGateway()?.getActiveConversationId();

  if (!activeConvId?.startsWith('slack-')) {
    res.json({ success: true, registered: false, reason: 'no active slack conversation' });
    return;
  }

  // Parse "slack-C0123456789:1707432600.000001"
  const slackPart = activeConvId.slice('slack-'.length);
  const colonIdx = slackPart.indexOf(':');
  if (colonIdx < 0) {
    res.json({ success: true, registered: false, reason: 'invalid conversation id format' });
    return;
  }

  const channelId = slackPart.slice(0, colonIdx);
  const threadTs = slackPart.slice(colonIdx + 1);

  const threadStore = getSlackThreadStore();
  if (!threadStore) {
    res.json({ success: true, registered: false, reason: 'thread store not initialized' });
    return;
  }

  try {
    await threadStore.registerAgent(agentSession, agentName || agentSession, channelId, threadTs);
    res.json({ success: true, registered: true, channelId, threadTs });
  } catch (error) {
    logger.error('Failed to register agent thread', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}
