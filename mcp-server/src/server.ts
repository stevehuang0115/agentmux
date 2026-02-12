#!/usr/bin/env node

import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { logger, createLogger } from './logger.js';
import { SessionAdapter } from './session-adapter.js';
import { WEB_CONSTANTS, TIMING_CONSTANTS, MCP_CONSTANTS } from '../../config/index.js';
import { sanitizeGitCommitMessage } from './security.js';
import { MemoryService, GoalTrackingService, DailyLogService, LearningAccumulationService } from '../../backend/src/services/memory/index.js';
import {
  MCPRequest,
  MCPResponse,
  MCPToolResult,
  SendMessageParams,
  BroadcastParams,
  GetTicketsParams,
  UpdateTicketParams,
  ReportProgressParams,
  RequestReviewParams,
  ScheduleCheckParams,
  EnforceCommitParams,
  CreateTeamParams,
  DelegateTaskParams,
  AssignTaskDelegationParams,
  LoadProjectContextParams,
  AssignTaskParams,
  AcceptTaskParams,
  CompleteTaskParams,
  ReadTaskParams,
  BlockTaskParams,
  TakeNextTaskParams,
  SyncTaskStatusParams,
  CheckTeamProgressParams,
  ReadTaskFileParams,
  ReportReadyParams,
  RegisterAgentStatusParams,
  GetAgentLogsParams,
  GetAgentStatusParams,
  ShutdownAgentParams,
  TicketInfo,
  ToolSchema,
  AgentStatus,
  TmuxSession,
  Team,
  TeamMember,
  BackendAgentData,
  TaskContent,
  TaskTrackingData,
  TaskDetails,
  AssignmentResult,
  TerminateAgentParams,
  TerminateAgentsParams,
  RecoveryReport,
  YAMLFieldValue,
  InProgressTask,
  RememberToolParams,
  RecallToolParams,
  RecordLearningToolParams,
  CheckQualityGatesParams,
  GetSOPsParams,
  CreateRoleToolParams,
  UpdateRoleToolParams,
  ListRolesToolParams,
  CreateSkillToolParams,
  ExecuteSkillToolParams,
  ListSkillsToolParams,
  CreateProjectFolderToolParams,
  SetupProjectStructureToolParams,
  CreateTeamForProjectToolParams,
  SendChatResponseParams,
  SendSlackMessageParams,
  SubscribeEventParams,
  UnsubscribeEventParams,
  SetGoalToolParams,
  GetGoalsToolParams,
  UpdateFocusToolParams,
  GetFocusToolParams,
  LogDailyToolParams,
  RecallTeamKnowledgeToolParams,
  RecordSuccessToolParams,
  RecordFailureToolParams,
} from './types.js';
import {
  handleCreateRole,
  handleUpdateRole,
  handleListRoles,
  handleCreateSkill,
  handleExecuteSkill,
  handleListSkills,
  handleCreateProjectFolder,
  handleSetupProjectStructure,
  handleCreateTeamForProject,
  orchestratorToolDefinitions,
} from './tools/index.js';
import { QualityGateService } from '../../backend/src/services/quality/quality-gate.service.js';
import { GateResult } from '../../backend/src/types/quality-gate.types.js';
import { SOPService } from '../../backend/src/services/sop/sop.service.js';
import { SOPRole, SOPCategory } from '../../backend/src/types/sop.types.js';
import { getChatService, ChatService } from '../../backend/src/services/chat/index.js';
import { ChatSender } from '../../backend/src/types/chat.types.js';


export class AgentMuxMCPServer {
  private sessionName: string;
  private apiBaseUrl: string;
  private projectPath: string;
  private agentRole: string;
  private sessionAdapter: SessionAdapter;
  private memoryService: MemoryService;
  private qualityGateService: QualityGateService;
  private sopService: SOPService;
  private chatService: ChatService;
  private requestQueue: Map<string, number> = new Map();
  private lastCleanup: number = Date.now();

  constructor() {
    // Get session name from environment variable, or use default
    // Note: tmux session detection has been removed as we now use PTY backend
    this.sessionName = process.env.TMUX_SESSION_NAME || 'mcp-server';
    this.apiBaseUrl = `http://localhost:${process.env.API_PORT || WEB_CONSTANTS.PORTS.BACKEND}`;
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';

    // Initialize SessionAdapter (uses backend API for session management)
    this.sessionAdapter = new SessionAdapter();

    // Initialize MemoryService
    this.memoryService = MemoryService.getInstance();

    // Initialize QualityGateService
    this.qualityGateService = QualityGateService.getInstance();

    // Initialize SOPService
    this.sopService = SOPService.getInstance();

    // Initialize ChatService for chat response loop
    this.chatService = getChatService();

    // Debug log session name
    logger.info(`[MCP Server] Initialized with sessionName: ${this.sessionName}`);

    // Setup periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, TIMING_CONSTANTS.INTERVALS.CLEANUP);
  }

  /**
   * Initialize the MCP server and its dependencies
   */
  async initialize(): Promise<void> {
    try {
      // Initialize SessionAdapter
      await this.sessionAdapter.initialize();
      logger.info('SessionAdapter initialized successfully');

      // Initialize ChatService for chat response loop
      await this.chatService.initialize();
      logger.info('ChatService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy(): void {
    this.sessionAdapter.destroy();
  }

  /**
   * Communication Tools
   */
  async sendMessage(params: SendMessageParams): Promise<MCPToolResult> {
    // Rate limiting check
    if (!this.checkRateLimit(`send_${params.to}`)) {
      return {
        content: [{ type: 'text', text: `Rate limit exceeded for ${params.to} - message queued` }],
      };
    }
    
    try {
      // Check if target session exists
      if (!(await this.sessionAdapter.sessionExists(params.to))) {
        logger.warn(`Session ${params.to} does not exist, skipping message`);
        return {
          content: [{ type: 'text', text: `Session ${params.to} not found - message not sent` }],
        };
      }
      
      // Use SessionAdapter's robust message sending
      await this.sessionAdapter.sendMessage(params.to, params.message);

      // Log message for tracking
      this.logMessage(this.sessionName, params.to, params.message).catch((e) => logger.error('Failed to log message', e));

      return {
        content: [{ type: 'text', text: `Message sent to ${params.to}` }],
      };
    } catch (error) {
      logger.error(`Send message error: ${error}`);
      return {
        content: [{ type: 'text', text: `Failed to send message to ${params.to}: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true
      };
    }
  }

  async broadcast(params: BroadcastParams): Promise<MCPToolResult> {
    try {
      // Get all sessions using SessionAdapter
      const sessions = await this.sessionAdapter.listSessions();

      if (sessions.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active sessions found for broadcast' }],
        };
      }

      let broadcastCount = 0;
      const maxConcurrent = 3;
      const sessionNames = sessions.map((s: TmuxSession) => s.sessionName);
      
      // Process sessions in batches
      for (let i = 0; i < sessionNames.length; i += maxConcurrent) {
        const batch = sessionNames.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (sessionName: string) => {
          if (params.excludeSelf && sessionName === this.sessionName) return;

          try {
            if (await this.sessionAdapter.sessionExists(sessionName)) {
              await this.sessionAdapter.sendMessage(sessionName, params.message);
              broadcastCount++;
            }
          } catch (error) {
            logger.warn(`Failed to broadcast to session ${sessionName}: ${error}`);
          }
        });
        
        await Promise.allSettled(batchPromises);
        if (i + maxConcurrent < sessionNames.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return {
        content: [{ type: 'text', text: `Broadcast sent to ${broadcastCount}/${sessionNames.length} sessions` }],
      };
    } catch (error) {
      logger.error(`Broadcast error: ${error}`);
      return {
        content: [{ type: 'text', text: `Broadcast failed: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true
      };
    }
  }

  /**
   * Team Status Tools
   */
  async getTeamStatus(): Promise<MCPToolResult> {
    try {
      const sessions = await this.sessionAdapter.listSessions();

      // Get team data from backend API to enrich session information
      let teamData: { teams?: Team[] } | null = null;
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/teams`);
        if (response.ok) {
          const data = await response.json() as { teams?: Team[] };
          teamData = data;
        }
      } catch (error) {
        logger.warn('Failed to fetch team data from API:', error);
      }

      const statuses = [];
      for (const sessionInfo of sessions) {
        const output = await this.sessionAdapter.capturePane(sessionInfo.sessionName, 20);
        const status = this.analyzeAgentStatus(output);

        // Debug logging for status detection
        if (process.env.NODE_ENV !== 'production') {
          logger.info(`[DEBUG] Status analysis for ${sessionInfo.sessionName}:`, {
            status,
            outputSnippet: output.slice(-100), // Last 100 chars
            sessionName: sessionInfo.sessionName
          });
        }

        // Find matching team member data
        let memberData: TeamMember | null = null;
        if (teamData?.teams) {
          for (const team of teamData.teams) {
            if (team.members) {
              const member = team.members.find((m: TeamMember) =>
                m.sessionName === sessionInfo.sessionName
              );
              if (member) {
                memberData = member;
                break;
              }
            }
          }
        }

        statuses.push({
          sessionName: sessionInfo.sessionName,
          teamMemberId: memberData?.id || null,
          name: memberData?.name || this.getDefaultNameFromSession(sessionInfo.sessionName),
          attached: sessionInfo.attached,
          status: status,
          agentStatus: memberData?.agentStatus || 'unknown',
          workingStatus: memberData?.workingStatus || 'unknown',
          lastActivity: this.extractLastActivity(output)
        });
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(statuses, null, 2) }],
      };
    } catch (error) {
      throw new Error(`Failed to get team status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * New Agent Monitoring Tools
   */
  async getAgentLogs(params: GetAgentLogsParams): Promise<MCPToolResult> {
    const { agentName, sessionName, lines = 50 } = params;
    
    // Validate required parameters
    if (!agentName && !sessionName) {
      return {
        content: [{
          type: 'text',
          text: 'Error: either agentName or sessionName is required'
        }],
        isError: true
      };
    }

    const targetSession = (sessionName || agentName)!; // Already validated above

    try {
      // Check if session exists first
      if (!(await this.sessionAdapter.sessionExists(targetSession))) {
        return {
          content: [{
            type: 'text',
            text: `Session ${targetSession} not found or unable to capture logs`
          }],
          isError: true
        };
      }
      
      const logs = await this.sessionAdapter.capturePane(targetSession, lines);
      const logContent = logs || `No recent activity found for ${targetSession}`;
      
      return {
        content: [{
          type: 'text',
          text: `📋 Logs for ${targetSession} (last ${lines} lines):\n\n${logContent}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Session ${targetSession} not found or unable to capture logs`
        }],
        isError: true
      };
    }
  }

  async getAgentStatus(params: GetAgentStatusParams): Promise<MCPToolResult> {
    const { agentName, sessionName } = params;
    const startTime = Date.now();

    logger.info(`[MCP-STATUS] 🔍 Starting agent status check for: ${agentName || sessionName}`);

    // Step 1: Validate required parameters
    if (!agentName && !sessionName) {
      logger.info('[MCP-STATUS] ❌ Missing required parameters');
      return {
        content: [{ type: 'text', text: 'Error: either agentName or sessionName is required' }],
        isError: true
      };
    }

    const targetSession = (sessionName || agentName)!;
    logger.info(`[MCP-STATUS] 🎯 Target session: ${targetSession}`);

    // Step 2: Fetch backend data
    const backendData = await this.fetchBackendTeams();

    // Step 3: Search for agent in backend data
    let agentFound = false;
    let agentData: BackendAgentData | null = null;
    let teamData: Team | null = null;

    if (backendData?.success && backendData?.data?.teams) {
      const result = this.findAgentInTeams(backendData.data.teams, targetSession);
      if (result) {
        agentFound = true;
        agentData = result.agent;
        teamData = result.team;
      }
    }

    // Step 4: Check tmux session status
    const { exists: sessionExists, paneOutput } = await this.checkTmuxSessionStatus(targetSession);

    // Step 5: Determine final agent status
    const { finalAgentStatus, finalWorkingStatus, statusIcon, statusColor } =
      this.determineAgentStatusDisplay(agentData, sessionExists);

    // Step 6: Analyze progress
    const progressIndicator = this.analyzeAgentProgress(paneOutput);

    // Step 7: Build and return status report
    const elapsedMs = Date.now() - startTime;
    logger.info(`[MCP-STATUS] ✅ Status check completed in ${elapsedMs}ms`);

    const statusReport = this.buildAgentStatusReport({
      targetSession,
      statusIcon,
      statusColor,
      finalWorkingStatus,
      sessionExists,
      agentFound,
      teamData,
      agentData,
      elapsedMs,
      backendConnected: !!backendData,
      progressIndicator,
      paneOutput
    });

    return {
      content: [{ type: 'text', text: statusReport }],
      isError: finalAgentStatus === 'unavailable'
    };
  }

  /**
   * Map backend agent status to display status with session existence context
   */
  private mapAgentStatus(backendStatus: string | undefined, sessionExists: boolean): string {
    if (!backendStatus) {
      return sessionExists ? 'session-only' : 'unavailable';
    }

    // Normalize status values
    switch (backendStatus.toLowerCase()) {
      case 'active':
        return sessionExists ? 'active' : 'inactive';
      case 'activating':
        return 'activating';
      case 'inactive':
      case 'idle':
        return sessionExists ? 'inactive' : 'unavailable';
      default:
        return sessionExists ? 'unknown' : 'unavailable';
    }
  }

  /**
   * Analyze terminal output to determine agent progress
   */
  private analyzeAgentProgress(output: string): string {
    if (!output || output.trim().length === 0) {
      return '🔇 No terminal activity detected';
    }

    const lowerOutput = output.toLowerCase();
    const lines = output.trim().split('\n');
    const lastFewLines = lines.slice(-3).join(' ').toLowerCase();

    // Check for completion indicators
    if (lowerOutput.includes('✅ completed') ||
        lowerOutput.includes('task completed') ||
        lowerOutput.includes('✅ done') ||
        lowerOutput.includes('finished successfully')) {
      return '✅ Recently completed task/work';
    }

    // Check for error/stuck indicators
    if (lowerOutput.includes('error') ||
        lowerOutput.includes('failed') ||
        lowerOutput.includes('timeout') ||
        lowerOutput.includes('stuck')) {
      return '❌ May be encountering errors or stuck';
    }

    // Check for active work indicators
    if (lowerOutput.includes('processing') ||
        lowerOutput.includes('working on') ||
        lowerOutput.includes('analyzing') ||
        lowerOutput.includes('building') ||
        lowerOutput.includes('creating') ||
        lowerOutput.includes('implementing')) {
      return '⚡ Actively working';
    }

    // Check for waiting/idle indicators
    if (lastFewLines.includes('$') ||
        lastFewLines.includes('waiting') ||
        lastFewLines.includes('ready') ||
        output.trim().endsWith('$') ||
        output.trim().endsWith('> ')) {
      return '⏳ Ready/waiting for input';
    }

    // Check for prompts or questions
    if (lowerOutput.includes('?') ||
        lowerOutput.includes('select') ||
        lowerOutput.includes('choose') ||
        lowerOutput.includes('enter')) {
      return '❓ Waiting for user input/decision';
    }

    // Default - show recent activity
    return '🔄 Active (see recent terminal output below)';
  }

  // ==================== getAgentStatus Helper Methods ====================

  /**
   * Fetch team data from the backend API with retry logic
   *
   * @returns Backend teams data or null if all attempts fail
   */
  private async fetchBackendTeams(): Promise<{ success?: boolean; data?: { teams: Team[] } } | null> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info(`[MCP-STATUS] 🌐 Backend API attempt ${attempt}/3...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMING_CONSTANTS.TIMEOUTS.CONNECTION);

        const response = await fetch(`${this.apiBaseUrl}/api/teams`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'AgentMux-MCP-Server'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as { success?: boolean; data?: { teams: Team[] } };
        logger.info(`[MCP-STATUS] ✅ Backend API success on attempt ${attempt}`);
        return data;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.info(`[MCP-STATUS] ❌ Backend API attempt ${attempt} failed: ${errorMsg}`);

        if (attempt === 3) {
          logger.info('[MCP-STATUS] 🚨 All backend API attempts failed, using fallback');
          return null;
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * TIMING_CONSTANTS.RETRIES.BASE_DELAY));
      }
    }
    return null;
  }

  /**
   * Search for an agent in the teams data
   *
   * @param teams - Array of teams to search
   * @param targetSession - Session name to find
   * @returns Object containing agent and team data, or null if not found
   */
  private findAgentInTeams(
    teams: Team[],
    targetSession: string
  ): { agent: BackendAgentData; team: Team } | null {
    logger.info(`[MCP-STATUS] 🔎 Searching through ${teams.length} teams...`);

    for (const team of teams) {
      if (team.members) {
        const member = team.members.find((m: TeamMember) =>
          m.sessionName === targetSession ||
          m.name === targetSession ||
          m.id === targetSession
        );

        if (member) {
          logger.info(`[MCP-STATUS] ✅ Agent found in team: ${team.name}`);
          return { agent: member, team };
        }
      }
    }
    return null;
  }

  /**
   * Check tmux session status and capture pane output
   *
   * @param targetSession - Session name to check
   * @returns Session existence and pane output
   */
  private async checkTmuxSessionStatus(targetSession: string): Promise<{ exists: boolean; paneOutput: string }> {
    let sessionExists = false;
    let paneOutput = '';

    // Check session existence with retry
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        logger.info(`[MCP-STATUS] 🖥️ Checking tmux session (attempt ${attempt}/2)...`);
        sessionExists = await this.sessionAdapter.sessionExists(targetSession);
        logger.info(`[MCP-STATUS] 📡 Session exists: ${sessionExists}`);
        break;
      } catch (error) {
        logger.info(`[MCP-STATUS] ⚠️ Session check attempt ${attempt} failed:`, error);
        if (attempt === 2) {
          sessionExists = false;
        }
      }
    }

    // Get pane output if session exists
    if (sessionExists) {
      try {
        logger.info('[MCP-STATUS] 📋 Capturing pane output...');
        paneOutput = await this.sessionAdapter.capturePane(targetSession, 10);
        logger.info(`[MCP-STATUS] ✅ Captured ${paneOutput.length} chars of output`);
      } catch (error) {
        logger.info('[MCP-STATUS] ⚠️ Failed to capture pane output:', error);
        paneOutput = 'Unable to capture terminal output';
      }
    }

    return { exists: sessionExists, paneOutput };
  }

  /**
   * Determine the final agent status based on available data
   *
   * @param agentData - Backend agent data (or null)
   * @param sessionExists - Whether the tmux session exists
   * @returns Status determination with icon and color
   */
  private determineAgentStatusDisplay(
    agentData: BackendAgentData | null,
    sessionExists: boolean
  ): {
    finalAgentStatus: string;
    finalWorkingStatus: string;
    statusIcon: string;
    statusColor: string;
  } {
    if (agentData) {
      const finalAgentStatus = this.mapAgentStatus(agentData.agentStatus, sessionExists);
      const finalWorkingStatus = agentData.workingStatus || 'idle';

      let statusIcon: string;
      let statusColor: string;

      if (finalAgentStatus === 'active' && sessionExists) {
        statusIcon = '✅';
        statusColor = 'ACTIVE';
      } else if (finalAgentStatus === 'activating') {
        statusIcon = '🔄';
        statusColor = 'ACTIVATING';
      } else if (sessionExists) {
        statusIcon = '⚠️';
        statusColor = 'CONNECTED (inactive in backend)';
      } else {
        statusIcon = '❌';
        statusColor = 'INACTIVE';
      }

      return { finalAgentStatus, finalWorkingStatus, statusIcon, statusColor };
    } else if (sessionExists) {
      return {
        finalAgentStatus: 'session-only',
        finalWorkingStatus: 'unknown',
        statusIcon: '🔗',
        statusColor: 'SESSION ONLY (not registered)'
      };
    } else {
      return {
        finalAgentStatus: 'unavailable',
        finalWorkingStatus: 'offline',
        statusIcon: '💀',
        statusColor: 'UNAVAILABLE'
      };
    }
  }

  /**
   * Build the status report string
   *
   * @param params - All the data needed to build the report
   * @returns Formatted status report string
   */
  private buildAgentStatusReport(params: {
    targetSession: string;
    statusIcon: string;
    statusColor: string;
    finalWorkingStatus: string;
    sessionExists: boolean;
    agentFound: boolean;
    teamData: Team | null;
    agentData: BackendAgentData | null;
    elapsedMs: number;
    backendConnected: boolean;
    progressIndicator: string;
    paneOutput: string;
  }): string {
    const {
      targetSession, statusIcon, statusColor, finalWorkingStatus,
      sessionExists, agentFound, teamData, agentData,
      elapsedMs, backendConnected, progressIndicator, paneOutput
    } = params;

    let report = `🔍 Status for ${targetSession}:\n\n`;

    // Agent Status Section
    report += `${statusIcon} Agent Status: ${statusColor}\n`;
    report += `⚡ Working Status: ${finalWorkingStatus.toUpperCase()}\n`;
    report += `📡 Session: ${targetSession} (${sessionExists ? 'running' : 'not found'})\n`;

    if (agentFound && teamData) {
      report += `👥 Team: ${teamData.name}\n`;
      report += `🎭 Role: ${agentData?.role || 'unknown'}\n`;
      report += `🕐 Last Activity: ${agentData?.lastActivityCheck || 'unknown'}\n`;
    }

    report += `⏱️ Check Duration: ${elapsedMs}ms\n`;
    report += `🔄 Backend API: ${backendConnected ? 'connected' : 'failed'}\n\n`;

    // Progress Indicator Section
    report += `📊 Progress Indicator:\n${progressIndicator}\n\n`;

    // Recent Terminal Output Section
    if (sessionExists && paneOutput) {
      const outputLines = paneOutput.trim().split('\n').slice(-5);
      report += `📋 Recent Terminal Activity (last 5 lines):\n`;
      report += '```\n';
      if (outputLines.length > 0) {
        outputLines.forEach(line => {
          report += `${line}\n`;
        });
      } else {
        report += '(no recent output)\n';
      }
      report += '```\n\n';
    } else if (sessionExists) {
      report += `📋 Terminal Output: Unable to capture\n\n`;
    } else {
      report += `📋 Terminal Output: Session not running\n\n`;
    }

    // Troubleshooting Section
    if (!sessionExists || !agentFound) {
      report += `🔧 Troubleshooting:\n`;
      if (!sessionExists) {
        report += `• Session '${targetSession}' is not running in tmux\n`;
        report += `• Try: tmux list-sessions to see active sessions\n`;
      }
      if (!agentFound) {
        report += `• Agent not found in backend teams database\n`;
        report += `• Agent may not be properly registered\n`;
      }
    }

    return report;
  }

  // ==================== registerAgentStatus Helper Methods ====================

  /**
   * Test API server connectivity
   *
   * @returns True if server is healthy
   */
  private async testApiConnectivity(): Promise<boolean> {
    try {
      logger.info(`[MCP] 🔍 Testing API server connectivity...`);
      const healthResponse = await fetch(`${this.apiBaseUrl}/health`);
      logger.info(`[MCP] 💓 Health check status: ${healthResponse.status} ${healthResponse.statusText}`);
      return healthResponse.ok;
    } catch (healthError) {
      logger.info(`[MCP] ❌ Health check failed:`, healthError instanceof Error ? healthError.message : String(healthError));
      return false;
    }
  }

  /**
   * Make registration API call
   *
   * @param params - Registration parameters
   * @returns Registration response data
   */
  private async callRegistrationApi(params: RegisterAgentStatusParams): Promise<unknown> {
    const requestBody = {
      sessionName: params.sessionName,
      role: params.role,
      status: 'active',
      registeredAt: new Date().toISOString(),
      memberId: params.teamMemberId,
      claudeSessionId: params.claudeSessionId
    };

    logger.info(`[MCP] 📤 Request body:`, JSON.stringify(requestBody, null, 2));

    const endpoint = `${this.apiBaseUrl}/api/teams/members/register`;
    logger.info(`[MCP] 📡 Calling endpoint: ${endpoint}`);
    logger.info(`[MCP] 📞 Making registration API call...`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AgentMux-MCP/1.0.0'
      },
      body: JSON.stringify(requestBody)
    });

    logger.info(`[MCP] 📨 Response received - Status: ${response.status} ${response.statusText}`);
    logger.info(`[MCP] 📋 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let responseBody = '';
      try {
        responseBody = await response.text();
        logger.info(`[MCP] 📄 Response body:`, responseBody);
      } catch (bodyError) {
        logger.info(`[MCP] ❌ Failed to read response body:`, bodyError);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse response
    try {
      const responseText = await response.text();
      logger.info(`[MCP] 📄 Response body text:`, responseText);
      if (responseText) {
        const responseData = JSON.parse(responseText);
        logger.info(`[MCP] 📋 Parsed response data:`, JSON.stringify(responseData, null, 2));
        return responseData;
      }
    } catch (parseError) {
      logger.info(`[MCP] ❌ Failed to parse response body:`, parseError);
    }

    return null;
  }

  /**
   * Check for abandoned tasks when orchestrator registers
   *
   * @param sessionName - Orchestrator session name
   * @returns Recovery report or null
   */
  private async checkOrchestratorRecovery(sessionName: string): Promise<RecoveryReport | null> {
    logger.info(`[MCP] 🔄 Orchestrator registered, checking for abandoned tasks...`);
    try {
      const recoveryResponse = await fetch(`${this.apiBaseUrl}/api/task-management/recover-abandoned-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AgentMux-MCP/1.0.0'
        },
        body: JSON.stringify({ sessionName })
      });

      if (recoveryResponse.ok) {
        const report = await recoveryResponse.json() as RecoveryReport;
        logger.info(`[MCP] 📊 Recovery completed:`, report);
        return report;
      } else {
        logger.info(`[MCP] ⚠️ Recovery check failed: ${recoveryResponse.status}`);
        return null;
      }
    } catch (recoveryError) {
      logger.info(`[MCP] ⚠️ Recovery check error:`, recoveryError);
      return null;
    }
  }

  /**
   * Build registration response message
   *
   * @param params - Registration params
   * @param recoveryReport - Optional recovery report
   * @returns Response message string
   */
  private buildRegistrationResponse(
    params: RegisterAgentStatusParams,
    recoveryReport: RecoveryReport | null
  ): string {
    let responseText = `Agent registered successfully. Role: ${params.role}, Session: ${params.sessionName}${params.teamMemberId ? `, Member ID: ${params.teamMemberId}` : ''}`;

    if (recoveryReport && recoveryReport.success) {
      const report = recoveryReport.data;
      if (report.totalInProgress > 0) {
        responseText += `\n\n🔄 Task Recovery Report:`;
        responseText += `\n- Total in-progress tasks checked: ${report.totalInProgress}`;
        responseText += `\n- Tasks recovered (moved back to open): ${report.recovered}`;
        responseText += `\n- Tasks kept (agent still active): ${report.skipped}`;

        if (report.recovered > 0) {
          responseText += `\n- Recovered tasks: ${report.recoveredTasks.join(', ')}`;
        }

        if (report.errors.length > 0) {
          responseText += `\n- Errors: ${report.errors.length}`;
        }
      } else {
        responseText += `\n\n✅ No abandoned tasks found to recover.`;
      }
    }

    return responseText;
  }

  /**
   * Register Agent Status
   */
  async registerAgentStatus(params: RegisterAgentStatusParams): Promise<MCPToolResult> {
    const startTime = Date.now();
    logger.info(`[MCP] 🚀 Starting agent registration process...`);
    logger.info(`[MCP] 📋 Arguments:`, JSON.stringify(params, null, 2));
    logger.info(`[MCP] 🌐 API Base URL: ${this.apiBaseUrl}`);
    logger.info(`[MCP] 📍 Session Name: ${this.sessionName}`);
    logger.info(`[MCP] 🎭 Agent Role: ${this.agentRole}`);

    try {
      // Step 1: Test API connectivity
      await this.testApiConnectivity();

      // Step 2: Make registration API call
      await this.callRegistrationApi(params);

      const duration = Date.now() - startTime;
      logger.info(`[MCP] ✅ Registration successful! Duration: ${duration}ms`);

      // Step 3: Check for abandoned tasks if orchestrator
      let recoveryReport: RecoveryReport | null = null;
      if (params.role === 'orchestrator') {
        recoveryReport = await this.checkOrchestratorRecovery(params.sessionName);
      }

      // Step 4: Build and return response
      const responseText = this.buildRegistrationResponse(params, recoveryReport);

      return {
        content: [{ type: 'text', text: responseText }]
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.info(`[MCP] ❌ Registration failed after ${duration}ms`);
      logger.info(`[MCP] 💥 Error details:`, error);

      return {
        content: [{
          type: 'text',
          text: `❌ Failed to register agent: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Task Management Tools
   */
  async acceptTask(params: AcceptTaskParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: params.absoluteTaskPath,
          sessionName: params.sessionName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;

      // Check if the operation was successful
      if (!result.success) {
        // Return detailed error information without throwing
        return {
          content: [{
            type: 'text',
            text: `❌ Task assignment failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.absoluteTaskPath}${result.currentFolder ? `\n📁 Current Folder: ${result.currentFolder}` : ''}${result.expectedFolder ? `\n🎯 Expected Folder: ${result.expectedFolder}` : ''}`
          }],
          isError: true
        };
      }

      // Add task to in_progress_tasks.json
      await this.addTaskToInProgressTracking(params.absoluteTaskPath, params.sessionName, result);

      return {
        content: [{
          type: 'text',
          text: `Task accepted successfully: Task moved from open to in_progress folder and added to tracking`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error accepting task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async readTask(params: ReadTaskParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/read-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: params.absoluteTaskPath
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;

      // Check if the operation was successful
      if (!result.success) {
        // Return detailed error information without throwing
        return {
          content: [{
            type: 'text',
            text: `❌ Task read failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.absoluteTaskPath}`
          }],
          isError: true
        };
      }

      return {
        content: [{
          type: 'text',
          text: `📋 Task File Content (${result.fileSize} chars):\n\n${result.content}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Format a failure message for quality gates
   *
   * @param failedGates - Array of failed gate results
   * @returns Formatted failure message
   */
  private formatGateFailureMessage(failedGates: GateResult[]): string {
    let message = `❌ Quality gates failed. Please fix the following issues:\n\n`;

    for (const gate of failedGates) {
      message += `## ${gate.name} (FAILED)\n`;
      message += `\`\`\`\n${gate.output.substring(0, 1000)}\n\`\`\`\n\n`;
    }

    message += `\n**Instructions:**\n`;
    message += `1. Review the errors above\n`;
    message += `2. Fix the issues in your code\n`;
    message += `3. Run the checks locally to verify\n`;
    message += `4. Call complete_task again when all checks pass\n`;

    return message;
  }

  async completeTask(params: CompleteTaskParams): Promise<MCPToolResult> {
    try {
      logger.info(`[complete_task] Called with params:`, {
        taskPath: params.absoluteTaskPath,
        sessionName: params.sessionName,
        skipGates: params.skipGates,
      });

      // Run quality gates unless skipped
      if (!params.skipGates) {
        logger.info(`[complete_task] Running quality gates for project: ${this.projectPath}`);

        const gateResults = await this.qualityGateService.runAllGates(this.projectPath);

        logger.info(`[complete_task] Gate results:`, {
          allRequiredPassed: gateResults.allRequiredPassed,
          allPassed: gateResults.allPassed,
          summary: gateResults.summary,
        });

        if (!gateResults.allRequiredPassed) {
          // Gates failed - return failure with details
          const failedGates = gateResults.results.filter(r => !r.passed && r.required);

          return {
            content: [{
              type: 'text',
              text: this.formatGateFailureMessage(failedGates)
            }],
            isError: true
          };
        }

        logger.info(`[complete_task] All quality gates passed`);
      } else {
        logger.warn(`[complete_task] Quality gates skipped (not recommended)`);
      }

      // Gates passed (or skipped) - proceed with task completion
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: params.absoluteTaskPath,
          sessionName: params.sessionName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;

      // Check if the operation was successful
      if (!result.success) {
        // Return detailed error information without throwing
        return {
          content: [{
            type: 'text',
            text: `❌ Task completion failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.absoluteTaskPath}${result.currentFolder ? `\n📁 Current Folder: ${result.currentFolder}` : ''}${result.expectedFolder ? `\n🎯 Expected Folder: ${result.expectedFolder}` : ''}`
          }],
          isError: true
        };
      }

      // Success case - remove task from in_progress_tasks.json
      await this.removeTaskFromInProgressTracking(params.absoluteTaskPath);

      // Build success message
      let successMessage = `✅ Task completed successfully!`;
      if (params.summary) {
        successMessage += `\n\n📝 Summary: ${params.summary}`;
      }
      if (!params.skipGates) {
        successMessage += `\n\n✅ All quality gates passed (typecheck, tests, build)`;
      }
      successMessage += `\n\n${result.message || 'Task moved to done folder and removed from tracking'}`;

      return {
        content: [{
          type: 'text',
          text: successMessage
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error completing task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Check quality gates without completing the task
   *
   * @param params - Parameters for the check
   * @returns Gate check results
   */
  async checkQualityGates(params: CheckQualityGatesParams): Promise<MCPToolResult> {
    try {
      logger.info(`[check_quality_gates] Running gates for project: ${this.projectPath}`);

      const gateResults = await this.qualityGateService.runAllGates(this.projectPath, {
        gateNames: params.gates,
        skipOptional: params.skipOptional,
      });

      // Format summary
      const summary = gateResults.results.map(r =>
        `${r.passed ? '✅' : '❌'} ${r.name}: ${r.passed ? 'PASSED' : 'FAILED'}${r.skipped ? ' (skipped)' : ''} (${r.duration}ms)`
      ).join('\n');

      // Build response message
      let message = gateResults.allRequiredPassed
        ? `✅ All required quality gates passed!\n\n`
        : `❌ Some quality gates failed:\n\n`;

      message += `## Results\n${summary}\n\n`;
      message += `## Summary\n`;
      message += `- Total: ${gateResults.summary.total}\n`;
      message += `- Passed: ${gateResults.summary.passed}\n`;
      message += `- Failed: ${gateResults.summary.failed}\n`;
      message += `- Skipped: ${gateResults.summary.skipped}\n`;
      message += `- Duration: ${gateResults.duration}ms\n`;

      // Include failure details for failed gates
      const failedGates = gateResults.results.filter(r => !r.passed && !r.skipped);
      if (failedGates.length > 0) {
        message += `\n## Failure Details\n`;
        for (const gate of failedGates) {
          message += `\n### ${gate.name}\n`;
          message += `\`\`\`\n${gate.output.substring(0, 500)}\n\`\`\`\n`;
        }
      }

      return {
        content: [{
          type: 'text',
          text: message
        }],
        isError: !gateResults.allRequiredPassed
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error checking quality gates: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async blockTask(params: BlockTaskParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: params.absoluteTaskPath,
          sessionName: this.sessionName,
          reason: params.reason,
          questions: params.questions || [],
          urgency: params.urgency || 'medium'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;

      // Check if the operation was successful
      if (!result.success) {
        // Return detailed error information without throwing
        return {
          content: [{
            type: 'text',
            text: `❌ Task blocking failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.absoluteTaskPath}${result.currentFolder ? `\n📁 Current Folder: ${result.currentFolder}` : ''}${result.expectedFolder ? `\n🎯 Expected Folder: ${result.expectedFolder}` : ''}`
          }],
          isError: true
        };
      }

      // Success case - broadcast notification to team
      if (result.broadcast) {
        await this.broadcast({
          message: result.broadcast,
          excludeSelf: false
        });
      }

      return {
        content: [{
          type: 'text',
          text: `🚫 Task blocked successfully: ${result.message || 'Task moved to blocked folder with questions for human review'}\n\n📋 Blocked Reason: ${params.reason}\n\n❓ Questions: ${params.questions?.length ? params.questions.join('\n- ') : 'None specified'}\n\n📢 Team has been notified via broadcast`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error blocking task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async assignTask(params: AssignTaskDelegationParams): Promise<MCPToolResult> {
    try {
      const { absoluteTaskPath: taskPath, targetSessionName, delegatedBy, reason, delegationChain = [] } = params;
      logger.info(`📋 Assigning task to ${targetSessionName} via delegation`);

      // Prevent delegation loops
      const currentChain = delegationChain || [];
      if (currentChain.includes(targetSessionName)) {
        return {
          content: [{
            type: 'text',
            text: `❌ Delegation loop detected: ${targetSessionName} is already in the delegation chain: ${currentChain.join(' → ')}`
          }],
          isError: true
        };
      }

      // Limit delegation chain length
      if (currentChain.length >= 5) {
        return {
          content: [{
            type: 'text',
            text: `❌ Delegation chain too long (${currentChain.length}). Maximum allowed: 5. Current chain: ${currentChain.join(' → ')}`
          }],
          isError: true
        };
      }

      // Check if target session exists
      if (!(await this.sessionAdapter.sessionExists(targetSessionName))) {
        return {
          content: [{
            type: 'text',
            text: `❌ Target session '${targetSessionName}' not found or not accessible`
          }],
          isError: true
        };
      }

      // Read the task file to get details
      let taskDetails: TaskDetails = {};
      let taskProjectPath = this.projectPath; // Default fallback

      try {
        const taskReadResult = await this.readTask({ absoluteTaskPath: taskPath });
        if (!taskReadResult.isError) {
          const content = taskReadResult.content[0]?.text || '';
          taskDetails = this.parseTaskContent(content, taskPath);
        }

        // Extract the actual project path from the task path
        // Task path format: /path/to/project/.agentmux/tasks/...
        const agentmuxIndex = taskPath.indexOf('/.agentmux/');
        if (agentmuxIndex !== -1) {
          taskProjectPath = taskPath.substring(0, agentmuxIndex);
        }
      } catch (error) {
        logger.warn('Could not read task details for assignment:', error);
      }

      // Load assignment template using shared method
      const promptTemplate = await this.loadAssignmentTemplate();

      // Debug logging for template variables
      logger.info(`[MCP] 🔍 Template replacement debug:`);
      logger.info(`[MCP]   taskPath: "${taskPath}"`);
      logger.info(`[MCP]   taskProjectPath: "${taskProjectPath}"`);
      logger.info(`[MCP]   targetSessionName: "${targetSessionName}"`);

      // Build delegation chain
      const newChain = [...currentChain];
      if (delegatedBy && !newChain.includes(delegatedBy)) {
        newChain.push(delegatedBy);
      }

      // Build assignment message using shared method
      const assignmentMessage = await this.buildAssignmentMessage({
        template: promptTemplate,
        taskPath,
        taskDetails,
        taskProjectPath,
        targetSessionName,
        delegatedBy,
        reason,
        delegationChain: currentChain
      });

      // Send assignment message directly to target session
      logger.info(`[MCP] 📤 Sending assignment message to ${targetSessionName}...`);
      logger.info(`[MCP] 📝 Assignment details: ${taskDetails.title || taskPath}`);

      try {
        // Use the existing sendMessage method to send the assignment
        await this.sendMessage({
          to: targetSessionName,
          message: assignmentMessage
        });

        logger.info(`[MCP] ✅ Assignment message sent to ${targetSessionName}`);

      } catch (messageError) {
        logger.error(`[MCP] ❌ Failed to send assignment message:`, messageError);
        throw new Error(`Failed to send assignment message to ${targetSessionName}: ${messageError instanceof Error ? messageError.message : 'Unknown error'}`);
      }

      // Log the delegation
      await this.logTaskDelegation(taskPath, this.sessionName, targetSessionName, reason, newChain);

      logger.info(`[MCP] ✅ Task delegation completed successfully for ${targetSessionName}`);

      return {
        content: [{
          type: 'text',
          text: `✅ Task assigned to ${targetSessionName}${reason ? ` (${reason})` : ''}\n📋 Task: ${taskDetails.title || taskPath}\n🔗 Delegation chain: ${newChain.length > 0 ? newChain.join(' → ') + ' → ' + targetSessionName : targetSessionName}\n📤 Assignment message sent directly to target session\n💬 Target agent should see the assignment message in their chat`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to assign task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Restored Tools - Core Orchestration
   */
  async getTickets(params: GetTicketsParams): Promise<MCPToolResult> {
    try {
      logger.info('🎫 Getting tickets and tasks');
      const { status, all } = params;

      const tickets: TicketInfo[] = [];

      // Check for both YAML tickets (legacy) and MD tickets (current)
      const ticketsDir = path.join(this.projectPath, '.agentmux', 'tickets');
      const tasksDir = path.join(this.projectPath, '.agentmux', 'tasks');

      // Legacy YAML tickets support
      try {
        await fs.mkdir(ticketsDir, { recursive: true });
        const files = await fs.readdir(ticketsDir);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            const content = await fs.readFile(path.join(ticketsDir, file), 'utf-8');
            const ticket = this.parseYAMLTicket(content);
            ticket.path = path.join(ticketsDir, file);

            if (!all && ticket.assignedTo !== this.sessionName) continue;
            if (status && ticket.status !== status) continue;

            tickets.push(ticket);
          }
        }
      } catch (error) {
        logger.warn('No legacy YAML tickets found:', error);
      }

      // Current MD tickets with milestone structure
      try {
        await fs.mkdir(tasksDir, { recursive: true });
        const milestones = await fs.readdir(tasksDir, { withFileTypes: true });

        for (const milestone of milestones) {
          if (!milestone.isDirectory()) continue;

          const milestonePath = path.join(tasksDir, milestone.name);
          const statusDirs = ['open', 'in_progress', 'blocked', 'done'];

          for (const statusDir of statusDirs) {
            const statusPath = path.join(milestonePath, statusDir);
            try {
              const statusFiles = await fs.readdir(statusPath);
              for (const file of statusFiles) {
                if (file.endsWith('.md')) {
                  const filePath = path.join(statusPath, file);
                  const content = await fs.readFile(filePath, 'utf-8');
                  const ticket = this.parseMDTicket(content, file, statusDir, milestone.name);
                  ticket.path = filePath;

                  if (!all && ticket.assignedTo !== this.sessionName) continue;
                  if (status && ticket.status !== statusDir) continue;

                  tickets.push(ticket);
                }
              }
            } catch (statusError) {
              // Status folder doesn't exist, skip
            }
          }
        }
      } catch (error) {
        logger.warn('No MD task structure found:', error);
      }

      const summary = `Found ${tickets.length} tickets${status ? ` with status: ${status}` : ''}${all ? ' (all)' : ' (assigned to you)'}`;
      const ticketList = tickets.map(t =>
        `📋 ${t.id}: ${t.title}\n   Status: ${t.status}${t.assignedTo ? ` | Assigned: ${t.assignedTo}` : ''}${t.priority ? ` | Priority: ${t.priority}` : ''}\n   📍 ${t.path}`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `${summary}\n\n${ticketList || 'No tickets match your criteria.'}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get tickets: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async updateTicket(params: UpdateTicketParams): Promise<MCPToolResult> {
    try {
      const { ticketId, status, notes, blockers } = params;
      logger.info(`📝 Updating ticket ${ticketId}`);

      // Find the ticket file
      const ticket = await this.findTicketById(ticketId);
      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      let updatedContent = '';
      let newPath = ticket.path;

      if (ticket.path?.endsWith('.yaml') || ticket.path?.endsWith('.yml')) {
        // Update YAML ticket
        const content = await fs.readFile(ticket.path, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (status && lines[i].startsWith('status:')) {
            lines[i] = `status: ${status}`;
          }
          if (notes && lines[i].startsWith('notes:')) {
            lines[i] = `notes: ${notes}`;
          }
          if (blockers && lines[i].startsWith('blockers:')) {
            lines[i] = `blockers: [${blockers.join(', ')}]`;
          }
        }

        updatedContent = lines.join('\n');
      } else {
        // Update MD ticket and potentially move between status folders
        const content = await fs.readFile(ticket.path!, 'utf-8');

        // Update frontmatter or add status info
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (frontmatterMatch) {
          let frontmatter = frontmatterMatch[1];
          let body = frontmatterMatch[2];

          if (status) frontmatter = this.updateYAMLField(frontmatter, 'status', status);
          if (notes) body = `${body}\n\n## Update Notes\n${notes}`;
          if (blockers) frontmatter = this.updateYAMLField(frontmatter, 'blockers', blockers);

          updatedContent = `---\n${frontmatter}\n---\n${body}`;
        } else {
          // No frontmatter, add status as comment
          updatedContent = content;
          if (notes) updatedContent += `\n\n<!-- Update Notes: ${notes} -->`;
        }

        // Move file if status changed
        if (status && ticket.status !== status) {
          const oldDir = path.dirname(ticket.path!);
          const newDir = oldDir.replace(/\/(open|in_progress|blocked|done)$/, `/${status}`);
          const fileName = path.basename(ticket.path!);
          newPath = path.join(newDir, fileName);

          await fs.mkdir(newDir, { recursive: true });
          await fs.writeFile(newPath, updatedContent);
          await fs.unlink(ticket.path!);
        }
      }

      if (newPath === ticket.path) {
        await fs.writeFile(ticket.path!, updatedContent);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Ticket ${ticketId} updated successfully${newPath !== ticket.path ? ` and moved to ${status}` : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to update ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async reportProgress(params: ReportProgressParams): Promise<MCPToolResult> {
    try {
      const { ticketId, progress, completed, current, blockers, nextSteps } = params;
      logger.info(`📊 Reporting progress for ${ticketId || 'current work'}: ${progress}%`);

      let message = `PROGRESS REPORT - ${new Date().toISOString()}\n`;
      message += `Agent: ${this.sessionName}\n`;
      if (ticketId) message += `Ticket: ${ticketId}\n`;
      message += `Progress: ${progress}%\n`;

      if (completed && completed.length > 0) {
        message += `\n✅ Completed:\n${completed.map(item => `  - ${item}`).join('\n')}\n`;
      }

      if (current) {
        message += `\n⚡ Currently Working On:\n  - ${current}\n`;
      }

      if (blockers && blockers.length > 0) {
        message += `\n🚫 Blockers:\n${blockers.map(item => `  - ${item}`).join('\n')}\n`;
      }

      if (nextSteps) {
        message += `\n🔄 Next Steps:\n  - ${nextSteps}\n`;
      }

      // Log progress to project memory
      await this.logProgress(message);

      // If there's a specific orchestrator, send to them
      const orchestratorSessions = await this.sessionAdapter.listSessions();
      const orchestrator = orchestratorSessions.find((s: TmuxSession) =>
        s.sessionName.includes('orchestrator') || s.sessionName.includes('orc')
      );

      if (orchestrator) {
        await this.sessionAdapter.sendMessage(orchestrator.sessionName, `📊 PROGRESS UPDATE:\n${message}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Progress reported: ${progress}%${orchestrator ? ` (sent to ${orchestrator.sessionName})` : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to report progress: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async requestReview(params: RequestReviewParams): Promise<MCPToolResult> {
    try {
      const { ticketId, reviewer, branch, message } = params;
      logger.info(`👀 Requesting review for ticket ${ticketId}`);

      let reviewMessage = `REVIEW REQUEST\n`;
      reviewMessage += `From: ${this.sessionName}\n`;
      reviewMessage += `Ticket: ${ticketId}\n`;
      if (branch) reviewMessage += `Branch: ${branch}\n`;
      reviewMessage += `\nRequest: ${message || 'Please review my work'}\n`;
      reviewMessage += `\nPlease provide feedback and approve when ready.`;

      if (reviewer) {
        // Send to specific reviewer
        if (await this.sessionAdapter.sessionExists(reviewer)) {
          await this.sessionAdapter.sendMessage(reviewer, reviewMessage);
          return {
            content: [{
              type: 'text',
              text: `✅ Review request sent to ${reviewer}`
            }]
          };
        } else {
          throw new Error(`Reviewer session ${reviewer} not found`);
        }
      } else {
        // Broadcast to all sessions (someone will pick it up)
        const sessions = await this.sessionAdapter.listSessions();
        let sentCount = 0;

        for (const sessionInfo of sessions) {
          if (sessionInfo.sessionName === this.sessionName) continue;

          try {
            await this.sessionAdapter.sendMessage(sessionInfo.sessionName, reviewMessage);
            sentCount++;
          } catch (error) {
            logger.warn(`Failed to send review request to ${sessionInfo.sessionName}`);
          }
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Review request broadcast to ${sentCount} team members`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to request review: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async scheduleCheck(params: ScheduleCheckParams): Promise<MCPToolResult> {
    try {
      const { minutes, message, target } = params;
      logger.info(`⏰ Scheduling check in ${minutes} minutes`);

      const checkTime = new Date(Date.now() + minutes * 60 * 1000);
      const targetTeam = target || 'orchestrator';

      // Determine delay unit and amount for optimal representation
      let delayAmount: number;
      let delayUnit: 'seconds' | 'minutes' | 'hours';
      if (minutes >= 60 && minutes % 60 === 0) {
        delayAmount = minutes / 60;
        delayUnit = 'hours';
      } else {
        delayAmount = minutes;
        delayUnit = 'minutes';
      }

      // Create scheduled message via backend API so it persists and shows in UI
      const response = await fetch(`${this.apiBaseUrl}/api/scheduled-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Check: ${message.substring(0, 60)}${message.length > 60 ? '...' : ''}`,
          targetTeam,
          message,
          delayAmount,
          delayUnit,
          isRecurring: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Backend API error: ${(errorData as any).error || response.statusText}`);
      }

      const result = await response.json() as { success: boolean; data?: { id: string } };

      return {
        content: [{
          type: 'text',
          text: `⏰ Check scheduled for ${checkTime.toLocaleTimeString()} (${minutes} minutes)${target ? ` → ${target}` : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to schedule check: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async enforceCommit(params: EnforceCommitParams): Promise<MCPToolResult> {
    try {
      const { message } = params;
      logger.info('🔒 Enforcing git commit');

      return new Promise((resolve) => {
        const gitStatus = spawn('git', ['status', '--porcelain'], {
          cwd: this.projectPath,
          stdio: 'pipe'
        });

        let output = '';
        gitStatus.stdout.on('data', (data) => {
          output += data.toString();
        });

        gitStatus.on('close', async (code) => {
          try {
            if (code !== 0) {
              resolve({
                content: [{
                  type: 'text',
                  text: '❌ Git status check failed - not a git repository or git error'
                }],
                isError: true
              });
              return;
            }

            if (output.trim() === '') {
              resolve({
                content: [{
                  type: 'text',
                  text: '✅ No uncommitted changes found'
                }]
              });
              return;
            }

            const changes = output.trim().split('\n').length;
            const rawCommitMsg = message || `Auto-commit: ${changes} changes by ${this.sessionName}`;
            const { sanitized: commitMsg, wasModified } = sanitizeGitCommitMessage(rawCommitMsg);
            if (wasModified) {
              logger.warn(`Commit message was sanitized for security. Original: "${rawCommitMsg.substring(0, 100)}..."`);
            }

            // Force add and commit all changes
            const gitAdd = spawn('git', ['add', '-A'], { cwd: this.projectPath });
            gitAdd.on('close', (addCode) => {
              if (addCode !== 0) {
                resolve({
                  content: [{
                    type: 'text',
                    text: '❌ Git add failed'
                  }],
                  isError: true
                });
                return;
              }

              const gitCommit = spawn('git', ['commit', '-m', commitMsg], { cwd: this.projectPath });
              gitCommit.on('close', (commitCode) => {
                if (commitCode === 0) {
                  resolve({
                    content: [{
                      type: 'text',
                      text: `✅ Committed ${changes} changes: "${commitMsg}"`
                    }]
                  });
                } else {
                  resolve({
                    content: [{
                      type: 'text',
                      text: `❌ Git commit failed (code: ${commitCode})`
                    }],
                    isError: true
                  });
                }
              });
            });
          } catch (error) {
            resolve({
              content: [{
                type: 'text',
                text: `Commit enforcement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
              }],
              isError: true
            });
          }
        });
      });
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to enforce commit: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async createTeam(params: CreateTeamParams): Promise<MCPToolResult> {
    try {
      const { role, name, projectPath, systemPrompt } = params;
      logger.info(`🚀 Creating team ${name} with role ${role}`);

      // Check orchestrator permission
      if (!this.sessionName.includes('orchestrator') && this.sessionName !== 'mcp-server') {
        throw new Error('Only orchestrator can create teams');
      }

      // Check if an agent session with this name already exists
      if (await this.sessionAdapter.sessionExists(name)) {
        logger.info(`Agent session "${name}" already exists, skipping creation`);
        return {
          content: [{
            type: 'text',
            text: `⚠️ Agent "${name}" already exists and is running. Use \`delegate_task\` to assign work to this agent instead of creating a new one. Example: delegate_task({ to: "${name}", task: "...", priority: "normal" })`
          }]
        };
      }

      // Create tmux session using SessionAdapter
      const sessionConfig = {
        name: name,
        role: role as 'orchestrator' | 'tpm' | 'pgm' | 'developer' | 'frontend-developer' | 'backend-developer' | 'qa' | 'tester' | 'designer',
        systemPrompt: systemPrompt || `You are a ${role} agent in the AgentMux team. Please collaborate effectively with other team members.`,
        projectPath: projectPath || this.projectPath,
        runtimeType: 'claude-code' as const
      };
      await this.sessionAdapter.createSession(sessionConfig);

      // Send initial setup commands
      const setupCommands = [
        `export TMUX_SESSION_NAME="${name}"`,
        `export AGENT_ROLE="${role}"`,
        `export PROJECT_PATH="${projectPath || this.projectPath}"`,
        `cd "${projectPath || this.projectPath}"`,
      ];

      for (const cmd of setupCommands) {
        await this.sessionAdapter.sendKey(name, cmd);
        await this.sessionAdapter.sendKey(name, 'Enter');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Send system prompt if provided
      if (systemPrompt) {
        await this.sessionAdapter.sendMessage(name, `SYSTEM PROMPT:\n${systemPrompt}\n\nPlease acknowledge and begin work.`);
      }

      // Register with API
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/teams/members/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionName: name,
            role: role,
            status: 'active',
            registeredAt: new Date().toISOString()
          })
        });

        if (response.ok) {
          logger.info(`Registered ${name} with backend API`);
        }
      } catch (apiError) {
        logger.warn(`Failed to register with API: ${apiError}`);
      }

      return {
        content: [{
          type: 'text',
          text: `✅ Team member ${name} created successfully with role: ${role}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to create team: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async delegateTask(params: DelegateTaskParams): Promise<MCPToolResult> {
    try {
      const { to, task, priority, ticketId } = params;
      logger.info(`📋 Delegating task to ${to}`);

      // Load assignment template using shared method
      const promptTemplate = await this.loadAssignmentTemplate();

      // Build assignment message using shared method
      const taskMessage = await this.buildAssignmentMessage({
        template: promptTemplate,
        targetSessionName: to,
        delegatedBy: this.sessionName,
        reason: `Task delegation from ${this.sessionName}`,
        task,
        priority,
        ticketId
      });

      if (await this.sessionAdapter.sessionExists(to)) {
        await this.sessionAdapter.sendMessage(to, taskMessage);

        // Log delegation
        await this.logDelegation(this.sessionName, to, task, priority);

        // Register agent-thread association for Slack thread tracking
        try {
          await fetch(`${this.apiBaseUrl}/api/slack-threads/register-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentSession: to, agentName: to }),
          });
        } catch {
          // Non-critical: thread registration failure should not block delegation
        }

        return {
          content: [{
            type: 'text',
            text: `✅ Task delegated to ${to}`
          }]
        };
      } else {
        throw new Error(`Session ${to} not found or not accessible`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to delegate task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async terminateAgent(params: TerminateAgentParams): Promise<MCPToolResult> {
    try {
      logger.info(`[SHUTDOWN] Step 1: Starting shutdown process for params:`, params);

      if (!params.sessionName) {
        throw new Error('sessionName parameter is required');
      }

      const sessionName = params.sessionName;
      logger.info(`[SHUTDOWN] Step 2: Validated sessionName: ${sessionName}`);

      // Safety checks
      if (sessionName === 'orchestrator' || sessionName === this.sessionName) {
        logger.info(`[SHUTDOWN] Step 3: Safety check failed - orchestrator/self protection`);
        throw new Error('Cannot shutdown orchestrator or self');
      }

      if (sessionName.includes('orchestrator') || sessionName.includes('orc')) {
        logger.info(`[SHUTDOWN] Step 4: Safety check failed - orchestrator name detection`);
        throw new Error('Cannot shutdown orchestrator sessions');
      }
      logger.info(`[SHUTDOWN] Step 5: Safety checks passed`);

      // Check if session exists
      logger.info(`[SHUTDOWN] Step 6: Checking if session exists...`);
      if (!(await this.sessionAdapter.sessionExists(sessionName))) {
        logger.info(`[SHUTDOWN] Step 7: Session existence check failed`);
        throw new Error(`Session ${sessionName} not found`);
      }
      logger.info(`[SHUTDOWN] Step 8: Session exists, proceeding with shutdown`);

      // Send notification message (less alarming than "warning")
      logger.info(`[SHUTDOWN] Step 9: Sending notification message...`);
      await this.sessionAdapter.sendMessage(sessionName, '📋 Agent session terminating. Please save your work.');
      logger.info(`[SHUTDOWN] Step 10: Notification sent, proceeding with termination`);

      // Terminate the session
      logger.info(`[SHUTDOWN] Step 11: Executing session termination...`);
      await this.sessionAdapter.killSession(sessionName);
      logger.info(`[SHUTDOWN] Step 12: Session termination completed successfully`);

      // Notify remaining sessions
      logger.info(`[SHUTDOWN] Step 13: Broadcasting termination notification...`);
      await this.broadcast({
        message: `📋 Agent ${sessionName} has been terminated by ${this.sessionName}`,
        excludeSelf: true
      });
      logger.info(`[SHUTDOWN] Step 14: Broadcast completed, termination process finished`);

      return {
        content: [{
          type: 'text',
          text: `✅ Agent session ${sessionName} terminated successfully`
        }]
      };
    } catch (error) {
      logger.info(`[SHUTDOWN] ERROR: Shutdown process failed:`, error);
      return {
        content: [{
          type: 'text',
          text: `Failed to shutdown agent: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async terminateAgents(params: TerminateAgentsParams): Promise<MCPToolResult> {
    try {
      logger.info(`[BULK-TERMINATE] Step 1: Starting bulk termination for:`, params.sessionNames);

      if (!params.sessionNames || !Array.isArray(params.sessionNames)) {
        throw new Error('sessionNames array parameter is required');
      }

      if (params.sessionNames.length === 0) {
        throw new Error('sessionNames array cannot be empty');
      }

      logger.info(`[BULK-TERMINATE] Step 2: Validating ${params.sessionNames.length} sessions`);

      const results = {
        successful: [] as string[],
        failed: [] as { sessionName: string; error: string }[],
        skipped: [] as { sessionName: string; reason: string }[]
      };

      // Process each session
      for (const sessionName of params.sessionNames) {
        logger.info(`[BULK-TERMINATE] Processing: ${sessionName}`);

        try {
          // Safety checks
          if (sessionName === 'orchestrator' || sessionName === this.sessionName) {
            results.skipped.push({
              sessionName,
              reason: 'Cannot terminate orchestrator or self'
            });
            logger.info(`[BULK-TERMINATE] Skipped ${sessionName}: orchestrator/self protection`);
            continue;
          }

          if (sessionName.includes('orchestrator') || sessionName.includes('orc')) {
            results.skipped.push({
              sessionName,
              reason: 'Cannot terminate orchestrator sessions'
            });
            logger.info(`[BULK-TERMINATE] Skipped ${sessionName}: orchestrator name detection`);
            continue;
          }

          // Check if session exists
          if (!(await this.sessionAdapter.sessionExists(sessionName))) {
            results.failed.push({
              sessionName,
              error: 'Session not found'
            });
            logger.info(`[BULK-TERMINATE] Failed ${sessionName}: session not found`);
            continue;
          }

          // Send notification message
          logger.info(`[BULK-TERMINATE] Sending notification to: ${sessionName}`);
          await this.sessionAdapter.sendMessage(sessionName, '📋 Agent session terminating. Please save your work.');

          // Terminate the session
          logger.info(`[BULK-TERMINATE] Terminating session: ${sessionName}`);
          await this.sessionAdapter.killSession(sessionName);

          results.successful.push(sessionName);
          logger.info(`[BULK-TERMINATE] Successfully terminated: ${sessionName}`);

        } catch (error) {
          results.failed.push({
            sessionName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          logger.info(`[BULK-TERMINATE] Error terminating ${sessionName}:`, error);
        }
      }

      // Broadcast summary notification to remaining agent sessions (exclude orchestrator)
      if (results.successful.length > 0) {
        logger.info(`[BULK-TERMINATE] Broadcasting summary notification...`);

        // Get all sessions and send to non-orchestrator sessions only
        const sessions = await this.sessionAdapter.listSessions();
        let broadcastCount = 0;

        for (const session of sessions) {
          const sessionName = session.sessionName;

          // Skip orchestrator sessions and self
          if (sessionName.includes('orchestrator') || sessionName.includes('orc') || sessionName === this.sessionName) {
            logger.info(`[BULK-TERMINATE] Skipping broadcast to: ${sessionName} (orchestrator/self)`);
            continue;
          }

          try {
            if (await this.sessionAdapter.sessionExists(sessionName)) {
              await this.sessionAdapter.sendMessage(sessionName, `📋 Bulk termination completed: ${results.successful.length} agents terminated by ${this.sessionName}`);
              broadcastCount++;
              logger.info(`[BULK-TERMINATE] Broadcasted to: ${sessionName}`);
            }
          } catch (error) {
            logger.info(`[BULK-TERMINATE] Failed to broadcast to ${sessionName}:`, error);
          }
        }

        logger.info(`[BULK-TERMINATE] Broadcast completed to ${broadcastCount} sessions`);
      }

      logger.info(`[BULK-TERMINATE] Bulk termination completed:`, results);

      // Format response
      let responseText = `✅ Bulk termination completed:\n`;
      responseText += `  • Successful: ${results.successful.length} sessions\n`;

      if (results.successful.length > 0) {
        responseText += `    - ${results.successful.join(', ')}\n`;
      }

      if (results.failed.length > 0) {
        responseText += `  • Failed: ${results.failed.length} sessions\n`;
        results.failed.forEach(f => {
          responseText += `    - ${f.sessionName}: ${f.error}\n`;
        });
      }

      if (results.skipped.length > 0) {
        responseText += `  • Skipped: ${results.skipped.length} sessions\n`;
        results.skipped.forEach(s => {
          responseText += `    - ${s.sessionName}: ${s.reason}\n`;
        });
      }

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error) {
      logger.info(`[BULK-TERMINATE] ERROR: Bulk termination failed:`, error);
      return {
        content: [{
          type: 'text',
          text: `Failed to terminate agents: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  // ============================================
  // Memory Management Tools
  // ============================================

  /**
   * Store knowledge in memory (remember tool)
   *
   * @param params - Remember tool parameters
   * @returns MCP tool result
   */
  async rememberKnowledge(params: RememberToolParams): Promise<MCPToolResult> {
    try {
      logger.info(`[REMEMBER] Storing knowledge: category=${params.category}, scope=${params.scope}`);

      // Get agent ID: prefer teamMemberId if provided, fall back to session name
      const agentId = params.teamMemberId || this.sessionName;
      const projectPath = params.projectPath || this.projectPath;

      const memoryId = await this.memoryService.remember({
        agentId,
        projectPath,
        content: params.content,
        category: params.category,
        scope: params.scope,
        metadata: {
          title: params.title,
          ...params.metadata,
        },
      });

      logger.info(`[REMEMBER] Knowledge stored successfully: ${memoryId}`);

      return {
        content: [{
          type: 'text',
          text: `✅ Knowledge stored successfully (ID: ${memoryId})\n\nCategory: ${params.category}\nScope: ${params.scope}${params.title ? `\nTitle: ${params.title}` : ''}`
        }]
      };
    } catch (error) {
      logger.error(`[REMEMBER] Failed to store knowledge:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to store knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Retrieve relevant memories (recall tool)
   *
   * @param params - Recall tool parameters
   * @returns MCP tool result
   */
  async recallKnowledge(params: RecallToolParams): Promise<MCPToolResult> {
    try {
      const scope = params.scope || 'both';
      logger.info(`[RECALL] Searching memories: context="${params.context.substring(0, 50)}...", scope=${scope}`);

      // Get agent ID: prefer teamMemberId if provided, fall back to session name
      const agentId = params.teamMemberId || this.sessionName;
      const projectPath = params.projectPath || this.projectPath;

      const result = await this.memoryService.recall({
        agentId,
        projectPath,
        context: params.context,
        scope: scope,
        limit: params.limit || 10,
      });

      const totalMemories = result.agentMemories.length + result.projectMemories.length;

      if (totalMemories === 0) {
        logger.info(`[RECALL] No relevant memories found`);
        return {
          content: [{
            type: 'text',
            text: `No relevant memories found for: "${params.context}"\n\nTip: Try using the 'remember' tool to store knowledge as you discover it.`
          }]
        };
      }

      logger.info(`[RECALL] Found ${totalMemories} relevant memories`);

      let responseText = `Found ${totalMemories} relevant memories:\n\n`;

      if (result.agentMemories.length > 0) {
        responseText += `### From Your Experience (${result.agentMemories.length})\n`;
        result.agentMemories.forEach(m => {
          responseText += `- ${m}\n`;
        });
        responseText += '\n';
      }

      if (result.projectMemories.length > 0) {
        responseText += `### From Project Knowledge (${result.projectMemories.length})\n`;
        result.projectMemories.forEach(m => {
          responseText += `- ${m}\n`;
        });
      }

      return {
        content: [{
          type: 'text',
          text: responseText.trim()
        }]
      };
    } catch (error) {
      logger.error(`[RECALL] Failed to recall memories:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to recall memories: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Record a learning during task work (record_learning tool)
   *
   * @param params - Record learning parameters
   * @returns MCP tool result
   */
  async recordLearning(params: RecordLearningToolParams): Promise<MCPToolResult> {
    try {
      logger.info(`[RECORD_LEARNING] Recording learning${params.relatedTask ? ` for task ${params.relatedTask}` : ''}`);

      const agentId = params.teamMemberId || this.sessionName;
      const projectPath = params.projectPath || this.projectPath;

      await this.memoryService.recordLearning({
        agentId,
        agentRole: this.agentRole,
        projectPath,
        learning: params.learning,
        relatedTask: params.relatedTask,
        relatedFiles: params.relatedFiles,
      });

      logger.info(`[RECORD_LEARNING] Learning recorded successfully`);

      let responseText = `✅ Learning recorded successfully\n\n`;
      responseText += `"${params.learning}"`;
      if (params.relatedTask) {
        responseText += `\n\nRelated to: ${params.relatedTask}`;
      }
      if (params.relatedFiles && params.relatedFiles.length > 0) {
        responseText += `\nRelated files: ${params.relatedFiles.join(', ')}`;
      }

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };
    } catch (error) {
      logger.error(`[RECORD_LEARNING] Failed to record learning:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to record learning: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get full memory context (get_my_context tool)
   *
   * @returns MCP tool result with full context
   */
  async getMyContext(): Promise<MCPToolResult> {
    try {
      logger.info(`[GET_MY_CONTEXT] Retrieving full context for ${this.sessionName}`);

      const agentId = this.sessionName;

      const context = await this.memoryService.getFullContext(agentId, this.projectPath);

      if (!context || context.trim().length === 0) {
        logger.info(`[GET_MY_CONTEXT] No context available`);
        return {
          content: [{
            type: 'text',
            text: `No knowledge context available yet.\n\nYou can build your knowledge base by:\n- Using 'remember' to store patterns, decisions, and gotchas\n- Using 'record_learning' to capture learnings during work\n\nKnowledge persists across sessions and helps you work more effectively.`
          }]
        };
      }

      logger.info(`[GET_MY_CONTEXT] Context retrieved: ${context.length} characters`);

      return {
        content: [{
          type: 'text',
          text: `# Your Knowledge Context\n\n${context}`
        }]
      };
    } catch (error) {
      logger.error(`[GET_MY_CONTEXT] Failed to get context:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get context: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Set a project goal (set_goal tool)
   */
  async handleSetGoal(params: SetGoalToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const service = GoalTrackingService.getInstance();
      await service.setGoal(projectPath, params.goal, params.setBy || 'orchestrator');
      return { content: [{ type: 'text', text: `✅ Goal set: "${params.goal}"` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to set goal: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Get active project goals (get_goals tool)
   */
  async handleGetGoals(params: GetGoalsToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const service = GoalTrackingService.getInstance();
      const goals = await service.getGoals(projectPath);
      return { content: [{ type: 'text', text: goals || 'No goals set yet.' }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to get goals: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Update team focus (update_focus tool)
   */
  async handleUpdateFocus(params: UpdateFocusToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const service = GoalTrackingService.getInstance();
      await service.updateFocus(projectPath, params.focus, params.updatedBy || 'orchestrator');
      return { content: [{ type: 'text', text: `✅ Focus updated: "${params.focus}"` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to update focus: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Get current team focus (get_focus tool)
   */
  async handleGetFocus(params: GetFocusToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const service = GoalTrackingService.getInstance();
      const focus = await service.getCurrentFocus(projectPath);
      return { content: [{ type: 'text', text: focus || 'No focus set yet.' }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to get focus: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Append to daily log (log_daily tool)
   */
  async handleLogDaily(params: LogDailyToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const agentId = params.teamMemberId || this.sessionName;
      const service = DailyLogService.getInstance();
      await service.appendEntry(projectPath, agentId, this.agentRole || 'unknown', params.entry);
      return { content: [{ type: 'text', text: `✅ Daily log entry recorded.` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to log daily entry: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Recall knowledge from all agents (recall_team_knowledge tool)
   */
  async handleRecallTeamKnowledge(params: RecallTeamKnowledgeToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const results = await this.memoryService.recallFromAllAgents(
        projectPath,
        params.context,
        params.limit || 20,
      );

      if (results.length === 0) {
        return { content: [{ type: 'text', text: `No team knowledge found for: "${params.context}"` }] };
      }

      const formatted = results.map(m => `- ${m}`).join('\n');
      return { content: [{ type: 'text', text: `# Team Knowledge\n\n${formatted}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to recall team knowledge: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Record a successful approach (record_success tool)
   */
  async handleRecordSuccess(params: RecordSuccessToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const agentId = params.teamMemberId || this.sessionName;
      const service = LearningAccumulationService.getInstance();
      await service.recordSuccess(projectPath, agentId, this.agentRole || 'unknown', params.description, params.context);
      return { content: [{ type: 'text', text: `✅ Success recorded: "${params.description.substring(0, 80)}..."` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to record success: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Record a failed approach (record_failure tool)
   */
  async handleRecordFailure(params: RecordFailureToolParams): Promise<MCPToolResult> {
    try {
      const projectPath = params.projectPath || this.projectPath;
      const agentId = params.teamMemberId || this.sessionName;
      const service = LearningAccumulationService.getInstance();
      await service.recordFailure(projectPath, agentId, this.agentRole || 'unknown', params.description, params.context);
      return { content: [{ type: 'text', text: `✅ Failure recorded: "${params.description.substring(0, 80)}..."` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to record failure: ${error instanceof Error ? error.message : 'Unknown error'}` }], isError: true };
    }
  }

  /**
   * Get relevant SOPs for the current situation (get_sops tool)
   *
   * @param params - Parameters including context and optional category
   * @returns MCP tool result with relevant SOPs
   */
  async getSOPs(params: GetSOPsParams): Promise<MCPToolResult> {
    try {
      logger.info(`[GET_SOPS] Getting SOPs for context: "${params.context.substring(0, 50)}..."`, {
        role: this.agentRole,
        category: params.category,
      });

      // Generate SOP context based on role and provided context
      const sopContext = await this.sopService.generateSOPContext({
        role: this.agentRole as SOPRole | 'all',
        taskContext: params.context,
        taskType: params.category,
      });

      if (!sopContext || sopContext.trim().length === 0) {
        logger.info(`[GET_SOPS] No specific SOPs found for context`);
        return {
          content: [{
            type: 'text',
            text: `No specific SOPs found for this context.\n\nUse general best practices for your role (${this.agentRole}).\n\nYou can try a different context or category to find relevant procedures.`
          }]
        };
      }

      logger.info(`[GET_SOPS] Found relevant SOPs: ${sopContext.length} characters`);

      return {
        content: [{
          type: 'text',
          text: sopContext
        }]
      };
    } catch (error) {
      logger.error(`[GET_SOPS] Failed to get SOPs:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to get SOPs: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /** Valid sender types for chat responses */
  private static readonly VALID_SENDER_TYPES = ['orchestrator', 'agent'] as const;
  private static readonly CHAT_RESPONSE_LOG_TAG = '[SEND_CHAT_RESPONSE]';

  /**
   * Send a chat response back to the UI
   *
   * This tool allows orchestrators and agents to send responses back to the
   * conversational chat dashboard, completing the chat response loop.
   *
   * @param params - The send chat response parameters
   * @returns MCP tool result indicating success or failure
   *
   * @example
   * ```typescript
   * // Send a simple response
   * await server.sendChatResponse({
   *   content: 'Task completed successfully!'
   * });
   *
   * // Send as a specific agent
   * await server.sendChatResponse({
   *   content: 'Code review completed',
   *   senderType: 'agent',
   *   senderName: 'Backend Developer'
   * });
   * ```
   */
  async sendChatResponse(params: SendChatResponseParams): Promise<MCPToolResult> {
    const logTag = AgentMuxMCPServer.CHAT_RESPONSE_LOG_TAG;

    try {
      // Input validation
      if (!params.content || params.content.trim().length === 0) {
        return {
          content: [{
            type: 'text',
            text: '❌ Content is required and cannot be empty'
          }],
          isError: true
        };
      }

      // Verify chatService is initialized
      if (!this.chatService.isInitialized()) {
        await this.chatService.initialize();
      }

      logger.info(`${logTag} Sending response to chat UI`, {
        conversationId: params.conversationId ?? 'current',
        senderType: params.senderType ?? 'orchestrator',
        contentLength: params.content.length,
      });

      // Determine conversation ID - use provided or get current
      const conversationId = await this.resolveConversationId(params.conversationId);

      // Build sender information with validated type
      const sender = this.buildChatSender(params);

      // Add the message to the chat
      const message = await this.chatService.addAgentMessage(
        conversationId,
        params.content,
        sender,
        params.metadata
      );

      logger.info(`${logTag} Response added to chat`, {
        messageId: message.id,
        conversationId,
      });

      return {
        content: [{
          type: 'text',
          text: `✅ Response sent to chat UI\n\nMessage ID: ${message.id}\nConversation: ${conversationId}\nSender: ${sender.name} (${sender.type})`
        }]
      };
    } catch (error) {
      logger.error(`${AgentMuxMCPServer.CHAT_RESPONSE_LOG_TAG} Failed to send chat response:`, error);
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to send chat response: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Send a message to a Slack channel or thread via the backend API
   *
   * This tool allows orchestrators and agents to send messages directly to Slack,
   * bypassing terminal output parsing to avoid PTY line-wrapping and ANSI artifacts.
   *
   * @param params - The send Slack message parameters
   * @returns MCP tool result indicating success or failure
   *
   * @example
   * ```typescript
   * await server.sendSlackMessage({
   *   channelId: 'C0123',
   *   text: 'Task completed!',
   *   threadTs: '1707430000.001234'
   * });
   * ```
   */
  async sendSlackMessage(params: SendSlackMessageParams): Promise<MCPToolResult> {
    try {
      if (!params.channelId || params.channelId.trim().length === 0) {
        return {
          content: [{ type: 'text', text: '❌ channelId is required and cannot be empty' }],
          isError: true
        };
      }

      if (!params.text || params.text.trim().length === 0) {
        return {
          content: [{ type: 'text', text: '❌ text is required and cannot be empty' }],
          isError: true
        };
      }

      logger.info(`[MCP:sendSlackMessage] Sending to channel ${params.channelId}`, {
        channelId: params.channelId,
        threadTs: params.threadTs ?? 'none',
        textLength: params.text.length,
      });

      const body: Record<string, string> = {
        channelId: params.channelId,
        text: params.text,
      };
      if (params.threadTs) {
        body.threadTs = params.threadTs;
      }

      const response = await fetch(`${this.apiBaseUrl}/api/slack/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AgentMux-MCP/1.0.0',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return {
          content: [{ type: 'text', text: `❌ Slack API error (${response.status}): ${(errorData as any).error || response.statusText}` }],
          isError: true
        };
      }

      const data = await response.json() as { success: boolean; data?: { messageTs: string } };

      return {
        content: [{
          type: 'text',
          text: `✅ Slack message sent\n\nChannel: ${params.channelId}${params.threadTs ? `\nThread: ${params.threadTs}` : ''}\nMessage TS: ${data.data?.messageTs ?? 'unknown'}`
        }]
      };
    } catch (error) {
      logger.error('[MCP:sendSlackMessage] Failed:', error);
      return {
        content: [{ type: 'text', text: `❌ Failed to send Slack message: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true
      };
    }
  }

  /**
   * Resolve conversation ID, creating a new conversation if needed
   *
   * @param providedId - Optional conversation ID provided by the caller
   * @returns The resolved conversation ID
   */
  private async resolveConversationId(providedId?: string): Promise<string> {
    if (providedId) {
      return providedId;
    }

    const currentConversation = await this.chatService.getCurrentConversation();
    if (currentConversation) {
      return currentConversation.id;
    }

    logger.warn(`${AgentMuxMCPServer.CHAT_RESPONSE_LOG_TAG} No active conversation found, creating new one`);
    const newConversation = await this.chatService.createNewConversation();
    return newConversation.id;
  }

  /**
   * Build a ChatSender object from params with validation
   *
   * @param params - The send chat response parameters
   * @returns A validated ChatSender object
   */
  private buildChatSender(params: SendChatResponseParams): ChatSender {
    const senderType = AgentMuxMCPServer.VALID_SENDER_TYPES.includes(
      params.senderType as typeof AgentMuxMCPServer.VALID_SENDER_TYPES[number]
    )
      ? params.senderType!
      : 'orchestrator';

    return {
      type: senderType,
      name: params.senderName ?? this.sessionName,
      id: this.sessionName,
    };
  }

  /**
   * Helper Methods for Ticket Management
   */
  private parseYAMLTicket(content: string): TicketInfo {
    const lines = content.split('\n');
    const ticket: TicketInfo = {
      id: '',
      title: '',
      status: 'open'
    };

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      switch (key.trim()) {
        case 'id': ticket.id = value; break;
        case 'title': ticket.title = value; break;
        case 'status': ticket.status = value; break;
        case 'assignedTo': ticket.assignedTo = value; break;
        case 'priority': ticket.priority = value; break;
        case 'description': ticket.description = value; break;
        case 'createdAt': ticket.createdAt = value; break;
        case 'updatedAt': ticket.updatedAt = value; break;
      }
    }

    return ticket;
  }

  private parseMDTicket(content: string, fileName: string, status: string, milestone: string): TicketInfo {
    const ticket: TicketInfo = {
      id: fileName.replace('.md', ''),
      title: fileName.replace('.md', '').replace(/-/g, ' '),
      status: status,
      milestone: milestone
    };

    // Parse frontmatter if exists
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const lines = frontmatter.split('\n');

      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        switch (key.trim()) {
          case 'title': ticket.title = value; break;
          case 'assignedTo': ticket.assignedTo = value; break;
          case 'priority': ticket.priority = value; break;
          case 'createdAt': ticket.createdAt = value; break;
          case 'updatedAt': ticket.updatedAt = value; break;
        }
      }

      ticket.description = frontmatterMatch[2].trim();
    } else {
      // Extract title from first line if it's a header
      const firstLine = content.split('\n')[0];
      if (firstLine.startsWith('#')) {
        ticket.title = firstLine.replace(/^#+\s*/, '');
      }
      ticket.description = content;
    }

    return ticket;
  }

  private async findTicketById(ticketId: string): Promise<TicketInfo | null> {

    // Search in tickets directory (YAML)
    const ticketsDir = path.join(this.projectPath, '.agentmux', 'tickets');
    try {
      const files = await fs.readdir(ticketsDir);
      for (const file of files) {
        if (file.includes(ticketId) && (file.endsWith('.yaml') || file.endsWith('.yml'))) {
          const content = await fs.readFile(path.join(ticketsDir, file), 'utf-8');
          return this.parseYAMLTicket(content);
        }
      }
    } catch (error) {
      // Tickets directory doesn't exist
    }

    // Search in tasks directory (MD)
    const tasksDir = path.join(this.projectPath, '.agentmux', 'tasks');
    try {
      const milestones = await fs.readdir(tasksDir, { withFileTypes: true });

      for (const milestone of milestones) {
        if (!milestone.isDirectory()) continue;

        const milestonePath = path.join(tasksDir, milestone.name);
        const statusDirs = ['open', 'in_progress', 'blocked', 'done'];

        for (const statusDir of statusDirs) {
          const statusPath = path.join(milestonePath, statusDir);
          try {
            const statusFiles = await fs.readdir(statusPath);
            for (const file of statusFiles) {
              if (file.includes(ticketId) && file.endsWith('.md')) {
                const content = await fs.readFile(path.join(statusPath, file), 'utf-8');
                const ticket = this.parseMDTicket(content, file, statusDir, milestone.name);
                ticket.path = path.join(statusPath, file);
                return ticket;
              }
            }
          } catch (statusError) {
            // Status folder doesn't exist
          }
        }
      }
    } catch (error) {
      // Tasks directory doesn't exist
    }

    return null;
  }

  private updateYAMLField(frontmatter: string, field: string, value: YAMLFieldValue): string {
    const lines = frontmatter.split('\n');
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`${field}:`)) {
        lines[i] = `${field}: ${Array.isArray(value) ? JSON.stringify(value) : value}`;
        updated = true;
        break;
      }
    }

    if (!updated) {
      lines.push(`${field}: ${Array.isArray(value) ? JSON.stringify(value) : value}`);
    }

    return lines.join('\n');
  }

  private async logProgress(message: string): Promise<void> {

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'progress.log');
    const logEntry = `${new Date().toISOString()} [${this.sessionName}]:\n${message}\n---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      logger.error('Failed to log progress:', error);
    }
  }

  private async logSchedule(message: string): Promise<void> {

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'scheduled.log');
    const logEntry = `${new Date().toISOString()}\n${message}\n---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      logger.error('Failed to log schedule:', error);
    }
  }

  private async logDelegation(from: string, to: string, task: string, priority?: string): Promise<void> {

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'delegations.log');
    const logEntry = `${new Date().toISOString()} [${from} → ${to}]:\n${task}\nPriority: ${priority || 'normal'}\n---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      logger.error('Failed to log delegation:', error);
    }
  }

  private async logTaskDelegation(taskPath: string, from: string, to: string, reason?: string, delegationChain?: string[]): Promise<void> {

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'task-delegations.log');
    const logEntry = `${new Date().toISOString()} [TASK DELEGATION]\n` +
      `Task: ${taskPath}\n` +
      `From: ${from}\n` +
      `To: ${to}\n` +
      `Reason: ${reason || 'Not specified'}\n` +
      `Delegation Chain: ${delegationChain && delegationChain.length > 0 ? delegationChain.join(' → ') + ' → ' + to : to}\n` +
      `---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      logger.error('Failed to log task delegation:', error);
    }
  }


  private parseTaskContent(content: string, taskPath: string): TaskContent {
    // Extract basic info from path using built-in path operations
    const pathParts = taskPath.split('/');
    const fileName = taskPath.split('/').pop()?.replace('.md', '') || 'unknown';

    // Better milestone extraction: look for task group patterns after .agentmux/tasks/
    let milestone = 'current';
    const tasksIndex = pathParts.findIndex(part => part === 'tasks');
    if (tasksIndex !== -1 && tasksIndex + 1 < pathParts.length) {
      const candidateMilestone = pathParts[tasksIndex + 1];
      // Check if it's a valid milestone (not a status folder)
      if (!['open', 'in_progress', 'blocked', 'done'].includes(candidateMilestone)) {
        milestone = candidateMilestone;
      }
    }

    // Parse frontmatter if exists
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    let title = fileName.replace(/-/g, ' ').replace(/_/g, ' ');
    let description = '';
    let priority = 'normal';
    let projectName = 'Current Project';

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const body = frontmatterMatch[2];

      // Parse YAML-like frontmatter
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        switch (key.trim()) {
          case 'title': title = value; break;
          case 'priority': priority = value; break;
          case 'project': projectName = value; break;
        }
      }

      description = body.trim();
    } else {
      // Extract title from first header
      const firstLine = content.split('\n')[0];
      if (firstLine.startsWith('#')) {
        title = firstLine.replace(/^#+\s*/, '');
      }
      description = content;
    }

    return {
      id: fileName,
      title: title,
      description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
      status: 'open',
      priority: priority,
      milestone: milestone,
      projectName: projectName
    };
  }

  /**
   * Shared Template Methods for Assignment Messages
   */
  private async loadAssignmentTemplate(): Promise<string> {

    const promptPath = path.join(process.cwd(), 'config', 'task_assignment', 'prompts', 'target-agent-assignment-prompt.md');

    try {
      return await fs.readFile(promptPath, 'utf-8');
    } catch (error) {
      // Fallback template if file not found
      return `📋 **TASK ASSIGNMENT** - {taskTitle}

**Task File:** \`{taskPath}\`
**Priority:** {taskPriority}

You are being assigned this task. You have two options:

1. **Accept and work on it:** Call \`accept_task\` and \`read_task\` to get started
2. **Delegate to another agent:** Call \`assign_task\` to delegate to someone more suitable

**Delegation chain:** {delegationChain}
**Delegated by:** {delegatedBy}
**Reason:** {reason}

Please respond promptly with either acceptance or delegation.`;
    }
  }

  private async buildAssignmentMessage(params: {
    template: string;
    taskPath?: string;
    taskDetails?: TaskDetails;
    taskProjectPath?: string;
    targetSessionName: string;
    delegatedBy?: string;
    reason?: string;
    delegationChain?: string[];
    task?: string;
    priority?: string;
    ticketId?: string;
  }): Promise<string> {
    const {
      template,
      taskPath = '',
      taskDetails = {},
      taskProjectPath = '',
      targetSessionName,
      delegatedBy = this.sessionName,
      reason = '',
      delegationChain = [],
      task = '',
      priority = 'normal',
      ticketId = ''
    } = params;

    // Build delegation chain
    const newChain = [...delegationChain];
    if (delegatedBy && !newChain.includes(delegatedBy)) {
      newChain.push(delegatedBy);
    }

    // Replace template variables
    return template
      .replace(/{taskPath}/g, taskPath || 'Direct delegation (no file)')
      .replace(/{absoluteTaskPath}/g, taskPath || 'Direct delegation (no file)')
      .replace(/{task_file_path}/g, taskPath || 'Direct delegation (no file)')
      .replace(/{taskTitle}/g, taskDetails.title || task || 'Task Assignment')
      .replace(/{taskId}/g, taskDetails.id || (taskPath ? path.basename(taskPath, '.md') : 'direct-task'))
      .replace(/{taskDescription}/g, taskDetails.description || task || 'See task details')
      .replace(/{taskPriority}/g, taskDetails.priority || priority)
      .replace(/{task_priority}/g, taskDetails.priority || priority)
      .replace(/{taskMilestone}/g, taskDetails.milestone || 'current')
      .replace(/{projectName}/g, taskDetails.projectName || 'Current Project')
      .replace(/{projectPath}/g, taskProjectPath)
      .replace(/{yourSessionName}/g, targetSessionName)
      .replace(/{assignedBy}/g, delegatedBy)
      .replace(/{assignmentTimestamp}/g, new Date().toISOString())
      .replace(/{currentTimestamp}/g, new Date().toISOString())
      .replace(/{delegationChain}/g, newChain.length > 0 ? newChain.join(' → ') : 'Direct assignment')
      .replace(/{delegatedBy}/g, delegatedBy)
      .replace(/{reason}/g, reason || 'Task assignment')
      .replace(/{ticketId}/g, ticketId || 'N/A');
  }

  /**
   * HTTP Server Management
   */
  async startHttpServer(port: number): Promise<void> {
    const httpServer = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const parsedUrl = url.parse(req.url || '', true);

      // Health check endpoint
      if (parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', mcp: 'running' }));
        return;
      }

      // MCP endpoint
      if (parsedUrl.pathname === '/mcp' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          let request: MCPRequest | undefined;
          try {
            request = JSON.parse(body);
            if (!request) {
              throw new Error('Invalid request');
            }
            
            let response: MCPResponse;

            // Handle MCP requests
            if (request.method === 'initialize') {
              response = {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: {
                    tools: {}
                  },
                  serverInfo: {
                    name: 'agentmux-mcp-server',
                    version: '1.0.0'
                  }
                }
              };
            } else if (request.method === 'notifications/initialized') {
              // Notification - send JSON response with no result/error
              response = {
                jsonrpc: '2.0',
                id: request.id
              };
            } else if (request.method === 'notifications/cancelled') {
              // Notification - send JSON response with no result/error  
              response = {
                jsonrpc: '2.0',
                id: request.id
              };
            } else if (request.method === 'tools/list') {
              response = {
                jsonrpc: '2.0',
                id: request.id,
                result: { tools: this.getToolDefinitions() }
              };
            } else if (request.method === 'tools/call') {
              const toolName = request.params.name;
              const toolArgs = request.params.arguments || {};
              
              let result: MCPToolResult;
              switch (toolName) {
                case 'send_message':
                  result = await this.sendMessage(toolArgs);
                  break;
                case 'broadcast':
                  result = await this.broadcast(toolArgs);
                  break;
                case 'get_team_status':
                  result = await this.getTeamStatus();
                  break;
                case 'get_agent_logs':
                  result = await this.getAgentLogs(toolArgs);
                  break;
                case 'get_agent_status':
                  result = await this.getAgentStatus(toolArgs);
                  break;
                case 'register_agent_status':
                  result = await this.registerAgentStatus(toolArgs);
                  break;
                case 'accept_task':
                  result = await this.acceptTask(toolArgs);
                  break;
                case 'complete_task':
                  result = await this.completeTask(toolArgs);
                  break;
                case 'check_quality_gates':
                  result = await this.checkQualityGates(toolArgs);
                  break;
                case 'read_task':
                  result = await this.readTask(toolArgs);
                  break;
                case 'block_task':
                  result = await this.blockTask(toolArgs);
                  break;
                case 'assign_task':
                  result = await this.assignTask(toolArgs);
                  break;
                case 'get_tickets':
                  result = await this.getTickets(toolArgs);
                  break;
                case 'update_ticket':
                  result = await this.updateTicket(toolArgs);
                  break;
                case 'report_progress':
                  result = await this.reportProgress(toolArgs);
                  break;
                case 'request_review':
                  result = await this.requestReview(toolArgs);
                  break;
                case 'schedule_check':
                  result = await this.scheduleCheck(toolArgs);
                  break;
                case 'enforce_commit':
                  result = await this.enforceCommit(toolArgs);
                  break;
                case 'create_team':
                  result = await this.createTeam(toolArgs);
                  break;
                case 'delegate_task':
                  result = await this.delegateTask(toolArgs);
                  break;
                case 'terminate_agent':
                  result = await this.terminateAgent(toolArgs);
                  break;
                case 'terminate_agents':
                  result = await this.terminateAgents(toolArgs);
                  break;
                // Memory Management Tools
                case 'remember':
                  result = await this.rememberKnowledge(toolArgs);
                  break;
                case 'recall':
                  result = await this.recallKnowledge(toolArgs);
                  break;
                case 'record_learning':
                  result = await this.recordLearning(toolArgs);
                  break;
                case 'get_my_context':
                  result = await this.getMyContext();
                  break;
                // Goal & Focus Tools
                case 'set_goal':
                  result = await this.handleSetGoal(toolArgs);
                  break;
                case 'get_goals':
                  result = await this.handleGetGoals(toolArgs);
                  break;
                case 'update_focus':
                  result = await this.handleUpdateFocus(toolArgs);
                  break;
                case 'get_focus':
                  result = await this.handleGetFocus(toolArgs);
                  break;
                case 'log_daily':
                  result = await this.handleLogDaily(toolArgs);
                  break;
                case 'recall_team_knowledge':
                  result = await this.handleRecallTeamKnowledge(toolArgs);
                  break;
                case 'record_success':
                  result = await this.handleRecordSuccess(toolArgs);
                  break;
                case 'record_failure':
                  result = await this.handleRecordFailure(toolArgs);
                  break;
                case 'get_sops':
                  result = await this.getSOPs(toolArgs);
                  break;

                // Chat Response Loop
                case 'send_chat_response':
                  result = await this.sendChatResponse(toolArgs);
                  break;

                // Slack Messaging
                case 'send_slack_message':
                  result = await this.sendSlackMessage(toolArgs);
                  break;

                // Orchestrator Tools - Role Management
                case 'create_role':
                  result = await this.wrapToolResult(handleCreateRole(toolArgs as CreateRoleToolParams));
                  break;
                case 'update_role':
                  result = await this.wrapToolResult(handleUpdateRole(toolArgs as UpdateRoleToolParams));
                  break;
                case 'list_roles':
                  result = await this.wrapToolResult(handleListRoles(toolArgs as ListRolesToolParams));
                  break;

                // Orchestrator Tools - Skill Management
                case 'create_skill':
                  result = await this.wrapToolResult(handleCreateSkill(toolArgs as CreateSkillToolParams));
                  break;
                case 'execute_skill':
                  result = await this.wrapToolResult(handleExecuteSkill(toolArgs as ExecuteSkillToolParams));
                  break;
                case 'list_skills':
                  result = await this.wrapToolResult(handleListSkills(toolArgs as ListSkillsToolParams));
                  break;

                // Orchestrator Tools - Project Management
                case 'create_project_folder':
                  result = await this.wrapToolResult(handleCreateProjectFolder(toolArgs as CreateProjectFolderToolParams));
                  break;
                case 'setup_project_structure':
                  result = await this.wrapToolResult(handleSetupProjectStructure(toolArgs as SetupProjectStructureToolParams));
                  break;
                case 'create_team_for_project':
                  result = await this.wrapToolResult(handleCreateTeamForProject(toolArgs as CreateTeamForProjectToolParams));
                  break;

                // Event Bus Tools
                case 'subscribe_event':
                  result = await this.subscribeEvent(toolArgs as SubscribeEventParams);
                  break;
                case 'unsubscribe_event':
                  result = await this.unsubscribeEvent(toolArgs as UnsubscribeEventParams);
                  break;
                case 'list_event_subscriptions':
                  result = await this.listEventSubscriptions();
                  break;

                default:
                  throw new Error(`Unknown tool: ${toolName}`);
              }
              
              response = {
                jsonrpc: '2.0',
                id: request.id,
                result: result
              };
            } else {
              response = {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                  code: -32601,
                  message: 'Method not found'
                }
              };
              
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            const errorResponse: MCPResponse = {
              jsonrpc: '2.0',
              id: request?.id,
              error: {
                code: -32603,
                message: 'Internal error',
                data: error instanceof Error ? error.message : 'Unknown error'
              }
            };
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorResponse));
          }
        });
        return;
      }

      // 404 for other paths
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    httpServer.listen(port, () => {
      logger.info(`╔════════════════════════════════════════════════╗`);
      logger.info(`║        AgentMux MCP Server Started!            ║`);
      logger.info(`╠════════════════════════════════════════════════╣`);
      logger.info(`║  🌐 URL: http://localhost:${port}/mcp           ║`);
      logger.info(`║  ❤️  Health: http://localhost:${port}/health    ║`);
      logger.info(`║  📡 Session: ${this.sessionName.padEnd(25)} ║`);
      logger.info(`║  📂 Project: ${path.basename(this.projectPath).padEnd(24)} ║`);
      logger.info(`╚════════════════════════════════════════════════╝`);
      logger.info('');
      logger.info('To configure Claude Code:');
      logger.info(`claude mcp add --transport http agentmux http://localhost:${port}/mcp`);
      logger.info('');
    });
  }

  /**
   * Subscribe to agent lifecycle events via the event bus API.
   *
   * @param params - Subscription parameters
   * @returns Tool result with subscription details
   */
  async subscribeEvent(params: SubscribeEventParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/events/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          subscriberSession: this.sessionName,
        }),
      });

      const data = await response.json() as { success: boolean; data?: unknown; error?: string };

      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Failed to subscribe: ${data.error || 'Unknown error'}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to subscribe to event: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  }

  /**
   * Unsubscribe from a previously created event subscription.
   *
   * @param params - Unsubscribe parameters
   * @returns Tool result indicating success or failure
   */
  async unsubscribeEvent(params: UnsubscribeEventParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/events/subscribe/${params.subscriptionId}`, {
        method: 'DELETE',
      });

      const data = await response.json() as { success: boolean; error?: string };

      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Failed to unsubscribe: ${data.error || 'Unknown error'}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Subscription ${params.subscriptionId} cancelled.` }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to unsubscribe: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  }

  /**
   * List active event subscriptions for this session.
   *
   * @returns Tool result with list of subscriptions
   */
  async listEventSubscriptions(): Promise<MCPToolResult> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/events/subscriptions?subscriberSession=${encodeURIComponent(this.sessionName)}`
      );

      const data = await response.json() as { success: boolean; data?: unknown; error?: string };

      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Failed to list subscriptions: ${data.error || 'Unknown error'}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Failed to list subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      };
    }
  }

  private getToolDefinitions(): ToolSchema[] {
    return [
      // Communication Tools
      {
        name: 'send_message',
        description: 'Send a message to another team member',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient team member session name' },
            message: { type: 'string', description: 'Message content' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['to', 'message']
        }
      },
      {
        name: 'broadcast',
        description: 'Broadcast a message to all team members',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to broadcast' },
            excludeSelf: { type: 'boolean', description: 'Exclude own session from broadcast' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['message']
        }
      },

      // Team Management Tools
      {
        name: 'get_team_status',
        description: 'Get current team status',
        inputSchema: {
          type: 'object',
          properties: {
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: []
        }
      },
      {
        name: 'get_agent_logs',
        description: 'Get terminal logs from another agent for monitoring their activity',
        inputSchema: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Name of the agent to get logs from' },
            sessionName: { type: 'string', description: 'Session name of the agent (alternative to agentName)' },
            lines: { type: 'number', description: 'Number of lines to retrieve (default: 50)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: []
        }
      },
      {
        name: 'get_agent_status',
        description: 'Get comprehensive status information about another agent',
        inputSchema: {
          type: 'object',
          properties: {
            agentName: { type: 'string', description: 'Name of the agent to check status for' },
            sessionName: { type: 'string', description: 'Session name of the agent (alternative to agentName)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: []
        }
      },
      {
        name: 'register_agent_status',
        description: 'Register agent as active and ready to receive instructions',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Agent role (orchestrator, tpm, dev, qa)' },
            sessionName: { type: 'string', description: 'Tmux session identifier' },
            teamMemberId: { type: 'string', description: 'Team member ID for association' },
            claudeSessionId: { type: 'string', description: 'Claude conversation/session ID for resuming on restart' }
          },
          required: ['role', 'sessionName']
        }
      },

      // Task Management Tools
      {
        name: 'accept_task',
        description: 'Accept a task and move it from open to in_progress folder',
        inputSchema: {
          type: 'object',
          properties: {
            absoluteTaskPath: { type: 'string', description: 'Absolute path to task file in open folder' },
            sessionName: { type: 'string', description: 'Session name of the team member accepting the task' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['absoluteTaskPath', 'sessionName']
        }
      },
      {
        name: 'complete_task',
        description: `Mark task as completed after verifying quality gates pass.

This tool will:
1. Run all required quality gates (typecheck, tests, build)
2. If all gates pass, move the task to done
3. If gates fail, return the failures for you to fix

**Important:** Do not call this until you believe ALL gates will pass.
Run tests and typecheck locally first.`,
        inputSchema: {
          type: 'object',
          properties: {
            absoluteTaskPath: { type: 'string', description: 'Absolute path to current task file' },
            sessionName: { type: 'string', description: 'Session name of the team member completing the task' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' },
            skipGates: { type: 'boolean', description: 'Skip quality gates (not recommended)', default: false },
            summary: { type: 'string', description: 'Summary of what was accomplished' }
          },
          required: ['absoluteTaskPath', 'sessionName']
        }
      },
      {
        name: 'check_quality_gates',
        description: `Run quality gates without completing the task.

Use this to verify your code will pass before calling complete_task.
Saves time by catching issues early.

Gates checked: typecheck, tests, build, lint (optional)`,
        inputSchema: {
          type: 'object',
          properties: {
            gates: { type: 'array', items: { type: 'string' }, description: 'Specific gates to run (default: all)' },
            skipOptional: { type: 'boolean', description: 'Skip optional gates like lint', default: false }
          },
          required: []
        }
      },
      {
        name: 'read_task',
        description: 'Read task file content from filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            absoluteTaskPath: { type: 'string', description: 'Absolute path to task file to read' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['absoluteTaskPath']
        }
      },
      {
        name: 'block_task',
        description: 'Block a task with questions for human review and move to blocked folder',
        inputSchema: {
          type: 'object',
          properties: {
            absoluteTaskPath: { type: 'string', description: 'Absolute path to task file in in_progress folder' },
            reason: { type: 'string', description: 'Reason for blocking the task' },
            questions: { type: 'array', items: { type: 'string' }, description: 'Questions requiring human answers' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level of the blocker' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['absoluteTaskPath', 'reason']
        }
      },
      {
        name: 'assign_task',
        description: 'Assign a task to another team member with delegation support and loop prevention',
        inputSchema: {
          type: 'object',
          properties: {
            absoluteTaskPath: { type: 'string', description: 'Absolute path to task file to assign' },
            targetSessionName: { type: 'string', description: 'Session name of the target team member' },
            delegatedBy: { type: 'string', description: 'Session name of the delegating agent (optional)' },
            reason: { type: 'string', description: 'Reason for delegation (optional)' },
            delegationChain: { type: 'array', items: { type: 'string' }, description: 'Current delegation chain to prevent loops (optional)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['absoluteTaskPath', 'targetSessionName']
        }
      },

      // Restored Ticket Management Tools
      {
        name: 'get_tickets',
        description: 'Get tickets and tasks from both YAML tickets and MD milestone structure',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Filter by status (open, in_progress, blocked, done)' },
            all: { type: 'boolean', description: 'Get all tickets (default: only assigned to you)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: []
        }
      },
      {
        name: 'update_ticket',
        description: 'Update ticket status, notes, and blockers',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'Ticket ID to update' },
            status: { type: 'string', description: 'New status (open, in_progress, blocked, done)' },
            notes: { type: 'string', description: 'Update notes' },
            blockers: { type: 'array', items: { type: 'string' }, description: 'List of blockers' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'report_progress',
        description: 'Report work progress with completion percentage and status',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'Related ticket ID (optional)' },
            progress: { type: 'number', description: 'Completion percentage (0-100)' },
            completed: { type: 'array', items: { type: 'string' }, description: 'List of completed items' },
            current: { type: 'string', description: 'What you are currently working on' },
            blockers: { type: 'array', items: { type: 'string' }, description: 'Current blockers' },
            nextSteps: { type: 'string', description: 'Next steps to take' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['progress']
        }
      },
      {
        name: 'request_review',
        description: 'Request code or work review from team members',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'Ticket ID for the work to review' },
            reviewer: { type: 'string', description: 'Specific reviewer session name (optional)' },
            branch: { type: 'string', description: 'Git branch to review (optional)' },
            message: { type: 'string', description: 'Review request message (optional)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'schedule_check',
        description: 'Schedule a future check or reminder',
        inputSchema: {
          type: 'object',
          properties: {
            minutes: { type: 'number', description: 'Minutes from now to send reminder' },
            message: { type: 'string', description: 'Reminder message' },
            target: { type: 'string', description: 'Target session name (optional, defaults to self)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['minutes', 'message']
        }
      },
      {
        name: 'enforce_commit',
        description: 'Force git commit of all current changes',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Custom commit message (optional)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: []
        }
      },

      // Orchestration Tools
      {
        name: 'create_team',
        description: 'Create a NEW team member session (orchestrator only). IMPORTANT: If the agent already exists, this will return an error — use delegate_task instead to assign work to existing agents. Check get_team_status first to see who is already running.',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Agent role (dev, qa, tpm, designer)' },
            name: { type: 'string', description: 'Session name' },
            projectPath: { type: 'string', description: 'Project path (optional)' },
            systemPrompt: { type: 'string', description: 'Initial system prompt (optional)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['role', 'name']
        }
      },
      {
        name: 'delegate_task',
        description: 'Delegate a task to an existing team member. Use this to assign work to agents that are already running (visible in get_team_status). The agent must already exist — use create_team first if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Target session name' },
            task: { type: 'string', description: 'Task description' },
            priority: { type: 'string', description: 'Task priority (low, normal, high, urgent)' },
            ticketId: { type: 'string', description: 'Related ticket ID (optional)' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['to', 'task', 'priority']
        }
      },
      {
        name: 'terminate_agent',
        description: 'Terminate an agent session (with safety checks)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionName: { type: 'string', description: 'Session name to terminate' },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['sessionName']
        }
      },
      {
        name: 'terminate_agents',
        description: 'Terminate multiple agent sessions in bulk (with safety checks)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionNames: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of session names to terminate'
            },
            teamMemberId: { type: 'string', description: 'Team member ID for heartbeat tracking (optional)' }
          },
          required: ['sessionNames']
        }
      },

      // Memory Management Tools
      {
        name: 'remember',
        description: `Store a piece of knowledge in your memory for future reference.

Use this when you:
- Discover a code pattern specific to this project
- Learn something important about how the codebase works
- Make or observe an architectural decision
- Find a gotcha or workaround
- Want to remember a preference or best practice

The knowledge will persist across sessions.`,
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The knowledge to remember (be specific and actionable)'
            },
            category: {
              type: 'string',
              enum: ['pattern', 'decision', 'gotcha', 'fact', 'preference', 'relationship'],
              description: 'Type of knowledge'
            },
            scope: {
              type: 'string',
              enum: ['agent', 'project'],
              description: 'agent = your role knowledge, project = project-specific knowledge'
            },
            title: {
              type: 'string',
              description: 'Short title for the knowledge (optional)'
            },
            metadata: {
              type: 'object',
              description: 'Additional context (files, severity, rationale, etc.)'
            },
            teamMemberId: {
              type: 'string',
              description: 'Your session name for identifying yourself. Pass your Session Name from Your Identity section.'
            },
            projectPath: {
              type: 'string',
              description: 'Your project root path. Pass your project path so knowledge is stored in the correct project.'
            }
          },
          required: ['content', 'category', 'scope']
        }
      },
      {
        name: 'recall',
        description: `Retrieve relevant knowledge from your memory based on what you're working on.

Use this when you:
- Start working on a new task and want to check for relevant patterns
- Need to remember how something was done before
- Want to check for known gotchas before making changes
- Need to recall a previous decision

Returns relevant memories from your agent knowledge and/or project knowledge.`,
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'What you are working on or looking for (be specific)'
            },
            scope: {
              type: 'string',
              enum: ['agent', 'project', 'both'],
              description: 'Where to search for memories (default: both)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of memories to return (default: 10)'
            },
            teamMemberId: {
              type: 'string',
              description: 'Your session name for identifying yourself. Pass your Session Name from Your Identity section.'
            },
            projectPath: {
              type: 'string',
              description: 'Your project root path. Pass your project path so knowledge is retrieved from the correct project.'
            }
          },
          required: ['context']
        }
      },
      {
        name: 'record_learning',
        description: `Record a learning or discovery while working on a task.

This is simpler than 'remember' - use it to quickly jot down learnings as you work.
Learnings are recorded in the project's learnings log and may also be added to your role knowledge.

Good learnings are:
- Specific and actionable
- Include context about when/why this applies
- Reference related files or components`,
        inputSchema: {
          type: 'object',
          properties: {
            learning: {
              type: 'string',
              description: 'What you learned (be specific)'
            },
            relatedTask: {
              type: 'string',
              description: 'Task ID this relates to (optional)'
            },
            relatedFiles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Related file paths (optional)'
            },
            teamMemberId: {
              type: 'string',
              description: 'Your session name for identifying yourself. Pass your Session Name from Your Identity section.'
            },
            projectPath: {
              type: 'string',
              description: 'Your project root path. Pass your project path so the learning is recorded in the correct project.'
            }
          },
          required: ['learning']
        }
      },
      {
        name: 'get_my_context',
        description: `Get your full knowledge context including agent knowledge and project knowledge.

Use this when you:
- Want to review what you know before starting a task
- Need a refresher on project patterns and decisions
- Want to check your performance metrics`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },

      // Goal & Focus Tools
      {
        name: 'set_goal',
        description: `Set a project goal. Use this when the user states a goal or objective for the team.`,
        inputSchema: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'The goal to set' },
            setBy: { type: 'string', description: 'Who set the goal (default: orchestrator)' },
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: ['goal'],
        },
      },
      {
        name: 'get_goals',
        description: `Get the project's active goals. Use this to review what the team is working towards.`,
        inputSchema: {
          type: 'object',
          properties: {
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: [],
        },
      },
      {
        name: 'update_focus',
        description: `Update the team's current focus. Use this to signal what the team should be working on right now.`,
        inputSchema: {
          type: 'object',
          properties: {
            focus: { type: 'string', description: 'Description of the current focus' },
            updatedBy: { type: 'string', description: 'Who updated the focus (default: orchestrator)' },
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: ['focus'],
        },
      },
      {
        name: 'get_focus',
        description: `Get the team's current focus. Use this to check what the team is actively working on.`,
        inputSchema: {
          type: 'object',
          properties: {
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: [],
        },
      },

      // Daily Log Tool
      {
        name: 'log_daily',
        description: `Add an entry to today's daily activity log. Use this to record significant actions and events.`,
        inputSchema: {
          type: 'object',
          properties: {
            entry: { type: 'string', description: 'The log entry text' },
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: ['entry'],
        },
      },

      // Cross-Agent Knowledge Tool
      {
        name: 'recall_team_knowledge',
        description: `Search for relevant knowledge across ALL agents that have worked on this project.
Use this to find patterns, decisions, or gotchas discovered by any team member.`,
        inputSchema: {
          type: 'object',
          properties: {
            context: { type: 'string', description: 'What you are looking for (be specific)' },
            limit: { type: 'number', description: 'Maximum results to return (default: 20)' },
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: ['context'],
        },
      },

      // Learning Accumulation Tools
      {
        name: 'record_success',
        description: `Record a successful pattern or approach that worked well.
The team will see this in future startup briefings to replicate success.`,
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'What worked well (be specific and actionable)' },
            context: { type: 'string', description: 'Additional context about when/why this works' },
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: ['description'],
        },
      },
      {
        name: 'record_failure',
        description: `Record a failed approach or pitfall to avoid.
The team will see this in future startup briefings to avoid repeating mistakes.`,
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'What failed or should be avoided (be specific)' },
            context: { type: 'string', description: 'Additional context about why it failed' },
            teamMemberId: { type: 'string', description: 'Your session name' },
            projectPath: { type: 'string', description: 'Your project root path' },
          },
          required: ['description'],
        },
      },

      // SOP Tool
      {
        name: 'get_sops',
        description: `Get relevant Standard Operating Procedures for your current situation.

Use this when you need guidance on:
- How to approach a task
- Best practices for your role
- How to handle errors or blockers
- Communication protocols
- Git workflow and coding standards

The SOPs returned will be tailored to your role and the context you provide.`,
        inputSchema: {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: 'Describe what you need guidance on (e.g., "committing code", "handling blockers", "testing procedures")'
            },
            category: {
              type: 'string',
              enum: ['workflow', 'quality', 'communication', 'escalation', 'tools', 'debugging', 'testing', 'git', 'security'],
              description: 'Specific category of SOPs (optional)'
            }
          },
          required: ['context']
        }
      },

      // Chat Response Loop Tool
      {
        name: 'send_chat_response',
        description: `Send a response back to the chat UI.

Use this tool to communicate with the user through the conversational dashboard.
This completes the chat response loop, allowing orchestrators and agents to
send messages, updates, and task completion reports back to the user.

**When to use:**
- Responding to user messages
- Reporting task completion status
- Providing progress updates
- Asking clarifying questions
- Sharing results or summaries

**Note:** Messages sent with this tool appear in the chat UI alongside
user messages, creating a full conversational experience.`,
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The message content to send to the user'
            },
            conversationId: {
              type: 'string',
              description: 'Conversation ID to add the message to (uses current conversation if not specified)'
            },
            senderType: {
              type: 'string',
              enum: ['orchestrator', 'agent'],
              description: 'Type of sender (defaults to orchestrator)'
            },
            senderName: {
              type: 'string',
              description: 'Name to display for the sender (defaults to session name)'
            },
            metadata: {
              type: 'object',
              description: 'Optional metadata to attach to the message'
            }
          },
          required: ['content']
        }
      },

      // Slack Messaging Tool
      {
        name: 'send_slack_message',
        description: `Send a message directly to a Slack channel or thread via the backend API.

This bypasses terminal output parsing, avoiding PTY line-wrapping and ANSI artifacts
that can garble messages sent through [NOTIFY] markers.

**When to use:**
- Sending status updates to Slack channels
- Replying in Slack threads
- Proactive notifications (task completions, errors, alerts)

**Note:** For chat UI messages, use send_chat_response instead.`,
        inputSchema: {
          type: 'object',
          properties: {
            channelId: {
              type: 'string',
              description: 'Slack channel ID to send the message to (e.g. C0123456789)'
            },
            text: {
              type: 'string',
              description: 'Message text to send (supports Slack markdown formatting)'
            },
            threadTs: {
              type: 'string',
              description: 'Thread timestamp for replying in a thread (optional)'
            }
          },
          required: ['channelId', 'text']
        }
      },

      // Event Bus Tools
      {
        name: 'subscribe_event',
        description: 'Subscribe to agent lifecycle events (e.g. agent becomes idle, active, inactive, busy). Returns a subscription ID. Matched events are delivered as terminal messages with [EVENT:subId:eventType] prefix.',
        inputSchema: {
          type: 'object',
          properties: {
            eventType: {
              type: 'string',
              enum: ['agent:status_changed', 'agent:idle', 'agent:busy', 'agent:active', 'agent:inactive'],
              description: 'Event type to subscribe to. Call multiple times to subscribe to multiple event types.'
            },
            filter: {
              type: 'object',
              properties: {
                sessionName: { type: 'string', description: 'Match events for a specific agent session name' },
                memberId: { type: 'string', description: 'Match events for a specific team member ID' },
                teamId: { type: 'string', description: 'Match events for a specific team ID' }
              },
              description: 'Filter criteria for matching events'
            },
            oneShot: { type: 'boolean', description: 'If true (default), subscription is removed after first match' },
            ttlMinutes: { type: 'number', description: 'Time-to-live in minutes (default: 30, max: 1440)' },
            messageTemplate: { type: 'string', description: 'Custom notification template. Placeholders: {memberName}, {sessionName}, {eventType}, {previousValue}, {newValue}, {teamName}' }
          },
          required: ['eventType', 'filter']
        }
      },
      {
        name: 'unsubscribe_event',
        description: 'Cancel an active event subscription by its ID',
        inputSchema: {
          type: 'object',
          properties: {
            subscriptionId: { type: 'string', description: 'ID of the subscription to cancel' }
          },
          required: ['subscriptionId']
        }
      },
      {
        name: 'list_event_subscriptions',
        description: 'List your active event subscriptions',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },

      // Orchestrator Tools - Role, Skill, and Project Management
      ...orchestratorToolDefinitions
    ];
  }

  /**
   * Wrap a tool result from the new tool handlers into MCPToolResult format
   *
   * @param resultPromise - Promise that resolves to ToolResultData
   * @returns MCPToolResult with content array
   */
  private async wrapToolResult(resultPromise: Promise<{ success: boolean; error?: string; [key: string]: unknown }>): Promise<MCPToolResult> {
    try {
      const result = await resultPromise;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  private analyzeAgentStatus(output: string): string {
    // Check for idle patterns first (highest priority)
    const idlePatterns = [
      /Type your message or @path\/to\/file/i,
      />\s*$/,
      /Task completed successfully/i,
      /✓.*completed/i,
      /✓.*done/i,
      /finished/i,
      /ready for next/i,
      /waiting for input/i,
      /bypass permissions/i,
      /⏵⏵ bypass permissions/i
    ];

    if (idlePatterns.some(pattern => output.match(pattern))) return 'idle';

    // Check for error patterns
    if (output.includes('error') || output.includes('Error')) return 'error';

    // Check for active operations (not just text presence)
    const activeGitPatterns = [
      /git commit.*\[running\]/i,
      /git add.*\[in progress\]/i,
      /Committing changes\.\.\./i,
      /staging.*files/i,
      /preparing commit/i
    ];

    if (activeGitPatterns.some(pattern => output.match(pattern))) return 'committing';

    // Check for waiting patterns
    if (output.includes('waiting') || output.includes('Waiting')) return 'waiting';
    if (output.includes('STATUS UPDATE')) return 'reporting';

    // Default to working only if none of the above patterns match
    return 'working';
  }

  private extractLastActivity(output: string): string {
    const lines = output.split('\n').filter(l => l.trim());
    return lines[lines.length - 1] || 'No recent activity';
  }

  private getDefaultNameFromSession(sessionName: string): string {
    // Handle orchestrator
    if (sessionName === 'agentmux-orc' || sessionName.includes('orchestrator')) {
      return 'Orchestrator';
    }

    // Handle vibecoder patterns
    if (sessionName.includes('fullstack-developer')) {
      return 'Fullstack Developer';
    }
    if (sessionName.includes('system-architect')) {
      return 'System Architect';
    }
    if (sessionName.includes('technical-product-manager')) {
      return 'Technical Product Manager';
    }
    if (sessionName.includes('frontend-developer')) {
      return 'Frontend Developer';
    }
    if (sessionName.includes('backend-developer')) {
      return 'Backend Developer';
    }
    if (sessionName.includes('qa')) {
      return 'QA Engineer';
    }
    if (sessionName.includes('designer')) {
      return 'Designer';
    }

    // Default fallback
    return sessionName;
  }

  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const lastRequest = this.requestQueue.get(identifier) || 0;

    if (now - lastRequest < TIMING_CONSTANTS.INTERVALS.RATE_LIMIT_WINDOW) {
      return false;
    }

    this.requestQueue.set(identifier, now);
    return true;
  }

  /**
   * Add task to in_progress_tasks.json for tracking
   */
  private async addTaskToInProgressTracking(taskPath: string, sessionName: string, assignmentResult: AssignmentResult): Promise<void> {
    try {
      const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
      const trackingDir = path.dirname(trackingFilePath);

      // Ensure directory exists
      await fs.mkdir(trackingDir, { recursive: true });

      // Load existing data
      let trackingData: TaskTrackingData = { tasks: [], lastUpdated: new Date().toISOString(), version: '1.0.0' };
      try {
        if (await fs.access(trackingFilePath).then(() => true).catch(() => false)) {
          const content = await fs.readFile(trackingFilePath, 'utf-8');
          trackingData = JSON.parse(content);
        }
      } catch (error) {
        logger.warn('Could not load existing in_progress_tasks.json, creating new one');
      }

      // Extract task information
      const taskName = path.basename(taskPath, '.md');
      const taskContent = await fs.readFile(taskPath.replace('/open/', '/in_progress/'), 'utf-8').catch(() => '');

      // Parse team information from assignment result
      const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        taskPath: assignmentResult.newPath || taskPath.replace('/open/', '/in_progress/'),
        taskName: taskName,
        assignedSessionName: sessionName,
        assignedTeamMemberId: assignmentResult.memberId || 'unknown',
        assignedAt: new Date().toISOString(),
        status: 'in_progress',
        originalPath: taskPath
      };

      // Add to tracking data
      trackingData.tasks = trackingData.tasks || [];
      trackingData.tasks.push(newTask);
      trackingData.lastUpdated = new Date().toISOString();

      // Save updated data
      await fs.writeFile(trackingFilePath, JSON.stringify(trackingData, null, 2), 'utf-8');

      logger.info(`Added task to in_progress tracking: ${taskName} -> ${sessionName}`);
    } catch (error) {
      logger.error('Error adding task to in_progress tracking:', error);
    }
  }

  /**
   * Remove task from in_progress_tasks.json when completed
   */
  private async removeTaskFromInProgressTracking(taskPath: string): Promise<void> {
    try {
      const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');

      // Load existing data
      let trackingData: TaskTrackingData = { tasks: [], lastUpdated: new Date().toISOString(), version: '1.0.0' };
      try {
        if (await fs.access(trackingFilePath).then(() => true).catch(() => false)) {
          const content = await fs.readFile(trackingFilePath, 'utf-8');
          trackingData = JSON.parse(content);
        }
      } catch (error) {
        logger.warn('Could not load in_progress_tasks.json for removal');
        return;
      }

      // Remove task by original path or current path
      const originalTaskCount = trackingData.tasks.length;
      trackingData.tasks = trackingData.tasks.filter((task: InProgressTask) =>
        task.taskPath !== taskPath &&
        task.originalPath !== taskPath &&
        task.taskPath !== taskPath.replace('/in_progress/', '/done/')
      );

      trackingData.lastUpdated = new Date().toISOString();

      // Save updated data
      await fs.writeFile(trackingFilePath, JSON.stringify(trackingData, null, 2), 'utf-8');

      const removedCount = originalTaskCount - trackingData.tasks.length;
      logger.info(`Removed ${removedCount} task(s) from in_progress tracking for path: ${taskPath}`);
    } catch (error) {
      logger.error('Error removing task from in_progress tracking:', error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Use spawn instead of execAsync since we removed execAsync
      spawn('find', ['/tmp', '-name', 'mcp-*', '-type', 'f', '-mtime', '+1', '-delete'], {
        stdio: 'ignore'
      });

      const now = Date.now();
      for (const [key, timestamp] of this.requestQueue.entries()) {
        if (now - timestamp > TIMING_CONSTANTS.INTERVALS.TASK_CLEANUP) {
          this.requestQueue.delete(key);
        }
      }

      this.lastCleanup = now;
    } catch (error) {
      logger.error('Cleanup error:', error);
    }
  }

  private async logMessage(from: string, to: string, message: string): Promise<void> {
    const logPath = `${this.projectPath}/.agentmux/memory/communication.log`;
    const logEntry = `${new Date().toISOString()} [${from} -> ${to}]: ${message}\n`;
    
    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      logger.error('Failed to log message:', error);
    }
  }
}