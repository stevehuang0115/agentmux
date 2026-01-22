import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);
const app = express();
const PORT = 8790;

app.use(cors());
app.use(express.json());

// Get Claude instances from running processes
async function getClaudeProcesses() {
  try {
    // Find all claude processes (main CLI processes, not subprocesses)
    const { stdout } = await execAsync(
      `ps aux | grep -E 'claude\\s*$' | grep -v grep | awk '{print $2, $3, $10, $11}'`
    );

    const processes = [];
    const lines = stdout.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const pid = parts[0];
        const cpuPercent = parseFloat(parts[1]) || 0;
        const startTime = parts[2] || '';

        // Get the working directory for this process
        let cwd = '';
        let projectName = 'Unknown Project';
        try {
          const { stdout: lsofOut } = await execAsync(`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`);
          cwd = lsofOut.trim();
          if (cwd) {
            projectName = path.basename(cwd);
          }
        } catch (e) {
          // Ignore errors
        }

        processes.push({
          pid,
          cpuPercent,
          startTime,
          cwd,
          projectName
        });
      }
    }

    return processes;
  } catch (error) {
    console.error('Error getting Claude processes:', error);
    return [];
  }
}

// Get session info from ~/.claude/projects
// Uses actual JSONL file modification times for accurate activity tracking
async function getSessionInfo() {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const sessions = [];

  try {
    const projectDirs = await fs.readdir(claudeDir);

    for (const dir of projectDirs) {
      if (dir.startsWith('.')) continue;

      const projectDir = path.join(claudeDir, dir);
      const sessionsIndexPath = path.join(projectDir, 'sessions-index.json');

      // Collect all indexed session IDs
      const indexedSessionIds = new Set();
      let originalPath = null;
      let indexedSessions = [];

      try {
        const content = await fs.readFile(sessionsIndexPath, 'utf-8');
        const data = JSON.parse(content);
        originalPath = data.originalPath;

        if (data.entries) {
          for (const entry of data.entries) {
            indexedSessionIds.add(entry.sessionId);
            indexedSessions.push(entry);
          }
        }
      } catch (e) {
        // No sessions-index.json - we'll still check for JSONL files
      }

      // Find ALL JSONL files in this project directory (including unindexed ones)
      let mostRecentSession = null;
      let mostRecentTime = 0;

      try {
        const files = await fs.readdir(projectDir);
        for (const file of files) {
          if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;

          const sessionId = file.replace('.jsonl', '');
          const jsonlPath = path.join(projectDir, file);

          try {
            const stat = await fs.stat(jsonlPath);
            if (stat.mtimeMs > mostRecentTime) {
              mostRecentTime = stat.mtimeMs;

              // Try to get metadata from index if available
              const indexedEntry = indexedSessions.find(e => e.sessionId === sessionId);

              mostRecentSession = {
                sessionId,
                summary: indexedEntry?.summary || 'Active session...',
                messageCount: indexedEntry?.messageCount || 0,
                fileModified: stat.mtime.toISOString()
              };
            }
          } catch (e) {
            // Can't stat file
          }
        }
      } catch (e) {
        // Can't read directory
      }

      // Derive originalPath from dir name if not found
      if (!originalPath && dir.startsWith('-')) {
        originalPath = dir.slice(1).replace(/-/g, '/');
      }

      if (mostRecentSession && originalPath) {
        sessions.push({
          projectPath: originalPath,
          projectName: path.basename(originalPath),
          sessionId: mostRecentSession.sessionId,
          summary: mostRecentSession.summary,
          modified: mostRecentSession.fileModified,
          messageCount: mostRecentSession.messageCount
        });
      }
    }

    return sessions;
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

// Cache for status persistence to avoid flashing
const statusCache = new Map();

// Determine instance status
// IMPORTANT: If a process is running, it's NEVER dormant.
// Dormant only means "process doesn't exist" - avatar should be hidden.
// This prevents flashing between active/dormant.
function determineStatus(pid, cpuPercent, sessionModified, hasSessionMatch) {
  const cached = statusCache.get(pid);
  const now = Date.now();

  // Hysteresis: once active, stay active for 30 seconds minimum
  // This prevents rapid flickering from CPU fluctuations
  if (cached?.status === 'active') {
    const timeSinceActive = now - cached.timestamp;
    if (timeSinceActive < 30000) { // 30 second cooldown
      return 'active';
    }
  }

  // High CPU = definitely active
  if (cpuPercent > 10) {
    statusCache.set(pid, { status: 'active', timestamp: now });
    return 'active';
  }

  // Check session file modification time for recent activity
  // BUT only if process has SOME CPU usage (> 0.5%) - prevents idle processes
  // in same project folder from appearing active due to shared session file
  if (hasSessionMatch && sessionModified && cpuPercent > 0.5) {
    const lastActivityTime = new Date(sessionModified).getTime();
    const timeSinceActivity = now - lastActivityTime;
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (timeSinceActivity < FIVE_MINUTES) {
      statusCache.set(pid, { status: 'active', timestamp: now });
      return 'active';
    }
  }

  // Process is running but not actively working = idle
  // NEVER return dormant for a running process
  return 'idle';
}

// Get real-time token usage from JSONL session files
async function getRealTimeUsage() {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const today = new Date().toISOString().split('T')[0];
  let todayTokens = 0;
  let todayMessages = 0;
  let todayToolCalls = 0;

  try {
    const projectDirs = await fs.readdir(claudeDir);

    for (const dir of projectDirs) {
      if (dir.startsWith('.')) continue;

      const projectDir = path.join(claudeDir, dir);
      const files = await fs.readdir(projectDir);

      for (const file of files) {
        if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;

        const filePath = path.join(projectDir, file);
        try {
          const stat = await fs.stat(filePath);
          // Only check files modified today
          const fileDate = stat.mtime.toISOString().split('T')[0];
          if (fileDate !== today) continue;

          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.trim().split('\n');

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              const timestamp = entry.timestamp?.split('T')[0];
              if (timestamp !== today) continue;

              // Count messages
              if (entry.type === 'assistant' || entry.type === 'human') {
                todayMessages++;
              }

              // Count tool calls
              if (entry.message?.content) {
                const toolUses = entry.message.content.filter(c => c.type === 'tool_use');
                todayToolCalls += toolUses.length;
              }

              // Sum tokens
              if (entry.message?.usage) {
                const usage = entry.message.usage;
                todayTokens += (usage.input_tokens || 0) +
                              (usage.output_tokens || 0) +
                              (usage.cache_creation_input_tokens || 0);
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        } catch (e) {
          // Skip unreadable files
        }
      }
    }
  } catch (error) {
    console.error('Error reading real-time usage:', error);
  }

  return { todayTokens, todayMessages, todayToolCalls };
}

// Get current task and token usage for a specific session
async function getSessionDetails(cwd, sessionId) {
  if (!cwd || !sessionId) return null;

  const claudeDir = path.join(os.homedir(), '.claude', 'projects');
  const today = new Date().toISOString().split('T')[0];

  // Find the project directory by encoding the cwd
  let currentPath = cwd;
  let projectDir = null;

  try {
    const projectDirs = await fs.readdir(claudeDir);

    while (currentPath && currentPath !== '/') {
      const encodedPath = '-' + currentPath.slice(1).replace(/\//g, '-');
      if (projectDirs.includes(encodedPath)) {
        projectDir = path.join(claudeDir, encodedPath);
        break;
      }
      currentPath = path.dirname(currentPath);
    }

    if (!projectDir) return null;

    const jsonlPath = path.join(projectDir, `${sessionId}.jsonl`);

    try {
      const content = await fs.readFile(jsonlPath, 'utf-8');
      const lines = content.trim().split('\n');

      let currentTask = '';
      let lastTool = '';
      let lastFile = '';
      let sessionTokens = 0;
      let recentTools = [];

      // Parse all lines to get context and tokens
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const timestamp = entry.timestamp?.split('T')[0];

          // Count today's tokens for this session
          if (timestamp === today && entry.message?.usage) {
            const usage = entry.message.usage;
            sessionTokens += (usage.input_tokens || 0) +
                            (usage.output_tokens || 0) +
                            (usage.cache_creation_input_tokens || 0);
          }

          // Extract current task from human messages
          if (entry.type === 'human' && entry.message?.content) {
            const textContent = entry.message.content.find(c => c.type === 'text');
            if (textContent?.text) {
              // Get last user request as current task (truncated)
              currentTask = textContent.text.slice(0, 100);
              if (textContent.text.length > 100) currentTask += '...';
            }
          }

          // Extract tool usage from assistant messages
          if (entry.type === 'assistant' && entry.message?.content) {
            for (const block of entry.message.content) {
              if (block.type === 'tool_use') {
                lastTool = block.name;
                recentTools.push(block.name);
                if (recentTools.length > 5) recentTools.shift();

                // Extract file path if present
                if (block.input?.file_path) {
                  lastFile = path.basename(block.input.file_path);
                } else if (block.input?.path) {
                  lastFile = path.basename(block.input.path);
                } else if (block.input?.command) {
                  // Extract from bash command
                  const cmd = block.input.command;
                  if (cmd.length < 50) lastFile = cmd;
                }
              }
            }
          }
        } catch (e) {
          // Skip malformed lines
        }
      }

      // Build activity summary
      let activity = '';
      if (lastTool) {
        activity = lastTool;
        if (lastFile) activity += `: ${lastFile}`;
      }

      return {
        currentTask,
        activity,
        lastTool,
        lastFile,
        recentTools,
        sessionTokens
      };
    } catch (e) {
      // Can't read file
      return null;
    }
  } catch (error) {
    console.error('Error getting session details:', error);
  }

  return null;
}

// Token usage endpoint
app.get('/api/usage', async (req, res) => {
  try {
    const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json');
    const content = await fs.readFile(statsPath, 'utf-8');
    const stats = JSON.parse(content);

    // Get real-time usage from JSONL files
    const realTime = await getRealTimeUsage();

    // Get recent 7 days from cache
    const recentDays = stats.dailyModelTokens?.slice(-7) || [];

    // Get model totals from cache
    const modelUsage = stats.modelUsage || {};

    res.json({
      timestamp: new Date().toISOString(),
      today: {
        date: new Date().toISOString().split('T')[0],
        messages: realTime.todayMessages,
        sessions: 1, // Current session
        toolCalls: realTime.todayToolCalls,
        tokens: realTime.todayTokens
      },
      totals: {
        sessions: stats.totalSessions || 0,
        messages: stats.totalMessages || 0,
        firstSession: stats.firstSessionDate
      },
      modelUsage: Object.entries(modelUsage).map(([model, usage]) => ({
        model: model.replace('claude-', '').replace(/-\d{8}$/, ''),
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        cacheReadTokens: usage.cacheReadInputTokens || 0,
        cacheWriteTokens: usage.cacheCreationInputTokens || 0
      })),
      recentDays: recentDays.map(d => ({
        date: d.date,
        tokens: Object.values(d.tokensByModel || {}).reduce((sum, t) => sum + t, 0)
      }))
    });
  } catch (error) {
    console.error('Error reading usage stats:', error);
    res.json({
      timestamp: new Date().toISOString(),
      today: { messages: 0, sessions: 0, toolCalls: 0, tokens: 0 },
      totals: { sessions: 0, messages: 0 },
      modelUsage: [],
      recentDays: []
    });
  }
});

// Find session directory from process cwd
async function findSessionForProcess(cwd) {
  if (!cwd) return null;

  const claudeDir = path.join(os.homedir(), '.claude', 'projects');

  try {
    const projectDirs = await fs.readdir(claudeDir);

    // Find directory that matches this cwd - try exact match first, then parent directories
    let matchingDir = null;
    let currentPath = cwd;

    while (currentPath && currentPath !== '/') {
      // Encode the path to match directory format
      const encodedPath = '-' + currentPath.slice(1).replace(/\//g, '-');

      if (projectDirs.includes(encodedPath)) {
        matchingDir = encodedPath;
        break;
      }

      // Try parent directory
      currentPath = path.dirname(currentPath);
    }

    if (!matchingDir) return null;

    const projectDir = path.join(claudeDir, matchingDir);

    // Find most recent JSONL in this directory
    let mostRecentFile = null;
    let mostRecentTime = 0;

    const files = await fs.readdir(projectDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;

      const filePath = path.join(projectDir, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat.mtimeMs > mostRecentTime) {
          mostRecentTime = stat.mtimeMs;
          mostRecentFile = {
            sessionId: file.replace('.jsonl', ''),
            modified: stat.mtime.toISOString(),
            projectDir
          };
        }
      } catch (e) {}
    }

    return mostRecentFile;
  } catch (error) {
    return null;
  }
}

// Main API endpoint
app.get('/api/claude-instances', async (req, res) => {
  try {
    const processes = await getClaudeProcesses();

    // Match processes with sessions and get details
    const instancePromises = processes.map(async (proc, index) => {
      // Find session directly from process cwd
      const sessionInfo = await findSessionForProcess(proc.cwd);
      const hasSessionMatch = !!sessionInfo;
      const lastActivity = sessionInfo?.modified || null;
      const status = determineStatus(proc.pid, proc.cpuPercent, lastActivity, hasSessionMatch);

      // Get detailed session info (current task, tokens)
      let details = null;
      if (sessionInfo) {
        details = await getSessionDetails(proc.cwd, sessionInfo.sessionId);
      }

      return {
        id: `instance-${proc.pid}`,
        pid: proc.pid,
        projectName: proc.projectName,
        projectPath: proc.cwd,
        summary: 'Active session...',
        cpuPercent: proc.cpuPercent,
        status,
        lastActivity: lastActivity || new Date().toISOString(),
        color: getAvatarColor(index),
        // New fields for current task and activity
        currentTask: details?.currentTask || '',
        activity: details?.activity || '',
        lastTool: details?.lastTool || '',
        recentTools: details?.recentTools || [],
        sessionTokens: details?.sessionTokens || 0
      };
    });

    const instances = await Promise.all(instancePromises);

    // Calculate total tokens for distribution percentage
    const totalSessionTokens = instances.reduce((sum, i) => sum + i.sessionTokens, 0);

    // Add token percentage to each instance
    instances.forEach(instance => {
      instance.tokenPercent = totalSessionTokens > 0
        ? Math.round((instance.sessionTokens / totalSessionTokens) * 100)
        : 0;
    });

    res.json({
      timestamp: new Date().toISOString(),
      totalInstances: instances.length,
      activeCount: instances.filter(i => i.status === 'active').length,
      idleCount: instances.filter(i => i.status === 'idle').length,
      dormantCount: instances.filter(i => i.status === 'dormant').length,
      totalSessionTokens,
      instances
    });
  } catch (error) {
    console.error('Error in /api/claude-instances:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get avatar colors for different instances
function getAvatarColor(index) {
  const colors = [
    '#4a90d9', // Blue
    '#d94a4a', // Red
    '#4ad94a', // Green
    '#d9d94a', // Yellow
    '#d94ad9', // Magenta
    '#4ad9d9', // Cyan
  ];
  return colors[index % colors.length];
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Claude Monitor API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET /api/claude-instances - Get all running Claude instances`);
  console.log(`  GET /api/health - Health check`);
});
