import { Project, Team, Ticket } from '../../types';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  icon: string;
  children?: FileTreeNode[];
}

export interface ProjectDetailState {
  project: Project | null;
  assignedTeams: Team[];
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
}

export interface AlignmentStatus {
  hasAlignmentIssues: boolean;
  alignmentFilePath: string | null;
  content: string | null;
}

export interface ProjectStats {
  totalFiles: number;
  totalDirectories: number;
  hasInitialGoalMd: boolean;
  hasInitialUserJourneyMd: boolean;
  specFiles: string[];
}

export interface TaskFormData {
  title: string;
  status: string;
  priority: string;
  targetRole: string;
  milestone: string;
  description: string;
}

export interface MilestoneFormData {
  name: string;
  description: string;
}

export type TabType = 'detail' | 'editor' | 'tasks' | 'teams';

export interface BuildSpecsWorkflowStep {
  id: number;
  name: string;
  delayMinutes: number;
  status: 'pending' | 'scheduled' | 'completed';
  scheduledAt?: Date;
}

export interface BuildSpecsWorkflow {
  isActive: boolean;
  steps: BuildSpecsWorkflowStep[];
}

export interface DetailViewProps {
  project: Project;
  onAddGoal: () => void;
  onEditGoal: () => void;
  onAddUserJourney: () => void;
  onEditUserJourney: () => void;
  onBuildSpecs: () => void;
  onBuildTasks: () => void;
  buildSpecsWorkflow: BuildSpecsWorkflow;
  alignmentStatus: AlignmentStatus;
  onContinueWithMisalignment: () => void;
  onViewAlignment: () => void;
  selectedBuildSpecsTeam: string;
  setSelectedBuildSpecsTeam: (value: string) => void;
  selectedBuildTasksTeam: string;
  setSelectedBuildTasksTeam: (value: string) => void;
  availableTeams: any[];
  onCreateSpecsTasks: () => void;
  onCreateDevTasks: () => void;
  onCreateE2ETasks: () => void;
}

export interface TasksViewProps {
  project: Project;
  tickets: any[];
  onTicketsUpdate: () => void;
  onCreateSpecsTasks: () => void;
  onCreateDevTasks: () => void;
  onCreateE2ETasks: () => void;
  loading: boolean;
  onTaskClick: (task: any) => void;
  onTaskAssign: (task: any) => void;
  taskAssignmentLoading: string | null;
}

export interface TaskColumnProps {
  title: string;
  count: number;
  tasks: any[];
  status: string;
  onTaskClick: (task: any) => void;
  onTaskAssign: (task: any) => void;
  taskAssignmentLoading: string | null;
}

// EditorView specific types
export interface EditorViewProps {
  project: Project;
  selectedFile: string | null;
  onFileSelect: (file: string | null) => void;
  setIsMarkdownEditorOpen: (open: boolean) => void;
}

export interface FileTreeViewProps {
  files: FileTreeNode[];
  selectedFile: string | null;
  expandedFolders: Set<string>;
  onFileSelect: (path: string | null) => void;
  onToggleFolder: (path: string) => void;
  level?: number;
}

export interface FileLoadingState {
  fileContent: string;
  loadingFile: boolean;
  fileError: string | null;
}

export interface ProjectFilesState {
  projectFiles: FileTreeNode[];
  expandedFolders: Set<string>;
}

// TeamsView specific types
export interface TeamsViewProps {
  assignedTeams: Team[];
  onUnassignTeam: (teamId: string, teamName: string) => void;
  openTerminalWithSession: (sessionName: string) => void;
}

// TaskCreateModal specific types
export interface TaskCreateFormData {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignedTo: string;
}

export interface TaskCreateModalProps {
  onClose: () => void;
  onSubmit: (ticketData: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    assignedTo?: string;
  }) => void;
}