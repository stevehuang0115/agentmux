import { GitIntegrationService } from '../../services/index.js';
export async function getGitStatus(req, res) {
    try {
        const { projectId } = req.params;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const git = new GitIntegrationService(project.path);
        if (!await git.isGitRepository()) {
            res.status(400).json({ success: false, error: 'Not a git repository' });
            return;
        }
        const [status, stats, lastCommit] = await Promise.all([
            git.getGitStatus(),
            git.getRepositoryStats(),
            git.getLastCommitInfo(),
        ]);
        res.json({ success: true, data: { status, stats, lastCommit } });
    }
    catch (error) {
        console.error('Error getting git status:', error);
        res.status(500).json({ success: false, error: 'Failed to get git status' });
    }
}
export async function commitChanges(req, res) {
    try {
        const { projectId } = req.params;
        const { message, includeUntracked, dryRun } = req.body;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const git = new GitIntegrationService(project.path);
        if (!await git.isGitRepository()) {
            res.status(400).json({ success: false, error: 'Not a git repository' });
            return;
        }
        const result = await git.commit({ message, includeUntracked, dryRun });
        res.json({ success: true, data: result });
    }
    catch (error) {
        console.error('Error committing changes:', error);
        res.status(500).json({ success: false, error: 'Failed to commit changes' });
    }
}
export async function startAutoCommit(req, res) {
    try {
        const { projectId } = req.params;
        const { intervalMinutes } = req.body;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const git = new GitIntegrationService(project.path);
        if (!await git.isGitRepository()) {
            await git.initializeGitRepository();
        }
        await git.startAutoCommitTimer(intervalMinutes || 30);
        global.gitServices = global.gitServices || {};
        global.gitServices[projectId] = git;
        res.json({ success: true, data: { projectId, intervalMinutes: intervalMinutes || 30, started: true } });
    }
    catch (error) {
        console.error('Error starting auto-commit:', error);
        res.status(500).json({ success: false, error: 'Failed to start auto-commit' });
    }
}
export async function stopAutoCommit(req, res) {
    try {
        const { projectId } = req.params;
        const gitServices = global.gitServices || {};
        const git = gitServices[projectId];
        if (git) {
            git.stopAutoCommitTimer();
            delete gitServices[projectId];
        }
        res.json({ success: true, data: { projectId, stopped: true } });
    }
    catch (error) {
        console.error('Error stopping auto-commit:', error);
        res.status(500).json({ success: false, error: 'Failed to stop auto-commit' });
    }
}
export async function getCommitHistory(req, res) {
    try {
        const { projectId } = req.params;
        const { limit } = req.query;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const git = new GitIntegrationService(project.path);
        if (!await git.isGitRepository()) {
            res.status(400).json({ success: false, error: 'Not a git repository' });
            return;
        }
        const commits = await git.getCommitHistory(limit ? parseInt(limit) : 10);
        res.json({ success: true, data: { commits, projectId } });
    }
    catch (error) {
        console.error('Error getting commit history:', error);
        res.status(500).json({ success: false, error: 'Failed to get commit history' });
    }
}
export async function createBranch(req, res) {
    try {
        const { projectId } = req.params;
        const { branchName, switchTo } = req.body;
        if (!branchName) {
            res.status(400).json({ success: false, error: 'Branch name is required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const git = new GitIntegrationService(project.path);
        await git.createBranch(branchName, switchTo);
        res.json({ success: true, data: { projectId, branchName, switchedTo: switchTo || false } });
    }
    catch (error) {
        console.error('Error creating branch:', error);
        res.status(500).json({ success: false, error: 'Failed to create branch' });
    }
}
export async function createPullRequest(req, res) {
    try {
        const { projectId } = req.params;
        const { baseBranch, headBranch, title, description } = req.body;
        if (!baseBranch || !headBranch || !title) {
            res.status(400).json({ success: false, error: 'baseBranch, headBranch, and title are required' });
            return;
        }
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const git = new GitIntegrationService(project.path);
        const url = await git.createPullRequest({ title, description, sourceBranch: headBranch, targetBranch: baseBranch });
        res.json({ success: true, data: { projectId, pullRequestUrl: url } });
    }
    catch (error) {
        console.error('Error creating pull request:', error);
        res.status(500).json({ success: false, error: 'Failed to create pull request' });
    }
}
//# sourceMappingURL=git.controller.js.map