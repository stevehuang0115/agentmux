import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { TaskService } from '../../services/index.js';
import { ApiResponse } from '../../types/index.js';

export async function getAllTasks(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    if (!projectId) { res.status(400).json({ success: false, error: 'Project ID is required' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TaskService(project.path);
    const tasks = await svc.getAllTasks();
    res.json({ success: true, data: tasks } as ApiResponse);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' } as ApiResponse);
  }
}

export async function getMilestones(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    if (!projectId) { res.status(400).json({ success: false, error: 'Project ID is required' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TaskService(project.path);
    const milestones = await svc.getMilestones();
    res.json({ success: true, data: milestones } as ApiResponse);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch milestones' } as ApiResponse);
  }
}

export async function getTasksByStatus(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, status } = req.params as any;
    if (!projectId) { res.status(400).json({ success: false, error: 'Project ID is required' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TaskService(project.path);
    const tasks = await svc.getTasksByStatus(status);
    res.json({ success: true, data: tasks } as ApiResponse);
  } catch (error) {
    console.error('Error fetching tasks by status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks by status' } as ApiResponse);
  }
}

export async function getTasksByMilestone(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, milestoneId } = req.params as any;
    if (!projectId) { res.status(400).json({ success: false, error: 'Project ID is required' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TaskService(project.path);
    const tasks = await svc.getTasksByMilestone(milestoneId);
    res.json({ success: true, data: tasks } as ApiResponse);
  } catch (error) {
    console.error('Error fetching tasks by milestone:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks by milestone' } as ApiResponse);
  }
}

export async function getProjectTasksStatus(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    if (!projectId) { res.status(400).json({ success: false, error: 'Project ID is required' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    // Reuse the existing TaskService
    const svc = new TaskService(project.path);
    const [all, milestones] = await Promise.all([
      svc.getAllTasks(),
      svc.getMilestones()
    ]);
    const byStatus = all.reduce((acc: any, t: any) => { acc[t.status] = (acc[t.status]||0)+1; return acc; }, {});
    res.json({ success: true, data: { totals: { all: all.length, ...byStatus }, milestones } } as ApiResponse);
  } catch (error) {
    console.error('Error getting project task status:', error);
    res.status(500).json({ success: false, error: 'Failed to get project task status' } as ApiResponse);
  }
}
