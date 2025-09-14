export interface InProgressTask {
  id: string;
  projectId: string;
  teamId: string;
  taskFilePath: string; // e.g. "/path/to/project/.agentmux/tasks/m1_foundation/open/01_setup_tpm.md"
  taskName: string;
  targetRole: string; // tpm, pgm, dev, qa
  assignedTeamMemberId: string;
  assignedSessionId: string;
  assignedAt: string; // ISO timestamp
  status: 'assigned' | 'active' | 'blocked' | 'pending_assignment' | 'completed';
  lastCheckedAt?: string;
  blockReason?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface TaskTrackingData {
  tasks: InProgressTask[];
  lastUpdated: string;
  version: string;
}

export interface TaskStatus {
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  folder: string; // open/, in_progress/, done/, blocked/
}

export interface TaskFileInfo {
  filePath: string;
  fileName: string;
  taskName: string;
  targetRole: string;
  milestoneFolder: string;
  statusFolder: 'open' | 'in_progress' | 'done' | 'blocked';
}