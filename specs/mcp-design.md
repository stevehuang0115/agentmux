# AgentMux MCP Server - Detailed Implementation Specification

## MCP Tools Implementation with Subprocess Commands

Based on the Tmux Orchestrator patterns, here's the detailed specification for MCP tools that agents can use.

### 1. Core MCP Server Structure

```typescript
// mcp-server/src/index.ts

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

class AgentMuxMCP {
	private sessionName: string; // Current agent's tmux session
	private apiBaseUrl: string;

	constructor() {
		this.sessionName = process.env.TMUX_SESSION_NAME || 'unknown';
		this.apiBaseUrl = `http://localhost:${process.env.API_PORT || 3000}`;
	}

	// Tool implementations below...
}
```

### 2. Communication Tools

#### 2.1 send_message - Send message to another agent

```typescript
async send_message(args: { to: string, message: string, type?: string }) {
  // Implementation using subprocess (based on send-claude-message.sh pattern)
  const command = `tmux send-keys -t "${args.to}" "${args.message}"`;
  await execAsync(command);

  // Critical: Wait 0.5 seconds before sending Enter (from orchestrator pattern)
  await new Promise(resolve => setTimeout(resolve, 500));

  // Send Enter key
  await execAsync(`tmux send-keys -t "${args.to}" Enter`);

  // Log message for tracking
  await this.logMessage(this.sessionName, args.to, args.message);

  return { success: true, message: `Message sent to ${args.to}` };
}
```

#### 2.2 broadcast - Send message to all team members

```typescript
async broadcast(args: { message: string, excludeSelf?: boolean }) {
  // Get all active sessions
  const sessionsCmd = `tmux list-sessions -F "#{session_name}"`;
  const result = await execAsync(sessionsCmd);
  const sessions = result.stdout.split('\n').filter(s => s.trim());

  for (const session of sessions) {
    if (args.excludeSelf && session === this.sessionName) continue;

    // Use same pattern as send_message
    await execAsync(`tmux send-keys -t "${session}:0" "${args.message}"`);
    await new Promise(resolve => setTimeout(resolve, 500));
    await execAsync(`tmux send-keys -t "${session}:0" Enter`);
  }

  return { success: true, broadcast_to: sessions.length };
}
```

### 3. Session Management Tools

#### 3.1 get_team_status - Check status of all teams

```typescript
async get_team_status() {
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

  return statuses;
}

private analyzeAgentStatus(output: string): string {
  // Pattern matching based on orchestrator learnings
  if (output.includes('error') || output.includes('Error')) return 'error';
  if (output.includes('waiting') || output.includes('Waiting')) return 'waiting';
  if (output.includes('STATUS UPDATE')) return 'reporting';
  if (output.includes('git commit') || output.includes('git add')) return 'committing';
  return 'working';
}
```

#### 3.2 create_team - Create new agent (Orchestrator only)

```typescript
async create_team(args: {
  role: string,
  name: string,
  projectPath: string,
  systemPrompt?: string
}) {
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
    `export MCP_SERVER_URL="http://localhost:${process.env.AGENTMUX_MCP_PORT}"`,
    `export PROJECT_PATH="${args.projectPath}"`,
    `export AGENT_ROLE="${args.role}"`
  ];

  for (const envVar of envVars) {
    await execAsync(`tmux send-keys -t "${args.name}:0" "${envVar}" Enter`);
  }

  // Initialize Claude Code environment
  await this.initialize_claude({ session: args.name });

  return { success: true, session: args.name };
}

private getDefaultPrompt(role: string): string {
  const prompts = {
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
```

### 4. Ticket Management Tools

#### 4.1 get_tickets - Retrieve assigned tickets

```typescript
async get_tickets(args: { status?: string, all?: boolean }) {
  // Read from filesystem
  const projectPath = process.env.PROJECT_PATH;
  const ticketsDir = `${projectPath}/.agentmux/tickets`;

  const findCmd = `find ${ticketsDir} -name "*.yaml" -o -name "*.md"`;
  const files = await execAsync(findCmd);

  const tickets = [];
  for (const file of files.stdout.split('\n')) {
    if (!file.trim()) continue;

    // Read and parse ticket file
    const content = await execAsync(`cat "${file}"`);
    const ticket = this.parseTicketFile(content.stdout);

    // Filter by assignment and status
    if (!args.all && ticket.assignedTo !== this.sessionName) continue;
    if (args.status && ticket.status !== args.status) continue;

    tickets.push(ticket);
  }

  return tickets;
}

private parseTicketFile(content: string): any {
  // Parse YAML frontmatter
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  // Extract frontmatter and body
  const frontmatter = this.parseYaml(match[1]);
  const body = match[2];

  return {
    ...frontmatter,
    description: this.extractSection(body, 'Description'),
    acceptanceCriteria: this.extractSection(body, 'Acceptance Criteria'),
    testPlan: this.extractSection(body, 'Test Plan')
  };
}
```

#### 4.2 update_ticket - Update ticket status

```typescript
async update_ticket(args: {
  ticketId: string,
  status?: string,
  notes?: string,
  blockers?: string[]
}) {
  const projectPath = process.env.PROJECT_PATH;
  const ticketPath = `${projectPath}/.agentmux/tickets/${args.ticketId}.yaml`;

  // Read current ticket
  const content = await execAsync(`cat "${ticketPath}"`);
  const ticket = this.parseTicketFile(content.stdout);

  // Update ticket
  ticket.status = args.status || ticket.status;
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
  await this.writeFile(ticketPath, updatedContent);

  // If status changed to 'done', enforce git commit
  if (args.status === 'done') {
    await this.enforceGitCommit(args.ticketId);
  }

  return { success: true, ticket: ticket };
}
```

### 5. Progress & Coordination Tools

#### 5.1 report_progress - Report progress to PM

```typescript
async report_progress(args: {
  ticketId?: string,
  progress: number,
  completed?: string[],
  current?: string,
  blockers?: string[],
  nextSteps?: string
}) {
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
  await this.send_message({ to: pmSession, message });

  // Update ticket if provided
  if (args.ticketId) {
    await this.update_ticket({
      ticketId: args.ticketId,
      notes: `Progress: ${args.progress}%`
    });
  }

  return { success: true, reported_to: pmSession };
}
```

#### 5.2 request_review - Request code review

```typescript
async request_review(args: {
  ticketId: string,
  reviewer?: string,
  branch?: string,
  message?: string
}) {
  // Find reviewer (QA or specified team member)
  const reviewer = args.reviewer || await this.findQAEngineer();

  // Ensure code is committed
  await this.enforceGitCommit(args.ticketId);

  // Get current branch
  const branchCmd = `cd ${process.env.PROJECT_PATH} && git branch --show-current`;
  const currentBranch = (await execAsync(branchCmd)).stdout.trim();

  // Send review request
  const reviewMessage = `REVIEW REQUEST
Ticket: ${args.ticketId}
Branch: ${args.branch || currentBranch}
Message: ${args.message || 'Please review implementation'}
Run: git checkout ${args.branch || currentBranch} && npm test`;

  await this.send_message({ to: reviewer, message: reviewMessage });

  // Update ticket status
  await this.update_ticket({
    ticketId: args.ticketId,
    status: 'review'
  });

  return { success: true, reviewer: reviewer };
}
```

### 6. Scheduling Tools

#### 6.1 schedule_check - Schedule a check-in

```typescript
async schedule_check(args: {
  minutes: number,
  message: string,
  target?: string
}) {
  const target = args.target || this.sessionName;

  // Use nohup pattern from orchestrator's schedule_with_note.sh
  const seconds = args.minutes * 60;
  const checkMessage = `SCHEDULED CHECK: ${args.message}`;

  // Create detached process for scheduling
  const scheduleCmd = `nohup bash -c "sleep ${seconds} && \
    tmux send-keys -t '${target}:0' '${checkMessage}' && \
    sleep 0.5 && \
    tmux send-keys -t '${target}:0' Enter" > /dev/null 2>&1 &`;

  const result = await execAsync(scheduleCmd);

  // Log scheduled check
  await this.logScheduledCheck(target, args.minutes, args.message);

  return {
    success: true,
    scheduled_for: `${args.minutes} minutes`,
    target: target
  };
}
```

### 7. Git Management Tools

#### 7.1 enforce_commit - Enforce 30-minute commit rule

```typescript
async enforce_commit(args: { message?: string }) {
  const projectPath = process.env.PROJECT_PATH;

  // Check for uncommitted changes
  const statusCmd = `cd ${projectPath} && git status --porcelain`;
  const status = await execAsync(statusCmd);

  if (status.stdout.trim()) {
    // Has uncommitted changes
    const commitMessage = args.message || `Progress: ${this.sessionName} - ${new Date().toISOString()}`;

    const commands = [
      `cd ${projectPath}`,
      `git add -A`,
      `git commit -m "${commitMessage}"`
    ];

    for (const cmd of commands) {
      await execAsync(cmd);
    }

    return { success: true, committed: true, message: commitMessage };
  }

  return { success: true, committed: false, message: 'No changes to commit' };
}
```

### 8. Claude Initialization Tools

#### 8.1 initialize_claude - Initialize Claude Code in target session

```typescript
async initialize_claude(args: { session: string }) {
  // Initialize bash environment and start Claude Code in target session
  const session = args.session;

  // Source bashrc to ensure proper environment
  await execAsync(`tmux send-keys -t "${session}:0" "source ~/.bashrc" Enter`);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Start Claude Code with danger mode to skip permissions
  const claudeCmd = `claude --dangerously-skip-permissions`;
  await execAsync(`tmux send-keys -t "${session}:0" "${claudeCmd}" Enter`);

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 2000));

  return { success: true, message: `Claude Code initialized in session ${session}` };
}
```

### 9. Team Monitoring Tools

#### 9.1 get_team_logs - Display current terminal logs from team member

```typescript
async get_team_logs(args: {
  session: string,
  lines?: number,
  window?: number
}) {
  const { session, lines = 20, window = 0 } = args;

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

  return {
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
}
```

#### 9.2 ping_team_member - Get current status and activity of specific team member

```typescript
async ping_team_member(args: { session: string }) {
  const session = args.session;

  // Check if session exists
  const sessions = await this.getActiveSessions();
  if (!sessions.includes(session)) {
    throw new Error(`Session "${session}" not found`);
  }

  // Get comprehensive session info
  const infoCmd = `tmux display-message -p -t "${session}" "#{session_name}:#{window_index}:#{window_name}:#{session_attached}:#{session_created}"`;
  const info = await execAsync(infoCmd);
  const [name, windowIndex, windowName, attached, created] = info.stdout.trim().split(':');

  // Capture current screen
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

  return {
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
}
```

### 10. Utility Functions

```typescript
// Helper functions used by tools

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

private async writeFile(path: string, content: string): Promise<void> {
  // Escape content for shell
  const escapedContent = content.replace(/'/g, "'\\''");
  await execAsync(`echo '${escapedContent}' > "${path}"`);
}

private async enforceGitCommit(ticketId: string): Promise<void> {
  await this.enforce_commit({
    message: `Complete: Ticket ${ticketId} - ${this.sessionName}`
  });
}
```

### 11. Tool Registration

```typescript
// Register all tools with MCP server
registerTools() {
  return [
    {
      name: 'send_message',
      description: 'Send message to another agent',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Target session:window' },
          message: { type: 'string' }
        },
        required: ['to', 'message']
      }
    },
    {
      name: 'get_team_status',
      description: 'Get status of all team members',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_tickets',
      description: 'Get assigned tickets',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] },
          all: { type: 'boolean' }
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
          status: { type: 'string' },
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
          progress: { type: 'number', minimum: 0, maximum: 100 },
          completed: { type: 'array', items: { type: 'string' } },
          current: { type: 'string' },
          blockers: { type: 'array', items: { type: 'string' } }
        },
        required: ['progress']
      }
    },
    {
      name: 'schedule_check',
      description: 'Schedule a check-in reminder',
      inputSchema: {
        type: 'object',
        properties: {
          minutes: { type: 'number' },
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
    {
      name: 'initialize_claude',
      description: 'Initialize Claude Code in target session with proper environment',
      inputSchema: {
        type: 'object',
        properties: {
          session: { type: 'string', description: 'Target session name to initialize Claude Code' }
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
          session: { type: 'string', description: 'Target session name' },
          lines: { type: 'number', description: 'Number of lines to capture (default: 20)', minimum: 1, maximum: 100 },
          window: { type: 'number', description: 'Window index (default: 0)', minimum: 0 }
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
          session: { type: 'string', description: 'Target session name to ping' }
        },
        required: ['session']
      }
    }
  ];
}
```
