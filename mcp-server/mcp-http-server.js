#!/usr/bin/env node

/**
 * AgentMux MCP HTTP Server
 * A complete MCP server implementation with all AgentMux tools
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class AgentMuxMCPServer {
  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'mcp-server';
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.agentRole = process.env.AGENT_ROLE || 'developer';
    this.port = process.env.MCP_PORT || 3001;
  }

  async handleRequest(request) {
    console.log(`📥 Received: ${request.method}`);
    
    if (request.method === 'initialize') {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'agentmux',
          version: '1.0.0'
        }
      };
    }

    if (request.method === 'tools/list') {
      return {
        tools: this.getToolDefinitions()
      };
    }

    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params;
      console.log(`🔧 Calling tool: ${name}`);
      return await this.callTool(name, args || {});
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
      console.log(`💬 Sending message to ${to}: ${message}`);
      
      // Send message via tmux
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
      console.log(`📢 Broadcasting: ${message}`);
      
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
      console.log('👥 Getting team status');
      
      const result = await execAsync('tmux list-sessions -F "#{session_name}:#{session_attached}"');
      const sessions = result.stdout.split('\n').filter(s => s.trim());
      
      const statuses = [];
      for (const sessionInfo of sessions) {
        const [name, attached] = sessionInfo.split(':');
        
        // Try to capture last activity
        let lastActivity = 'Unknown';
        try {
          const capture = await execAsync(`tmux capture-pane -t "${name}:0" -p | tail -5`);
          const lines = capture.stdout.split('\n').filter(l => l.trim());
          lastActivity = lines[lines.length - 1] || 'No activity';
        } catch (e) {
          // Session might be locked
        }
        
        statuses.push({
          session: name,
          attached: attached === '1',
          lastActivity: lastActivity.substring(0, 100)
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

  async getTickets(args) {
    try {
      console.log('🎫 Getting tickets');
      const { status, all } = args;
      
      const ticketsDir = path.join(this.projectPath, '.agentmux', 'tickets');
      
      // Create directory if it doesn't exist
      await fs.mkdir(ticketsDir, { recursive: true });
      
      const tickets = [];
      try {
        const files = await fs.readdir(ticketsDir);
        for (const file of files) {
          if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            const content = await fs.readFile(path.join(ticketsDir, file), 'utf-8');
            const ticket = this.parseTicket(content);
            
            if (!all && ticket.assignedTo !== this.sessionName) continue;
            if (status && ticket.status !== status) continue;
            
            tickets.push(ticket);
          }
        }
      } catch (e) {
        // No tickets yet
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `📋 Tickets:\n${JSON.stringify(tickets, null, 2)}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to get tickets: ${error.message}` 
        }]
      };
    }
  }

  async updateTicket(args) {
    try {
      const { ticketId, status, notes } = args;
      console.log(`📝 Updating ticket ${ticketId}`);
      
      const ticketPath = path.join(this.projectPath, '.agentmux', 'tickets', `${ticketId}.yaml`);
      
      let ticket = { id: ticketId, status: 'todo' };
      try {
        const content = await fs.readFile(ticketPath, 'utf-8');
        ticket = this.parseTicket(content);
      } catch (e) {
        // New ticket
      }
      
      if (status) ticket.status = status;
      ticket.updatedAt = new Date().toISOString();
      ticket.lastUpdatedBy = this.sessionName;
      
      if (notes) {
        ticket.notes = ticket.notes || [];
        ticket.notes.push({
          author: this.sessionName,
          content: notes,
          timestamp: new Date().toISOString()
        });
      }
      
      // Save ticket
      const yamlContent = this.generateTicketYaml(ticket);
      await fs.writeFile(ticketPath, yamlContent);
      
      // If marking as done, commit
      if (status === 'done') {
        await this.enforceCommit({ message: `Complete ticket ${ticketId}` });
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Ticket ${ticketId} updated` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to update ticket: ${error.message}` 
        }]
      };
    }
  }

  async reportProgress(args) {
    try {
      const { progress, current, blockers } = args;
      console.log(`📈 Reporting progress: ${progress}%`);
      
      const message = `STATUS UPDATE [${this.sessionName}]
Progress: ${progress}%
Current: ${current || 'Working on tasks'}
Blockers: ${blockers?.join(', ') || 'None'}
Time: ${new Date().toLocaleTimeString()}`;
      
      // Find PM session
      const sessions = await this.getActiveSessions();
      const pmSession = sessions.find(s => s.includes('pm') || s.includes('manager')) || 'orchestrator';
      
      await this.sendMessage({ to: pmSession, message });
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Progress reported to ${pmSession}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to report progress: ${error.message}` 
        }]
      };
    }
  }

  async requestReview(args) {
    try {
      const { ticketId, reviewer, message } = args;
      console.log(`👀 Requesting review for ${ticketId}`);
      
      const reviewMessage = `REVIEW REQUEST
Ticket: ${ticketId}
From: ${this.sessionName}
Message: ${message || 'Please review my implementation'}`;
      
      const targetReviewer = reviewer || 'qa';
      await this.sendMessage({ to: targetReviewer, message: reviewMessage });
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Review requested from ${targetReviewer}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to request review: ${error.message}` 
        }]
      };
    }
  }

  async scheduleCheck(args) {
    try {
      const { minutes, message, target } = args;
      console.log(`⏰ Scheduling check in ${minutes} minutes`);
      
      const targetSession = target || this.sessionName;
      const seconds = minutes * 60;
      
      // Use nohup to schedule in background
      const scheduleCmd = `nohup bash -c "sleep ${seconds} && tmux send-keys -t '${targetSession}:0' 'REMINDER: ${message}' && sleep 0.5 && tmux send-keys -t '${targetSession}:0' Enter" > /dev/null 2>&1 &`;
      
      await execAsync(scheduleCmd);
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Check scheduled for ${targetSession} in ${minutes} minutes` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to schedule check: ${error.message}` 
        }]
      };
    }
  }

  async enforceCommit(args) {
    try {
      const { message } = args;
      console.log(`💾 Enforcing commit`);
      
      const status = await execAsync(`cd ${this.projectPath} && git status --porcelain`);
      
      if (status.stdout.trim()) {
        const commitMsg = message || `Progress update from ${this.sessionName}`;
        await execAsync(`cd ${this.projectPath} && git add -A`);
        await execAsync(`cd ${this.projectPath} && git commit -m "${commitMsg}"`);
        
        return {
          content: [{ 
            type: 'text', 
            text: `✅ Changes committed: ${commitMsg}` 
          }]
        };
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: '✅ No changes to commit' 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to commit: ${error.message}` 
        }]
      };
    }
  }

  async createTeam(args) {
    try {
      const { role, name } = args;
      console.log(`🚀 Creating team ${name} with role ${role}`);
      
      // Check orchestrator permission
      if (!this.sessionName.includes('orchestrator') && this.sessionName !== 'mcp-server') {
        throw new Error('Only orchestrator can create teams');
      }
      
      // Create tmux session
      await execAsync(`tmux new-session -d -s "${name}" -c "${this.projectPath}"`);
      
      // Send initial setup commands
      const setupCommands = [
        `export TMUX_SESSION_NAME="${name}"`,
        `export PROJECT_PATH="${this.projectPath}"`,
        `export AGENT_ROLE="${role}"`,
        `echo "🤖 Agent ${name} (${role}) initialized"`
      ];
      
      for (const cmd of setupCommands) {
        await execAsync(`tmux send-keys -t "${name}:0" "${cmd}" Enter`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Team ${name} created with role ${role}` 
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

  async delegateTask(args) {
    try {
      const { to, task, priority } = args;
      console.log(`📋 Delegating task to ${to}`);
      
      const taskMessage = `TASK DELEGATION
From: ${this.sessionName}
Priority: ${priority || 'normal'}
Task: ${task}
Please acknowledge and provide ETA.`;
      
      await this.sendMessage({ to, message: taskMessage });
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Task delegated to ${to}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to delegate task: ${error.message}` 
        }]
      };
    }
  }

  async killAgent(args) {
    try {
      const { session } = args;
      console.log(`🛑 Killing agent session ${session}`);
      
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

  async getActiveSessions() {
    const result = await execAsync('tmux list-sessions -F "#{session_name}"');
    return result.stdout.split('\n').filter(s => s.trim());
  }

  parseTicket(content) {
    try {
      const lines = content.split('\n');
      const ticket = { id: 'unknown', status: 'todo' };
      
      let inFrontmatter = false;
      for (const line of lines) {
        if (line === '---') {
          inFrontmatter = !inFrontmatter;
          continue;
        }
        
        if (inFrontmatter) {
          const match = line.match(/^(\w+):\s*(.*)$/);
          if (match) {
            ticket[match[1]] = match[2];
          }
        }
      }
      
      return ticket;
    } catch (e) {
      return { id: 'error', status: 'error' };
    }
  }

  generateTicketYaml(ticket) {
    const { notes, ...frontmatter } = ticket;
    
    let yaml = '---\n';
    for (const [key, value] of Object.entries(frontmatter)) {
      yaml += `${key}: ${value}\n`;
    }
    yaml += '---\n\n';
    
    if (notes && notes.length > 0) {
      yaml += '## Notes\n\n';
      for (const note of notes) {
        yaml += `**${note.author}** (${note.timestamp}):\n${note.content}\n\n`;
      }
    }
    
    return yaml;
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
      }
    ];
  }

  start() {
    const server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', mcp: 'running' }));
        return;
      }

      if (req.url === '/mcp' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
          try {
            const request = JSON.parse(body);
            console.log(`\n📨 Request: ${request.method}`);
            
            const result = await this.handleRequest(request);
            const response = {
              jsonrpc: '2.0',
              id: request.id,
              result
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            const errorResponse = {
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32603,
                message: error.message
              }
            };
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(errorResponse));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(this.port, () => {
      console.log(`
╔════════════════════════════════════════════════╗
║        AgentMux MCP Server Started!            ║
╠════════════════════════════════════════════════╣
║  🌐 URL: http://localhost:${this.port}/mcp           ║
║  ❤️  Health: http://localhost:${this.port}/health    ║
║  📡 Session: ${this.sessionName.padEnd(34)} ║
║  📂 Project: ${path.basename(this.projectPath).padEnd(34)} ║
╚════════════════════════════════════════════════╝

To configure Claude Code:
claude mcp add --transport http agentmux http://localhost:${this.port}/mcp

Or add to ~/.claude/settings.json:
{
  "mcpServers": {
    "agentmux": {
      "transport": "http",
      "url": "http://localhost:${this.port}/mcp"
    }
  }
}
`);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down MCP server...');
      server.close();
      process.exit(0);
    });
  }
}

// Start server
if (require.main === module) {
  const server = new AgentMuxMCPServer();
  server.start();
}

module.exports = AgentMuxMCPServer;