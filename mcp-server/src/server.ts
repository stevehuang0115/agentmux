#!/usr/bin/env node

import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import { execSync } from 'child_process';
import { TmuxService } from '../../backend/src/services/agent/tmux.service.js';
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
  AgentStatus
} from './types.js';


export class AgentMuxMCPServer {
  private sessionName: string;
  private apiBaseUrl: string;
  private projectPath: string;
  private agentRole: string;
  private tmuxService: TmuxService;
  private requestQueue: Map<string, number> = new Map();
  private lastCleanup: number = Date.now();

  constructor() {
    // Try to get session name from environment variable first
    // If not available, try to get from tmux directly
    this.sessionName = process.env.TMUX_SESSION_NAME || this.getCurrentTmuxSession() || 'mcp-server';
    this.apiBaseUrl = `http://localhost:${process.env.API_PORT || 8788}`;
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';

    // Initialize TmuxService
    this.tmuxService = new TmuxService();

    // Debug log session name
    console.log(`[MCP Server] Initialized with sessionName: ${this.sessionName}`);

    // Setup periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Get current tmux session name
   */
  private getCurrentTmuxSession(): string | null {
    try {
      const sessionName = execSync('tmux display-message -p "#S"', { encoding: 'utf8' }).trim();
      return sessionName || null;
    } catch (error) {
      console.warn('[MCP Server] Could not get tmux session name:', error);
      return null;
    }
  }

  /**
   * Initialize the MCP server and its dependencies
   */
  async initialize(): Promise<void> {
    try {
      // Initialize TmuxService
      await this.tmuxService.initialize();
      console.log('TmuxService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TmuxService:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy(): void {
    this.tmuxService.destroy();
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
      if (!(await this.tmuxService.sessionExists(params.to))) {
        console.warn(`Session ${params.to} does not exist, skipping message`);
        return {
          content: [{ type: 'text', text: `Session ${params.to} not found - message not sent` }],
        };
      }
      
      // Use TmuxService's robust message sending
      await this.tmuxService.sendMessage(params.to, params.message);

      // Log message for tracking
      this.logMessage(this.sessionName, params.to, params.message).catch(console.error);

      return {
        content: [{ type: 'text', text: `Message sent to ${params.to}` }],
      };
    } catch (error) {
      console.error(`Send message error: ${error}`);
      return {
        content: [{ type: 'text', text: `Failed to send message to ${params.to}: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true
      };
    }
  }

  async broadcast(params: BroadcastParams): Promise<MCPToolResult> {
    try {
      // Get all sessions using TmuxService
      const sessions = await this.tmuxService.listSessions();

      if (sessions.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active sessions found for broadcast' }],
        };
      }

      let broadcastCount = 0;
      const maxConcurrent = 3;
      const sessionNames = sessions.map((s: any) => s.sessionName);
      
      // Process sessions in batches
      for (let i = 0; i < sessionNames.length; i += maxConcurrent) {
        const batch = sessionNames.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (sessionName: string) => {
          if (params.excludeSelf && sessionName === this.sessionName) return;

          try {
            if (await this.tmuxService.sessionExists(sessionName)) {
              await this.tmuxService.sendMessage(sessionName, params.message);
              broadcastCount++;
            }
          } catch (error) {
            console.warn(`Failed to broadcast to session ${sessionName}: ${error}`);
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
      console.error(`Broadcast error: ${error}`);
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
      const sessions = await this.tmuxService.listSessions();

      // Get team data from backend API to enrich session information
      let teamData: any = null;
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/teams`);
        if (response.ok) {
          const data = await response.json();
          teamData = data;
        }
      } catch (error) {
        console.warn('Failed to fetch team data from API:', error);
      }

      const statuses = [];
      for (const sessionInfo of sessions) {
        const output = await this.tmuxService.capturePane(sessionInfo.sessionName, 20);
        const status = this.analyzeAgentStatus(output);

        // Debug logging for status detection
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEBUG] Status analysis for ${sessionInfo.sessionName}:`, {
            status,
            outputSnippet: output.slice(-100), // Last 100 chars
            sessionName: sessionInfo.sessionName
          });
        }

        // Find matching team member data
        let memberData: any = null;
        if (teamData?.data?.teams) {
          for (const team of teamData.data.teams) {
            if (team.members) {
              const member = team.members.find((m: any) =>
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
          sessionId: sessionInfo.sessionName,
          memberId: memberData?.id || null,
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
      if (!(await this.tmuxService.sessionExists(targetSession))) {
        return {
          content: [{
            type: 'text',
            text: `Session ${targetSession} not found or unable to capture logs`
          }],
          isError: true
        };
      }
      
      const logs = await this.tmuxService.capturePane(targetSession, lines);
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

    // Enhanced logging for debugging
    console.log(`[MCP-STATUS] 🔍 Starting agent status check for: ${agentName || sessionName}`);

    // Validate required parameters
    if (!agentName && !sessionName) {
      console.log('[MCP-STATUS] ❌ Missing required parameters');
      return {
        content: [{
          type: 'text',
          text: 'Error: either agentName or sessionName is required'
        }],
        isError: true
      };
    }

    const targetSession = (sessionName || agentName)!;
    console.log(`[MCP-STATUS] 🎯 Target session: ${targetSession}`);

    // Initialize status tracking
    let agentFound = false;
    let agentData: any = null;
    let teamData: any = null;
    let sessionExists = false;
    let paneOutput = '';

    // Step 1: Try to get status from backend API with retry logic
    let backendData: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[MCP-STATUS] 🌐 Backend API attempt ${attempt}/3...`);

        // Increased timeout from default
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

        backendData = await response.json();
        console.log(`[MCP-STATUS] ✅ Backend API success on attempt ${attempt}`);
        break;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`[MCP-STATUS] ❌ Backend API attempt ${attempt} failed: ${errorMsg}`);

        if (attempt === 3) {
          console.log('[MCP-STATUS] 🚨 All backend API attempts failed, using fallback');
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // Step 2: Search for agent in backend data
    if (backendData?.success && backendData?.data?.teams) {
      console.log(`[MCP-STATUS] 🔎 Searching through ${backendData.data.teams.length} teams...`);

      for (const team of backendData.data.teams) {
        if (team.members) {
          const member = team.members.find((m: any) =>
            m.sessionName === targetSession ||
            m.name === targetSession ||
            m.id === targetSession
          );

          if (member) {
            agentFound = true;
            agentData = member;
            teamData = team;
            console.log(`[MCP-STATUS] ✅ Agent found in team: ${team.name}`);
            break;
          }
        }
      }
    }

    // Step 3: Check tmux session existence with retry
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[MCP-STATUS] 🖥️ Checking tmux session (attempt ${attempt}/2)...`);
        sessionExists = await this.tmuxService.sessionExists(targetSession);
        console.log(`[MCP-STATUS] 📡 Session exists: ${sessionExists}`);
        break;
      } catch (error) {
        console.log(`[MCP-STATUS] ⚠️ Session check attempt ${attempt} failed:`, error);
        if (attempt === 2) {
          sessionExists = false; // Default to false if all attempts fail
        }
      }
    }

    // Step 4: Get pane output for progress indication (only if session exists)
    if (sessionExists) {
      try {
        console.log('[MCP-STATUS] 📋 Capturing pane output...');
        paneOutput = await this.tmuxService.capturePane(targetSession, 10);
        console.log(`[MCP-STATUS] ✅ Captured ${paneOutput.length} chars of output`);
      } catch (error) {
        console.log('[MCP-STATUS] ⚠️ Failed to capture pane output:', error);
        paneOutput = 'Unable to capture terminal output';
      }
    }

    // Step 5: Determine final agent status with better mapping
    let finalAgentStatus: string;
    let finalWorkingStatus: string;
    let statusIcon: string;
    let statusColor: string;

    if (agentFound && agentData) {
      // Use backend data as primary source
      finalAgentStatus = this.mapAgentStatus(agentData.agentStatus, sessionExists);
      finalWorkingStatus = agentData.workingStatus || 'idle';

      // Determine status presentation
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
    } else if (sessionExists) {
      // Session exists but not in backend - likely a manual session
      finalAgentStatus = 'session-only';
      finalWorkingStatus = 'unknown';
      statusIcon = '🔗';
      statusColor = 'SESSION ONLY (not registered)';
    } else {
      // No backend data and no session
      finalAgentStatus = 'unavailable';
      finalWorkingStatus = 'offline';
      statusIcon = '💀';
      statusColor = 'UNAVAILABLE';
    }

    // Step 6: Analyze pane output for progress indication
    const progressIndicator = this.analyzeAgentProgress(paneOutput);

    // Step 7: Build comprehensive status report
    const elapsedMs = Date.now() - startTime;
    console.log(`[MCP-STATUS] ✅ Status check completed in ${elapsedMs}ms`);

    let statusReport = `🔍 Status for ${targetSession}:\n\n`;

    // Agent Status Section
    statusReport += `${statusIcon} Agent Status: ${statusColor}\n`;
    statusReport += `⚡ Working Status: ${finalWorkingStatus.toUpperCase()}\n`;
    statusReport += `📡 Session: ${targetSession} (${sessionExists ? 'running' : 'not found'})\n`;

    if (agentFound && teamData) {
      statusReport += `👥 Team: ${teamData.name}\n`;
      statusReport += `🎭 Role: ${agentData.role || 'unknown'}\n`;
      statusReport += `🕐 Last Activity: ${agentData.lastActivityCheck || 'unknown'}\n`;
    }

    statusReport += `⏱️ Check Duration: ${elapsedMs}ms\n`;
    statusReport += `🔄 Backend API: ${backendData ? 'connected' : 'failed'}\n\n`;

    // Progress Indicator Section
    statusReport += `📊 Progress Indicator:\n${progressIndicator}\n\n`;

    // Recent Terminal Output Section (if available)
    if (sessionExists && paneOutput) {
      const outputLines = paneOutput.trim().split('\n').slice(-5); // Last 5 lines
      statusReport += `📋 Recent Terminal Activity (last 5 lines):\n`;
      statusReport += '```\n';
      if (outputLines.length > 0) {
        outputLines.forEach(line => {
          statusReport += `${line}\n`;
        });
      } else {
        statusReport += '(no recent output)\n';
      }
      statusReport += '```\n\n';
    } else if (sessionExists) {
      statusReport += `📋 Terminal Output: Unable to capture\n\n`;
    } else {
      statusReport += `📋 Terminal Output: Session not running\n\n`;
    }

    // Troubleshooting Section (if there are issues)
    if (!sessionExists || !agentFound) {
      statusReport += `🔧 Troubleshooting:\n`;
      if (!sessionExists) {
        statusReport += `• Session '${targetSession}' is not running in tmux\n`;
        statusReport += `• Try: tmux list-sessions to see active sessions\n`;
      }
      if (!agentFound) {
        statusReport += `• Agent not found in backend teams database\n`;
        statusReport += `• Agent may not be properly registered\n`;
      }
    }

    return {
      content: [{
        type: 'text',
        text: statusReport
      }],
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

  /**
   * Register Agent Status
   */
  async registerAgentStatus(params: RegisterAgentStatusParams): Promise<MCPToolResult> {
    const startTime = Date.now();
    console.log(`[MCP] 🚀 Starting agent registration process...`);
    console.log(`[MCP] 📋 Arguments:`, JSON.stringify(params, null, 2));
    console.log(`[MCP] 🌐 API Base URL: ${this.apiBaseUrl}`);
    console.log(`[MCP] 📍 Session Name: ${this.sessionName}`);
    console.log(`[MCP] 🎭 Agent Role: ${this.agentRole}`);
    
    try {
      const requestBody = {
        sessionName: params.sessionId,
        role: params.role,
        status: 'active',
        registeredAt: new Date().toISOString(),
        memberId: params.memberId
      };
      
      console.log(`[MCP] 📤 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const endpoint = `${this.apiBaseUrl}/api/teams/members/register`;
      console.log(`[MCP] 📡 Calling endpoint: ${endpoint}`);
      
      // Test API server connectivity
      try {
        console.log(`[MCP] 🔍 Testing API server connectivity...`);
        const healthResponse = await fetch(`${this.apiBaseUrl}/health`);
        console.log(`[MCP] 💓 Health check status: ${healthResponse.status} ${healthResponse.statusText}`);
      } catch (healthError) {
        console.log(`[MCP] ❌ Health check failed:`, healthError instanceof Error ? healthError.message : String(healthError));
      }
      
      // Make registration call
      console.log(`[MCP] 📞 Making registration API call...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AgentMux-MCP/1.0.0'
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[MCP] 📨 Response received - Status: ${response.status} ${response.statusText}`);
      console.log(`[MCP] 📋 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let responseBody = '';
        try {
          responseBody = await response.text();
          console.log(`[MCP] 📄 Response body:`, responseBody);
        } catch (bodyError) {
          console.log(`[MCP] ❌ Failed to read response body:`, bodyError);
        }
        
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`[MCP] ❌ Registration failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Parse response
      let responseData;
      try {
        const responseText = await response.text();
        console.log(`[MCP] 📄 Response body text:`, responseText);
        if (responseText) {
          responseData = JSON.parse(responseText);
          console.log(`[MCP] 📋 Parsed response data:`, JSON.stringify(responseData, null, 2));
        }
      } catch (parseError) {
        console.log(`[MCP] ❌ Failed to parse response body:`, parseError);
      }

      const duration = Date.now() - startTime;
      console.log(`[MCP] ✅ Registration successful! Duration: ${duration}ms`);

      return {
        content: [{
          type: 'text',
          text: `Agent registered successfully. Role: ${params.role}, Session: ${params.sessionId}${params.memberId ? `, Member ID: ${params.memberId}` : ''}`
        }]
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`[MCP] ❌ Registration failed after ${duration}ms`);
      console.log(`[MCP] 💥 Error details:`, error);
      
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
          taskPath: params.taskPath,
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
            text: `❌ Task assignment failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.taskPath}${result.currentFolder ? `\n📁 Current Folder: ${result.currentFolder}` : ''}${result.expectedFolder ? `\n🎯 Expected Folder: ${result.expectedFolder}` : ''}`
          }],
          isError: true
        };
      }

      // Add task to in_progress_tasks.json
      await this.addTaskToInProgressTracking(params.taskPath, params.sessionName, result);

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
          taskPath: params.taskPath
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
            text: `❌ Task read failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.taskPath}`
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

  async completeTask(params: CompleteTaskParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: params.taskPath,
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
            text: `❌ Task completion failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.taskPath}${result.currentFolder ? `\n📁 Current Folder: ${result.currentFolder}` : ''}${result.expectedFolder ? `\n🎯 Expected Folder: ${result.expectedFolder}` : ''}`
          }],
          isError: true
        };
      }

      // Success case - remove task from in_progress_tasks.json
      await this.removeTaskFromInProgressTracking(params.taskPath);

      return {
        content: [{
          type: 'text',
          text: `✅ Task completed successfully: ${result.message || 'Task moved to done folder and removed from tracking'}`
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

  async blockTask(params: BlockTaskParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: params.taskPath,
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
            text: `❌ Task blocking failed: ${result.error}\n\n📋 Details: ${result.details}\n\n💡 Suggestion: ${result.suggestion || result.action || 'Check the task file path and workflow state'}\n\n📂 Task Path: ${result.taskPath || params.taskPath}${result.currentFolder ? `\n📁 Current Folder: ${result.currentFolder}` : ''}${result.expectedFolder ? `\n🎯 Expected Folder: ${result.expectedFolder}` : ''}`
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
      const { taskPath, targetSessionName, delegatedBy, reason, delegationChain = [] } = params;
      console.log(`📋 Assigning task to ${targetSessionName} via delegation`);

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
      if (!(await this.tmuxService.sessionExists(targetSessionName))) {
        return {
          content: [{
            type: 'text',
            text: `❌ Target session '${targetSessionName}' not found or not accessible`
          }],
          isError: true
        };
      }

      // Read the task file to get details
      let taskDetails: any = {};
      let taskProjectPath = this.projectPath; // Default fallback

      try {
        const taskReadResult = await this.readTask({ taskPath });
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
        console.warn('Could not read task details for assignment:', error);
      }

      // Load the assignment prompt template from agentmux config directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const promptPath = path.join(process.cwd(), 'config', 'task_assignment', 'prompts', 'target-agent-assignment-prompt.md');
      let promptTemplate = '';

      try {
        promptTemplate = await fs.readFile(promptPath, 'utf-8');
      } catch (error) {
        // Final fallback message if template not found
        promptTemplate = `📋 **TASK ASSIGNMENT** - {taskTitle}

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

      // Build updated delegation chain
      const newChain = [...currentChain];
      if (delegatedBy && !newChain.includes(delegatedBy)) {
        newChain.push(delegatedBy);
      }

      // Debug logging for template variables
      console.log(`[MCP] 🔍 Template replacement debug:`);
      console.log(`[MCP]   taskPath: "${taskPath}"`);
      console.log(`[MCP]   taskProjectPath: "${taskProjectPath}"`);
      console.log(`[MCP]   targetSessionName: "${targetSessionName}"`);

      // Replace template variables
      const assignmentMessage = promptTemplate
        .replace(/{taskPath}/g, taskPath || 'ERROR: taskPath is empty')
        .replace(/{taskTitle}/g, taskDetails.title || 'Task Assignment')
        .replace(/{taskId}/g, taskDetails.id || path.basename(taskPath, '.md'))
        .replace(/{taskDescription}/g, taskDetails.description || 'See task file for details')
        .replace(/{taskPriority}/g, taskDetails.priority || 'normal')
        .replace(/{taskMilestone}/g, taskDetails.milestone || 'current')
        .replace(/{projectName}/g, taskDetails.projectName || 'Current Project')
        .replace(/{projectPath}/g, taskProjectPath)
        .replace(/{yourSessionName}/g, targetSessionName)
        .replace(/{assignedBy}/g, delegatedBy || this.sessionName)
        .replace(/{assignmentTimestamp}/g, new Date().toISOString())
        .replace(/{delegationChain}/g, newChain.length > 0 ? newChain.join(' → ') : 'Direct assignment')
        .replace(/{delegatedBy}/g, delegatedBy || this.sessionName)
        .replace(/{reason}/g, reason || 'Task assignment');

      // Send assignment message directly to target session
      console.log(`[MCP] 📤 Sending assignment message to ${targetSessionName}...`);
      console.log(`[MCP] 📝 Assignment details: ${taskDetails.title || taskPath}`);

      try {
        // Use the existing sendMessage method to send the assignment
        await this.sendMessage({
          to: targetSessionName,
          message: assignmentMessage
        });

        console.log(`[MCP] ✅ Assignment message sent to ${targetSessionName}`);

      } catch (messageError) {
        console.error(`[MCP] ❌ Failed to send assignment message:`, messageError);
        throw new Error(`Failed to send assignment message to ${targetSessionName}: ${messageError instanceof Error ? messageError.message : 'Unknown error'}`);
      }

      // Log the delegation
      await this.logTaskDelegation(taskPath, this.sessionName, targetSessionName, reason, newChain);

      console.log(`[MCP] ✅ Task delegation completed successfully for ${targetSessionName}`);

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
      console.log('🎫 Getting tickets and tasks');
      const { status, all } = params;

      const tickets: TicketInfo[] = [];
      const fs = await import('fs/promises');
      const path = await import('path');

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
        console.warn('No legacy YAML tickets found:', error);
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
        console.warn('No MD task structure found:', error);
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
      console.log(`📝 Updating ticket ${ticketId}`);

      const fs = await import('fs/promises');

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
          const path = await import('path');
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
      console.log(`📊 Reporting progress for ${ticketId || 'current work'}: ${progress}%`);

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
      const orchestratorSessions = await this.tmuxService.listSessions();
      const orchestrator = orchestratorSessions.find((s: any) =>
        s.sessionName.includes('orchestrator') || s.sessionName.includes('orc')
      );

      if (orchestrator) {
        await this.tmuxService.sendMessage(orchestrator.sessionName, `📊 PROGRESS UPDATE:\n${message}`);
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
      console.log(`👀 Requesting review for ticket ${ticketId}`);

      let reviewMessage = `REVIEW REQUEST\n`;
      reviewMessage += `From: ${this.sessionName}\n`;
      reviewMessage += `Ticket: ${ticketId}\n`;
      if (branch) reviewMessage += `Branch: ${branch}\n`;
      reviewMessage += `\nRequest: ${message || 'Please review my work'}\n`;
      reviewMessage += `\nPlease provide feedback and approve when ready.`;

      if (reviewer) {
        // Send to specific reviewer
        if (await this.tmuxService.sessionExists(reviewer)) {
          await this.tmuxService.sendMessage(reviewer, reviewMessage);
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
        const sessions = await this.tmuxService.listSessions();
        let sentCount = 0;

        for (const sessionInfo of sessions) {
          if (sessionInfo.sessionName === this.sessionName) continue;

          try {
            await this.tmuxService.sendMessage(sessionInfo.sessionName, reviewMessage);
            sentCount++;
          } catch (error) {
            console.warn(`Failed to send review request to ${sessionInfo.sessionName}`);
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
      console.log(`⏰ Scheduling check in ${minutes} minutes`);

      const checkTime = new Date(Date.now() + minutes * 60 * 1000);
      const scheduleMessage = `SCHEDULED CHECK - ${checkTime.toISOString()}\nFrom: ${this.sessionName}\nMessage: ${message}`;

      // Use setTimeout for the schedule (simple implementation)
      setTimeout(async () => {
        try {
          if (target && await this.tmuxService.sessionExists(target)) {
            await this.tmuxService.sendMessage(target, `⏰ ${message}`);
          } else {
            // Send back to self
            await this.tmuxService.sendMessage(this.sessionName, `⏰ REMINDER: ${message}`);
          }
        } catch (error) {
          console.error('Scheduled check failed:', error);
        }
      }, minutes * 60 * 1000);

      // Log the scheduled check
      await this.logSchedule(scheduleMessage);

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
      console.log('🔒 Enforcing git commit');

      const { spawn } = await import('child_process');
      const path = await import('path');

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
            const commitMsg = message || `Auto-commit: ${changes} changes by ${this.sessionName}`;

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
      console.log(`🚀 Creating team ${name} with role ${role}`);

      // Check orchestrator permission
      if (!this.sessionName.includes('orchestrator') && this.sessionName !== 'mcp-server') {
        throw new Error('Only orchestrator can create teams');
      }

      // Create tmux session using TmuxService
      const sessionConfig = {
        name: name,
        role: role as 'orchestrator' | 'tpm' | 'pgm' | 'developer' | 'frontend-developer' | 'backend-developer' | 'qa' | 'tester' | 'designer',
        systemPrompt: systemPrompt || `You are a ${role} agent in the AgentMux team. Please collaborate effectively with other team members.`,
        projectPath: projectPath || this.projectPath,
        runtimeType: 'claude-code' as const
      };
      await this.tmuxService.createSession(sessionConfig);

      // Send initial setup commands
      const setupCommands = [
        `export TMUX_SESSION_NAME="${name}"`,
        `export AGENT_ROLE="${role}"`,
        `export PROJECT_PATH="${projectPath || this.projectPath}"`,
        `cd "${projectPath || this.projectPath}"`,
      ];

      for (const cmd of setupCommands) {
        await this.tmuxService.sendKey(name, cmd);
        await this.tmuxService.sendKey(name, 'Enter');
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Send system prompt if provided
      if (systemPrompt) {
        await this.tmuxService.sendMessage(name, `SYSTEM PROMPT:\n${systemPrompt}\n\nPlease acknowledge and begin work.`);
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
          console.log(`Registered ${name} with backend API`);
        }
      } catch (apiError) {
        console.warn(`Failed to register with API: ${apiError}`);
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
      console.log(`📋 Delegating task to ${to}`);

      const taskMessage = `TASK DELEGATION\n` +
        `From: ${this.sessionName}\n` +
        `Priority: ${priority || 'normal'}\n` +
        `${ticketId ? `Ticket ID: ${ticketId}\n` : ''}` +
        `Task: ${task}\n\n` +
        `Please acknowledge and provide ETA.`;

      if (await this.tmuxService.sessionExists(to)) {
        await this.tmuxService.sendMessage(to, taskMessage);

        // Log delegation
        await this.logDelegation(this.sessionName, to, task, priority);

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

  async shutdownAgent(params: ShutdownAgentParams): Promise<MCPToolResult> {
    try {
      const { session } = params;
      console.log(`🛑 Shutting down agent session ${session}`);

      // Safety checks
      if (session === 'orchestrator' || session === this.sessionName) {
        throw new Error('Cannot shutdown orchestrator or self');
      }

      if (session.includes('orchestrator') || session.includes('orc')) {
        throw new Error('Cannot shutdown orchestrator sessions');
      }

      // Check if session exists
      if (!(await this.tmuxService.sessionExists(session))) {
        throw new Error(`Session ${session} not found`);
      }

      // Send warning message first
      await this.tmuxService.sendMessage(session, '⚠️  WARNING: Agent shutdown in 5 seconds. Please save your work!');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Shutdown the session
      await this.tmuxService.killSession(session);

      // Notify remaining sessions
      await this.broadcast({
        message: `🛑 Agent ${session} has been shutdown by ${this.sessionName}`,
        excludeSelf: true
      });

      return {
        content: [{
          type: 'text',
          text: `✅ Agent session ${session} shutdown successfully`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to shutdown agent: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
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
    const fs = await import('fs/promises');
    const path = await import('path');

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

  private updateYAMLField(frontmatter: string, field: string, value: any): string {
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
    const fs = await import('fs/promises');
    const path = await import('path');

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'progress.log');
    const logEntry = `${new Date().toISOString()} [${this.sessionName}]:\n${message}\n---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Failed to log progress:', error);
    }
  }

  private async logSchedule(message: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'scheduled.log');
    const logEntry = `${new Date().toISOString()}\n${message}\n---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Failed to log schedule:', error);
    }
  }

  private async logDelegation(from: string, to: string, task: string, priority?: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const logPath = path.join(this.projectPath, '.agentmux', 'memory', 'delegations.log');
    const logEntry = `${new Date().toISOString()} [${from} → ${to}]:\n${task}\nPriority: ${priority || 'normal'}\n---\n\n`;

    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Failed to log delegation:', error);
    }
  }

  private async logTaskDelegation(taskPath: string, from: string, to: string, reason?: string, delegationChain?: string[]): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

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
      console.error('Failed to log task delegation:', error);
    }
  }


  private parseTaskContent(content: string, taskPath: string): any {
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
      priority: priority,
      milestone: milestone,
      projectName: projectName
    };
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
                case 'shutdown_agent':
                  result = await this.shutdownAgent(toolArgs);
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
      console.log(`╔════════════════════════════════════════════════╗`);
      console.log(`║        AgentMux MCP Server Started!            ║`);
      console.log(`╠════════════════════════════════════════════════╣`);
      console.log(`║  🌐 URL: http://localhost:${port}/mcp           ║`);
      console.log(`║  ❤️  Health: http://localhost:${port}/health    ║`);
      console.log(`║  📡 Session: ${this.sessionName.padEnd(25)} ║`);
      console.log(`║  📂 Project: ${path.basename(this.projectPath).padEnd(24)} ║`);
      console.log(`╚════════════════════════════════════════════════╝`);
      console.log('');
      console.log('To configure Claude Code:');
      console.log(`claude mcp add --transport http agentmux http://localhost:${port}/mcp`);
      console.log('');
    });
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
            message: { type: 'string', description: 'Message content' }
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
            excludeSelf: { type: 'boolean', description: 'Exclude own session from broadcast' }
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
          properties: {},
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
            lines: { type: 'number', description: 'Number of lines to retrieve (default: 50)' }
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
            sessionName: { type: 'string', description: 'Session name of the agent (alternative to agentName)' }
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
            sessionId: { type: 'string', description: 'Tmux session identifier' },
            memberId: { type: 'string', description: 'Team member ID for association' }
          },
          required: ['role', 'sessionId']
        }
      },

      // Task Management Tools
      {
        name: 'accept_task',
        description: 'Accept a task and move it from open to in_progress folder',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to task file in open folder' },
            sessionName: { type: 'string', description: 'Session name of the team member accepting the task' }
          },
          required: ['taskPath', 'sessionName']
        }
      },
      {
        name: 'complete_task',
        description: 'Mark task as completed and move to done folder',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to current task file' },
            sessionName: { type: 'string', description: 'Session name of the team member completing the task' }
          },
          required: ['taskPath', 'sessionName']
        }
      },
      {
        name: 'read_task',
        description: 'Read task file content from filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to task file to read' }
          },
          required: ['taskPath']
        }
      },
      {
        name: 'block_task',
        description: 'Block a task with questions for human review and move to blocked folder',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to task file in in_progress folder' },
            reason: { type: 'string', description: 'Reason for blocking the task' },
            questions: { type: 'array', items: { type: 'string' }, description: 'Questions requiring human answers' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Urgency level of the blocker' }
          },
          required: ['taskPath', 'reason']
        }
      },
      {
        name: 'assign_task',
        description: 'Assign a task to another team member with delegation support and loop prevention',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to task file to assign' },
            targetSessionName: { type: 'string', description: 'Session name of the target team member' },
            delegatedBy: { type: 'string', description: 'Session name of the delegating agent (optional)' },
            reason: { type: 'string', description: 'Reason for delegation (optional)' },
            delegationChain: { type: 'array', items: { type: 'string' }, description: 'Current delegation chain to prevent loops (optional)' }
          },
          required: ['taskPath', 'targetSessionName']
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
            all: { type: 'boolean', description: 'Get all tickets (default: only assigned to you)' }
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
            blockers: { type: 'array', items: { type: 'string' }, description: 'List of blockers' }
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
            nextSteps: { type: 'string', description: 'Next steps to take' }
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
            message: { type: 'string', description: 'Review request message (optional)' }
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
            target: { type: 'string', description: 'Target session name (optional, defaults to self)' }
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
            message: { type: 'string', description: 'Custom commit message (optional)' }
          },
          required: []
        }
      },

      // Orchestration Tools
      {
        name: 'create_team',
        description: 'Create a new team member session (orchestrator only)',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Agent role (dev, qa, tpm, designer)' },
            name: { type: 'string', description: 'Session name' },
            projectPath: { type: 'string', description: 'Project path (optional)' },
            systemPrompt: { type: 'string', description: 'Initial system prompt (optional)' }
          },
          required: ['role', 'name']
        }
      },
      {
        name: 'delegate_task',
        description: 'Delegate a task to another team member',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Target session name' },
            task: { type: 'string', description: 'Task description' },
            priority: { type: 'string', description: 'Task priority (low, normal, high, urgent)' },
            ticketId: { type: 'string', description: 'Related ticket ID (optional)' }
          },
          required: ['to', 'task', 'priority']
        }
      },
      {
        name: 'shutdown_agent',
        description: 'Shutdown an agent session (with safety checks)',
        inputSchema: {
          type: 'object',
          properties: {
            session: { type: 'string', description: 'Session name to shutdown' }
          },
          required: ['session']
        }
      }
    ];
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
      /waiting for input/i
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
    
    if (now - lastRequest < 1000) {
      return false;
    }
    
    this.requestQueue.set(identifier, now);
    return true;
  }

  /**
   * Add task to in_progress_tasks.json for tracking
   */
  private async addTaskToInProgressTracking(taskPath: string, sessionName: string, assignmentResult: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');
      const trackingDir = path.dirname(trackingFilePath);

      // Ensure directory exists
      await fs.mkdir(trackingDir, { recursive: true });

      // Load existing data
      let trackingData: any = { tasks: [], lastUpdated: new Date().toISOString(), version: '1.0.0' };
      try {
        if (await fs.access(trackingFilePath).then(() => true).catch(() => false)) {
          const content = await fs.readFile(trackingFilePath, 'utf-8');
          trackingData = JSON.parse(content);
        }
      } catch (error) {
        console.warn('Could not load existing in_progress_tasks.json, creating new one');
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
        assignedMemberId: assignmentResult.memberId || 'unknown',
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

      console.log(`Added task to in_progress tracking: ${taskName} -> ${sessionName}`);
    } catch (error) {
      console.error('Error adding task to in_progress tracking:', error);
    }
  }

  /**
   * Remove task from in_progress_tasks.json when completed
   */
  private async removeTaskFromInProgressTracking(taskPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const trackingFilePath = path.join(os.homedir(), '.agentmux', 'in_progress_tasks.json');

      // Load existing data
      let trackingData: any = { tasks: [], lastUpdated: new Date().toISOString(), version: '1.0.0' };
      try {
        if (await fs.access(trackingFilePath).then(() => true).catch(() => false)) {
          const content = await fs.readFile(trackingFilePath, 'utf-8');
          trackingData = JSON.parse(content);
        }
      } catch (error) {
        console.warn('Could not load in_progress_tasks.json for removal');
        return;
      }

      // Remove task by original path or current path
      const originalTaskCount = trackingData.tasks.length;
      trackingData.tasks = trackingData.tasks.filter((task: any) =>
        task.taskPath !== taskPath &&
        task.originalPath !== taskPath &&
        task.taskPath !== taskPath.replace('/in_progress/', '/done/')
      );

      trackingData.lastUpdated = new Date().toISOString();

      // Save updated data
      await fs.writeFile(trackingFilePath, JSON.stringify(trackingData, null, 2), 'utf-8');

      const removedCount = originalTaskCount - trackingData.tasks.length;
      console.log(`Removed ${removedCount} task(s) from in_progress tracking for path: ${taskPath}`);
    } catch (error) {
      console.error('Error removing task from in_progress tracking:', error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Use spawn instead of execAsync since we removed execAsync
      const { spawn } = await import('child_process');
      spawn('find', ['/tmp', '-name', 'mcp-*', '-type', 'f', '-mtime', '+1', '-delete'], {
        stdio: 'ignore'
      });

      const now = Date.now();
      for (const [key, timestamp] of this.requestQueue.entries()) {
        if (now - timestamp > 300000) {
          this.requestQueue.delete(key);
        }
      }

      this.lastCleanup = now;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  private async logMessage(from: string, to: string, message: string): Promise<void> {
    const logPath = `${this.projectPath}/.agentmux/memory/communication.log`;
    const logEntry = `${new Date().toISOString()} [${from} -> ${to}]: ${message}\n`;
    
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Failed to log message:', error);
    }
  }
}