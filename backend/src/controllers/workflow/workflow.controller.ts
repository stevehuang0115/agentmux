import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { WorkflowService } from '../../services/index.js';
import { ApiResponse } from '../../types/index.js';

export async function getWorkflowExecution(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { executionId } = req.params as any;
    const workflowService = WorkflowService.getInstance();
    const execution = workflowService.getExecution(executionId);
    if (!execution) { res.status(404).json({ success: false, error: 'Workflow execution not found' } as ApiResponse); return; }
    res.json({ success: true, data: execution } as ApiResponse);
  } catch (error) {
    console.error('Error getting workflow execution:', error);
    res.status(500).json({ success: false, error: 'Failed to get workflow execution' } as ApiResponse);
  }
}

export async function getActiveWorkflows(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const workflowService = WorkflowService.getInstance();
    const executions = workflowService.getActiveExecutions();
    res.json({ success: true, data: executions } as ApiResponse);
  } catch (error) {
    console.error('Error getting active workflows:', error);
    res.status(500).json({ success: false, error: 'Failed to get active workflows' } as ApiResponse);
  }
}

export async function cancelWorkflowExecution(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { executionId } = req.params as any;
    const workflowService = WorkflowService.getInstance();
    const result = await workflowService.cancelExecution(executionId);
    if (result) res.json({ success: true, message: 'Workflow execution cancelled successfully' } as ApiResponse);
    else res.status(404).json({ success: false, error: 'Workflow execution not found or cannot be cancelled' } as ApiResponse);
  } catch (error) {
    console.error('Error cancelling workflow execution:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel workflow execution' } as ApiResponse);
  }
}
