import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { TicketEditorService } from '../../services/index.js';
import { ApiResponse } from '../../types/index.js';
import { LoggerService } from '../../services/core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('TicketsController');

export async function createTicket(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    const ticketData = req.body as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const ticket = await svc.createTicket(ticketData);
    res.json({ success: true, data: ticket } as ApiResponse);
  } catch (error) {
    logger.error('Error creating ticket', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to create ticket' } as ApiResponse);
  }
}

export async function getTickets(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    const { status, assignedTo, priority } = req.query as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const filter = { status, assignedTo, priority };
    const tickets = await svc.getAllTickets(filter);
    res.json({ success: true, data: tickets } as ApiResponse);
  } catch (error) {
    logger.error('Error fetching tickets', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to fetch tickets' } as ApiResponse);
  }
}

export async function getTicket(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, ticketId } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const ticket = await svc.getTicket(ticketId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' } as ApiResponse); return; }
    res.json({ success: true, data: ticket } as ApiResponse);
  } catch (error) {
    logger.error('Error fetching ticket', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to fetch ticket' } as ApiResponse);
  }
}

export async function updateTicket(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, ticketId } = req.params as any;
    const updates = req.body as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const ticket = await svc.updateTicket(ticketId, updates);
    if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' } as ApiResponse); return; }
    res.json({ success: true, data: ticket } as ApiResponse);
  } catch (error) {
    logger.error('Error updating ticket', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to update ticket' } as ApiResponse);
  }
}

export async function deleteTicket(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, ticketId } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const deleted = await svc.deleteTicket(ticketId);
    if (!deleted) { res.status(404).json({ success: false, error: 'Ticket not found' } as ApiResponse); return; }
    res.json({ success: true, data: { deleted: true } } as ApiResponse);
  } catch (error) {
    logger.error('Error deleting ticket', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to delete ticket' } as ApiResponse);
  }
}

export async function addSubtask(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, ticketId } = req.params as any;
    const { title } = req.body as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const ticket = await svc.addSubtask(ticketId, title);
    if (!ticket) { res.status(404).json({ success: false, error: 'Ticket not found' } as ApiResponse); return; }
    res.json({ success: true, data: ticket } as ApiResponse);
  } catch (error) {
    logger.error('Error adding subtask', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to add subtask' } as ApiResponse);
  }
}

export async function toggleSubtask(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, ticketId, subtaskId } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const ticket = await svc.toggleSubtask(ticketId, subtaskId);
    if (!ticket) { res.status(404).json({ success: false, error: 'Ticket or subtask not found' } as ApiResponse); return; }
    res.json({ success: true, data: ticket } as ApiResponse);
  } catch (error) {
    logger.error('Error toggling subtask', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to toggle subtask' } as ApiResponse);
  }
}

export async function createTicketTemplate(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, templateName } = req.params as any;
    const templateData = req.body as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    await svc.createTicketTemplate(templateName, templateData);
    res.json({ success: true, data: { templateName, created: true } } as ApiResponse);
  } catch (error) {
    logger.error('Error creating ticket template', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to create ticket template' } as ApiResponse);
  }
}

export async function getTicketTemplates(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const templates = await svc.getAllTemplates();
    res.json({ success: true, data: templates } as ApiResponse);
  } catch (error) {
    logger.error('Error fetching ticket templates', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to fetch ticket templates' } as ApiResponse);
  }
}

export async function getTicketTemplate(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId, templateName } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const svc = new TicketEditorService(project.path);
    const template = await svc.getTicketTemplate(templateName);
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' } as ApiResponse); return; }
    res.json({ success: true, data: template } as ApiResponse);
  } catch (error) {
    logger.error('Error fetching ticket template', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Failed to fetch ticket template' } as ApiResponse);
  }
}
