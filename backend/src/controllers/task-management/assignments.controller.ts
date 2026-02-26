import { Request, Response } from 'express';
import type { ApiController } from '../api.controller.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('AssignmentsController');

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
    logger.error('Error fetching assignments', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
}

export async function updateAssignment(this: ApiController, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const { status } = req.body as any;
    if (status && ['todo', 'in-progress', 'review', 'done'].includes(status)) {
      const projects = await this.storageService.getProjects();
      const assignmentId = String(id ?? '');
      const project = projects.find(p => assignmentId === p.id || assignmentId.startsWith(`${p.id}-`));
      if (project) {
        let nextProjectStatus: string | null = null;
        if (status === 'in-progress') nextProjectStatus = 'active';
        else if (status === 'done') nextProjectStatus = 'completed';

        if (nextProjectStatus && project.status !== nextProjectStatus) {
          project.status = nextProjectStatus as any;
          await this.storageService.saveProject(project);
        }
      }
    }
    res.json({ success: true, message: 'Assignment updated successfully' });
  } catch (error) {
    logger.error('Error updating assignment', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
}
