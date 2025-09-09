import { Team, TeamMember } from '../../types';

export interface Terminal {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastOutput: string;
}

export interface TeamDetailProps {
  team: Team;
  onUpdate: () => void;
}

export interface TeamHeaderProps {
  team: Team;
  teamStatus: string;
  orchestratorSessionActive: boolean;
  onStartTeam: () => void;
  onStopTeam: () => void;
  onViewTerminal: () => void;
  onDeleteTeam: () => void;
}

export interface TeamStatsProps {
  team: Team;
  teamStatus: string;
  projectName: string | null;
}

export interface TeamDescriptionProps {
  description?: string;
}

export interface AddMemberFormProps {
  isVisible: boolean;
  onToggle: () => void;
  onAdd: (member: { name: string; role: string }) => void;
  onCancel: () => void;
  isOrchestratorTeam: boolean;
}

export interface MembersListProps {
  team: Team;
  teamId: string;
  onUpdateMember: (memberId: string, updates: Partial<TeamMember>) => void;
  onDeleteMember: (memberId: string) => void;
  onStartMember: (memberId: string) => Promise<void>;
  onStopMember: (memberId: string) => Promise<void>;
}

export interface NewMember {
  name: string;
  role: string;
}

export type TeamStatus = 'active' | 'idle';