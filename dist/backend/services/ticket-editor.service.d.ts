import { Ticket, TicketFilter } from '../types/index.js';
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
export declare class TicketEditorService {
    private ticketsDir;
    constructor(projectPath?: string);
    ensureTicketsDirectory(): Promise<void>;
    createTicket(template: TicketTemplate): Promise<ExtendedTicket>;
    updateTicket(ticketId: string, updates: Partial<TicketTemplate>): Promise<ExtendedTicket>;
    getTicket(ticketId: string): Promise<ExtendedTicket | null>;
    getAllTickets(filter?: TicketFilter): Promise<ExtendedTicket[]>;
    deleteTicket(ticketId: string): Promise<boolean>;
    addSubtask(ticketId: string, subtaskTitle: string): Promise<ExtendedTicket | null>;
    toggleSubtask(ticketId: string, subtaskId: string): Promise<ExtendedTicket | null>;
    getTicketsByAssignee(assignedTo: string): Promise<ExtendedTicket[]>;
    getTicketsByStatus(status: string): Promise<ExtendedTicket[]>;
    getTicketsByPriority(priority: string): Promise<ExtendedTicket[]>;
    createTicketTemplate(name: string, template: TicketTemplate): Promise<void>;
    getTicketTemplate(name: string): Promise<TicketTemplate | null>;
    getAllTemplates(): Promise<string[]>;
}
//# sourceMappingURL=ticket-editor.service.d.ts.map