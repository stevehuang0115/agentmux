import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { Ticket, TicketFilter } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExtendedTicket extends Omit<Ticket, 'projectId'> {
  tags?: string[];
  subtasks: Subtask[];
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface TicketTemplate {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
  assignedTo?: string;
  tags?: string[];
  subtasks?: Array<{
    title: string;
    completed: boolean;
  }>;
  dueDate?: string;
  estimatedHours?: number;
}

export class TicketEditorService {
  private ticketsDir: string;

  constructor(projectPath?: string) {
    this.ticketsDir = projectPath 
      ? path.join(path.resolve(projectPath), '.agentmux', 'tasks')
      : path.join(process.cwd(), '.agentmux', 'tasks');
  }

  async ensureTicketsDirectory(): Promise<void> {
    if (!existsSync(this.ticketsDir)) {
      await fs.mkdir(this.ticketsDir, { recursive: true });
    }
  }

  async createTicket(template: TicketTemplate): Promise<ExtendedTicket> {
    await this.ensureTicketsDirectory();

    const ticket: ExtendedTicket = {
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

  async updateTicket(ticketId: string, updates: Partial<TicketTemplate>): Promise<ExtendedTicket> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const updatedTicket: ExtendedTicket = {
      ...ticket,
      ...(updates as any),
      updatedAt: new Date().toISOString()
    };

    const fileName = `${ticketId}.yaml`;
    const filePath = path.join(this.ticketsDir, fileName);
    
    const yamlContent = stringifyYAML(updatedTicket);

    await fs.writeFile(filePath, yamlContent, 'utf-8');
    return updatedTicket;
  }

  async getTicket(ticketId: string): Promise<ExtendedTicket | null> {
    const fileName = `${ticketId}.yaml`;
    const filePath = path.join(this.ticketsDir, fileName);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return parseYAML(content) as ExtendedTicket;
    } catch (error) {
      console.error(`Error reading ticket ${ticketId}:`, error);
      return null;
    }
  }

  async getAllTickets(filter?: TicketFilter): Promise<ExtendedTicket[]> {
    await this.ensureTicketsDirectory();

    if (!existsSync(this.ticketsDir)) {
      return [];
    }

    const files = await fs.readdir(this.ticketsDir);
    const yamlFiles = files.filter(file => file.endsWith('.yaml'));
    
    const tickets: ExtendedTicket[] = [];
    
    for (const file of yamlFiles) {
      const filePath = path.join(this.ticketsDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const ticket = parseYAML(content) as ExtendedTicket;
        
        // Apply filters
        if (filter) {
          if (filter.status && ticket.status !== filter.status) continue;
          if (filter.assignedTo && ticket.assignedTo !== filter.assignedTo) continue;
          if (filter.priority && ticket.priority !== filter.priority) continue;
        }
        
        tickets.push(ticket);
      } catch (error) {
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

  async deleteTicket(ticketId: string): Promise<boolean> {
    const fileName = `${ticketId}.yaml`;
    const filePath = path.join(this.ticketsDir, fileName);

    if (!existsSync(filePath)) {
      return false;
    }

    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting ticket ${ticketId}:`, error);
      return false;
    }
  }

  async addSubtask(ticketId: string, subtaskTitle: string): Promise<ExtendedTicket | null> {
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

    return await this.updateTicket(ticketId, ticket as any);
  }

  async toggleSubtask(ticketId: string, subtaskId: string): Promise<ExtendedTicket | null> {
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

    return await this.updateTicket(ticketId, ticket as any);
  }

  async getTicketsByAssignee(assignedTo: string): Promise<ExtendedTicket[]> {
    return await this.getAllTickets({ assignedTo });
  }

  async getTicketsByStatus(status: string): Promise<ExtendedTicket[]> {
    return await this.getAllTickets({ status });
  }

  async getTicketsByPriority(priority: string): Promise<ExtendedTicket[]> {
    return await this.getAllTickets({ priority });
  }

  // Template management
  async createTicketTemplate(name: string, template: TicketTemplate): Promise<void> {
    const templatesDir = path.join(this.ticketsDir, 'templates');
    if (!existsSync(templatesDir)) {
      await fs.mkdir(templatesDir, { recursive: true });
    }

    const templatePath = path.join(templatesDir, `${name}.yaml`);
    const yamlContent = stringifyYAML(template);

    await fs.writeFile(templatePath, yamlContent, 'utf-8');
  }

  async getTicketTemplate(name: string): Promise<TicketTemplate | null> {
    const templatesDir = path.join(this.ticketsDir, 'templates');
    const templatePath = path.join(templatesDir, `${name}.yaml`);

    if (!existsSync(templatePath)) {
      return null;
    }

    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      return parseYAML(content) as TicketTemplate;
    } catch (error) {
      console.error(`Error reading template ${name}:`, error);
      return null;
    }
  }

  async getAllTemplates(): Promise<string[]> {
    const templatesDir = path.join(this.ticketsDir, 'templates');
    
    if (!existsSync(templatesDir)) {
      return [];
    }

    const files = await fs.readdir(templatesDir);
    return files.filter(file => file.endsWith('.yaml')).map(file => file.replace('.yaml', ''));
  }
}