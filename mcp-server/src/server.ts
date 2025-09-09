#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
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
  LoadProjectContextParams,
  AssignTaskParams,
  AcceptTaskParams,
  CompleteTaskParams,
  BlockTaskParams,
  TakeNextTaskParams,
  SyncTaskStatusParams,
  CheckTeamProgressParams,
  ReadTaskFileParams,
  ReportReadyParams,
  RegisterAgentStatusParams,
  GetAgentLogsParams,
  GetAgentStatusParams,
  ToolSchema,
  AgentStatus
} from './types.js';

const execAsync = promisify(exec);

export class AgentMuxMCPServer {
  private sessionName: string;
  private apiBaseUrl: string;
  private projectPath: string;
  private agentRole: string;
  private requestQueue: Map<string, number> = new Map();
  private lastCleanup: number = Date.now();

  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'mcp-server';
    this.apiBaseUrl = `http://localhost:${process.env.API_PORT || 3000}`;
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';
    
    // Setup periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
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
      // Clean the message to ensure it works with tmux
      const cleanMessage = params.message
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[✅❌🚀📋🔧⏳💡🎯📝📡❤️🛑]/g, '')
        .replace(/[|&;`$(){}[\]]/g, ' ')
        .trim();
      
      // Check if target session exists
      try {
        await execAsync(`tmux has-session -t '${params.to}' 2>/dev/null`);
      } catch (error) {
        console.warn(`Session ${params.to} does not exist, skipping message`);
        return {
          content: [{ type: 'text', text: `Session ${params.to} not found - message not sent` }],
        };
      }
      
      // Send message using tmpfile approach
      const chunkSize = 1000;
      
      if (cleanMessage.length <= chunkSize) {
        const tmpFile = `/tmp/mcp-msg-${Date.now()}.txt`;
        await fs.writeFile(tmpFile, cleanMessage);
        await execAsync(`tmux send-keys -t '${params.to}' -l "$(cat '${tmpFile}')" && rm -f '${tmpFile}'`);
      } else {
        // Split large messages into chunks
        for (let i = 0; i < cleanMessage.length; i += chunkSize) {
          const chunk = cleanMessage.substring(i, i + chunkSize);
          const tmpFile = `/tmp/mcp-chunk-${Date.now()}-${i}.txt`;
          await fs.writeFile(tmpFile, chunk);
          await execAsync(`tmux send-keys -t '${params.to}' -l "$(cat '${tmpFile}')" && rm -f '${tmpFile}'`);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Wait before sending Enter
      await new Promise(resolve => setTimeout(resolve, 500));
      await execAsync(`tmux send-keys -t '${params.to}' Enter`);

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
      const sessionsCmd = `timeout 10s tmux list-sessions -F "#{session_name}" 2>/dev/null || echo ""`;
      const result = await execAsync(sessionsCmd);
      const sessions = result.stdout.split('\n').filter(s => s.trim());

      if (sessions.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active sessions found for broadcast' }],
        };
      }

      // Clean message
      const cleanMessage = params.message
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[✅❌🚀📋🔧⏳💡🎯📝📡❤️🛑]/g, '')
        .replace(/[|&;`$(){}[\]]/g, ' ')
        .trim();

      let broadcastCount = 0;
      const maxConcurrent = 3;
      
      // Process sessions in batches
      for (let i = 0; i < sessions.length; i += maxConcurrent) {
        const batch = sessions.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (session) => {
          if (params.excludeSelf && session === this.sessionName) return;

          try {
            await execAsync(`timeout 5s tmux has-session -t '${session}' 2>/dev/null`);
            
            const tmpFile = `/tmp/mcp-broadcast-${Date.now()}-${session}.txt`;
            await fs.writeFile(tmpFile, cleanMessage);
            await execAsync(`timeout 10s tmux send-keys -t '${session}:0' -l "$(cat '${tmpFile}')" && rm -f '${tmpFile}'`);
            await new Promise(resolve => setTimeout(resolve, 300));
            await execAsync(`timeout 5s tmux send-keys -t '${session}:0' Enter`);
            broadcastCount++;
          } catch (error) {
            console.warn(`Failed to broadcast to session ${session}: ${error}`);
          }
        });
        
        await Promise.allSettled(batchPromises);
        if (i + maxConcurrent < sessions.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return {
        content: [{ type: 'text', text: `Broadcast sent to ${broadcastCount}/${sessions.length} sessions` }],
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
      const listCmd = `tmux list-sessions -F "#{session_name}:#{session_attached}:#{session_created}"`;
      const sessionsResult = await execAsync(listCmd);

      const statuses = [];
      for (const line of sessionsResult.stdout.split('\n')) {
        if (!line.trim()) continue;
        const [name, attached, created] = line.split(':');

        const captureCmd = `tmux capture-pane -t "${name}:0" -p -S -20`;
        const output = await execAsync(captureCmd).catch(() => ({ stdout: 'Unable to capture' }));

        const status = this.analyzeAgentStatus(output.stdout);

        statuses.push({
          session: name,
          attached: attached === '1',
          status: status,
          lastActivity: this.extractLastActivity(output.stdout)
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

    const targetSession = sessionName || agentName;

    try {
      const { stdout } = await execAsync(`tmux capture-pane -t "${targetSession}" -p -S -${lines}`);
      const logs = stdout || `No recent activity found for ${targetSession}`;
      
      return {
        content: [{
          type: 'text',
          text: `📋 Logs for ${agentName || targetSession} (last ${lines} lines):\n\n${logs}`
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

    const targetSession = sessionName || agentName;

    try {
      // Try to get status from backend API
      const response = await fetch(`${this.apiBaseUrl}/api/teams`);
      
      if (!response.ok) {
        throw new Error(`API response: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      // Try to find the agent in teams data
      let agentFound = false;
      let agentStatus: AgentStatus = {
        agentStatus: 'unknown',
        workingStatus: 'unknown',
        lastActivityCheck: new Date().toISOString(),
        sessionActive: false
      };
      
      // Search through teams to find the agent
      if (data.teams) {
        for (const team of data.teams) {
          if (team.members) {
            const member = team.members.find((m: any) => 
              m.sessionName === targetSession || m.name === (agentName || targetSession)
            );
            if (member) {
              agentFound = true;
              agentStatus = {
                agentStatus: member.agentStatus || 'inactive',
                workingStatus: member.workingStatus || 'idle',
                lastActivityCheck: member.lastActivityCheck || new Date().toISOString(),
                sessionActive: member.agentStatus === 'active'
              };
              break;
            }
          }
        }
      }
      
      // Check if tmux session exists
      let sessionExists = false;
      try {
        await execAsync(`tmux has-session -t "${targetSession}" 2>/dev/null`);
        sessionExists = true;
      } catch {
        sessionExists = false;
      }
      
      return {
        content: [{
          type: 'text',
          text: `🔍 Status for ${agentName || targetSession}:\n\n` +
                `✅ Agent Status: ${agentStatus.agentStatus}\n` +
                `⚡ Working Status: ${agentStatus.workingStatus}\n` +
                `📡 Session: ${agentName || targetSession} (${sessionExists ? 'active' : 'inactive'})\n` +
                `🕐 Last Activity: ${agentStatus.lastActivityCheck}\n` +
                `📊 Activity Monitor: Running (30s intervals)`
        }]
      };
    } catch (error) {
      // Fallback when API is unavailable
      return {
        content: [{
          type: 'text',
          text: `🔍 Status for ${agentName || targetSession}:\n\n` +
                `❌ Unable to fetch status from backend API\n` +
                `📡 Session: ${agentName || targetSession}\n` +
                `🕐 Timestamp: ${new Date().toISOString()}`
        }]
      };
    }
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
      
      const endpoint = `${this.apiBaseUrl}/api/team-members/register-status`;
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
          memberId: params.memberId,
          sessionId: this.sessionName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        content: [{
          type: 'text',
          text: `Task accepted successfully: Task moved from open to in_progress folder`
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

  async completeTask(params: CompleteTaskParams): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/complete`, {
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
      return {
        content: [{
          type: 'text',
          text: `Task completed successfully: ${result.message || 'Task moved to done folder'}`
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
      {
        name: 'accept_task',
        description: 'Accept a task and move it from open to in_progress folder',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to task file in open folder' },
            memberId: { type: 'string', description: 'Team member ID accepting the task' }
          },
          required: ['taskPath', 'memberId']
        }
      },
      {
        name: 'complete_task',
        description: 'Mark task as completed and move to done folder',
        inputSchema: {
          type: 'object',
          properties: {
            taskPath: { type: 'string', description: 'Path to current task file' }
          },
          required: ['taskPath']
        }
      }
    ];
  }

  private analyzeAgentStatus(output: string): string {
    if (output.includes('error') || output.includes('Error')) return 'error';
    if (output.includes('waiting') || output.includes('Waiting')) return 'waiting';
    if (output.includes('STATUS UPDATE')) return 'reporting';
    if (output.includes('git commit') || output.includes('git add')) return 'committing';
    return 'working';
  }

  private extractLastActivity(output: string): string {
    const lines = output.split('\n').filter(l => l.trim());
    return lines[lines.length - 1] || 'No recent activity';
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

  private async cleanup(): Promise<void> {
    try {
      await execAsync(`find /tmp -name "mcp-*" -type f -mtime +1 -delete 2>/dev/null || true`);
      
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
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Failed to log message:', error);
    }
  }
}