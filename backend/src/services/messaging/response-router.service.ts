/**
 * Response Router Service
 *
 * Routes orchestrator responses back to the correct source.
 * - Web chat: no-op (existing TerminalGateway -> ChatGateway -> WebSocket pipeline handles it)
 * - Slack: resolves the blocking promise via the slackResolve callback
 *
 * @module services/messaging/response-router
 */

import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import type { QueuedMessage } from '../../types/messaging.types.js';

/**
 * ResponseRouterService routes orchestrator responses to the appropriate
 * destination based on the message source.
 *
 * @example
 * ```typescript
 * const router = new ResponseRouterService();
 * router.routeResponse(completedMessage, 'Here is the response');
 * ```
 */
export class ResponseRouterService {
  private logger: ComponentLogger;

  constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('ResponseRouter');
  }

  /**
   * Route a response to the appropriate destination based on message source.
   *
   * @param message - The completed/failed QueuedMessage
   * @param response - The response content from the orchestrator
   */
  routeResponse(message: QueuedMessage, response: string): void {
    switch (message.source) {
      case 'web_chat':
        this.routeToWebChat(message, response);
        break;
      case 'slack':
        this.routeToSlack(message, response);
        break;
      case 'system_event':
        this.logger.debug('System event response routed (no-op)', {
          messageId: message.id,
        });
        break;
      default:
        this.logger.warn('Unknown message source for routing', {
          messageId: message.id,
          source: message.source,
        });
    }
  }

  /**
   * Route response to web chat.
   * This is a no-op because the existing TerminalGateway -> ChatGateway ->
   * WebSocket pipeline already broadcasts responses to connected clients.
   *
   * @param message - The completed QueuedMessage
   * @param response - The response content
   */
  private routeToWebChat(message: QueuedMessage, response: string): void {
    this.logger.debug('Web chat response routed (via existing WebSocket pipeline)', {
      messageId: message.id,
      conversationId: message.conversationId,
      responseLength: response.length,
    });
  }

  /**
   * Route response to Slack by calling the slackResolve callback.
   * This unblocks the Slack bridge's promise that is waiting for a response.
   *
   * @param message - The completed QueuedMessage
   * @param response - The response content
   */
  private routeToSlack(message: QueuedMessage, response: string): void {
    const slackResolve = message.sourceMetadata?.slackResolve;

    if (typeof slackResolve === 'function') {
      try {
        slackResolve(response);
        this.logger.debug('Slack response resolved', {
          messageId: message.id,
          conversationId: message.conversationId,
          responseLength: response.length,
        });
      } catch (error) {
        this.logger.error('Failed to resolve Slack response', {
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      this.logger.warn('Slack message has no slackResolve callback', {
        messageId: message.id,
        conversationId: message.conversationId,
      });
    }
  }

  /**
   * Route an error to the appropriate destination.
   *
   * @param message - The failed QueuedMessage
   * @param error - The error message
   */
  routeError(message: QueuedMessage, error: string): void {
    switch (message.source) {
      case 'web_chat':
        this.logger.debug('Web chat error routed (via existing pipeline)', {
          messageId: message.id,
          error,
        });
        break;
      case 'slack': {
        const slackResolve = message.sourceMetadata?.slackResolve;
        if (typeof slackResolve === 'function') {
          slackResolve(`Error: ${error}`);
        }
        break;
      }
      case 'system_event':
        this.logger.debug('System event error routed (no-op)', {
          messageId: message.id,
          error,
        });
        break;
      default:
        this.logger.warn('Unknown message source for error routing', {
          messageId: message.id,
          source: message.source,
        });
    }
  }
}
