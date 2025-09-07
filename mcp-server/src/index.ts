#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

const execAsync = promisify(exec);

// Schema for cancelled notification
const CancelledNotificationSchema = z.object({
  method: z.literal('notifications/cancelled')
});

class AgentMuxMCP {
  private server: Server;
  private sessionName: string;
  private apiBaseUrl: string;
  private projectPath: string;
  private agentRole: string;
  private requestQueue: Map<string, number> = new Map(); // Rate limiting
  private lastCleanup: number = Date.now();

  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'unknown';
    this.apiBaseUrl = `http://localhost:${process.env.API_PORT || 3000}`;
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';
    
    // Setup periodic cleanup of temp files and request queue
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute

    this.server = new Server(
      {
        name: 'agentmux',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerTools();
  }

  private registerTools(): void {
    // Register tool list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'send_message',
            description: 'Send a message to another team member',
            inputSchema: {
              type: 'object',
              properties: {
                recipient: { type: 'string', description: 'Recipient team member' },
                message: { type: 'string', description: 'Message content' }
              },
              required: ['recipient', 'message']
            }
          },
          {
            name: 'broadcast',
            description: 'Broadcast a message to all team members',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Message to broadcast' }
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
            name: 'get_tickets',
            description: 'Get project tickets',
            inputSchema: {
              type: 'object',
              properties: {
                status: { type: 'string', description: 'Filter by status' },
                all: { type: 'boolean', description: 'Get all tickets' }
              },
              required: []
            }
          },
          {
            name: 'update_ticket',
            description: 'Update a ticket status',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Ticket ID' },
                status: { type: 'string', description: 'New status' }
              },
              required: ['id', 'status']
            }
          },
          {
            name: 'report_progress',
            description: 'Report progress on current task',
            inputSchema: {
              type: 'object',
              properties: {
                progress: { type: 'string', description: 'Progress description' }
              },
              required: ['progress']
            }
          },
          {
            name: 'request_review',
            description: 'Request code review',
            inputSchema: {
              type: 'object',
              properties: {
                files: { type: 'array', items: { type: 'string' }, description: 'Files to review' }
              },
              required: ['files']
            }
          },
          {
            name: 'schedule_check',
            description: 'Schedule a check with the user',
            inputSchema: {
              type: 'object',
              properties: {
                time: { type: 'string', description: 'Check time' },
                message: { type: 'string', description: 'Check message' }
              },
              required: ['time', 'message']
            }
          },
          {
            name: 'enforce_commit',
            description: 'Enforce a commit with specific message',
            inputSchema: {
              type: 'object',
              properties: {
                message: { type: 'string', description: 'Commit message' }
              },
              required: ['message']
            }
          },
          {
            name: 'create_team',
            description: 'Create a new team',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Team name' },
                role: { type: 'string', description: 'Team role' }
              },
              required: ['name', 'role']
            }
          },
          {
            name: 'delegate_task',
            description: 'Delegate a task to another team member',
            inputSchema: {
              type: 'object',
              properties: {
                recipient: { type: 'string', description: 'Task recipient' },
                task: { type: 'string', description: 'Task description' }
              },
              required: ['recipient', 'task']
            }
          },
          {
            name: 'load_project_context',
            description: 'Load comprehensive project context information',
            inputSchema: {
              type: 'object',
              properties: {
                includeFiles: { type: 'boolean', description: 'Include file structure' },
                includeGitHistory: { type: 'boolean', description: 'Include recent commits' },
                includeTickets: { type: 'boolean', description: 'Include project tickets' }
              },
              required: []
            }
          },
          {
            name: 'get_context_summary',
            description: 'Get a summarized context for current role and project',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'refresh_agent_context',
            description: 'Refresh and update agent context with latest project information',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'assign_task',
            description: 'Assign a task to a team member and move to in_progress folder',
            inputSchema: {
              type: 'object',
              properties: {
                taskPath: { type: 'string', description: 'Path to task file' },
                memberId: { type: 'string', description: 'Team member ID' },
                sessionId: { type: 'string', description: 'Session ID' }
              },
              required: ['taskPath', 'memberId', 'sessionId']
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
          },
          {
            name: 'block_task',
            description: 'Mark task as blocked and move to blocked folder with reason',
            inputSchema: {
              type: 'object',
              properties: {
                taskPath: { type: 'string', description: 'Path to current task file' },
                reason: { type: 'string', description: 'Block reason' }
              },
              required: ['taskPath', 'reason']
            }
          },
          {
            name: 'take_next_task',
            description: 'Find and assign next available task for the current agent role',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID' },
                memberRole: { type: 'string', description: 'Team member role (tpm, pgm, dev, qa)' }
              },
              required: ['projectId', 'memberRole']
            }
          },
          {
            name: 'sync_task_status',
            description: 'Synchronize task status with file system',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID to sync' }
              },
              required: ['projectId']
            }
          },
          {
            name: 'check_team_progress',
            description: 'Check progress of all team members and their assigned tasks',
            inputSchema: {
              type: 'object',
              properties: {
                projectId: { type: 'string', description: 'Project ID to check' }
              },
              required: ['projectId']
            }
          },
          {
            name: 'read_task_file',
            description: 'Read the complete task file to get full specifications and requirements',
            inputSchema: {
              type: 'object',
              properties: {
                taskPath: { type: 'string', description: 'Full path to the task markdown file' },
                taskId: { type: 'string', description: 'Task ID (alternative to full path)' },
                milestone: { type: 'string', description: 'Milestone folder name (used with taskId)' }
              },
              required: []
            }
          },
          {
            name: 'report_ready',
            description: 'Report that the agent is fully initialized and ready for task assignment',
            inputSchema: {
              type: 'object',
              properties: {
                role: { type: 'string', description: 'Agent role (tpm, pgm, dev, qa)' },
                capabilities: { type: 'array', items: { type: 'string' }, description: 'List of agent capabilities' }
              },
              required: ['role']
            }
          },
          {
            name: 'register_agent_status',
            description: 'Register agent as active and ready to receive instructions',
            inputSchema: {
              type: 'object',
              properties: {
                role: { type: 'string', description: 'Agent role (tpm, pgm, dev, qa)' },
                sessionId: { type: 'string', description: 'Tmux session identifier' },
                memberId: { type: 'string', description: 'Team member ID for association' }
              },
              required: ['role', 'sessionId']
            }
          }
        ]
      };
    });

    // Register tool call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'send_message':
          return await this.sendMessage(args as { to: string; message: string; type?: string });
        case 'broadcast':
          return await this.broadcast(args as { message: string; excludeSelf?: boolean });
        case 'get_team_status':
          return await this.getTeamStatus();
        case 'get_tickets':
          return await this.getTickets(args as { status?: string; all?: boolean });
        case 'update_ticket':
          return await this.updateTicket(args as { ticketId: string; status?: string; notes?: string; blockers?: string[] });
        case 'report_progress':
          return await this.reportProgress(args as { ticketId?: string; progress: number; completed?: string[]; current?: string; blockers?: string[]; nextSteps?: string });
        case 'request_review':
          return await this.requestReview(args as { ticketId: string; reviewer?: string; branch?: string; message?: string });
        case 'schedule_check':
          return await this.scheduleCheck(args as { minutes: number; message: string; target?: string });
        case 'enforce_commit':
          return await this.enforceCommit(args as { message?: string });
        case 'create_team':
          return await this.createTeam(args as { role: string; name: string; projectPath: string; systemPrompt?: string });
        case 'delegate_task':
          return await this.delegateTask(args as { to: string; task: string; priority: string; ticketId?: string });
        case 'load_project_context':
          return await this.loadProjectContext(args as { includeFiles?: boolean; includeGitHistory?: boolean; includeTickets?: boolean });
        case 'get_context_summary':
          return await this.getContextSummary();
        case 'refresh_agent_context':
          return await this.refreshAgentContext();
        case 'assign_task':
          return await this.assignTask(args as { taskPath: string; memberId: string; sessionId: string });
        case 'accept_task':
          return await this.acceptTask(args as { taskPath: string; memberId: string });
        case 'complete_task':
          return await this.completeTask(args as { taskPath: string });
        case 'block_task':
          return await this.blockTask(args as { taskPath: string; reason: string });
        case 'take_next_task':
          return await this.takeNextTask(args as { projectId: string; memberRole: string });
        case 'sync_task_status':
          return await this.syncTaskStatus(args as { projectId: string });
        case 'check_team_progress':
          return await this.checkTeamProgress(args as { projectId: string });
        case 'read_task_file':
          return await this.readTaskFile(args as { taskPath?: string; taskId?: string; milestone?: string });
        case 'report_ready':
          return await this.reportReady(args as { role: string; capabilities?: string[] });
        case 'register_agent_status':
          return await this.registerAgentStatus(args as { role: string; sessionId: string; memberId?: string });
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // Handle notifications/cancelled - this is sent when operations are cancelled
    this.server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
      // Silently handle cancellation notifications - no action needed
      // This prevents "Unknown method" errors when operations are cancelled
    });
  }

  /**
   * Communication Tools
   */
  private async sendMessage(args: { to: string; message: string; type?: string }) {
    // Rate limiting check
    if (!this.checkRateLimit(`send_${args.to}`)) {
      return {
        content: [{ type: 'text', text: `Rate limit exceeded for ${args.to} - message queued` }],
      };
    }
    
    try {
      // Clean the message to ensure it works with tmux
      const cleanMessage = args.message
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')   // Handle Mac line endings
        // Remove or replace problematic characters that could be interpreted as commands
        .replace(/[✅❌🚀📋🔧⏳💡🎯📝📡❤️🛑]/g, '') // Remove emojis that cause shell command errors
        .replace(/[|&;`$(){}[\]]/g, ' ') // Replace shell metacharacters with spaces
        .trim();               // Remove leading/trailing whitespace
      
      // Check if target session exists before attempting to send
      try {
        await execAsync(`tmux has-session -t '${args.to}' 2>/dev/null`);
      } catch (error) {
        console.warn(`Session ${args.to} does not exist, skipping message`);
        return {
          content: [{ type: 'text', text: `Session ${args.to} not found - message not sent` }],
        };
      }
      
      // For very large messages, split into smaller chunks
      const chunkSize = 1000; // Smaller, more conservative chunk size
      
      if (cleanMessage.length <= chunkSize) {
        // Send message in one piece using tmpfile approach to avoid shell escaping issues
        const tmpFile = `/tmp/mcp-msg-${Date.now()}.txt`;
        await fs.writeFile(tmpFile, cleanMessage);
        await execAsync(`tmux send-keys -t '${args.to}' -l "$(cat '${tmpFile}')" && rm -f '${tmpFile}'`);
      } else {
        // Split large messages into chunks
        for (let i = 0; i < cleanMessage.length; i += chunkSize) {
          const chunk = cleanMessage.substring(i, i + chunkSize);
          const tmpFile = `/tmp/mcp-chunk-${Date.now()}-${i}.txt`;
          await fs.writeFile(tmpFile, chunk);
          await execAsync(`tmux send-keys -t '${args.to}' -l "$(cat '${tmpFile}')" && rm -f '${tmpFile}'`);
          // Small delay between chunks
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // Critical: Wait 0.5 seconds before sending Enter
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send Enter key
      await execAsync(`tmux send-keys -t '${args.to}' Enter`);

      // Log message for tracking (async, don't wait)
      this.logMessage(this.sessionName, args.to, args.message).catch(console.error);

      return {
        content: [{ type: 'text', text: `Message sent to ${args.to}` }],
      };
    } catch (error) {
      console.error(`Send message error: ${error}`);
      return {
        content: [{ type: 'text', text: `Failed to send message to ${args.to}: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true
      };
    }
  }

  private async broadcast(args: { message: string; excludeSelf?: boolean }) {
    try {
      // Get all active sessions with timeout and error handling
      const sessionsCmd = `timeout 10s tmux list-sessions -F "#{session_name}" 2>/dev/null || echo ""`;
      const result = await execAsync(sessionsCmd);
      const sessions = result.stdout.split('\n').filter(s => s.trim());

      if (sessions.length === 0) {
        return {
          content: [{ type: 'text', text: 'No active sessions found for broadcast' }],
        };
      }

      // Clean message similar to sendMessage
      const cleanMessage = args.message
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')   // Handle Mac line endings
        .replace(/[✅❌🚀📋🔧⏳💡🎯📝📡❤️🛑]/g, '') // Remove problematic emojis
        .replace(/[|&;`$(){}[\]]/g, ' ') // Replace shell metacharacters
        .trim();

      let broadcastCount = 0;
      const maxConcurrent = 3; // Limit concurrent operations to reduce resource usage
      
      // Process sessions in batches to avoid resource exhaustion
      for (let i = 0; i < sessions.length; i += maxConcurrent) {
        const batch = sessions.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (session) => {
          if (args.excludeSelf && session === this.sessionName) return;

          try {
            // Check if session exists before sending
            await execAsync(`timeout 5s tmux has-session -t '${session}' 2>/dev/null`);
            
            // Use tmpfile approach for safer message sending
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
        // Brief pause between batches
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
  private async getTeamStatus() {
    try {
      // List all tmux sessions with details
      const listCmd = `tmux list-sessions -F "#{session_name}:#{session_attached}:#{session_created}"`;
      const sessionsResult = await execAsync(listCmd);

      const statuses = [];
      for (const line of sessionsResult.stdout.split('\n')) {
        if (!line.trim()) continue;
        const [name, attached, created] = line.split(':');

        // Capture last 20 lines from each session
        const captureCmd = `tmux capture-pane -t "${name}:0" -p -S -20`;
        const output = await execAsync(captureCmd).catch(() => ({ stdout: 'Unable to capture' }));

        // Analyze output for status
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

  /**
   * Ticket Management Tools
   */
  private async getTickets(args: { status?: string; all?: boolean }) {
    try {
      const tickets = [];
      
      // First, check for traditional YAML tickets
      const ticketsDir = `${this.projectPath}/.agentmux/tickets`;
      try {
        const findCmd = `find ${ticketsDir} -name "*.yaml" -o -name "*.yml" 2>/dev/null || echo ""`;
        const files = await execAsync(findCmd);

        for (const file of files.stdout.split('\n')) {
          if (!file.trim()) continue;

          try {
            // Read and parse ticket file
            const content = await fs.readFile(file, 'utf-8');
            const ticket = this.parseTicketFile(content);

            // Filter by assignment and status
            if (!args.all && ticket.assignedTo !== this.sessionName) continue;
            if (args.status && ticket.status !== args.status) continue;

            tickets.push(ticket);
          } catch (error) {
            console.error(`Error reading ticket file ${file}:`, error);
          }
        }
      } catch (error) {
        // Tickets directory might not exist
      }
      
      // Also check for task files in the tasks structure
      const tasksDir = `${this.projectPath}/.agentmux/tasks`;
      try {
        const statusFolders = args.status ? [args.status === 'in_progress' ? 'in_progress' : args.status] : ['open', 'in_progress', 'done', 'blocked'];
        
        for (const statusFolder of statusFolders) {
          const tasksFolderPath = `${tasksDir}/m0_build_spec_tasks/${statusFolder}`;
          try {
            const taskFiles = await fs.readdir(tasksFolderPath);
            
            for (const taskFile of taskFiles) {
              if (!taskFile.endsWith('.md')) continue;
              
              const taskPath = `${tasksFolderPath}/${taskFile}`;
              const content = await fs.readFile(taskPath, 'utf-8');
              
              // Parse basic info from markdown task file
              const taskId = taskFile.replace('.md', '');
              const titleMatch = content.match(/^# (.+)/m);
              const title = titleMatch ? titleMatch[1] : taskId;
              
              const task = {
                id: taskId,
                title: title,
                status: statusFolder === 'in_progress' ? 'in_progress' : statusFolder,
                type: 'task',
                path: taskPath,
                description: content.substring(0, 200) + '...',
                assignedTo: statusFolder === 'in_progress' ? 'current_agent' : 'unassigned'
              };
              
              // Filter by assignment and status
              if (!args.all && statusFolder !== 'in_progress') continue;
              
              tickets.push(task);
            }
          } catch (error) {
            // Task folder might not exist
          }
        }
      } catch (error) {
        // Tasks directory might not exist
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(tickets, null, 2) }],
      };
    } catch (error) {
      throw new Error(`Failed to get tickets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateTicket(args: {
    ticketId: string;
    status?: string;
    notes?: string;
    blockers?: string[];
  }) {
    try {
      // Check if this is a task file (contains task_ prefix)
      if (args.ticketId.includes('task_')) {
        // This is actually a task file, not a ticket
        // Find the task file in the appropriate status folder
        let taskPath = '';
        const possiblePaths = [
          `${this.projectPath}/.agentmux/tasks/m0_build_spec_tasks/open/${args.ticketId}.md`,
          `${this.projectPath}/.agentmux/tasks/m0_build_spec_tasks/in_progress/${args.ticketId}.md`,
          `${this.projectPath}/.agentmux/tasks/m0_build_spec_tasks/done/${args.ticketId}.md`,
          `${this.projectPath}/.agentmux/tasks/m0_build_spec_tasks/blocked/${args.ticketId}.md`
        ];
        
        // Find which path exists
        for (const path of possiblePaths) {
          try {
            await fs.access(path);
            taskPath = path;
            break;
          } catch {
            // Path doesn't exist, continue
          }
        }
        
        if (!taskPath) {
          throw new Error(`Task file ${args.ticketId}.md not found in any status folder`);
        }
        
        // For task files, we should use the proper task management API instead
        // But for now, let's handle the status update appropriately
        if (args.status === 'in_progress') {
          // Move task to in_progress if status is being updated
          return await this.acceptTask({ taskPath: taskPath, memberId: this.sessionName });
        } else if (args.status === 'done') {
          return await this.completeTask({ taskPath: taskPath });
        } else if (args.status === 'blocked') {
          const reason = args.notes || args.blockers?.join(', ') || 'No reason provided';
          return await this.blockTask({ taskPath: taskPath, reason: reason });
        }
        
        // If just adding notes without status change, read and append to task file
        const content = await fs.readFile(taskPath, 'utf-8');
        if (args.notes) {
          const timestamp = new Date().toISOString();
          const noteSection = `\n\n## Update - ${timestamp}\n\n**Author:** ${this.sessionName}\n\n${args.notes}`;
          await fs.writeFile(taskPath, content + noteSection);
        }
        
        return {
          content: [{ type: 'text', text: `Task ${args.ticketId} updated successfully` }],
        };
      }
      
      // Original ticket handling for YAML files
      const ticketPath = `${this.projectPath}/.agentmux/tickets/${args.ticketId}.yaml`;
      
      // Read current ticket
      const content = await fs.readFile(ticketPath, 'utf-8');
      const ticket = this.parseTicketFile(content);

      // Update ticket
      if (args.status) ticket.status = args.status;
      ticket.updatedAt = new Date().toISOString();
      ticket.lastUpdatedBy = this.sessionName;

      if (args.notes) {
        ticket.comments = ticket.comments || [];
        ticket.comments.push({
          author: this.sessionName,
          content: args.notes,
          timestamp: new Date().toISOString()
        });
      }

      if (args.blockers) {
        ticket.blockers = args.blockers;
      }

      // Write back to file
      const updatedContent = this.generateTicketFile(ticket);
      await fs.writeFile(ticketPath, updatedContent);

      // If status changed to 'done', enforce git commit
      if (args.status === 'done') {
        await this.enforceCommit({ message: `Complete: Ticket ${args.ticketId}` });
      }

      return {
        content: [{ type: 'text', text: `Ticket ${args.ticketId} updated successfully` }],
      };
    } catch (error) {
      throw new Error(`Failed to update ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Progress Reporting Tools
   */
  private async reportProgress(args: {
    ticketId?: string;
    progress: number;
    completed?: string[];
    current?: string;
    blockers?: string[];
    nextSteps?: string;
  }) {
    try {
      // Find PM session
      const pmSession = await this.findProjectManager();

      // Format status update message
      const message = `STATUS UPDATE [${this.sessionName}] ${new Date().toISOString()}
Completed: ${args.completed?.join(', ') || 'N/A'}
Current: ${args.current || 'N/A'}
Progress: ${args.progress}%
Blockers: ${args.blockers?.join(', ') || 'None'}
Next: ${args.nextSteps || 'Continue implementation'}`;

      // Send to PM
      await this.sendMessage({ to: pmSession, message });

      // Update ticket if provided
      if (args.ticketId) {
        await this.updateTicket({
          ticketId: args.ticketId,
          notes: `Progress: ${args.progress}%`
        });
      }

      return {
        content: [{ type: 'text', text: `Progress reported to ${pmSession}` }],
      };
    } catch (error) {
      throw new Error(`Failed to report progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async requestReview(args: {
    ticketId: string;
    reviewer?: string;
    branch?: string;
    message?: string;
  }) {
    try {
      // Find reviewer (QA or specified team member)
      const reviewer = args.reviewer || await this.findQAEngineer();

      // Ensure code is committed
      await this.enforceCommit({ message: `Review ready: ${args.ticketId}` });

      // Get current branch
      const branchCmd = `cd ${this.projectPath} && git branch --show-current`;
      const currentBranch = (await execAsync(branchCmd)).stdout.trim();

      // Send review request
      const reviewMessage = `REVIEW REQUEST
Ticket: ${args.ticketId}
Branch: ${args.branch || currentBranch}
Message: ${args.message || 'Please review implementation'}
Run: git checkout ${args.branch || currentBranch} && npm test`;

      await this.sendMessage({ to: reviewer, message: reviewMessage });

      // Update ticket status
      await this.updateTicket({
        ticketId: args.ticketId,
        status: 'review'
      });

      return {
        content: [{ type: 'text', text: `Review requested from ${reviewer}` }],
      };
    } catch (error) {
      throw new Error(`Failed to request review: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scheduling Tools
   */
  private async scheduleCheck(args: {
    minutes: number;
    message: string;
    target?: string;
  }) {
    try {
      const target = args.target || this.sessionName;
      const seconds = args.minutes * 60;
      const checkMessage = `SCHEDULED CHECK: ${args.message}`;

      // Create detached process for scheduling (nohup pattern)
      const scheduleCmd = `nohup bash -c "sleep ${seconds} && tmux send-keys -t '${target}:0' '${checkMessage}' && sleep 0.5 && tmux send-keys -t '${target}:0' Enter" > /dev/null 2>&1 &`;

      await execAsync(scheduleCmd);

      // Log scheduled check
      await this.logScheduledCheck(target, args.minutes, args.message);

      return {
        content: [{ type: 'text', text: `Check scheduled for ${target} in ${args.minutes} minutes` }],
      };
    } catch (error) {
      throw new Error(`Failed to schedule check: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Git Management Tools
   */
  private async enforceCommit(args: { message?: string }) {
    try {
      // Check for uncommitted changes
      const statusCmd = `cd ${this.projectPath} && git status --porcelain`;
      const status = await execAsync(statusCmd);

      if (status.stdout.trim()) {
        // Has uncommitted changes
        const commitMessage = args.message || `Progress: ${this.sessionName} - ${new Date().toISOString()}`;

        const commands = [
          `cd ${this.projectPath}`,
          `git add -A`,
          `git commit -m "${commitMessage}"`
        ];

        for (const cmd of commands) {
          await execAsync(cmd);
        }

        return {
          content: [{ type: 'text', text: `Committed changes: ${commitMessage}` }],
        };
      }

      return {
        content: [{ type: 'text', text: 'No changes to commit' }],
      };
    } catch (error) {
      throw new Error(`Failed to commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Orchestrator-only Tools
   */
  private async createTeam(args: {
    role: string;
    name: string;
    projectPath: string;
    systemPrompt?: string;
  }) {
    try {
      // Verify orchestrator permission
      if (!this.sessionName.includes('orchestrator')) {
        throw new Error('Only orchestrator can create teams');
      }

      // Use the backend API to create team member session 
      // This ensures both MCP server and backend use the same team creation logic
      const response = await fetch(`${this.apiBaseUrl}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: args.name,
          members: [{
            name: args.name,
            role: args.role,
            sessionName: args.name,
            projectPath: args.projectPath,
            systemPrompt: args.systemPrompt || this.getDefaultPrompt(args.role)
          }],
          status: 'ready'
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(`API call failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json() as { team: { id: string } };

      // Start the team to initialize sessions with system prompts
      const startResponse = await fetch(`${this.apiBaseUrl}/api/teams/${result.team.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json() as { error?: string };
        throw new Error(`Failed to start team: ${errorData.error || startResponse.statusText}`);
      }

      return {
        content: [{ type: 'text', text: `Team ${args.name} created and started successfully. Agent will initialize with system prompt and report ready status.` }],
      };
    } catch (error) {
      throw new Error(`Failed to create team: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async delegateTask(args: {
    to: string;
    task: string;
    priority: string;
    ticketId?: string;
  }) {
    try {
      // Verify orchestrator permission
      if (!this.sessionName.includes('orchestrator')) {
        throw new Error('Only orchestrator can delegate tasks');
      }

      const delegationMessage = `TASK DELEGATION [Priority: ${args.priority}]
Task: ${args.task}
Ticket: ${args.ticketId || 'N/A'}
Delegated by: ${this.sessionName}

Please acknowledge receipt and provide an ETA.`;

      await this.sendMessage({ to: args.to, message: delegationMessage });

      // Create or update ticket if ticketId provided
      if (args.ticketId) {
        await this.updateTicket({
          ticketId: args.ticketId,
          notes: `Task delegated to ${args.to} with priority ${args.priority}`
        });
      }

      return {
        content: [{ type: 'text', text: `Task delegated to ${args.to}` }],
      };
    } catch (error) {
      throw new Error(`Failed to delegate task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Context Loading Tools
   */
  private async loadProjectContext(args: {
    includeFiles?: boolean;
    includeGitHistory?: boolean;
    includeTickets?: boolean;
  }) {
    try {
      const context: any = {
        project: {
          name: path.basename(this.projectPath),
          path: this.projectPath,
          role: this.agentRole,
          session: this.sessionName
        },
        specifications: '',
        readme: '',
        structure: [],
        tickets: [],
        recentCommits: [],
        dependencies: {}
      };

      // Load project specifications
      const specFiles = ['project.md', 'architecture.md', 'requirements.md', 'prd.md'];
      for (const specFile of specFiles) {
        const specPath = `${this.projectPath}/.agentmux/${specFile}`;
        try {
          const content = await fs.readFile(specPath, 'utf-8');
          context.specifications += `\n\n## ${specFile}\n\n${content}`;
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Load README
      const readmePaths = ['README.md', 'readme.md', 'README.txt'];
      for (const readmePath of readmePaths) {
        try {
          const content = await fs.readFile(`${this.projectPath}/${readmePath}`, 'utf-8');
          context.readme = content;
          break;
        } catch (error) {
          // File doesn't exist, try next
        }
      }

      // Load file structure if requested
      if (args.includeFiles !== false) {
        try {
          const findCmd = `find ${this.projectPath} -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.md" -o -name "*.json" | grep -v node_modules | head -50`;
          const result = await execAsync(findCmd);
          context.structure = result.stdout.split('\n')
            .filter(line => line.trim())
            .map(file => path.relative(this.projectPath, file));
        } catch (error) {
          // Command failed, skip
        }
      }

      // Load tickets if requested
      if (args.includeTickets !== false) {
        try {
          const ticketsDir = `${this.projectPath}/.agentmux/tickets`;
          const ticketFiles = await fs.readdir(ticketsDir);
          
          for (const file of ticketFiles.filter(f => f.endsWith('.yaml'))) {
            const content = await fs.readFile(`${ticketsDir}/${file}`, 'utf-8');
            const ticket = this.parseTicketFile(content);
            context.tickets.push({
              id: ticket.id,
              title: ticket.title,
              status: ticket.status,
              priority: ticket.priority,
              assignedTo: ticket.assignedTo,
              description: ticket.description?.substring(0, 200) + '...'
            });
          }
        } catch (error) {
          // Tickets directory doesn't exist or error reading
        }
      }

      // Load git history if requested
      if (args.includeGitHistory !== false) {
        try {
          const gitLogCmd = `cd ${this.projectPath} && git log --oneline -10`;
          const result = await execAsync(gitLogCmd);
          context.recentCommits = result.stdout.split('\n').filter(line => line.trim());
        } catch (error) {
          // Not a git repository or git not available
        }
      }

      // Load dependencies
      try {
        const packageJsonContent = await fs.readFile(`${this.projectPath}/package.json`, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);
        context.dependencies = {
          ...packageJson.dependencies || {},
          ...packageJson.devDependencies || {}
        };
      } catch (error) {
        // package.json doesn't exist
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(context, null, 2) }],
      };
    } catch (error) {
      throw new Error(`Failed to load project context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getContextSummary() {
    try {
      const contextPath = `${this.projectPath}/.agentmux/context/${this.sessionName}-context.md`;
      
      try {
        const contextContent = await fs.readFile(contextPath, 'utf-8');
        
        // Extract key sections for summary
        const sections = {
          role: this.extractContextSection(contextContent, 'Your Role'),
          tickets: this.extractContextSection(contextContent, 'Relevant Tickets'),
          structure: this.extractContextSection(contextContent, 'Project Structure'),
          dependencies: this.extractContextSection(contextContent, 'Key Dependencies')
        };

        const summary = `# Context Summary for ${this.sessionName}

## Role
${sections.role || this.agentRole}

## Current Tickets
${sections.tickets || 'No tickets assigned'}

## Project Overview
- Project: ${path.basename(this.projectPath)}
- Role: ${this.agentRole}
- Session: ${this.sessionName}

## Key Files
${sections.structure ? sections.structure.split('\n').slice(0, 10).join('\n') : 'Structure loading...'}

## Dependencies
${sections.dependencies ? sections.dependencies.split('\n').slice(0, 5).join('\n') : 'Loading dependencies...'}`;

        return {
          content: [{ type: 'text', text: summary }],
        };
      } catch (error) {
        // Context file doesn't exist, create basic summary
        const basicSummary = `# Context Summary for ${this.sessionName}

## Role
${this.agentRole}

## Project
${path.basename(this.projectPath)}

## Status
Context not yet loaded. Use load_project_context to initialize.`;

        return {
          content: [{ type: 'text', text: basicSummary }],
        };
      }
    } catch (error) {
      throw new Error(`Failed to get context summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async refreshAgentContext() {
    try {
      // Make API call to refresh context
      const response = await fetch(`${this.apiBaseUrl}/api/teams/${this.sessionName}/members/${this.sessionName}/context/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        content: [{ 
          type: 'text', 
          text: `Context refreshed successfully. Updated at: ${(result as any).data?.refreshedAt || new Date().toISOString()}` 
        }],
      };
    } catch (error) {
      // Fallback to local context refresh
      try {
        const contextPath = `${this.projectPath}/.agentmux/context/${this.sessionName}-context.md`;
        const context = await this.loadProjectContext({
          includeFiles: true,
          includeGitHistory: true,
          includeTickets: true
        });

        // Write refreshed context to file
        await fs.mkdir(path.dirname(contextPath), { recursive: true });
        await fs.writeFile(contextPath, `# Refreshed Context for ${this.sessionName}\n\n${context.content[0].text}`);

        return {
          content: [{ type: 'text', text: `Context refreshed locally at ${new Date().toISOString()}` }],
        };
      } catch (localError) {
        throw new Error(`Failed to refresh agent context: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private extractContextSection(content: string, sectionName: string): string {
    const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Task Management Tools
   */
  private async assignTask(args: { taskPath: string; memberId: string; sessionId: string }) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: args.taskPath,
          memberId: args.memberId,
          sessionId: args.sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
      return {
        content: [{
          type: 'text',
          text: `Task assigned successfully: ${result.message || 'Task moved to in_progress folder'}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error assigning task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async acceptTask(args: { taskPath: string; memberId: string }) {
    try {
      // Use the same API endpoint but with the current agent as both member and session
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: args.taskPath,
          memberId: args.memberId,
          sessionId: this.sessionName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
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

  private async completeTask(args: { taskPath: string }) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: args.taskPath
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

  private async blockTask(args: { taskPath: string; reason: string }) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskPath: args.taskPath,
          reason: args.reason
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
      return {
        content: [{
          type: 'text',
          text: `Task blocked successfully: ${result.message || 'Task moved to blocked folder'}`
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

  private async takeNextTask(args: { projectId: string; memberRole: string }) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/take-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: args.projectId,
          memberRole: args.memberRole,
          sessionId: this.sessionName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
      return {
        content: [{
          type: 'text',
          text: `Next task assigned: ${result.data?.taskName || 'Task assigned successfully'}\nPath: ${result.data?.taskPath || 'N/A'}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error taking next task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async syncTaskStatus(args: { projectId: string }) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: args.projectId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
      return {
        content: [{
          type: 'text',
          text: `Task status synced: ${result.message || 'All task statuses synchronized with file system'}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error syncing task status: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async checkTeamProgress(args: { projectId: string }) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/task-management/team-progress?projectId=${args.projectId}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      let progressReport = "## Team Progress Report\n\n";
      
      if (result.data?.teamMembers) {
        for (const member of result.data.teamMembers) {
          progressReport += `### ${member.name} (${member.role})\n`;
          progressReport += `- Status: ${member.status}\n`;
          progressReport += `- Current Tasks: ${member.currentTasks?.length || 0}\n`;
          if (member.currentTasks?.length > 0) {
            progressReport += `- Tasks: ${member.currentTasks.map((t: any) => t.name).join(', ')}\n`;
          }
          progressReport += `- Last Activity: ${member.lastActivity || 'N/A'}\n\n`;
        }
      }

      if (result.data?.openTasks) {
        progressReport += `### Available Open Tasks: ${result.data.openTasks.length}\n\n`;
      }

      return {
        content: [{
          type: 'text',
          text: progressReport
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error checking team progress: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  private async readTaskFile(args: { taskPath?: string; taskId?: string; milestone?: string }) {
    try {
      let taskFilePath: string;

      if (args.taskPath) {
        // Use provided full path
        taskFilePath = args.taskPath;
      } else if (args.taskId && args.milestone) {
        // Construct path from taskId and milestone
        taskFilePath = `${this.projectPath}/.agentmux/tasks/${args.milestone}/open/${args.taskId}.md`;
      } else {
        throw new Error('Either taskPath or both taskId and milestone must be provided');
      }

      // Read the task file
      const taskContent = await fs.readFile(taskFilePath, 'utf-8');

      return {
        content: [{
          type: 'text',
          text: `# Task File: ${taskFilePath}\n\n${taskContent}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error reading task file: ${error instanceof Error ? error.message : 'Unknown error'}\n\nMake sure the task file exists at the specified path. If using taskId and milestone, verify the file is in the 'open' folder.`
        }],
        isError: true
      };
    }
  }

  private async reportReady(args: { role: string; capabilities?: string[] }) {
    try {
      // Report to backend API that this agent is ready
      const response = await fetch(`${this.apiBaseUrl}/api/team-members/report-ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: this.sessionName,
          role: args.role,
          capabilities: args.capabilities || [],
          readyAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;
      return {
        content: [{
          type: 'text',
          text: `✅ Agent ready status reported successfully. Role: ${args.role}, Session: ${this.sessionName}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Warning: Could not report ready status (${error instanceof Error ? error.message : 'Unknown error'}), but agent is functional.`
        }],
        isError: false // Don't treat this as a blocking error
      };
    }
  }

  private async registerAgentStatus(args: { role: string; sessionId: string; memberId?: string }) {
    const startTime = Date.now();
    console.log(`[MCP] 🚀 Starting agent registration process...`);
    console.log(`[MCP] 📋 Arguments:`, JSON.stringify(args, null, 2));
    console.log(`[MCP] 🌐 API Base URL: ${this.apiBaseUrl}`);
    console.log(`[MCP] 📍 Session Name: ${this.sessionName}`);
    console.log(`[MCP] 🎭 Agent Role: ${this.agentRole}`);
    
    try {
      // Register this agent as active with the backend API  
      const requestBody = {
        sessionName: args.sessionId,
        role: args.role,
        status: 'active',
        registeredAt: new Date().toISOString(),
        memberId: args.memberId
      };
      
      console.log(`[MCP] 📤 Request body:`, JSON.stringify(requestBody, null, 2));
      
      const endpoint = `${this.apiBaseUrl}/api/team-members/register-status`;
      console.log(`[MCP] 📡 Calling endpoint: ${endpoint}`);
      console.log(`[MCP] 🔧 Request method: POST`);
      console.log(`[MCP] 📋 Request headers: Content-Type: application/json`);
      
      // First, let's check if the API server is reachable
      try {
        console.log(`[MCP] 🔍 Testing API server connectivity...`);
        const healthResponse = await fetch(`${this.apiBaseUrl}/health`, {
          method: 'GET'
        });
        console.log(`[MCP] 💓 Health check status: ${healthResponse.status} ${healthResponse.statusText}`);
      } catch (healthError) {
        console.log(`[MCP] ❌ Health check failed:`, healthError instanceof Error ? healthError.message : String(healthError));
      }
      
      // Try to list available API routes for debugging
      try {
        console.log(`[MCP] 🔍 Testing API routes availability...`);
        const routesResponse = await fetch(`${this.apiBaseUrl}/api`, {
          method: 'GET'
        });
        console.log(`[MCP] 📋 API routes test status: ${routesResponse.status} ${routesResponse.statusText}`);
      } catch (routesError) {
        console.log(`[MCP] ❌ API routes test failed:`, routesError instanceof Error ? routesError.message : String(routesError));
      }
      
      // Now make the actual registration call
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
        // Try to get response body for more details
        let responseBody = '';
        try {
          responseBody = await response.text();
          console.log(`[MCP] 📄 Response body:`, responseBody);
        } catch (bodyError) {
          console.log(`[MCP] ❌ Failed to read response body:`, bodyError);
        }
        
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`[MCP] ❌ Registration failed: ${errorMsg}`);
        if (responseBody) {
          console.log(`[MCP] 💬 Server response: ${responseBody}`);
        }
        throw new Error(errorMsg);
      }

      // Try to parse response body
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
          text: `✅ Agent registered and awaiting instructions. Role: ${args.role}, Session: ${this.sessionName}`
        }]
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`[MCP] ❌ Registration failed after ${duration}ms`);
      console.log(`[MCP] 💥 Error details:`, error);
      
      if (error instanceof Error) {
        console.log(`[MCP] 📝 Error name: ${error.name}`);
        console.log(`[MCP] 📝 Error message: ${error.message}`);
        console.log(`[MCP] 📝 Error stack:`, error.stack);
      }
      
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
   * Resource Management
   */
  private async cleanup(): Promise<void> {
    try {
      // Clean up old temp files
      await execAsync(`find /tmp -name "mcp-*" -type f -mtime +1 -delete 2>/dev/null || true`);
      
      // Clear old rate limit entries
      const now = Date.now();
      for (const [key, timestamp] of this.requestQueue.entries()) {
        if (now - timestamp > 300000) { // 5 minutes
          this.requestQueue.delete(key);
        }
      }
      
      this.lastCleanup = now;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const lastRequest = this.requestQueue.get(identifier) || 0;
    
    // Allow max 1 request per second per identifier
    if (now - lastRequest < 1000) {
      return false;
    }
    
    this.requestQueue.set(identifier, now);
    return true;
  }

  /**
   * Helper Functions
   */
  private async findProjectManager(): Promise<string> {
    const sessions = await this.getActiveSessions();
    const pm = sessions.find(s => s.includes('-pm') || s.includes('project-manager'));
    return pm || 'orchestrator:0';
  }

  private async findQAEngineer(): Promise<string> {
    const sessions = await this.getActiveSessions();
    const qa = sessions.find(s => s.includes('-qa') || s.includes('quality'));
    return qa || await this.findProjectManager();
  }

  private async getActiveSessions(): Promise<string[]> {
    const cmd = `tmux list-sessions -F "#{session_name}"`;
    const result = await execAsync(cmd);
    return result.stdout.split('\n').filter(s => s.trim());
  }

  private parseTicketFile(content: string): any {
    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { id: 'unknown', title: 'Parse Error', status: 'error' };

    try {
      const frontmatter = parseYAML(match[1]);
      const body = match[2];

      return {
        ...frontmatter,
        description: this.extractSection(body, 'Description') || body,
        acceptanceCriteria: this.extractSection(body, 'Acceptance Criteria'),
        testPlan: this.extractSection(body, 'Test Plan')
      };
    } catch (error) {
      return { id: 'unknown', title: 'Parse Error', status: 'error' };
    }
  }

  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private generateTicketFile(ticket: any): string {
    const { description, acceptanceCriteria, testPlan, comments, ...frontmatter } = ticket;
    
    let content = `---\n${stringifyYAML(frontmatter)}---\n\n`;
    
    if (description) content += `## Description\n\n${description}\n\n`;
    if (acceptanceCriteria) content += `## Acceptance Criteria\n\n${acceptanceCriteria}\n\n`;
    if (testPlan) content += `## Test Plan\n\n${testPlan}\n\n`;
    
    if (comments && comments.length > 0) {
      content += `## Comments\n\n`;
      for (const comment of comments) {
        content += `**${comment.author}** (${comment.timestamp}):\n${comment.content}\n\n`;
      }
    }

    return content;
  }

  private getDefaultPrompt(role: string): string {
    const prompts: Record<string, string> = {
      pm: `You are a Project Manager. Your responsibilities:
- Maintain exceptionally high quality standards
- Test everything, trust but verify
- Coordinate team communication efficiently
- Track progress and identify blockers
- Enforce 30-minute git commits`,

      developer: `You are a Software Developer. Your responsibilities:
- Implement features according to specifications
- Write clean, maintainable code
- Commit every 30 minutes without fail
- Work in feature branches
- Report progress to PM regularly`,

      qa: `You are a QA Engineer. Your responsibilities:
- Test all implemented features thoroughly
- Verify acceptance criteria are met
- Document test results
- Report issues immediately
- Ensure quality standards are maintained`
    };

    return prompts[role] || prompts.developer;
  }

  private async writeSystemPrompt(promptPath: string, prompt: string, config: any): Promise<void> {
    // Ensure prompts directory exists
    await fs.mkdir(path.dirname(promptPath), { recursive: true });

    const fullPrompt = `# AgentMux Agent: ${config.role.toUpperCase()}

${prompt}

## MCP Tools Available
- send_message: Communicate with other agents
- broadcast: Send message to all team members
- get_tickets: Retrieve project tickets
- update_ticket: Modify ticket status and details
- report_progress: Update progress on assigned tasks
- get_team_status: Check status of other team members
- request_review: Request code review from QA
- schedule_check: Schedule reminder check-ins
- enforce_commit: Commit current work (30-minute rule)

## Environment
Session: ${config.name}
Role: ${config.role}
Project: ${config.projectPath}

Work autonomously within your role boundaries and communicate effectively with your team.`;

    await fs.writeFile(promptPath, fullPrompt);
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

  private async logScheduledCheck(target: string, minutes: number, message: string): Promise<void> {
    const logPath = `${this.projectPath}/.agentmux/memory/schedule.log`;
    const logEntry = `${new Date().toISOString()} Scheduled check for ${target} in ${minutes}m: ${message}\n`;
    
    try {
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      console.error('Failed to log scheduled check:', error);
    }
  }

  private getToolDefinitions() {
    return [
      {
        name: 'send_message',
        description: 'Send message to another agent',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Target session name' },
            message: { type: 'string', description: 'Message to send' },
            type: { type: 'string', description: 'Message type (optional)' }
          },
          required: ['to', 'message']
        }
      },
      {
        name: 'broadcast',
        description: 'Send message to all team members',
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
        description: 'Get status of all team members',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_tickets',
        description: 'Get assigned tickets',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['open', 'in_progress', 'review', 'done', 'blocked'] },
            all: { type: 'boolean', description: 'Get all tickets, not just assigned ones' }
          }
        }
      },
      {
        name: 'update_ticket',
        description: 'Update ticket status and add notes',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string' },
            status: { type: 'string', enum: ['open', 'in_progress', 'review', 'done', 'blocked'] },
            notes: { type: 'string' },
            blockers: { type: 'array', items: { type: 'string' } }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'report_progress',
        description: 'Report progress to project manager',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string' },
            progress: { type: 'number', minimum: 0, maximum: 100 },
            completed: { type: 'array', items: { type: 'string' } },
            current: { type: 'string' },
            blockers: { type: 'array', items: { type: 'string' } },
            nextSteps: { type: 'string' }
          },
          required: ['progress']
        }
      },
      {
        name: 'request_review',
        description: 'Request code review from QA or another team member',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string' },
            reviewer: { type: 'string' },
            branch: { type: 'string' },
            message: { type: 'string' }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'schedule_check',
        description: 'Schedule a check-in reminder',
        inputSchema: {
          type: 'object',
          properties: {
            minutes: { type: 'number', minimum: 1 },
            message: { type: 'string' },
            target: { type: 'string' }
          },
          required: ['minutes', 'message']
        }
      },
      {
        name: 'enforce_commit',
        description: 'Commit current work (30-minute rule)',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      },
      // Orchestrator-only tools
      {
        name: 'create_team',
        description: 'Create new agent team (Orchestrator only)',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['pm', 'developer', 'qa'] },
            name: { type: 'string' },
            projectPath: { type: 'string' },
            systemPrompt: { type: 'string' }
          },
          required: ['role', 'name', 'projectPath']
        }
      },
      {
        name: 'delegate_task',
        description: 'Delegate task to team member (Orchestrator only)',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string' },
            task: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            ticketId: { type: 'string' }
          },
          required: ['to', 'task', 'priority']
        }
      }
    ];
  }

  async start(): Promise<void> {
    // Check if we should start HTTP server or use stdio
    const useHttp = process.env.MCP_HTTP === 'true' || process.argv.includes('--http');
    const port = parseInt(process.env.MCP_PORT || '3001');

    if (useHttp) {
      await this.startHttpServer(port);
    } else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.log(`AgentMux MCP Server started for session: ${this.sessionName}`);
    }
  }

  private async startHttpServer(port: number): Promise<void> {
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
          try {
            const request = JSON.parse(body);
            let response;

            // Handle MCP requests directly by calling our handlers
            if (request.method === 'tools/list') {
              const tools = {
                tools: [
                  {
                    name: 'send_message',
                    description: 'Send a message to another team member',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        recipient: { type: 'string', description: 'Recipient team member' },
                        message: { type: 'string', description: 'Message content' }
                      },
                      required: ['recipient', 'message']
                    }
                  },
                  {
                    name: 'broadcast',
                    description: 'Broadcast a message to all team members',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        message: { type: 'string', description: 'Message to broadcast' }
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
                    name: 'get_tickets',
                    description: 'Get project tickets',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', description: 'Filter by status' },
                        all: { type: 'boolean', description: 'Get all tickets' }
                      },
                      required: []
                    }
                  },
                  {
                    name: 'update_ticket',
                    description: 'Update a ticket status',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Ticket ID' },
                        status: { type: 'string', description: 'New status' }
                      },
                      required: ['id', 'status']
                    }
                  },
                  {
                    name: 'report_progress',
                    description: 'Report progress on current task',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        progress: { type: 'string', description: 'Progress description' }
                      },
                      required: ['progress']
                    }
                  },
                  {
                    name: 'request_review',
                    description: 'Request code review',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        files: { type: 'array', items: { type: 'string' }, description: 'Files to review' }
                      },
                      required: ['files']
                    }
                  },
                  {
                    name: 'schedule_check',
                    description: 'Schedule a check with the user',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        time: { type: 'string', description: 'Check time' },
                        message: { type: 'string', description: 'Check message' }
                      },
                      required: ['time', 'message']
                    }
                  },
                  {
                    name: 'enforce_commit',
                    description: 'Enforce a commit with specific message',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        message: { type: 'string', description: 'Commit message' }
                      },
                      required: ['message']
                    }
                  },
                  {
                    name: 'create_team',
                    description: 'Create a new team',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string', description: 'Team name' },
                        role: { type: 'string', description: 'Team role' }
                      },
                      required: ['name', 'role']
                    }
                  },
                  {
                    name: 'delegate_task',
                    description: 'Delegate a task to another team member',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        recipient: { type: 'string', description: 'Task recipient' },
                        task: { type: 'string', description: 'Task description' }
                      },
                      required: ['recipient', 'task']
                    }
                  },
                  {
                    name: 'load_project_context',
                    description: 'Load comprehensive project context information',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        includeFiles: { type: 'boolean', description: 'Include file structure' },
                        includeGitHistory: { type: 'boolean', description: 'Include recent commits' },
                        includeTickets: { type: 'boolean', description: 'Include project tickets' }
                      },
                      required: []
                    }
                  },
                  {
                    name: 'get_context_summary',
                    description: 'Get a summarized context for current role and project',
                    inputSchema: {
                      type: 'object',
                      properties: {},
                      required: []
                    }
                  },
                  {
                    name: 'refresh_agent_context',
                    description: 'Refresh and update agent context with latest project information',
                    inputSchema: {
                      type: 'object',
                      properties: {},
                      required: []
                    }
                  },
                  {
                    name: 'assign_task',
                    description: 'Assign a task to a team member and move to in_progress folder',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        taskPath: { type: 'string', description: 'Path to task file' },
                        memberId: { type: 'string', description: 'Team member ID' },
                        sessionId: { type: 'string', description: 'Session ID' }
                      },
                      required: ['taskPath', 'memberId', 'sessionId']
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
                  },
                  {
                    name: 'block_task',
                    description: 'Mark task as blocked and move to blocked folder with reason',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        taskPath: { type: 'string', description: 'Path to current task file' },
                        reason: { type: 'string', description: 'Block reason' }
                      },
                      required: ['taskPath', 'reason']
                    }
                  },
                  {
                    name: 'take_next_task',
                    description: 'Find and assign next available task for the current agent role',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        projectId: { type: 'string', description: 'Project ID' },
                        memberRole: { type: 'string', description: 'Team member role (tpm, pgm, dev, qa)' }
                      },
                      required: ['projectId', 'memberRole']
                    }
                  },
                  {
                    name: 'sync_task_status',
                    description: 'Synchronize task status with file system',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        projectId: { type: 'string', description: 'Project ID to sync' }
                      },
                      required: ['projectId']
                    }
                  },
                  {
                    name: 'check_team_progress',
                    description: 'Check progress of all team members and their assigned tasks',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        projectId: { type: 'string', description: 'Project ID to check' }
                      },
                      required: ['projectId']
                    }
                  },
                  {
                    name: 'read_task_file',
                    description: 'Read the complete task file to get full specifications and requirements',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        taskPath: { type: 'string', description: 'Full path to the task markdown file' },
                        taskId: { type: 'string', description: 'Task ID (alternative to full path)' },
                        milestone: { type: 'string', description: 'Milestone folder name (used with taskId)' }
                      },
                      required: []
                    }
                  },
                  {
                    name: 'report_ready',
                    description: 'Report that the agent is fully initialized and ready for task assignment',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', description: 'Agent role (tpm, pgm, dev, qa)' },
                        capabilities: { type: 'array', items: { type: 'string' }, description: 'List of agent capabilities' }
                      },
                      required: ['role']
                    }
                  },
                  {
                    name: 'register_agent_status',
                    description: 'Register agent as active and ready to receive instructions',
                    inputSchema: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', description: 'Agent role (tpm, pgm, dev, qa)' },
                        sessionId: { type: 'string', description: 'Tmux session identifier' },
                        memberId: { type: 'string', description: 'Team member ID for association' }
                      },
                      required: ['role', 'sessionId']
                    }
                  }
                ]
              };
              response = {
                jsonrpc: '2.0',
                id: request.id,
                result: tools
              };
            } else if (request.method === 'tools/call') {
              // Call the actual tool handler
              const toolName = request.params.name;
              const toolArgs = request.params.arguments || {};
              
              let result;
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
                case 'load_project_context':
                  result = await this.loadProjectContext(toolArgs);
                  break;
                case 'get_context_summary':
                  result = await this.getContextSummary();
                  break;
                case 'refresh_agent_context':
                  result = await this.refreshAgentContext();
                  break;
                case 'assign_task':
                  result = await this.assignTask(toolArgs);
                  break;
                case 'accept_task':
                  result = await this.acceptTask(toolArgs);
                  break;
                case 'complete_task':
                  result = await this.completeTask(toolArgs);
                  break;
                case 'block_task':
                  result = await this.blockTask(toolArgs);
                  break;
                case 'take_next_task':
                  result = await this.takeNextTask(toolArgs);
                  break;
                case 'sync_task_status':
                  result = await this.syncTaskStatus(toolArgs);
                  break;
                case 'check_team_progress':
                  result = await this.checkTeamProgress(toolArgs);
                  break;
                case 'read_task_file':
                  result = await this.readTaskFile(toolArgs);
                  break;
                case 'report_ready':
                  result = await this.reportReady(toolArgs);
                  break;
                case 'register_agent_status':
                  result = await this.registerAgentStatus(toolArgs);
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
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            const errorResponse = {
              jsonrpc: '2.0',
              id: null,
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
      console.log(`AgentMux MCP HTTP Server started on port ${port} for session: ${this.sessionName}`);
    });
  }
}

// Start MCP server if this file is run directly (disabled for testing)
// if (import.meta.url === `file://${process.argv[1]}`) {
//   const mcpServer = new AgentMuxMCP();
//   mcpServer.start().catch((error) => {
//     console.error('Failed to start MCP server:', error);
//     process.exit(1);
//   });
// }

export default AgentMuxMCP;