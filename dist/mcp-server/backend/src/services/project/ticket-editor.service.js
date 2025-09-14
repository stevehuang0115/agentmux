import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { v4 as uuidv4 } from 'uuid';
export class TicketEditorService {
    ticketsDir;
    constructor(projectPath) {
        this.ticketsDir = projectPath
            ? path.join(path.resolve(projectPath), '.agentmux', 'tasks')
            : path.join(process.cwd(), '.agentmux', 'tasks');
    }
    async ensureTicketsDirectory() {
        if (!existsSync(this.ticketsDir)) {
            await fs.mkdir(this.ticketsDir, { recursive: true });
        }
    }
    async createTicket(template) {
        await this.ensureTicketsDirectory();
        const ticket = {
            id: uuidv4(),
            title: template.title,
            description: template.description,
            status: template.status,
            priority: template.priority,
            assignedTo: template.assignedTo,
            tags: template.tags || [],
            subtasks: template.subtasks?.map(st => ({
                id: uuidv4(),
                title: st.title,
                completed: st.completed,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })) || [],
            dueDate: template.dueDate,
            estimatedHours: template.estimatedHours,
            actualHours: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const fileName = `${ticket.id}.yaml`;
        const filePath = path.join(this.ticketsDir, fileName);
        const yamlContent = stringifyYAML(ticket);
        await fs.writeFile(filePath, yamlContent, 'utf-8');
        return ticket;
    }
    async updateTicket(ticketId, updates) {
        const ticket = await this.getTicket(ticketId);
        if (!ticket) {
            throw new Error(`Ticket ${ticketId} not found`);
        }
        const updatedTicket = {
            ...ticket,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        const fileName = `${ticketId}.yaml`;
        const filePath = path.join(this.ticketsDir, fileName);
        const yamlContent = stringifyYAML(updatedTicket);
        await fs.writeFile(filePath, yamlContent, 'utf-8');
        return updatedTicket;
    }
    async getTicket(ticketId) {
        const fileName = `${ticketId}.yaml`;
        const filePath = path.join(this.ticketsDir, fileName);
        if (!existsSync(filePath)) {
            return null;
        }
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return parseYAML(content);
        }
        catch (error) {
            console.error(`Error reading ticket ${ticketId}:`, error);
            return null;
        }
    }
    async getAllTickets(filter) {
        await this.ensureTicketsDirectory();
        if (!existsSync(this.ticketsDir)) {
            return [];
        }
        const files = await fs.readdir(this.ticketsDir);
        const yamlFiles = files.filter(file => file.endsWith('.yaml'));
        const tickets = [];
        for (const file of yamlFiles) {
            const filePath = path.join(this.ticketsDir, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const ticket = parseYAML(content);
                // Apply filters
                if (filter) {
                    if (filter.status && ticket.status !== filter.status)
                        continue;
                    if (filter.assignedTo && ticket.assignedTo !== filter.assignedTo)
                        continue;
                    if (filter.priority && ticket.priority !== filter.priority)
                        continue;
                }
                tickets.push(ticket);
            }
            catch (error) {
                console.error(`Error reading ticket file ${file}:`, error);
            }
        }
        // Sort by priority and created date
        return tickets.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority] || 0;
            const bPriority = priorityOrder[b.priority] || 0;
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }
    async deleteTicket(ticketId) {
        const fileName = `${ticketId}.yaml`;
        const filePath = path.join(this.ticketsDir, fileName);
        if (!existsSync(filePath)) {
            return false;
        }
        try {
            await fs.unlink(filePath);
            return true;
        }
        catch (error) {
            console.error(`Error deleting ticket ${ticketId}:`, error);
            return false;
        }
    }
    async addSubtask(ticketId, subtaskTitle) {
        const ticket = await this.getTicket(ticketId);
        if (!ticket) {
            return null;
        }
        const newSubtask = {
            id: uuidv4(),
            title: subtaskTitle,
            completed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        ticket.subtasks.push(newSubtask);
        ticket.updatedAt = new Date().toISOString();
        return await this.updateTicket(ticketId, ticket);
    }
    async toggleSubtask(ticketId, subtaskId) {
        const ticket = await this.getTicket(ticketId);
        if (!ticket) {
            return null;
        }
        const subtask = ticket.subtasks.find(st => st.id === subtaskId);
        if (!subtask) {
            return null;
        }
        subtask.completed = !subtask.completed;
        subtask.updatedAt = new Date().toISOString();
        ticket.updatedAt = new Date().toISOString();
        return await this.updateTicket(ticketId, ticket);
    }
    async getTicketsByAssignee(assignedTo) {
        return await this.getAllTickets({ assignedTo });
    }
    async getTicketsByStatus(status) {
        return await this.getAllTickets({ status });
    }
    async getTicketsByPriority(priority) {
        return await this.getAllTickets({ priority });
    }
    // Template management
    async createTicketTemplate(name, template) {
        const templatesDir = path.join(this.ticketsDir, 'templates');
        if (!existsSync(templatesDir)) {
            await fs.mkdir(templatesDir, { recursive: true });
        }
        const templatePath = path.join(templatesDir, `${name}.yaml`);
        const yamlContent = stringifyYAML(template);
        await fs.writeFile(templatePath, yamlContent, 'utf-8');
    }
    async getTicketTemplate(name) {
        const templatesDir = path.join(this.ticketsDir, 'templates');
        const templatePath = path.join(templatesDir, `${name}.yaml`);
        if (!existsSync(templatePath)) {
            return null;
        }
        try {
            const content = await fs.readFile(templatePath, 'utf-8');
            return parseYAML(content);
        }
        catch (error) {
            console.error(`Error reading template ${name}:`, error);
            return null;
        }
    }
    async getAllTemplates() {
        const templatesDir = path.join(this.ticketsDir, 'templates');
        if (!existsSync(templatesDir)) {
            return [];
        }
        const files = await fs.readdir(templatesDir);
        return files.filter(file => file.endsWith('.yaml')).map(file => file.replace('.yaml', ''));
    }
}
//# sourceMappingURL=ticket-editor.service.js.map