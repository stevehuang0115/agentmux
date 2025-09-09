import { Team, TeamMember, Project } from '@/types';

// Dashboard-specific types
export interface DashboardState {
  teams: Team[];
  selectedProject: Project | null;
  selectedMember: TeamMember | null;
  loading: boolean;
  activeTab: 'overview' | 'teams' | 'terminal';
}

// Component prop interfaces
export interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export interface DashboardHeaderProps {
  connected: boolean;
  selectedProject: Project | null;
  teamsCount: number;
}

export interface DashboardNavigationProps {
  activeTab: 'overview' | 'teams' | 'terminal';
  onTabChange: (tab: 'overview' | 'teams' | 'terminal') => void;
}

export interface ProjectInfoPanelProps {
  project: Project;
  teamsCount: number;
  totalMembers: number;
}

export interface QuickActionsPanelProps {
  selectedMember: TeamMember | null;
  onManageTeamsClick: () => void;
  onTerminalClick: () => void;
  onProjectSettingsClick: () => void;
}

export interface RecentActivityPanelProps {
  // Future: add activity data props when implemented
}

export interface TerminalPanelProps {
  selectedMember: TeamMember;
  terminalData: any[];
  onTerminalInput: (input: string) => void;
}

export interface EmptyTerminalStateProps {
  className?: string;
}

// Dashboard statistics interface
export interface DashboardStats {
  totalTeams: number;
  totalMembers: number;
  activeProjects: number;
  onlineMembers: number;
}