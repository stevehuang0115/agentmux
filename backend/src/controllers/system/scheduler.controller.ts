import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ApiResponse } from '../../types/index.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('SchedulerController');

export async function scheduleCheck(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { targetSession, minutes, message, isRecurring, intervalMinutes, maxOccurrences } = req.body as any;
    if (!targetSession || !minutes || !message) { res.status(400).json({ success: false, error: 'targetSession, minutes, and message are required' } as ApiResponse); return; }
    let checkId: string;
    if (isRecurring && intervalMinutes) checkId = this.schedulerService.scheduleRecurringCheck(targetSession, intervalMinutes, message, 'progress-check', maxOccurrences);
    else checkId = this.schedulerService.scheduleCheck(targetSession, minutes, message);
    res.status(201).json({ success: true, data: { checkId }, message: 'Check-in scheduled successfully' } as ApiResponse<{ checkId: string }>);
  } catch (error) {
    logger.error('Error scheduling check', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to schedule check-in' } as ApiResponse);
  }
}

export async function getScheduledChecks(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { session } = req.query as any;
    const checks = session ? this.schedulerService.getChecksForSession(session) : this.schedulerService.listScheduledChecks();
    res.json({ success: true, data: checks } as ApiResponse);
  } catch (error) {
    logger.error('Error getting scheduled checks', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to retrieve scheduled checks' } as ApiResponse);
  }
}

export async function cancelScheduledCheck(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    this.schedulerService.cancelCheck(id);
    res.json({ success: true, message: 'Check-in cancelled successfully' } as ApiResponse);
  } catch (error) {
    logger.error('Error cancelling check', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to cancel check-in' } as ApiResponse);
  }
}

/**
 * Restores persisted scheduled checks (both recurring and one-time) after a restart.
 *
 * @param req - Request (no body required)
 * @param res - Response with restore counts
 */
export async function restoreScheduledChecks(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const recurringCount = await this.schedulerService.restoreRecurringChecks();
    const oneTimeCount = await this.schedulerService.restoreOneTimeChecks();
    res.json({
      success: true,
      data: { recurringRestored: recurringCount, oneTimeRestored: oneTimeCount },
      message: `Restored ${recurringCount} recurring and ${oneTimeCount} one-time checks`,
    } as ApiResponse<{ recurringRestored: number; oneTimeRestored: number }>);
  } catch (error) {
    logger.error('Error restoring scheduled checks', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to restore scheduled checks' } as ApiResponse);
  }
}
