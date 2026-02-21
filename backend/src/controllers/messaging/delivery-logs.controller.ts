import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ApiResponse } from '../../types/index.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('DeliveryLogsController');

export async function getDeliveryLogs(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const logs = await this.storageService.getDeliveryLogs();
    res.json({ success: true, data: logs, message: 'Delivery logs retrieved successfully' } as ApiResponse);
  } catch (error) {
    logger.error('Error getting delivery logs', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to get delivery logs' } as ApiResponse);
  }
}

export async function clearDeliveryLogs(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    await this.storageService.clearDeliveryLogs();
    res.json({ success: true, message: 'Delivery logs cleared successfully' } as ApiResponse);
  } catch (error) {
    logger.error('Error clearing delivery logs', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to clear delivery logs' } as ApiResponse);
  }
}
