/**
 * Relay REST Controller
 *
 * Handles HTTP requests for both the WebSocket Relay server management
 * and the relay client lifecycle (connecting to a remote relay).
 *
 * Server-side endpoints:
 * - POST /relay/register — register a local instance as a relay node
 * - GET  /relay/status   — get relay server status and active sessions
 *
 * Client-side endpoints:
 * - POST /relay/connect    — connect to a remote relay server
 * - POST /relay/disconnect — disconnect from the relay server
 * - GET  /relay/devices    — list paired/connected devices
 * - POST /relay/send       — send a message to the paired peer
 *
 * @module controllers/cloud/relay.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { RelayServerService } from '../../services/cloud/relay-server.service.js';
import { RelayClientService } from '../../services/cloud/relay-client.service.js';
import { LoggerService } from '../../services/core/logger.service.js';
import { CLOUD_CONSTANTS } from '../../constants.js';
import type {
  RelayRegisterRequest,
  RelayRegisterResponse,
  RelayNodeRole,
  RelayClientConfig,
} from '../../services/cloud/relay.types.js';

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

// ---------------------------------------------------------------------------
// Client-side endpoints
// ---------------------------------------------------------------------------

/** Request body for POST /relay/connect. */
interface ConnectRelayRequestBody {
  wsUrl: string;
  pairingCode: string;
  role: 'orchestrator' | 'agent';
  token: string;
  sharedSecret: string;
}

/**
 * POST /relay/connect
 *
 * Connect the local Crewly instance to a remote relay server as a client.
 * Initiates WebSocket connection, registration, and waits for pairing.
 *
 * @param req - Request with body: { wsUrl, pairingCode, role, token, sharedSecret }
 * @param res - Response with connection status
 * @param next - Next function for error propagation
 */
export async function connectToRelay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { wsUrl, pairingCode, role, token, sharedSecret } = req.body as Partial<ConnectRelayRequestBody>;

    if (!wsUrl || !pairingCode || !role || !token || !sharedSecret) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: wsUrl, pairingCode, role, token, sharedSecret',
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

    const client = RelayClientService.getInstance();
    const currentState = client.getState();

    if (currentState !== 'disconnected' && currentState !== 'error') {
      res.status(409).json({
        success: false,
        error: `Relay client is already in "${currentState}" state. Disconnect first.`,
      });
      return;
    }

    const config: RelayClientConfig = { wsUrl, pairingCode, role, token, sharedSecret };
    client.connect(config);

    logger.info('Relay client connecting', { wsUrl, pairingCode, role });

    res.json({
      success: true,
      data: {
        state: client.getState(),
        message: 'Relay client connection initiated',
      },
    });
  } catch (error) {
    logger.error('Failed to connect relay client', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * POST /relay/disconnect
 *
 * Disconnect the local relay client from the remote relay server.
 * Closes the WebSocket cleanly and stops heartbeats and reconnection.
 *
 * @param req - Express request (no body required)
 * @param res - Response with disconnection confirmation
 * @param next - Next function for error propagation
 */
export async function disconnectFromRelay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = RelayClientService.getInstance();
    const previousState = client.getState();

    client.disconnect();

    logger.info('Relay client disconnected', { previousState });

    res.json({
      success: true,
      data: {
        previousState,
        state: client.getState(),
        message: 'Relay client disconnected',
      },
    });
  } catch (error) {
    logger.error('Failed to disconnect relay client', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /relay/devices
 *
 * List connected devices visible through the relay. Returns both the local
 * relay client state and the relay server sessions (if a local server is running).
 *
 * @param req - Express request (no params required)
 * @param res - Response with device list
 * @param next - Next function for error propagation
 */
export async function getRelayDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = RelayClientService.getInstance();
    const server = RelayServerService.getInstance();

    const clientInfo = {
      state: client.getState(),
      sessionId: client.getSessionId(),
    };

    const serverSessions = server.isRunning() ? server.getSessions() : [];

    res.json({
      success: true,
      data: {
        client: clientInfo,
        serverRunning: server.isRunning(),
        devices: serverSessions.map((session) => ({
          sessionId: session.sessionId,
          role: session.role,
          state: session.state,
          pairedWith: session.pairedWith,
          registeredAt: session.registeredAt,
          lastHeartbeatAt: session.lastHeartbeatAt,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get relay devices', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * POST /relay/send
 *
 * Send an encrypted message to the paired peer via the relay.
 * The message is encrypted locally using the shared secret before
 * being forwarded through the relay server.
 *
 * @param req - Request with body: { message }
 * @param res - Response with send confirmation
 * @param next - Next function for error propagation
 */
export async function sendRelayMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message } = req.body as { message?: string };

    if (typeof message !== 'string' || message.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or empty required parameter: message',
      });
      return;
    }

    const client = RelayClientService.getInstance();

    if (client.getState() !== 'paired') {
      res.status(409).json({
        success: false,
        error: `Cannot send — relay client is in "${client.getState()}" state, must be "paired".`,
      });
      return;
    }

    client.send(message);

    logger.info('Relay message sent', { messageLength: message.length });

    res.json({
      success: true,
      data: {
        sent: true,
        messageLength: message.length,
      },
    });
  } catch (error) {
    logger.error('Failed to send relay message', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
