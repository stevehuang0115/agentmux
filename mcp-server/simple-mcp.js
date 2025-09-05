#!/usr/bin/env node

/**
 * Simple AgentMux MCP Server
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const sessionName = process.env.TMUX_SESSION_NAME || 'orchestrator';
const projectPath = process.env.PROJECT_PATH || process.cwd();

// Tool implementations
const tools = {
  async send_message(args) {
    const { to, message } = args;
    try {
      const escapedMessage = message.replace(/'/g, "'\\''");
      await execAsync(`tmux send-keys -t "${to}" '${escapedMessage}' Enter`);
      return { content: [{ type: 'text', text: `✅ Message sent to ${to}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed: ${error.message}` }] };
    }
  },

  async broadcast(args) {
    const { message } = args;
    try {
      const result = await execAsync('tmux list-sessions -F "#{session_name}"');
      const sessions = result.stdout.split('\n').filter(s => s.trim());
      
      for (const session of sessions) {
        const escapedMessage = message.replace(/'/g, "'\\''");
        await execAsync(`tmux send-keys -t "${session}:0" '${escapedMessage}' Enter`);
      }
      
      return { content: [{ type: 'text', text: `✅ Broadcast sent to ${sessions.length} sessions` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Broadcast failed: ${error.message}` }] };
    }
  },

  async get_team_status() {
    try {
      const result = await execAsync('tmux list-sessions -F "#{session_name}:#{session_attached}"');
      const sessions = result.stdout.split('\n').filter(s => s.trim());
      
      const statuses = sessions.map(sessionInfo => {
        const [name, attached] = sessionInfo.split(':');
        return {
          session: name,
          attached: attached === '1',
          status: 'active'
        };
      });
      
      return { content: [{ type: 'text', text: `📊 Team Status:\n${JSON.stringify(statuses, null, 2)}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to get team status: ${error.message}` }] };
    }
  },

  async create_team(args) {
    const { role, name } = args;
    try {
      await execAsync(`tmux new-session -d -s "${name}" -c "${projectPath}"`);
      await execAsync(`tmux send-keys -t "${name}:0" "echo '🤖 Agent ${name} (${role}) initialized'" Enter`);
      
      return { content: [{ type: 'text', text: `✅ Team ${name} created with role ${role}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to create team: ${error.message}` }] };
    }
  },

  async kill_agent(args) {
    const { session } = args;
    try {
      if (session === 'orchestrator' || session === sessionName) {
        throw new Error('Cannot kill orchestrator or self');
      }
      
      await execAsync(`tmux kill-session -t "${session}"`);
      return { content: [{ type: 'text', text: `✅ Agent ${session} terminated` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `❌ Failed to kill agent: ${error.message}` }] };
    }
  }
};

// Tool definitions
const toolDefinitions = [
  {
    name: 'send_message',
    description: 'Send message to another agent',
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
    description: 'Broadcast message to all agents',
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
        role: { type: 'string', description: 'Agent role' },
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
  }
];

// Handle requests
async function handleRequest(request) {
  if (request.method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'agentmux', version: '1.0.0' }
    };
  }

  if (request.method === 'initialized') {
    return {};
  }

  if (request.method === 'tools/list') {
    return { tools: toolDefinitions };
  }

  if (request.method === 'tools/call') {
    const { name, arguments: args } = request.params;
    if (tools[name]) {
      return await tools[name](args || {});
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  throw new Error(`Unknown method: ${request.method}`);
}

// Main server loop
let buffer = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line);
        
        handleRequest(request).then(result => {
          const response = {
            jsonrpc: '2.0',
            id: request.id,
            result
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }).catch(error => {
          const errorResponse = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32603,
              message: error.message
            }
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
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
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

process.stderr.write(`AgentMux MCP Server started (session: ${sessionName})\n`);