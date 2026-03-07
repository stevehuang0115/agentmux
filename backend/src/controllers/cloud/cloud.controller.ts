/**
 * Cloud REST Controller
 *
 * Handles HTTP requests for CrewlyAI Cloud integration.
 * Provides endpoints for connecting, disconnecting, checking status,
 * and fetching premium templates from CrewlyAI Cloud.
 *
 * @module controllers/cloud/cloud.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { CloudClientService } from '../../services/cloud/cloud-client.service.js';
import { LoggerService } from '../../services/core/logger.service.js';
import { CLOUD_CONSTANTS } from '../../constants.js';

const logger = LoggerService.getInstance().createComponentLogger('CloudController');

/**
 * POST /api/cloud/connect
 *
 * Connect to CrewlyAI Cloud with the provided URL and authentication token.
 *
 * @param req - Request with body: { cloudUrl?, token }
 * @param res - Response returning { success, data: { tier } }
 * @param next - Next function for error propagation
 */
export async function connectToCloud(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cloudUrl, token } = req.body;

    if (!token) {
      res.status(400).json({ success: false, error: 'Missing required parameter: token' });
      return;
    }

    const resolvedUrl = cloudUrl || CLOUD_CONSTANTS.DEFAULT_CLOUD_URL;
    const client = CloudClientService.getInstance();
    const result = await client.connect(resolvedUrl, token);

    logger.info('Connected to CrewlyAI Cloud', { tier: result.tier });
    res.json({ success: true, data: { tier: result.tier } });
  } catch (error) {
    logger.error('Failed to connect to cloud', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error && error.message.includes('authentication failed')) {
      res.status(401).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/cloud/disconnect
 *
 * Disconnect from CrewlyAI Cloud and clear stored credentials.
 *
 * @param req - Express request (no body required)
 * @param res - Response returning { success: true }
 * @param next - Next function for error propagation
 */
export async function disconnectFromCloud(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = CloudClientService.getInstance();
    client.disconnect();

    logger.info('Disconnected from CrewlyAI Cloud');
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to disconnect from cloud', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/cloud/status
 *
 * Get the current CrewlyAI Cloud connection status and subscription tier.
 *
 * @param req - Express request (no params required)
 * @param res - Response returning { success, data: CloudStatus }
 * @param next - Next function for error propagation
 */
export async function getCloudStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = CloudClientService.getInstance();
    const status = client.getStatus();

    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get cloud status', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/cloud/templates
 *
 * Fetch available premium templates from CrewlyAI Cloud.
 * Requires an active cloud connection.
 *
 * @param req - Express request (no params required)
 * @param res - Response returning { success, data: CloudTemplateSummary[] }
 * @param next - Next function for error propagation
 */
export async function getCloudTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = CloudClientService.getInstance();

    if (!client.isConnected()) {
      res.status(403).json({
        success: false,
        error: 'Not connected to CrewlyAI Cloud. Connect via POST /api/cloud/connect first.',
      });
      return;
    }

    const templates = await client.getTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to fetch cloud templates', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
