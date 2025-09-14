import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ApiResponse } from '../../types/index.js';

export async function scheduleCheck(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { targetSession, minutes, message, isRecurring, intervalMinutes } = req.body as any;
    if (!targetSession || !minutes || !message) { res.status(400).json({ success: false, error: 'targetSession, minutes, and message are required' } as ApiResponse); return; }
    let checkId: string;
    if (isRecurring && intervalMinutes) checkId = this.schedulerService.scheduleRecurringCheck(targetSession, intervalMinutes, message);
    else checkId = this.schedulerService.scheduleCheck(targetSession, minutes, message);
    res.status(201).json({ success: true, data: { checkId }, message: 'Check-in scheduled successfully' } as ApiResponse<{ checkId: string }>);
  } catch (error) {
    console.error('Error scheduling check:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule check-in' } as ApiResponse);
  }
}

export async function getScheduledChecks(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { session } = req.query as any;
    const checks = session ? this.schedulerService.getChecksForSession(session) : this.schedulerService.listScheduledChecks();
    res.json({ success: true, data: checks } as ApiResponse);
  } catch (error) {
    console.error('Error getting scheduled checks:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve scheduled checks' } as ApiResponse);
  }
}

export async function cancelScheduledCheck(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    this.schedulerService.cancelCheck(id);
    res.json({ success: true, message: 'Check-in cancelled successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error cancelling check:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel check-in' } as ApiResponse);
  }
}
