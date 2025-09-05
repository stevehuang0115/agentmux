#!/usr/bin/env node

/**
 * AgentMux MCP HTTP Server - Fixed Implementation
 * Properly implements MCP protocol over HTTP for Claude Code compatibility
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class AgentMuxMCPHTTPServer {
  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'orchestrator';
    this.projectPath = process.env.PROJECT_PATH || process.cwd();
    this.port = process.env.MCP_PORT || 3001;
    
    // Track server state
    this.isInitialized = false;
    this.capabilities = {
      tools: {}
    };
    this.teamsFilePath = require('path').join(require('os').homedir(), '.agentmux', 'teams.json');
  }

  // Helper function to read teams.json
  async readTeamsFile() {
    const fs = require('fs').promises;
    try {
      const data = await fs.readFile(this.teamsFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading teams.json:', error.message);
      return [];
    }
  }

  // Helper function to write teams.json
  async writeTeamsFile(teams) {
    const fs = require('fs').promises;
    try {
      await fs.writeFile(this.teamsFilePath, JSON.stringify(teams, null, 2));
    } catch (error) {
      console.error('Error writing teams.json:', error.message);
      throw error;
    }
  }

  // Helper function to find and update team member session
  async updateTeamMemberSession(sessionName, newSessionName = null) {
    try {
      const teams = await this.readTeamsFile();
      let updated = false;

      for (const team of teams) {
        for (const member of team.members) {
          // For creating team (linking session): find member by name when sessionName is empty
          if (newSessionName && member.name === sessionName && member.sessionName === '') {
            member.sessionName = newSessionName;
            member.status = 'active';
            member.updatedAt = new Date().toISOString();
            updated = true;
            console.error(`🔗 Linked session "${newSessionName}" to team member "${member.name}"`);
            break;
          }
          // For killing agent (releasing session): find member by current sessionName
          else if (!newSessionName && member.sessionName === sessionName) {
            member.sessionName = '';
            member.status = 'idle';
            member.updatedAt = new Date().toISOString();
            updated = true;
            console.error(`🔓 Released session "${sessionName}" from team member "${member.name}"`);
            break;
          }
        }
        if (updated) break;
      }

      if (updated) {
        await this.writeTeamsFile(teams);
      }

      return updated;
    } catch (error) {
      console.error('Error updating team member session:', error.message);
      return false;
    }
  }

  async handleMCPRequest(request) {
    console.error(`📥 MCP Request: ${request.method} (id: ${request.id})`);
    
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);
      case 'initialized': 
      case 'notifications/initialized':  // Handle both formats
        return this.handleInitialized(request);
      case 'tools/list':
        return this.handleToolsList(request);
      case 'tools/call':
        return this.handleToolCall(request);
      case 'ping':
        return this.handlePing(request);
      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }

  handleInitialize(request) {
    console.error('🚀 Initializing MCP server...');
    
    const { protocolVersion, capabilities, clientInfo } = request.params || {};
    if (clientInfo && clientInfo.name) {
      console.error(`📡 Client: ${clientInfo.name} v${clientInfo.version || 'unknown'}`);
    } else {
      console.error('📡 Client: claude-code (no client info provided)');
    }
    console.error(`🔗 Protocol: ${protocolVersion || '2024-11-05'}`);
    
    this.isInitialized = false; // Will be true after 'initialized' call
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
        logging: {}
      },
      serverInfo: {
        name: 'agentmux',
        version: '1.0.0',
        description: 'AgentMux team coordination and communication tools'
      }
    };
  }

  handleInitialized(request) {
    console.error('✅ MCP server initialization complete');
    this.isInitialized = true;
    return {}; // Empty response for initialized
  }

  handlePing(request) {
    return {}; // Simple ping response
  }

  handleToolsList(request) {
    console.error('📋 Listing tools...');
    
    if (!this.isInitialized) {
      console.error('⚠️  Server not yet initialized');
    }
    
    const tools = [
      {
        name: 'send_message',
        description: 'Send a message to another agent session',
        inputSchema: {
          type: 'object',
          properties: {
            to: { 
              type: 'string', 
              description: 'Target tmux session name (e.g., "agent-dev", "agent-qa")' 
            },
            message: { 
              type: 'string', 
              description: 'Message content to send' 
            }
          },
          required: ['to', 'message']
        }
      },
      {
        name: 'broadcast',
        description: 'Broadcast a message to all active agent sessions',
        inputSchema: {
          type: 'object',
          properties: {
            message: { 
              type: 'string', 
              description: 'Message to broadcast to all agents' 
            },
            excludeSelf: { 
              type: 'boolean', 
              description: 'Whether to exclude the sender from broadcast',
              default: true
            }
          },
          required: ['message']
        }
      },
      {
        name: 'get_team_status',
        description: 'Get the current status of all team members and sessions',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'create_team',
        description: 'Create a new agent team member with specified role',
        inputSchema: {
          type: 'object',
          properties: {
            role: { 
              type: 'string', 
              description: 'Agent role: developer, pm, qa, or tester',
              enum: ['developer', 'pm', 'qa', 'tester']
            },
            name: { 
              type: 'string', 
              description: 'Unique session name for the agent (e.g., "dev1", "qa-lead")' 
            }
          },
          required: ['role', 'name']
        }
      },
      {
        name: 'kill_agent',
        description: 'Terminate an agent session safely',
        inputSchema: {
          type: 'object',
          properties: {
            session: { 
              type: 'string', 
              description: 'Session name to terminate (cannot kill orchestrator or self)' 
            }
          },
          required: ['session']
        }
      },
      {
        name: 'initialize_claude',
        description: 'Initialize Claude Code in target session with proper environment using bash script',
        inputSchema: {
          type: 'object',
          properties: {
            session: { 
              type: 'string', 
              description: 'Target session name to initialize Claude Code in' 
            },
            teamRole: {
              type: 'string',
              description: 'Team role for the session (developer, pm, qa, tester)',
              enum: ['developer', 'pm', 'qa', 'tester'],
              default: 'developer'
            },
            createIfNotExists: {
              type: 'boolean',
              description: 'Create session if it does not exist',
              default: true
            }
          },
          required: ['session']
        }
      },
      {
        name: 'get_team_logs',
        description: 'Get current terminal logs from specific team member session',
        inputSchema: {
          type: 'object',
          properties: {
            session: { 
              type: 'string', 
              description: 'Target session name to get logs from' 
            },
            lines: { 
              type: 'number', 
              description: 'Number of lines to capture (default: 20, max: 100)',
              minimum: 1,
              maximum: 100,
              default: 20
            },
            window: { 
              type: 'number', 
              description: 'Window index to capture from (default: 0)',
              minimum: 0,
              default: 0
            }
          },
          required: ['session']
        }
      },
      {
        name: 'ping_team_member',
        description: 'Get comprehensive status and current activity of specific team member',
        inputSchema: {
          type: 'object',
          properties: {
            session: { 
              type: 'string', 
              description: 'Target session name to ping and get status from' 
            }
          },
          required: ['session']
        }
      }
    ];

    return { tools };
  }

  async handleToolCall(request) {
    const { name, arguments: args } = request.params;
    console.error(`🔧 Calling tool: ${name} with args:`, JSON.stringify(args, null, 2));

    try {
      let result;
      
      switch (name) {
        case 'send_message':
          result = await this.sendMessage(args);
          break;
        case 'broadcast':
          result = await this.broadcast(args);
          break;
        case 'get_team_status':
          result = await this.getTeamStatus(args);
          break;
        case 'create_team':
          result = await this.createTeam(args);
          break;
        case 'kill_agent':
          result = await this.killAgent(args);
          break;
        case 'initialize_claude':
          result = await this.initializeClaude(args);
          break;
        case 'get_team_logs':
          result = await this.getTeamLogs(args);
          break;
        case 'ping_team_member':
          result = await this.pingTeamMember(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      console.error(`✅ Tool ${name} completed successfully`);
      return result;
      
    } catch (error) {
      console.error(`❌ Tool ${name} failed:`, error.message);
      throw error;
    }
  }

  async sendMessage(args) {
    const { to, message } = args;
    
    if (!to || !message) {
      throw new Error('Both "to" and "message" parameters are required');
    }

    try {
      // Check if target session exists
      const sessions = await this.getActiveSessions();
      if (!sessions.includes(to)) {
        throw new Error(`Target session "${to}" not found. Active sessions: ${sessions.join(', ')}`);
      }

      // Send message via tmux with proper Enter key handling
      const escapedMessage = message.replace(/'/g, "'\\''").replace(/"/g, '\\"');
      
      // Send the message content directly (for commands) or as a display message
      const messageToSend = message.startsWith('/') || message.includes('mkdir') || message.includes('ls') || message.includes('cd') || message.includes('npm') || message.includes('git') || message.includes('curl') || message.includes('node') || message.includes('python') || message.includes('cat') || message.includes('echo') 
        ? message  // Send command directly
        : `echo "📨 Message from ${this.sessionName}: ${escapedMessage}"`; // Wrap non-commands in echo
      
      // Send the message/command first
      await execAsync(`tmux send-keys -t "${to}:0" '${messageToSend}'`);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send Enter key separately using spawn for reliability
      const { spawn } = require('child_process');
      const tmuxProcess = spawn('tmux', ['send-keys', '-t', `${to}:0`, 'Enter']);
      await new Promise((resolve, reject) => {
        tmuxProcess.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`tmux send-keys failed with code ${code}`));
        });
      });
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Message successfully sent to session "${to}"\n💬 Content: "${message}"` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to send message to "${to}": ${error.message}` 
        }]
      };
    }
  }

  async broadcast(args) {
    const { message, excludeSelf = true } = args;
    
    if (!message) {
      throw new Error('Message parameter is required');
    }

    try {
      const sessions = await this.getActiveSessions();
      const targetSessions = excludeSelf 
        ? sessions.filter(s => s !== this.sessionName)
        : sessions;

      if (targetSessions.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: '⚠️ No target sessions found for broadcast' 
          }]
        };
      }

      const escapedMessage = message.replace(/'/g, "'\\''").replace(/"/g, '\\"');
      let successCount = 0;

      const { spawn } = require('child_process');
      
      for (const session of targetSessions) {
        try {
          // Send the message content directly (for commands) or as a display message
          const messageToSend = message.startsWith('/') || message.includes('mkdir') || message.includes('ls') || message.includes('cd') || message.includes('npm') || message.includes('git') || message.includes('curl') || message.includes('node') || message.includes('python') || message.includes('cat') || message.includes('echo') 
            ? message  // Send command directly
            : `echo "📢 Broadcast from ${this.sessionName}: ${escapedMessage}"`; // Wrap non-commands in echo
          
          // Send the message/command first
          await execAsync(`tmux send-keys -t "${session}:0" '${messageToSend}'`);
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Send Enter key separately using spawn for reliability
          const tmuxProcess = spawn('tmux', ['send-keys', '-t', `${session}:0`, 'Enter']);
          await new Promise((resolve, reject) => {
            tmuxProcess.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`tmux send-keys failed with code ${code}`));
            });
          });
          
          successCount++;
        } catch (error) {
          console.error(`Failed to send to ${session}:`, error.message);
        }
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Broadcast sent to ${successCount}/${targetSessions.length} sessions\n📢 Message: "${message}"` 
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
      const result = await execAsync('tmux list-sessions -F "#{session_name}:#{session_attached}:#{session_created}"');
      const sessionLines = result.stdout.split('\n').filter(s => s.trim());

      if (sessionLines.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: '📊 No active tmux sessions found' 
          }]
        };
      }

      const statuses = [];
      for (const line of sessionLines) {
        const [name, attached, created] = line.split(':');
        
        // Try to get last activity from the session
        let lastActivity = 'Unknown';
        let windowCount = 0;
        
        try {
          const windowInfo = await execAsync(`tmux list-windows -t "${name}" -F "#{window_name}" 2>/dev/null`);
          windowCount = windowInfo.stdout.split('\n').filter(w => w.trim()).length;
          
          const capture = await execAsync(`tmux capture-pane -t "${name}:0" -p -S -3 2>/dev/null`);
          const lines = capture.stdout.split('\n').filter(l => l.trim());
          if (lines.length > 0) {
            lastActivity = lines[lines.length - 1].substring(0, 60);
            if (lastActivity.length === 60) lastActivity += '...';
          }
        } catch (e) {
          // Session might be busy or locked
          lastActivity = 'Session busy or inaccessible';
        }
        
        statuses.push({
          session: name,
          attached: attached === '1',
          created: new Date(parseInt(created) * 1000).toLocaleString(),
          windows: windowCount,
          lastActivity,
          isCurrentSession: name === this.sessionName
        });
      }

      // Sort by session name for consistent output
      statuses.sort((a, b) => a.session.localeCompare(b.session));

      const statusText = `📊 Team Status (${statuses.length} sessions active)\n\n` +
        statuses.map(s => 
          `🖥️  **${s.session}** ${s.isCurrentSession ? '(current)' : ''}\n` +
          `   ├─ Attached: ${s.attached ? '✅ Yes' : '❌ No'}\n` +
          `   ├─ Windows: ${s.windows}\n` +
          `   ├─ Created: ${s.created}\n` +
          `   └─ Activity: ${s.lastActivity}\n`
        ).join('\n');

      return {
        content: [{ 
          type: 'text', 
          text: statusText
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
    const { role, name } = args;
    
    if (!role || !name) {
      throw new Error('Both "role" and "name" parameters are required');
    }

    if (!['developer', 'pm', 'qa', 'tester'].includes(role)) {
      throw new Error('Role must be one of: developer, pm, qa, tester');
    }

    try {
      // Check if session already exists
      const sessions = await this.getActiveSessions();
      if (sessions.includes(name)) {
        throw new Error(`Session "${name}" already exists`);
      }

      // Create new tmux session
      await execAsync(`tmux new-session -d -s "${name}" -c "${this.projectPath}"`);
      
      // Send initial setup commands
      const setupCommands = [
        `export TMUX_SESSION_NAME="${name}"`,
        `export PROJECT_PATH="${this.projectPath}"`, 
        `export AGENT_ROLE="${role}"`,
        `clear`,
        `echo "╔══════════════════════════════════════════╗"`,
        `echo "║         🤖 Agent Initialized            ║"`,
        `echo "╠══════════════════════════════════════════╣"`,
        `echo "║  Name: ${name.padEnd(32)} ║"`,
        `echo "║  Role: ${role.padEnd(32)} ║"`,
        `echo "║  Project: ${require('path').basename(this.projectPath).padEnd(26)} ║"`,
        `echo "╚══════════════════════════════════════════╝"`,
        `echo ""`,
        `echo "Ready for commands! Type 'help' for assistance."`
      ];

      for (const cmd of setupCommands) {
        await execAsync(`tmux send-keys -t "${name}:0" "${cmd}" Enter`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Automatically initialize Claude Code in the new session
      console.error(`🔧 Auto-initializing Claude Code for ${name} with role ${role}`);
      await this.initializeClaude({ session: name, teamRole: role });
      
      // Link session to team member in teams.json
      console.error(`🔗 Linking session "${name}" to team member in teams.json`);
      const linked = await this.updateTeamMemberSession(name, name);
      
      if (linked) {
        console.error(`✅ Successfully linked session "${name}" to team member`);
      } else {
        console.error(`⚠️ Could not find team member "${name}" in teams.json to link session`);
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Successfully created agent "${name}" with role "${role}"\n🎯 Session initialized and ready for work\n🔧 Claude Code automatically initialized\n📁 Working directory: ${this.projectPath}${linked ? '\n🔗 Team member linked in teams.json' : '\n⚠️ Could not link to teams.json (member may not exist)'}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to create team "${name}": ${error.message}` 
        }]
      };
    }
  }

  async killAgent(args) {
    const { session } = args;
    
    if (!session) {
      throw new Error('Session parameter is required');
    }

    // Safety checks
    if (session === 'orchestrator' || session.includes('orchestrator')) {
      throw new Error('Cannot terminate orchestrator session');
    }
    
    if (session === this.sessionName) {
      throw new Error('Cannot terminate self');
    }

    try {
      // Check if session exists
      const sessions = await this.getActiveSessions();
      if (!sessions.includes(session)) {
        throw new Error(`Session "${session}" not found. Active sessions: ${sessions.join(', ')}`);
      }

      // Send goodbye message first
      try {
        await execAsync(`tmux send-keys -t "${session}:0" 'echo "🛑 Agent ${session} shutting down..."' Enter`);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // Session might be busy
      }

      // Kill the session
      await execAsync(`tmux kill-session -t "${session}"`);
      
      // Release session from team member in teams.json
      console.error(`🔗 Releasing session "${session}" from team member in teams.json`);
      const released = await this.updateTeamMemberSession(session, null);
      
      if (released) {
        console.error(`✅ Successfully released session "${session}" from team member`);
      } else {
        console.error(`⚠️ Could not find team member with session "${session}" in teams.json`);
      }
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Agent "${session}" has been successfully terminated\n🏁 Session closed cleanly${released ? '\n🔓 Session released from teams.json' : '\n⚠️ Session not found in teams.json'}` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to kill agent "${session}": ${error.message}` 
        }]
      };
    }
  }

  async initializeClaude(args) {
    const { session, teamRole, createIfNotExists } = args;
    
    if (!session) {
      throw new Error('Session parameter is required');
    }
    
    console.error(`🚀 Initializing Claude Code in session ${session}`);
    
    try {
      const role = teamRole || 'developer';
      const scriptPath = `${this.projectPath}/config/initialize_claude.sh`;
      
      // Check if initialization script exists
      try {
        await execAsync(`test -f "${scriptPath}"`);
      } catch (e) {
        throw new Error(`Initialization script not found at ${scriptPath}`);
      }
      
      // Run the initialization script
      console.error(`📝 Running initialization script: ${scriptPath}`);
      const initCommand = `bash "${scriptPath}" "${session}" "${this.projectPath}" "${role}"`;
      
      const result = await execAsync(initCommand, { 
        timeout: 60000, // 1 minute timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      console.error(`✅ Initialization script completed for ${session}`);
      console.error(`Script output: ${result.stdout}`);
      
      if (result.stderr) {
        console.error(`Script stderr: ${result.stderr}`);
      }
      
      // Verify the session exists after initialization
      const sessions = await this.getActiveSessions();
      if (!sessions.includes(session)) {
        throw new Error(`Session "${session}" was not created successfully`);
      }
      
      // Get session status for confirmation
      const statusCmd = `tmux display-message -t "${session}" -p "#{session_name}:#{session_attached}:#{session_created}"`;
      const statusResult = await execAsync(statusCmd);
      const [name, attached, created] = statusResult.stdout.trim().split(':');
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ **Claude Code Successfully Initialized**\n\n` +
                `📋 **Session Details:**\n` +
                `├─ Name: ${name}\n` +
                `├─ Role: ${role}\n` +
                `├─ Attached: ${attached === '1' ? 'Yes' : 'No'}\n` +
                `├─ Created: ${new Date(parseInt(created) * 1000).toLocaleString()}\n` +
                `└─ Project: ${this.projectPath}\n\n` +
                `🔧 **What was done:**\n` +
                `├─ Session created/verified\n` +
                `├─ Environment variables set\n` +
                `├─ ~/.bashrc sourced\n` +
                `└─ Claude Code started with --dangerously-skip-permissions\n\n` +
                `🎯 **Ready for use!**`
        }]
      };
    } catch (error) {
      console.error(`❌ Claude initialization failed: ${error.message}`);
      
      return {
        content: [{ 
          type: 'text', 
          text: `❌ **Failed to initialize Claude Code in "${session}"**\n\n` +
                `**Error:** ${error.message}\n\n` +
                `**Troubleshooting:**\n` +
                `├─ Check if tmux is running\n` +
                `├─ Verify Claude Code is installed\n` +
                `├─ Ensure initialization script exists\n` +
                `└─ Check session permissions\n\n` +
                `**Manual initialization:**\n` +
                `\`bash ${this.projectPath}/config/initialize_claude.sh ${session}\`` 
        }]
      };
    }
  }

  async getTeamLogs(args) {
    const { session, lines = 20, window = 0 } = args;
    
    if (!session) {
      throw new Error('Session parameter is required');
    }
    
    if (lines < 1 || lines > 100) {
      throw new Error('Lines parameter must be between 1 and 100');
    }
    
    console.error(`📋 Getting team logs for ${session}:${window} (${lines} lines)`);
    
    try {
      // Check if session exists
      const sessions = await this.getActiveSessions();
      if (!sessions.includes(session)) {
        throw new Error(`Session "${session}" not found. Active sessions: ${sessions.join(', ')}`);
      }
      
      // Get session information
      const sessionInfoCmd = `tmux display-message -p -t "${session}:${window}" "#{session_name}:#{window_index}:#{window_name}"`;
      const sessionInfo = await execAsync(sessionInfoCmd);
      
      // Capture pane content
      const captureCmd = `tmux capture-pane -t "${session}:${window}" -p -S -${lines}`;
      const output = await execAsync(captureCmd);
      
      // Get additional session metadata
      const metadataCmd = `tmux display-message -p -t "${session}" "#{session_attached}:#{session_created}:#{session_last_attached}"`;
      const metadata = await execAsync(metadataCmd);
      const [attached, created, lastAttached] = metadata.stdout.trim().split(':');
      
      const result = {
        session: session,
        window: window,
        sessionInfo: sessionInfo.stdout.trim(),
        attached: attached === '1',
        created: new Date(parseInt(created) * 1000).toISOString(),
        lastAttached: lastAttached ? new Date(parseInt(lastAttached) * 1000).toISOString() : null,
        lines: lines,
        logs: output.stdout,
        timestamp: new Date().toISOString()
      };
      
      const summary = `📊 **Team Logs: ${session}:${window}**\n` +
                     `📅 Captured: ${result.lines} lines at ${result.timestamp}\n` +
                     `🔗 Attached: ${result.attached ? 'Yes' : 'No'}\n` +
                     `📋 Session: ${result.sessionInfo}\n\n` +
                     `**Recent Activity:**\n\`\`\`\n${result.logs}\n\`\`\``;
      
      return {
        content: [{ 
          type: 'text', 
          text: summary
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to get team logs for "${session}": ${error.message}` 
        }]
      };
    }
  }

  async pingTeamMember(args) {
    const { session } = args;
    
    if (!session) {
      throw new Error('Session parameter is required');
    }
    
    console.error(`🏓 Pinging team member: ${session}`);
    
    try {
      // Check if session exists
      const sessions = await this.getActiveSessions();
      if (!sessions.includes(session)) {
        throw new Error(`Session "${session}" not found. Active sessions: ${sessions.join(', ')}`);
      }
      
      // Get comprehensive session info
      const infoCmd = `tmux display-message -p -t "${session}" "#{session_name}:#{window_index}:#{window_name}:#{session_attached}:#{session_created}"`;
      const info = await execAsync(infoCmd);
      const [name, windowIndex, windowName, attached, created] = info.stdout.trim().split(':');
      
      // Capture current screen (last 10 lines)
      const captureCmd = `tmux capture-pane -t "${session}:${windowIndex}" -p -S -10`;
      const currentScreen = await execAsync(captureCmd);
      
      // Get window list
      const windowsCmd = `tmux list-windows -t "${session}" -F "#{window_index}:#{window_name}:#{window_active}"`;
      const windowsResult = await execAsync(windowsCmd);
      const windows = windowsResult.stdout.split('\n')
        .filter(w => w.trim())
        .map(w => {
          const [index, name, active] = w.split(':');
          return { index: parseInt(index), name, active: active === '1' };
        });
      
      const result = {
        session: name,
        currentWindow: {
          index: parseInt(windowIndex),
          name: windowName
        },
        attached: attached === '1',
        created: new Date(parseInt(created) * 1000).toISOString(),
        windows: windows,
        currentActivity: currentScreen.stdout.split('\n').slice(-5).join('\n'), // Last 5 lines
        timestamp: new Date().toISOString()
      };
      
      const summary = `🏓 **Team Member Status: ${result.session}**\n\n` +
                     `📊 **Session Info:**\n` +
                     `├─ Current Window: ${result.currentWindow.index} (${result.currentWindow.name})\n` +
                     `├─ Attached: ${result.attached ? '✅ Yes' : '❌ No'}\n` +
                     `├─ Created: ${result.created}\n` +
                     `└─ Total Windows: ${result.windows.length}\n\n` +
                     `🪟 **Windows:**\n${result.windows.map(w => 
                       `${w.active ? '👉' : '  '} ${w.index}: ${w.name}${w.active ? ' (active)' : ''}`
                     ).join('\n')}\n\n` +
                     `🎯 **Current Activity (last 5 lines):**\n\`\`\`\n${result.currentActivity}\n\`\`\`\n\n` +
                     `🕒 **Pinged at:** ${result.timestamp}`;
      
      return {
        content: [{ 
          type: 'text', 
          text: summary
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to ping team member "${session}": ${error.message}` 
        }]
      };
    }
  }

  async getActiveSessions() {
    try {
      const result = await execAsync('tmux list-sessions -F "#{session_name}"');
      return result.stdout.split('\n').filter(s => s.trim());
    } catch (error) {
      console.error('No tmux sessions found');
      return [];
    }
  }

  start() {
    const server = http.createServer(async (req, res) => {
      // Enhanced CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, User-Agent');
      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      
      // Health check endpoint
      if (url.pathname === '/health' || url.pathname === '/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          server: 'agentmux-mcp',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          initialized: this.isInitialized
        }));
        return;
      }

      // MCP endpoint
      if (url.pathname === '/mcp' && req.method === 'POST') {
        let body = '';
        let bodyComplete = false;

        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          if (bodyComplete) return;
          bodyComplete = true;

          try {
            const request = JSON.parse(body);
            
            // Handle the MCP request
            const result = await this.handleMCPRequest(request);
            
            const response = {
              jsonrpc: '2.0',
              id: request.id,
              result: result
            };
            
            res.writeHead(200, { 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            });
            res.end(JSON.stringify(response));
            
          } catch (error) {
            console.error(`❌ MCP Error:`, error.message);
            
            const errorResponse = {
              jsonrpc: '2.0',
              id: body ? JSON.parse(body).id : null,
              error: {
                code: error.message.includes('not found') ? -32601 : -32603,
                message: error.message,
                data: {
                  timestamp: new Date().toISOString()
                }
              }
            };
            
            res.writeHead(error.message.includes('not found') ? 404 : 500, { 
              'Content-Type': 'application/json' 
            });
            res.end(JSON.stringify(errorResponse));
          }
        });

        req.on('error', (error) => {
          if (!bodyComplete) {
            console.error('Request error:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: {
                code: -32700,
                message: 'Parse error'
              }
            }));
          }
        });
        
        return;
      }

      // 404 for other paths
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Not found',
        available_endpoints: ['/health', '/mcp'] 
      }));
    });

    server.listen(this.port, '0.0.0.0', () => {
      console.error(`
╔════════════════════════════════════════════════╗
║        🚀 AgentMux MCP Server (HTTP)           ║
╠════════════════════════════════════════════════╣
║  📡 URL: http://localhost:${this.port}/mcp           ║
║  ❤️  Health: http://localhost:${this.port}/health    ║
║  🖥️  Session: ${this.sessionName.padEnd(29)} ║
║  📁 Project: ${require('path').basename(this.projectPath).padEnd(30)} ║
╚════════════════════════════════════════════════╝

🔧 Configure Claude Code with:
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

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.error('\n🛑 Shutting down MCP server...');
      server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      console.error('\n🛑 SIGTERM received, shutting down...');
      server.close(() => {
        process.exit(0);
      });
    });

    return server;
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new AgentMuxMCPHTTPServer();
  server.start();
}

module.exports = AgentMuxMCPHTTPServer;