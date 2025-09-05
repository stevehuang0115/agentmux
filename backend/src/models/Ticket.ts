import { Ticket } from '../types/index.js';

export class TicketModel implements Ticket {
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

  constructor(data: Partial<Ticket>) {
    this.id = data.id || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.status = data.status || 'open';
    this.assignedTo = data.assignedTo;
    this.priority = data.priority || 'medium';
    this.labels = data.labels || [];
    this.projectId = data.projectId || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  updateStatus(status: Ticket['status']): void {
    this.status = status;
    this.updatedAt = new Date().toISOString();
  }

  assign(teamId: string): void {
    this.assignedTo = teamId;
    if (this.status === 'open') {
      this.status = 'in_progress';
    }
    this.updatedAt = new Date().toISOString();
  }

  unassign(): void {
    this.assignedTo = undefined;
    if (this.status === 'in_progress') {
      this.status = 'open';
    }
    this.updatedAt = new Date().toISOString();
  }

  addLabel(label: string): void {
    if (!this.labels) {
      this.labels = [];
    }
    if (!this.labels.includes(label)) {
      this.labels.push(label);
    }
    this.updatedAt = new Date().toISOString();
  }

  removeLabel(label: string): void {
    if (this.labels) {
      this.labels = this.labels.filter(l => l !== label);
    }
    this.updatedAt = new Date().toISOString();
  }

  setPriority(priority: Ticket['priority']): void {
    this.priority = priority;
    this.updatedAt = new Date().toISOString();
  }

  toYAML(): string {
    const frontmatter = {
      id: this.id,
      title: this.title,
      status: this.status,
      assignedTo: this.assignedTo,
      priority: this.priority,
      labels: this.labels,
      projectId: this.projectId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    const yamlHeader = Object.entries(frontmatter)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
        }
        return `${key}: "${value}"`;
      })
      .join('\n');

    return `---\n${yamlHeader}\n---\n\n${this.description}`;
  }

  toJSON(): Ticket {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      assignedTo: this.assignedTo,
      priority: this.priority,
      labels: this.labels,
      projectId: this.projectId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: Ticket): TicketModel {
    return new TicketModel(data);
  }
}