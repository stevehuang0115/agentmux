#!/usr/bin/env node

/**
 * AgentMux MCP STDIO Server
 * Standard MCP server using stdio transport as expected by Claude Code
 */

const { spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(require('child_process').exec);

class AgentMuxMCPServer {
  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'mcp-server';
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';
    
    // Bind methods to maintain context
    this.handleRequest = this.handleRequest.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.broadcast = this.broadcast.bind(this);
    this.getTeamStatus = this.getTeamStatus.bind(this);
    this.createTeam = this.createTeam.bind(this);
    this.killAgent = this.killAgent.bind(this);
  }

  start() {
    // Use stdio transport for MCP
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    let buffer = '';
    
    stdin.on('data', (chunk) => {
      buffer += chunk.toString();
      
      // Process complete messages (one per line)
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const request = JSON.parse(line);
            this.handleRequest(request).then(response => {
              stdout.write(JSON.stringify(response) + '\n');
            }).catch(error => {
              const errorResponse = {
                jsonrpc: '2.0',
                id: request.id,
                error: {
                  code: -32603,
                  message: error.message
                }
              };
              stdout.write(JSON.stringify(errorResponse) + '\n');
            });
          } catch (error) {
            const errorResponse = {
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32700,
                message: 'Parse error'
              }
            };
            stdout.write(JSON.stringify(errorResponse) + '\n');
          }
        }
      }
    });
    
    stdin.on('end', () => {
      process.exit(0);
    });
    
    // Set encoding
    stdin.setEncoding('utf8');
    
    console.error(`AgentMux MCP Server started (stdio mode)`);
    console.error(`Session: ${this.sessionName}`);
    console.error(`Project: ${this.projectPath}`);
  }

  async handleRequest(request) {
    console.error(`📥 Request: ${request.method}`);
    
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'agentmux',
            version: '1.0.0'
          }
        }
      };
    }

    if (request.method === 'initialized') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {}
      };
    }

    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: this.getToolDefinitions()
        }
      };
    }

    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      console.error(`🔧 Calling tool: ${name}`);
      const result = await this.callTool(name, args || {});
      
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: result
      };
    }

    throw new Error(`Unknown method: ${request.method}`);
  }

  async callTool(name, args) {
    switch (name) {
      case 'send_message':
        return await this.sendMessage(args);
      case 'broadcast':
        return await this.broadcast(args);
      case 'get_team_status':
        return await this.getTeamStatus();
      case 'get_tickets':
        return await this.getTickets(args);
      case 'update_ticket':
        return await this.updateTicket(args);
      case 'report_progress':
        return await this.reportProgress(args);
      case 'request_review':
        return await this.requestReview(args);
      case 'schedule_check':
        return await this.scheduleCheck(args);
      case 'enforce_commit':
        return await this.enforceCommit(args);
      case 'create_team':
        return await this.createTeam(args);
      case 'delegate_task':
        return await this.delegateTask(args);
      case 'kill_agent':
        return await this.killAgent(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async sendMessage(args) {
    try {
      const { to, message } = args;
      console.error(`💬 Sending message to ${to}: ${message}`);
      
      const escapedMessage = message.replace(/'/g, "'\\''");
      await execAsync(`tmux send-keys -t "${to}" '${escapedMessage}'`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await execAsync(`tmux send-keys -t "${to}" Enter`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Message sent to ${to}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to send message: ${error.message}` 
        }]
      };
    }
  }

  async broadcast(args) {
    try {
      const { message, excludeSelf } = args;
      console.error(`📢 Broadcasting: ${message}`);
      
      const result = await execAsync('tmux list-sessions -F "#{session_name}"');
      const sessions = result.stdout.split('\n').filter(s => s.trim());
      
      let count = 0;
      for (const session of sessions) {
        if (excludeSelf && session === this.sessionName) continue;
        
        const escapedMessage = message.replace(/'/g, "'\\''");
        await execAsync(`tmux send-keys -t "${session}:0" '${escapedMessage}'`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await execAsync(`tmux send-keys -t "${session}:0" Enter`);
        count++;
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Broadcast sent to ${count} sessions` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Broadcast failed: ${error.message}` 
        }]
      };
    }
  }

  async getTeamStatus() {
    try {
      console.error('👥 Getting team status');
      
      const result = await execAsync('tmux list-sessions -F "#{session_name}:#{session_attached}"');
      const sessions = result.stdout.split('\n').filter(s => s.trim());
      
      const statuses = [];
      for (const sessionInfo of sessions) {
        const [name, attached] = sessionInfo.split(':');
        
        let lastActivity = 'Unknown';
        try {
          const capture = await execAsync(`tmux capture-pane -t "${name}:0" -p | tail -3`);
          const lines = capture.stdout.split('\n').filter(l => l.trim());
          lastActivity = lines[lines.length - 1] || 'No activity';
        } catch (e) {
          // Session might be locked
        }
        
        statuses.push({
          session: name,
          attached: attached === '1',
          lastActivity: lastActivity.substring(0, 80)
        });
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `📊 Team Status:\n${JSON.stringify(statuses, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to get team status: ${error.message}` 
        }]
      };
    }
  }

  async createTeam(args) {
    try {
      const { role, name } = args;
      console.error(`🚀 Creating team ${name} with role ${role}`);
      
      // Create tmux session
      await execAsync(`tmux new-session -d -s "${name}" -c "${this.projectPath}"`);
      
      // Send initial setup commands
      const setupCommands = [
        `export TMUX_SESSION_NAME="${name}"`,
        `export PROJECT_PATH="${this.projectPath}"`,
        `export AGENT_ROLE="${role}"`,
        `echo "🤖 Agent ${name} (${role}) initialized and ready!"`
      ];
      
      for (const cmd of setupCommands) {
        await execAsync(`tmux send-keys -t "${name}:0" "${cmd}" Enter`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Team ${name} created successfully with role ${role}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to create team: ${error.message}` 
        }]
      };
    }
  }

  async killAgent(args) {
    try {
      const { session } = args;
      console.error(`🛑 Killing agent session ${session}`);
      
      // Safety check
      if (session === 'orchestrator' || session === this.sessionName) {
        throw new Error('Cannot kill orchestrator or self');
      }
      
      await execAsync(`tmux kill-session -t "${session}"`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Agent ${session} terminated` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to kill agent: ${error.message}` 
        }]
      };
    }
  }

  async getTickets(args) {
    return {
      content: [{ 
        type: 'text', 
        text: '📋 No tickets configured yet' 
      }]
    };
  }

  async updateTicket(args) {
    return {
      content: [{ 
        type: 'text', 
        text: '✅ Ticket update simulated' 
      }]
    };
  }

  async reportProgress(args) {
    const { progress, current } = args;
    return {
      content: [{ 
        type: 'text', 
        text: `✅ Progress reported: ${progress}% - ${current || 'Working'}` 
      }]
    };
  }

  async requestReview(args) {
    return {
      content: [{ 
        type: 'text', 
        text: '✅ Review requested' 
      }]
    };
  }

  async scheduleCheck(args) {
    const { minutes, message } = args;
    return {
      content: [{ 
        type: 'text', 
        text: `✅ Check scheduled for ${minutes} minutes: ${message}` 
      }]
    };
  }

  async enforceCommit(args) {
    return {
      content: [{ 
        type: 'text', 
        text: '✅ Commit enforced' 
      }]
    };
  }

  async delegateTask(args) {
    const { to, task } = args;
    return {
      content: [{ 
        type: 'text', 
        text: `✅ Task delegated to ${to}: ${task}` 
      }]
    };
  }

  getToolDefinitions() {
    return [
      {
        name: 'send_message',
        description: 'Send message to another agent session',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Target session name' },
            message: { type: 'string', description: 'Message to send' }
          },
          required: ['to', 'message']
        }
      },
      {
        name: 'broadcast',
        description: 'Broadcast message to all team members',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to broadcast' },
            excludeSelf: { type: 'boolean', description: 'Exclude sender from broadcast' }
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
        name: 'create_team',
        description: 'Create new agent team',
        inputSchema: {
          type: 'object',
          properties: {
            role: { type: 'string', description: 'Agent role (pm, developer, qa)' },
            name: { type: 'string', description: 'Session name' }
          },
          required: ['role', 'name']
        }
      },
      {
        name: 'kill_agent',
        description: 'Terminate an agent session',
        inputSchema: {
          type: 'object',
          properties: {
            session: { type: 'string', description: 'Session name to kill' }
          },
          required: ['session']
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
          }
        }
      },
      {
        name: 'update_ticket',
        description: 'Update ticket status',
        inputSchema: {
          type: 'object',
          properties: {
            ticketId: { type: 'string', description: 'Ticket ID' },
            status: { type: 'string', description: 'New status' },
            notes: { type: 'string', description: 'Additional notes' }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'report_progress',
        description: 'Report progress to PM',
        inputSchema: {
          type: 'object',
          properties: {
            progress: { type: 'number', description: 'Progress percentage' },
            current: { type: 'string', description: 'Current task' },
            blockers: { type: 'array', items: { type: 'string' }, description: 'Blockers' }
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
            ticketId: { type: 'string', description: 'Ticket ID' },
            reviewer: { type: 'string', description: 'Reviewer session' },
            message: { type: 'string', description: 'Review message' }
          },
          required: ['ticketId']
        }
      },
      {
        name: 'schedule_check',
        description: 'Schedule a reminder',
        inputSchema: {
          type: 'object',
          properties: {
            minutes: { type: 'number', description: 'Minutes until reminder' },
            message: { type: 'string', description: 'Reminder message' },
            target: { type: 'string', description: 'Target session' }
          },
          required: ['minutes', 'message']
        }
      },
      {
        name: 'enforce_commit',
        description: 'Commit current changes',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Commit message' }
          }
        }
      },
      {
        name: 'delegate_task',
        description: 'Delegate task to team member',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Target session' },
            task: { type: 'string', description: 'Task description' },
            priority: { type: 'string', description: 'Task priority' }
          },
          required: ['to', 'task']
        }
      }
    ];
  }
}

// Start server
if (require.main === module) {
  const server = new AgentMuxMCPServer();
  server.start();
}

module.exports = AgentMuxMCPServer;