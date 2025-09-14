import { TicketEditorService } from '../../services/index.js';
export async function createTicket(req, res) {
    try {
        const { projectId } = req.params;
        const ticketData = req.body;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const ticket = await svc.createTicket(ticketData);
        res.json({ success: true, data: ticket });
    }
    catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ success: false, error: 'Failed to create ticket' });
    }
}
export async function getTickets(req, res) {
    try {
        const { projectId } = req.params;
        const { status, assignedTo, priority } = req.query;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const filter = { status, assignedTo, priority };
        const tickets = await svc.getAllTickets(filter);
        res.json({ success: true, data: tickets });
    }
    catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tickets' });
    }
}
export async function getTicket(req, res) {
    try {
        const { projectId, ticketId } = req.params;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const ticket = await svc.getTicket(ticketId);
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }
        res.json({ success: true, data: ticket });
    }
    catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch ticket' });
    }
}
export async function updateTicket(req, res) {
    try {
        const { projectId, ticketId } = req.params;
        const updates = req.body;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const ticket = await svc.updateTicket(ticketId, updates);
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }
        res.json({ success: true, data: ticket });
    }
    catch (error) {
        console.error('Error updating ticket:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to update ticket' });
    }
}
export async function deleteTicket(req, res) {
    try {
        const { projectId, ticketId } = req.params;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const deleted = await svc.deleteTicket(ticketId);
        if (!deleted) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }
        res.json({ success: true, data: { deleted: true } });
    }
    catch (error) {
        console.error('Error deleting ticket:', error);
        res.status(500).json({ success: false, error: 'Failed to delete ticket' });
    }
}
export async function addSubtask(req, res) {
    try {
        const { projectId, ticketId } = req.params;
        const { title } = req.body;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const ticket = await svc.addSubtask(ticketId, title);
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket not found' });
            return;
        }
        res.json({ success: true, data: ticket });
    }
    catch (error) {
        console.error('Error adding subtask:', error);
        res.status(500).json({ success: false, error: 'Failed to add subtask' });
    }
}
export async function toggleSubtask(req, res) {
    try {
        const { projectId, ticketId, subtaskId } = req.params;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const ticket = await svc.toggleSubtask(ticketId, subtaskId);
        if (!ticket) {
            res.status(404).json({ success: false, error: 'Ticket or subtask not found' });
            return;
        }
        res.json({ success: true, data: ticket });
    }
    catch (error) {
        console.error('Error toggling subtask:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle subtask' });
    }
}
export async function createTicketTemplate(req, res) {
    try {
        const { projectId, templateName } = req.params;
        const templateData = req.body;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        await svc.createTicketTemplate(templateName, templateData);
        res.json({ success: true, data: { templateName, created: true } });
    }
    catch (error) {
        console.error('Error creating ticket template:', error);
        res.status(500).json({ success: false, error: 'Failed to create ticket template' });
    }
}
export async function getTicketTemplates(req, res) {
    try {
        const { projectId } = req.params;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const templates = await svc.getAllTemplates();
        res.json({ success: true, data: templates });
    }
    catch (error) {
        console.error('Error fetching ticket templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch ticket templates' });
    }
}
export async function getTicketTemplate(req, res) {
    try {
        const { projectId, templateName } = req.params;
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const svc = new TicketEditorService(project.path);
        const template = await svc.getTicketTemplate(templateName);
        if (!template) {
            res.status(404).json({ success: false, error: 'Template not found' });
            return;
        }
        res.json({ success: true, data: template });
    }
    catch (error) {
        console.error('Error fetching ticket template:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch ticket template' });
    }
}
//# sourceMappingURL=tickets.controller.js.map