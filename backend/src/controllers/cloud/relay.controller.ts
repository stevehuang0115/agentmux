/**
 * Relay REST Controller
 *
 * Handles HTTP requests for the WebSocket Relay registration and status.
 * Provides the REST API surface that clients hit before upgrading to
 * a WebSocket connection for the actual relay communication.
 *
 * Endpoints:
 * - POST /v1/relay/register — register a local instance as a relay node
 * - GET  /relay/status      — get relay server status and active sessions
 *
 * @module controllers/cloud/relay.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { RelayServerService } from '../../services/cloud/relay-server.service.js';
import { LoggerService } from '../../services/core/logger.service.js';
import { CLOUD_CONSTANTS } from '../../constants.js';
import type { RelayRegisterRequest, RelayRegisterResponse, RelayNodeRole } from '../../services/cloud/relay.types.js';

const logger = LoggerService.getInstance().createComponentLogger('RelayController');

/** Valid relay node roles for request validation. */
const VALID_ROLES: ReadonlySet<string> = new Set(['orchestrator', 'agent']);

/**
 * POST /relay/register
 *
 * Register a local Crewly instance as a relay node. Returns a session ID
 * and the WebSocket URL to connect to for relay communication.
 *
 * @param req - Request with body: { role, pairingCode }
 * @param res - Response returning RelayRegisterResponse
 * @param next - Next function for error propagation
 */
export async function registerRelayNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role, pairingCode } = req.body as Partial<RelayRegisterRequest>;

    if (!role || !pairingCode) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: role, pairingCode',
      });
      return;
    }

    if (!VALID_ROLES.has(role)) {
      res.status(400).json({
        success: false,
        error: `Invalid role: "${role}". Must be "orchestrator" or "agent".`,
      });
      return;
    }

    const relay = RelayServerService.getInstance();

    if (!relay.isRunning()) {
      res.status(503).json({
        success: false,
        error: 'Relay server is not running. Start it first.',
      });
      return;
    }

    // Build the WebSocket URL from the request
    const protocol = req.secure ? 'wss' : 'ws';
    const host = req.get('host') ?? 'localhost';
    const wsUrl = `${protocol}://${host}/relay`;

    // Generate a session ID (the actual WS registration happens on connect)
    const response: RelayRegisterResponse = {
      success: true,
      sessionId: `pending-${Date.now()}`,
      wsUrl,
    };

    logger.info('Relay node registration via REST', { role, pairingCode });
    res.json(response);
  } catch (error) {
    logger.error('Failed to register relay node', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /relay/status
 *
 * Get the current relay server status, including whether it's running,
 * the number of connected clients, and active session details.
 *
 * @param req - Express request (no params required)
 * @param res - Response returning relay status object
 * @param next - Next function for error propagation
 */
export async function getRelayStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const relay = RelayServerService.getInstance();

    res.json({
      success: true,
      data: {
        running: relay.isRunning(),
        clientCount: relay.getClientCount(),
        sessions: relay.getSessions(),
      },
    });
  } catch (error) {
    logger.error('Failed to get relay status', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
