import { Ticket } from '../types/index.js';
export declare class TicketModel implements Ticket {
    id: string;
    title: string;
    description: string;
    status: 'open' | 'in_progress' | 'review' | 'done' | 'blocked';
    assignedTo?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    labels?: string[];
    projectId: string;
    createdAt: string;
    updatedAt: string;
    constructor(data: Partial<Ticket>);
    updateStatus(status: Ticket['status']): void;
    assign(teamId: string): void;
    unassign(): void;
    addLabel(label: string): void;
    removeLabel(label: string): void;
    setPriority(priority: Ticket['priority']): void;
    toYAML(): string;
    toJSON(): Ticket;
    static fromJSON(data: Ticket): TicketModel;
}
//# sourceMappingURL=Ticket.d.ts.map