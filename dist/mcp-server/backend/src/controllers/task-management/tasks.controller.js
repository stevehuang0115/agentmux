import { TaskService } from '../../services/index.js';
export async function getAllTasks(req, res) {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            res.status(400).json({ success: false, error: 'Project ID is required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TaskService(project.path);
        const tasks = await svc.getAllTasks();
        res.json({ success: true, data: tasks });
    }
    catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
    }
}
export async function getMilestones(req, res) {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            res.status(400).json({ success: false, error: 'Project ID is required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TaskService(project.path);
        const milestones = await svc.getMilestones();
        res.json({ success: true, data: milestones });
    }
    catch (error) {
        console.error('Error fetching milestones:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch milestones' });
    }
}
export async function getTasksByStatus(req, res) {
    try {
        const { projectId, status } = req.params;
        if (!projectId) {
            res.status(400).json({ success: false, error: 'Project ID is required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TaskService(project.path);
        const tasks = await svc.getTasksByStatus(status);
        res.json({ success: true, data: tasks });
    }
    catch (error) {
        console.error('Error fetching tasks by status:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tasks by status' });
    }
}
export async function getTasksByMilestone(req, res) {
    try {
        const { projectId, milestoneId } = req.params;
        if (!projectId) {
            res.status(400).json({ success: false, error: 'Project ID is required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TaskService(project.path);
        const tasks = await svc.getTasksByMilestone(milestoneId);
        res.json({ success: true, data: tasks });
    }
    catch (error) {
        console.error('Error fetching tasks by milestone:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tasks by milestone' });
    }
}
export async function getProjectTasksStatus(req, res) {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            res.status(400).json({ success: false, error: 'Project ID is required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        // Reuse the existing TaskService
        const svc = new TaskService(project.path);
        const [all, milestones] = await Promise.all([
            svc.getAllTasks(),
            svc.getMilestones()
        ]);
        const byStatus = all.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
        res.json({ success: true, data: { totals: { all: all.length, ...byStatus }, milestones } });
    }
    catch (error) {
        console.error('Error getting project task status:', error);
        res.status(500).json({ success: false, error: 'Failed to get project task status' });
    }
}
//# sourceMappingURL=tasks.controller.js.map