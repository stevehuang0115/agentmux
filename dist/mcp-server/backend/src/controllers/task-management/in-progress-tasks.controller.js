import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import * as os from 'os';
/**
 * Gets in-progress tasks data from ~/.agentmux/in_progress_tasks.json
 *
 * @param req - Request
 * @param res - Response with in-progress tasks data
 */
export async function getInProgressTasks(req, res) {
    try {
        const taskTrackingPath = join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
        // Check if file exists
        if (!existsSync(taskTrackingPath)) {
            res.json({
                success: true,
                tasks: [],
                lastUpdated: new Date().toISOString(),
                version: '1.0.0'
            });
            return;
        }
        // Read and parse the file
        const content = await readFile(taskTrackingPath, 'utf-8');
        const data = JSON.parse(content);
        res.json({
            success: true,
            ...data
        });
    }
    catch (error) {
        console.error('Error reading in-progress tasks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to read in-progress tasks data',
            tasks: [],
            lastUpdated: new Date().toISOString(),
            version: '1.0.0'
        });
    }
}
//# sourceMappingURL=in-progress-tasks.controller.js.map