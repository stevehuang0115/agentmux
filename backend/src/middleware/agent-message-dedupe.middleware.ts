/**
 * Drops an agent's identical message to the same target resent within a few
 * minutes (93 such resends in 7 days, audit 2026-10-14) and tells the sender
 * it was a duplicate. Owner and harness writes are never touched.
 *
 * @module middleware/agent-message-dedupe
 */

import type { NextFunction, Request, Response } from 'express';
import { readAgentSessionHeader } from '../utils/agent-caller.utils.js';
import { stripTraceMarkers } from '../services/trace/trace-markers.js';
import { agentMessageRepeatOf, forgetAgentMessage } from '../utils/duplicate-creation.utils.js';
import { LoggerService } from '../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('AgentMessageDedupe');

/**
 * Express middleware for `/terminal/:sessionName/write|deliver`.
 *
 * @param req - Request
 * @param res - Response
 * @param next - Next handler
 */
export function agentMessageDedupe(req: Request, res: Response, next: NextFunction): void {
  try {
    const sender = readAgentSessionHeader(req);
    const target = req.params?.sessionName;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = typeof body.message === 'string' ? body.message : body.mode === 'message' && typeof body.data === 'string' ? body.data : null;
    if (sender && target && text && sender !== target) {
      const secondsAgo = agentMessageRepeatOf(sender, target, stripTraceMarkers(text));
      if (secondsAgo !== null) {
        logger.info('Duplicate agent message dropped', { sender, target, secondsAgo });
        res.status(200).json({
          success: true,
          duplicate: true,
          delivered: false,
          message: `Duplicate: you sent ${target} this exact message ${secondsAgo}s ago, so it was not sent again. Wait for their reply instead of repeating it.`,
        });
        return;
      }
      // Only a send that went through counts: a failed one may be retried.
      const clean = stripTraceMarkers(text);
      const json = res.json.bind(res);
      res.json = ((payload: unknown) => {
        const failed = res.statusCode >= 400 || (payload as { success?: unknown } | null)?.success === false;
        if (failed) forgetAgentMessage(sender, target, clean);
        return json(payload);
      }) as typeof res.json;
    }
  } catch {
    // Dedupe is best-effort: never block a message on its own failure.
  }
  next();
}
