import { Request, Response } from 'express';
import type { ApiController } from '../api.controller.js';

export async function getAssignments(this: ApiController, req: Request, res: Response): Promise<void> {
  try {
    const projects = await this.storageService.getProjects();
    const teams = await this.storageService.getTeams();
    const assignments: any[] = [];
    for (const project of projects) {
      for (const teamId of Object.values(project.teams).flat() as string[]) {
        const team = teams.find(t => t.id === teamId);
        if (team) {
          assignments.push({
            id: `${project.id}-${teamId}`,
            title: `${project.name} - ${team.name}`,
            description: 'No description available',
            status: project.status === 'active' ? 'in-progress' : 'todo',
            assignedTo: team.members[0]?.name || 'Unassigned',
            priority: 'medium' as const,
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
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
}

export async function updateAssignment(this: ApiController, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const { status } = req.body as any;
    const [projectId] = String(id).split('-');
    if (status && ['todo', 'in-progress', 'review', 'done'].includes(status)) {
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (project) {
        if (status === 'in-progress') project.status = 'active';
        else if (status === 'done') project.status = 'completed';
        await this.storageService.saveProject(project);
      }
    }
    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
}

