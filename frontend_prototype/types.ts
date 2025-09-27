
export enum ProjectStatus {
  Running = 'Running',
  Paused = 'Paused',
  Completed = 'Completed',
  Blocked = 'Blocked',
}

export enum TeamMemberStatus {
    Started = 'Started',
    Stopped = 'Stopped',
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarUrl: string;
  assistantAvatarUrl: string;
  session: string;
  status: TeamMemberStatus;
}

export interface Team {
  id:string;
  name: string;
  description: string;
  status: string;
  members: TeamMember[];
  assignedProject: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: ProjectStatus;
  teams: Team[];
  dueDate?: string;
  completedDate?: string;
  path: string;
}

export enum MessageStatus {
    Delivered = 'Delivered',
    Failed = 'Failed',
}

export interface ScheduledMessage {
    id: string;
    name: string;
    targetType: 'Team' | 'Project';
    targetName: string;
    schedule: string;
    status: 'Active' | 'Completed';
    message: string;
}

export interface MessageLog {
    id: string;
    timestamp: string;
    message: string;
    target: string;
    status: MessageStatus;
}

export type Task = {
    id: string;
    title: string;
    priority: 'High' | 'Medium' | 'Low';
    assignee: string;
    status: 'Open' | 'In Progress' | 'Done' | 'Blocked';
    milestone: string;
    description: string;
    dependencies: { id: string; title: string; status: 'Done' | 'In Progress' | 'Open' }[];
}