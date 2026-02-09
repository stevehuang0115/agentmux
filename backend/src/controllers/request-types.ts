/**
 * Type definitions for API request bodies and query parameters
 *
 * These interfaces replace `any` type assertions in controller files,
 * providing compile-time type safety for incoming HTTP requests.
 */

import type { TeamMember, Project } from '../types/index.js';

// =============================================================================
// Project Controller Request Types
// =============================================================================

/**
 * Request body for creating a new project
 */
export interface CreateProjectRequestBody {
  path: string;
  name?: string;
  description?: string;
}

/**
 * Request body for starting a project with team assignments
 */
export interface StartProjectRequestBody {
  teamIds: string[];
}

/**
 * Request body for assigning teams to a project
 */
export interface AssignTeamsRequestBody {
  teamAssignments?: Record<string, string[]>;
}

/**
 * Request body for unassigning a team from a project
 */
export interface UnassignTeamRequestBody {
  teamId: string;
}

/**
 * Query parameters for getting project files
 */
export interface GetProjectFilesQuery {
  depth?: string;
  includeDotFiles?: string;
}

/**
 * Query parameters for getting file content
 */
export interface GetFileContentQuery {
  filePath?: string;
}

/**
 * Query parameters for getting agentmux markdown files
 */
export interface GetAgentmuxMarkdownFilesQuery {
  projectPath?: string;
}

/**
 * Request body for saving a markdown file
 */
export interface SaveMarkdownFileRequestBody {
  projectPath: string;
  filePath: string;
  content: string;
}

/**
 * Request body for creating a spec file
 */
export interface CreateSpecFileRequestBody {
  fileName: string;
  content: string;
}

/**
 * Query parameters for getting spec file content
 */
export interface GetSpecFileContentQuery {
  fileName?: string;
}

/**
 * Query parameters for project context options
 */
export interface ProjectContextOptionsQuery {
  includeFiles?: string;
  includeGitHistory?: string;
  includeTickets?: string;
  maxFileSize?: string;
  fileExtensions?: string;
}

// =============================================================================
// Team Controller Request Types
// =============================================================================

/**
 * Request body for creating a new team member during team creation
 */
export interface CreateTeamMemberInput {
  name: string;
  role: TeamMember['role'];
  systemPrompt: string;
  runtimeType?: TeamMember['runtimeType'];
  avatar?: string;
  skillOverrides?: string[];
  excludedRoleSkills?: string[];
}

/**
 * Request body for creating a new team
 */
export interface CreateTeamRequestBody {
  name: string;
  description?: string;
  members: CreateTeamMemberInput[];
  projectPath?: string;
  currentProject?: string;
}

/**
 * Request body for starting a team
 */
export interface StartTeamRequestBody {
  projectId?: string;
}

/**
 * Request body for adding a new team member
 */
export interface AddTeamMemberRequestBody {
  name: string;
  role: TeamMember['role'];
  avatar?: string;
}

/**
 * Request body for updating a team member
 * Allows partial updates of TeamMember fields
 */
export interface UpdateTeamMemberRequestBody {
  name?: string;
  role?: TeamMember['role'];
  avatar?: string;
  systemPrompt?: string;
  runtimeType?: TeamMember['runtimeType'];
}

/**
 * Query parameters for getting team member session output
 */
export interface GetTeamMemberSessionQuery {
  lines?: string | number;
}

/**
 * Request body for reporting a member as ready
 */
export interface ReportMemberReadyRequestBody {
  sessionName: string;
  role: string;
  capabilities?: string[];
  readyAt?: string;
}

/**
 * Request body for registering member status (MCP registration)
 */
export interface RegisterMemberStatusRequestBody {
  sessionName: string;
  role: string;
  status?: string;
  registeredAt?: string;
  memberId?: string;
  /** Claude conversation/session ID for resuming on restart */
  claudeSessionId?: string;
}

/**
 * Query parameters for generating member context
 */
export interface GenerateMemberContextQuery {
  includeFiles?: string;
  includeGitHistory?: string;
  includeTickets?: string;
}

/**
 * Request body for updating team member runtime type
 */
export interface UpdateTeamMemberRuntimeRequestBody {
  runtimeType: 'claude-code' | 'gemini-cli' | 'codex-cli';
}

/**
 * Member update data in team update request
 */
export interface TeamMemberUpdate {
  name: string;
  role: string;
  systemPrompt: string;
  runtimeType?: 'claude-code' | 'gemini-cli' | 'codex-cli';
  avatar?: string;
  skillOverrides?: string[];
  excludedRoleSkills?: string[];
}

/**
 * Request body for updating team properties
 */
export interface UpdateTeamRequestBody {
  name?: string;
  description?: string;
  currentProject?: string;
  members?: TeamMemberUpdate[];
}

// =============================================================================
// Helper type for TeamMember with mutable timestamp fields
// =============================================================================

/**
 * TeamMember with updatedAt as a writable property
 * Used internally when modifying team member records
 */
export interface MutableTeamMember extends Omit<TeamMember, 'updatedAt'> {
  updatedAt: string;
  lastTerminalOutput?: string;
  lastActivityCheck?: string;
  readyAt?: string;
  capabilities?: string[];
}

/**
 * Team with mutable timestamp and optional extension fields
 */
export interface MutableTeam {
  id: string;
  name: string;
  description?: string;
  members: MutableTeamMember[];
  currentProject?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project with mutable fields for internal updates
 * Used when modifying project records directly without using ProjectModel
 */
export interface MutableProject extends Omit<Project, 'updatedAt'> {
  updatedAt: string;
  description?: string;
}
