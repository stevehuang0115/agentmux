export async function getAssignments(req, res) {
    try {
        const projects = await this.storageService.getProjects();
        const teams = await this.storageService.getTeams();
        const assignments = [];
        for (const project of projects) {
            for (const teamId of Object.values(project.teams).flat()) {
                const team = teams.find(t => t.id === teamId);
                if (team) {
                    assignments.push({
                        id: `${project.id}-${teamId}`,
                        title: `${project.name} - ${team.name}`,
                        description: 'No description available',
                        status: project.status === 'active' ? 'in-progress' : 'todo',
                        assignedTo: team.members[0]?.name || 'Unassigned',
                        priority: 'medium',
                        teamId: team.id,
                        teamName: team.name,
                        createdAt: project.createdAt,
                        dueDate: undefined,
                        tags: [team.members[0]?.role || 'general']
                    });
                }
            }
        }
        res.json(assignments);
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
    }
}
export async function updateAssignment(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const [projectId] = String(id).split('-');
        if (status && ['todo', 'in-progress', 'review', 'done'].includes(status)) {
            const projects = await this.storageService.getProjects();
            const project = projects.find(p => p.id === projectId);
            if (project) {
                if (status === 'in-progress')
                    project.status = 'active';
                else if (status === 'done')
                    project.status = 'completed';
                await this.storageService.saveProject(project);
            }
        }
        res.json({ success: true, message: 'Assignment updated successfully' });
    }
    catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ success: false, error: 'Failed to update assignment' });
    }
}
//# sourceMappingURL=assignments.controller.js.map