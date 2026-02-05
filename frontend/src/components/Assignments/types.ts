import { Project, Team } from '../../types';

export interface EnhancedTeamMember {
  teamId: string;
  teamName: string;
  memberId: string;
  memberName: string;
  role: string;
  sessionName: string;
  agentStatus: 'inactive' | 'starting' | 'started' | 'active' | 'activating';
  workingStatus: 'idle' | 'in_progress';
  lastActivityCheck: string;
  activityDetected: boolean;
  currentTask?: {
    id: string;
    taskName: string;
    taskFilePath: string;
    assignedAt: string;
    status: string;
  } | null;
  error?: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high';
  teamId: string;
  teamName: string;
  createdAt: string;
  dueDate?: string;
  tags: string[];
}

export interface OrchestratorCommand {
  id: string;
  command: string;
  timestamp: string;
  output?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface AssignmentFiltersProps {
  filterStatus: string;
  filterTeam: string;
  assignments: Assignment[];
  onStatusChange: (status: string) => void;
  onTeamChange: (team: string) => void;
}

export interface ViewToggleProps {
  viewMode: 'projects' | 'teams';
  assignedProjects: Project[];
  assignedTeams: Team[];
  onViewModeChange: (mode: 'projects' | 'teams') => void;
}

export interface ProjectCardProps {
  project: Project;
  teams: Team[];
  onMemberClick: (memberId: string, memberName: string, teamId: string) => void;
  onOrchestratorClick: () => void;
  onUnassignTeam: (teamId: string, teamName: string, projectId?: string) => void;
}

export interface TeamCardProps {
  team: Team;
  projects: Project[];
  onUnassignTeam: (teamId: string, teamName: string, projectId?: string) => void;
}

export interface EmptyStateProps {
  type: 'projects' | 'teams';
  icon: React.ComponentType<{ size?: number | string }>;
  title: string;
  description: string;
}

export interface AssignmentsListProps {
  viewMode: 'projects' | 'teams';
  assignedProjects: Project[];
  assignedTeams: Team[];
  teams: Team[];
  projects: Project[];
  onMemberClick: (memberId: string, memberName: string, teamId: string) => void;
  onOrchestratorClick: () => void;
  onUnassignTeam: (teamId: string, teamName: string, projectId?: string) => void;
}

export type AssignmentStatus = Assignment['status'];
export type AssignmentPriority = Assignment['priority'];