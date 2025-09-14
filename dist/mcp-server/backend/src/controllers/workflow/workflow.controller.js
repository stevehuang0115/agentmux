import { WorkflowService } from '../../services/index.js';
export async function getWorkflowExecution(req, res) {
    try {
        const { executionId } = req.params;
        const workflowService = WorkflowService.getInstance();
        const execution = workflowService.getExecution(executionId);
        if (!execution) {
            res.status(404).json({ success: false, error: 'Workflow execution not found' });
            return;
        }
        res.json({ success: true, data: execution });
    }
    catch (error) {
        console.error('Error getting workflow execution:', error);
        res.status(500).json({ success: false, error: 'Failed to get workflow execution' });
    }
}
export async function getActiveWorkflows(req, res) {
    try {
        const workflowService = WorkflowService.getInstance();
        const executions = workflowService.getActiveExecutions();
        res.json({ success: true, data: executions });
    }
    catch (error) {
        console.error('Error getting active workflows:', error);
        res.status(500).json({ success: false, error: 'Failed to get active workflows' });
    }
}
export async function cancelWorkflowExecution(req, res) {
    try {
        const { executionId } = req.params;
        const workflowService = WorkflowService.getInstance();
        const result = await workflowService.cancelExecution(executionId);
        if (result)
            res.json({ success: true, message: 'Workflow execution cancelled successfully' });
        else
            res.status(404).json({ success: false, error: 'Workflow execution not found or cannot be cancelled' });
    }
    catch (error) {
        console.error('Error cancelling workflow execution:', error);
        res.status(500).json({ success: false, error: 'Failed to cancel workflow execution' });
    }
}
//# sourceMappingURL=workflow.controller.js.map