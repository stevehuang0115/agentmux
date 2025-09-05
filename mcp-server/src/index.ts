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
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

const execAsync = promisify(exec);

class AgentMuxMCP {
  private server: Server;
  private sessionName: string;
  private apiBaseUrl: string;
  private projectPath: string;
  private agentRole: string;

  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'unknown';
    this.apiBaseUrl = `http://localhost:${process.env.API_PORT || 3000}`;
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';

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
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Communication Tools
   */
  private async sendMessage(args: { to: string; message: string; type?: string }) {
    try {
      // Send message with timing pattern from orchestrator
      const command = `tmux send-keys -t "${args.to}" "${args.message.replace(/"/g, '\\"')}"`;
      await execAsync(command);

      // Critical: Wait 0.5 seconds before sending Enter
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send Enter key
      await execAsync(`tmux send-keys -t "${args.to}" Enter`);

      // Log message for tracking
      await this.logMessage(this.sessionName, args.to, args.message);

      return {
        content: [{ type: 'text', text: `Message sent to ${args.to}` }],
      };
    } catch (error) {
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async broadcast(args: { message: string; excludeSelf?: boolean }) {
    try {
      // Get all active sessions
      const sessionsCmd = `tmux list-sessions -F "#{session_name}"`;
      const result = await execAsync(sessionsCmd);
      const sessions = result.stdout.split('\n').filter(s => s.trim());

      let broadcastCount = 0;
      for (const session of sessions) {
        if (args.excludeSelf && session === this.sessionName) continue;

        // Use same pattern as send_message
        await execAsync(`tmux send-keys -t "${session}:0" "${args.message.replace(/"/g, '\\"')}"`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await execAsync(`tmux send-keys -t "${session}:0" Enter`);
        broadcastCount++;
      }

      return {
        content: [{ type: 'text', text: `Broadcast sent to ${broadcastCount} sessions` }],
      };
    } catch (error) {
      throw new Error(`Failed to broadcast: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const ticketsDir = `${this.projectPath}/.agentmux/tickets`;
      
      // Find ticket files
      const findCmd = `find ${ticketsDir} -name "*.yaml" -o -name "*.yml" 2>/dev/null || echo ""`;
      const files = await execAsync(findCmd);

      const tickets = [];
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

      // Create tmux session with proper directory
      const createCmd = `tmux new-session -d -s "${args.name}" -c "${args.projectPath}"`;
      await execAsync(createCmd);

      // Prepare system prompt file
      const promptPath = `${args.projectPath}/.agentmux/prompts/${args.name}.md`;
      const prompt = args.systemPrompt || this.getDefaultPrompt(args.role);

      // Write prompt to file
      await this.writeSystemPrompt(promptPath, prompt, args);

      // Start Claude Code with MCP integration
      const envVars = [
        `export TMUX_SESSION_NAME="${args.name}"`,
        `export MCP_SERVER_URL="http://localhost:${process.env.MCP_PORT || 3001}"`,
        `export PROJECT_PATH="${args.projectPath}"`,
        `export AGENT_ROLE="${args.role}"`
      ];

      for (const envVar of envVars) {
        await execAsync(`tmux send-keys -t "${args.name}:0" "${envVar}" Enter`);
      }

      // Start Claude Code
      const claudeCmd = `claude-code --system-prompt-file ${promptPath} --mcp-server ${process.env.MCP_PORT || 3001}`;
      await execAsync(`tmux send-keys -t "${args.name}:0" "${claudeCmd}" Enter`);

      return {
        content: [{ type: 'text', text: `Team ${args.name} created successfully` }],
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

// Start MCP server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const mcpServer = new AgentMuxMCP();
  mcpServer.start().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

export default AgentMuxMCP;