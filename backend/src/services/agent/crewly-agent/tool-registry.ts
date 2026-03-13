/**
 * Crewly Agent Tool Registry
 *
 * Defines all AI SDK tools available to the Crewly Agent runtime.
 * Each tool maps to a Crewly REST API endpoint, replacing the bash
 * skill scripts used by PTY-based runtimes.
 *
 * @module services/agent/crewly-agent/tool-registry
 */

import { promises as fsPromises } from 'fs';
import { homedir } from 'os';
import { z } from 'zod';
import type { CrewlyApiClient } from './api-client.js';
import type { ToolDefinition, ToolCallbacks, ToolSensitivity, AuditEntry, ApprovalCheckResult, AuditLogFilters } from './types.js';

/**
 * Expand ~ and $HOME in a file path to the user's home directory.
 *
 * @param filePath - Path that may contain ~ or $HOME
 * @returns Resolved absolute path
 */
function expandPath(filePath: string): string {
  const home = homedir();
  if (filePath === '~' || filePath.startsWith('~/')) {
    return home + filePath.slice(1);
  }
  if (filePath.startsWith('$HOME/') || filePath === '$HOME') {
    return home + filePath.slice(5);
  }
  return filePath;
}

/** File extensions recognized as images for multimodal read_file support */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

/** MIME type mapping for image extensions */
const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/**
 * Strip [NOTIFY]...[/NOTIFY] markers from text.
 *
 * The crewly-agent model sometimes wraps tool arguments in NOTIFY markers
 * intended for the terminal gateway routing layer. When this leaks into
 * reply_slack or other outward-facing tools, the raw markers appear in
 * the Slack message. This function extracts the body content (after the
 * --- separator if present) or the full block content.
 *
 * @param text - Text that may contain NOTIFY markers
 * @returns Clean text with markers stripped and body content extracted
 */
export function stripNotifyMarkers(text: string): string {
  // Replace each [NOTIFY]...[/NOTIFY] block with its body content
  const cleaned = text.replace(/\[NOTIFY\]([\s\S]*?)\[\/NOTIFY\]/gi, (_match, inner: string) => {
    const trimmed = inner.trim();
    // If there's a --- separator, extract only the body after it
    const separatorIdx = trimmed.indexOf('---');
    if (separatorIdx !== -1) {
      return trimmed.slice(separatorIdx + 3).trim();
    }
    // No separator — return the full inner content
    return trimmed;
  });
  return cleaned.trim();
}

/**
 * Sensitivity classification for each tool.
 * Used by the audit trail to classify tool invocations.
 */
export const TOOL_SENSITIVITY: Record<string, ToolSensitivity> = {
  // Safe: read-only, informational
  get_agent_status: 'safe',
  get_team_status: 'safe',
  get_agent_logs: 'safe',
  heartbeat: 'safe',
  get_tasks: 'safe',
  get_project_overview: 'safe',
  read_file: 'safe',
  recall_memory: 'safe',
  subscribe_event: 'safe',
  get_audit_log: 'safe',
  compact_memory: 'safe',
  // Sensitive: modify state, communicate externally
  delegate_task: 'sensitive',
  send_message: 'sensitive',
  reply_slack: 'sensitive',
  schedule_check: 'sensitive',
  cancel_schedule: 'sensitive',
  register_self: 'sensitive',
  report_status: 'sensitive',
  remember: 'sensitive',
  complete_task: 'sensitive',
  broadcast: 'sensitive',
  // Destructive: irreversible or high-impact operations
  start_agent: 'destructive',
  stop_agent: 'destructive',
  handle_agent_failure: 'destructive',
  edit_file: 'destructive',
  write_file: 'destructive',
};

/**
 * Wrap a tool's execute function with audit logging.
 *
 * Records tool name, sensitivity, args, result status, and duration.
 * Sanitizes arguments to avoid logging secrets.
 *
 * @param toolName - Name of the tool being wrapped
 * @param executeFn - Original execute function
 * @param callbacks - Callbacks object with onAuditLog handler
 * @returns Wrapped execute function
 */
/**
 * Wrap a tool's execute function with security policy enforcement and audit logging.
 *
 * Checks blocked tools and approval requirements before execution.
 * Records tool name, sensitivity, args, result status, and duration.
 * Sanitizes arguments to avoid logging secrets.
 *
 * @param toolName - Name of the tool being wrapped
 * @param executeFn - Original execute function
 * @param callbacks - Callbacks object with onAuditLog and onCheckApproval handlers
 * @returns Wrapped execute function
 */
function wrapWithAudit(
  toolName: string,
  executeFn: (args: Record<string, unknown>) => Promise<unknown>,
  callbacks?: ToolCallbacks,
): (args: Record<string, unknown>) => Promise<unknown> {
  if (!callbacks?.onAuditLog && !callbacks?.onCheckApproval) return executeFn;

  return async (args: Record<string, unknown>): Promise<unknown> => {
    const start = Date.now();
    const sensitivity = TOOL_SENSITIVITY[toolName] || 'safe';

    // Sanitize args: redact potential secrets
    const sanitizedArgs = sanitizeArgs(args);

    // Check security policy before execution
    if (callbacks?.onCheckApproval) {
      const approvalResult: ApprovalCheckResult = callbacks.onCheckApproval(toolName, sensitivity);
      if (!approvalResult.allowed) {
        const entry: AuditEntry = {
          timestamp: new Date().toISOString(),
          toolName,
          sensitivity,
          args: sanitizedArgs,
          success: false,
          error: approvalResult.reason || 'Blocked by security policy',
          durationMs: Date.now() - start,
        };
        if (callbacks?.onAuditLog) callbacks.onAuditLog(entry);
        return {
          success: false,
          blocked: approvalResult.blocked ?? false,
          requiresApproval: !approvalResult.blocked,
          error: approvalResult.reason || 'Tool execution denied by security policy',
        };
      }
    }

    // No audit logger — just execute
    if (!callbacks?.onAuditLog) return executeFn(args);

    try {
      const result = await executeFn(args);
      const success = result != null && typeof result === 'object'
        ? (result as Record<string, unknown>).success !== false
        : true;

      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        toolName,
        sensitivity,
        args: sanitizedArgs,
        success,
        durationMs: Date.now() - start,
      };
      if (!success && typeof result === 'object' && result !== null) {
        entry.error = String((result as Record<string, unknown>).error || 'unknown');
      }
      callbacks.onAuditLog!(entry);
      return result;
    } catch (error) {
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        toolName,
        sensitivity,
        args: sanitizedArgs,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
      callbacks.onAuditLog!(entry);
      throw error;
    }
  };
}

/**
 * Sanitize tool arguments for audit logging.
 * Redacts values for keys that may contain secrets.
 *
 * @param args - Raw tool arguments
 * @returns Sanitized copy safe for logging
 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'api_key', 'authorization'];
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 2000) {
      result[key] = value.substring(0, 2000) + '...[truncated]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Create the complete set of AI SDK tools for the Crewly Agent.
 *
 * Each tool's execute function calls the Crewly REST API directly
 * via the provided API client, bypassing the bash script layer.
 * Tools are wrapped with audit logging when callbacks are provided.
 *
 * @param client - API client instance for making REST calls
 * @param sessionName - Agent session name for identity context
 * @param projectPath - Optional project path for auto-injection
 * @param callbacks - Optional callbacks for compaction and audit logging
 * @returns Object of named tools ready to pass to generateText
 */
export function createTools(client: CrewlyApiClient, sessionName: string, projectPath?: string, callbacks?: ToolCallbacks, conversationId?: string): Record<string, ToolDefinition> {
  const rawTools: Record<string, ToolDefinition> = {
    // ===== Core Orchestration Tools =====

    delegate_task: {
      description: 'Delegate a task to a worker agent. Sends the task message and creates a task tracking file.',
      inputSchema: z.object({
        to: z.string().describe('Target agent session name'),
        task: z.string().describe('Task description and instructions'),
        priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
        context: z.string().optional().describe('Additional context for the task'),
        projectPath: z.string().optional().describe('Project path for task tracking'),
      }),
      execute: async ({ to, task, priority, context, projectPath }) => {
        const taskMessage = buildTaskMessage(to as string, task as string, priority as string, context as string | undefined, projectPath as string | undefined);

        // Deliver the task message
        const deliverResult = await client.post(`/terminal/${to}/deliver`, {
          message: taskMessage,
          waitForReady: true,
          waitTimeout: 15000,
        });

        if (!deliverResult.success) {
          // Fallback: force delivery
          const forceResult = await client.post(`/terminal/${to}/deliver`, {
            message: taskMessage,
            force: true,
          });
          if (!forceResult.success) {
            return { success: false, error: `Failed to deliver task to ${to}: ${forceResult.error}` };
          }
        }

        // Create task tracking entry
        let taskId: string | undefined;
        if (projectPath) {
          const createResult = await client.post('/task-management/create', {
            projectPath,
            task,
            priority,
            sessionName: to,
            milestone: 'delegated',
          });
          if (createResult.success && createResult.data) {
            taskId = (createResult.data as Record<string, string>).taskId;
          }
        }

        // Subscribe to idle event for monitoring
        await client.post('/events/subscribe', {
          eventType: 'agent:idle',
          filter: { sessionName: to },
          subscriberSession: sessionName,
          oneShot: true,
          ttlMinutes: 120,
        });

        return { success: true, delegatedTo: to, taskId, conversationId: conversationId || undefined };
      },
    },

    send_message: {
      description: 'Send a message to an agent terminal session.',
      inputSchema: z.object({
        sessionName: z.string().describe('Target agent session name'),
        message: z.string().describe('Message content'),
        force: z.boolean().default(false).describe('Force send without waiting for ready state'),
      }),
      execute: async ({ sessionName: target, message, force }) => {
        const body = force
          ? { message, force: true }
          : { message, waitForReady: true, waitTimeout: 120000 };
        const result = await client.post(`/terminal/${target}/deliver`, body);
        return result.success
          ? { success: true, delivered: true }
          : { success: false, error: result.error };
      },
    },

    get_agent_status: {
      description: 'Get the current status of a specific agent by session name.',
      inputSchema: z.object({
        sessionName: z.string().describe('Agent session name to check'),
      }),
      execute: async ({ sessionName: target }) => {
        // Record manual check so redundant scheduled checks are suppressed (fire-and-forget)
        Promise.resolve(client.post('/schedule/manual-check', { agentSession: target })).catch(() => {});

        const result = await client.get('/teams');
        if (!result.success) return { error: result.error };

        const teams = result.data as Record<string, unknown>[];
        const teamArray = Array.isArray(teams) ? teams : [teams];
        for (const team of teamArray) {
          const members = (team as Record<string, unknown>).members as Array<Record<string, unknown>> | undefined;
          if (!members) continue;
          const agent = members.find(m => m.sessionName === target || m.name === target);
          if (agent) return agent;
        }
        return { error: 'Agent not found', sessionName: target };
      },
    },

    get_team_status: {
      description: 'Get status of all teams and their agents.',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.get('/teams');
        return result.success ? result.data : { error: result.error };
      },
    },

    get_agent_logs: {
      description: 'Get recent terminal output from an agent session.',
      inputSchema: z.object({
        sessionName: z.string().describe('Agent session name'),
        lines: z.number().default(50).describe('Number of lines to retrieve'),
      }),
      execute: async ({ sessionName: target, lines }) => {
        // Record manual check so redundant scheduled checks are suppressed (fire-and-forget)
        Promise.resolve(client.post('/schedule/manual-check', { agentSession: target })).catch(() => {});

        const result = await client.get(`/terminal/${target}/output?lines=${lines}`);
        return result.success ? result.data : { error: result.error };
      },
    },

    reply_slack: {
      description: 'Send a reply to a Slack channel or thread.',
      inputSchema: z.object({
        channelId: z.string().describe('Slack channel ID'),
        text: z.string().describe('Message text'),
        threadTs: z.string().optional().describe('Thread timestamp for replies'),
      }),
      execute: async ({ channelId, text, threadTs }) => {
        // Strip [NOTIFY]...[/NOTIFY] blocks that may leak into tool arguments.
        // The agent sometimes wraps responses in NOTIFY markers intended for the
        // terminal gateway routing layer, not for Slack display.
        const cleanText = stripNotifyMarkers(text as string);
        const body: Record<string, string> = { channelId: channelId as string, text: cleanText };
        if (threadTs) body.threadTs = threadTs as string;
        const result = await client.post('/slack/send', body);
        return result.success
          ? { success: true, sent: true }
          : { success: false, error: result.error };
      },
    },

    // ===== Scheduling Tools =====

    schedule_check: {
      description: 'Schedule a future check-in reminder.',
      inputSchema: z.object({
        minutes: z.number().describe('Minutes from now'),
        message: z.string().describe('Reminder message'),
        target: z.string().optional().describe('Target session (defaults to self)'),
        recurring: z.boolean().default(false),
        maxOccurrences: z.number().optional(),
      }),
      execute: async ({ minutes, message, target, recurring, maxOccurrences }) => {
        const targetSession = target || sessionName;
        const body: Record<string, unknown> = {
          targetSession,
          minutes,
          message,
        };
        if (recurring) {
          body.isRecurring = true;
          body.intervalMinutes = minutes;
        }
        if (maxOccurrences) body.maxOccurrences = maxOccurrences;
        const result = await client.post('/schedule', body);
        return result.success ? result.data : { error: result.error };
      },
    },

    cancel_schedule: {
      description: 'Cancel a scheduled check-in by ID.',
      inputSchema: z.object({
        checkId: z.string().describe('Schedule ID to cancel'),
      }),
      execute: async ({ checkId }) => {
        const result = await client.delete(`/schedule/${checkId}`);
        return result.success ? { success: true } : { error: result.error };
      },
    },

    // ===== Agent Lifecycle Tools =====

    start_agent: {
      description: 'Start a specific agent within a team.',
      inputSchema: z.object({
        teamId: z.string().describe('Team UUID'),
        memberId: z.string().describe('Member UUID'),
      }),
      execute: async ({ teamId, memberId }) => {
        const result = await client.post(`/teams/${teamId}/members/${memberId}/start`, {});
        return result.success ? result.data : { error: result.error };
      },
    },

    stop_agent: {
      description: 'Stop a specific agent within a team.',
      inputSchema: z.object({
        teamId: z.string().describe('Team UUID'),
        memberId: z.string().describe('Member UUID'),
      }),
      execute: async ({ teamId, memberId }) => {
        const result = await client.post(`/teams/${teamId}/members/${memberId}/stop`, {});
        return result.success ? result.data : { error: result.error };
      },
    },

    // ===== Event Tools =====

    subscribe_event: {
      description: 'Subscribe to agent lifecycle events (e.g., agent:idle, agent:busy).',
      inputSchema: z.object({
        eventType: z.string().describe('Event type (e.g., "agent:idle")'),
        filter: z.record(z.string()).optional().describe('Event filter criteria'),
        oneShot: z.boolean().default(true),
      }),
      execute: async ({ eventType, filter, oneShot }) => {
        const result = await client.post('/events/subscribe', {
          eventType,
          filter: filter || {},
          subscriberSession: sessionName,
          oneShot,
        });
        return result.success ? result.data : { error: result.error };
      },
    },

    // ===== Memory Tools =====

    recall_memory: {
      description: 'Retrieve relevant knowledge from agent/project memory.',
      inputSchema: z.object({
        context: z.string().describe('What to search for'),
        scope: z.enum(['agent', 'project', 'both']).default('both'),
        projectPath: z.string().optional().describe('Project path (auto-injected if omitted)'),
      }),
      execute: async ({ context, scope, projectPath: pp }) => {
        const body: Record<string, unknown> = {
          agentId: sessionName,
          context,
          scope,
        };
        // Auto-inject projectPath when scope requires it
        const resolvedProjectPath = (pp as string | undefined) || projectPath;
        if (resolvedProjectPath && (scope === 'project' || scope === 'both')) {
          body.projectPath = resolvedProjectPath;
        }
        const result = await client.post('/memory/recall', body);
        return result.success ? result.data : { error: result.error };
      },
    },

    remember: {
      description: 'Store knowledge for future reference.',
      inputSchema: z.object({
        content: z.string().describe('Knowledge to store'),
        category: z.enum(['pattern', 'decision', 'gotcha', 'fact', 'preference']),
        scope: z.enum(['agent', 'project']).default('project'),
        projectPath: z.string().optional().describe('Project path (auto-injected if omitted)'),
      }),
      execute: async ({ content, category, scope, projectPath: pp }) => {
        const body: Record<string, unknown> = {
          agentId: sessionName,
          content,
          category,
          scope,
        };
        const resolvedProjectPath = (pp as string | undefined) || projectPath;
        if (resolvedProjectPath) {
          body.projectPath = resolvedProjectPath;
        }
        const result = await client.post('/memory/remember', body);
        return result.success ? result.data : { error: result.error };
      },
    },

    // ===== System Tools =====

    heartbeat: {
      description: 'System health check. Returns teams, projects, and message queue status.',
      inputSchema: z.object({}),
      execute: async () => {
        const [teams, projects, queue] = await Promise.all([
          client.get('/teams'),
          client.get('/projects'),
          client.get('/messaging/queue/status'),
        ]);
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          teams: teams.success ? teams.data : 'unavailable',
          projects: projects.success ? projects.data : 'unavailable',
          queue: queue.success ? queue.data : 'unavailable',
        };
      },
    },

    get_tasks: {
      description: 'Get all tracked tasks for a project.',
      inputSchema: z.object({
        projectPath: z.string().describe('Project path'),
        status: z.string().optional().describe('Filter by status (e.g., "in_progress", "done")'),
      }),
      execute: async ({ projectPath, status }) => {
        let endpoint = `/task-management/tasks?projectPath=${encodeURIComponent(projectPath as string)}`;
        if (status) endpoint += `&status=${encodeURIComponent(status as string)}`;
        const result = await client.get(endpoint);
        return result.success ? result.data : { error: result.error };
      },
    },

    complete_task: {
      description: 'Mark a task as complete.',
      inputSchema: z.object({
        absoluteTaskPath: z.string().describe('Absolute path to the task file'),
        sessionName: z.string().describe('Agent session that completed it'),
        summary: z.string().describe('Completion summary'),
      }),
      execute: async ({ absoluteTaskPath, sessionName: agent, summary }) => {
        const result = await client.post('/task-management/complete', {
          absoluteTaskPath,
          sessionName: agent,
          summary,
        });
        return result.success ? result.data : { error: result.error };
      },
    },

    broadcast: {
      description: 'Broadcast a message to all active agent sessions.',
      inputSchema: z.object({
        message: z.string().describe('Message to broadcast'),
      }),
      execute: async ({ message }) => {
        const sessionsResult = await client.get('/terminal/sessions');
        if (!sessionsResult.success) return { error: sessionsResult.error };

        const sessions = sessionsResult.data as Record<string, unknown>[] | { data: Record<string, unknown>[] };
        const sessionList = Array.isArray(sessions) ? sessions : (sessions as Record<string, unknown>).data as Record<string, unknown>[] || [];

        let sent = 0;
        let failed = 0;
        for (const session of sessionList) {
          const name = (session as Record<string, string>).name;
          if (!name || name === sessionName) continue;
          const result = await client.post(`/terminal/${name}/deliver`, { message });
          if (result.success) sent++;
          else failed++;
        }
        return { sent, failed };
      },
    },

    handle_agent_failure: {
      description: 'Handle agent failure: restart the agent session.',
      inputSchema: z.object({
        teamId: z.string(),
        memberId: z.string(),
        sessionName: z.string().describe('Agent session name'),
        action: z.enum(['restart', 'retry', 'escalate']),
        reason: z.string().optional(),
      }),
      execute: async ({ teamId, memberId, sessionName: agent, action, reason }) => {
        if (action === 'restart') {
          await client.post(`/teams/${teamId}/members/${memberId}/stop`, {});
          const result = await client.post(`/teams/${teamId}/members/${memberId}/start`, {});
          return { action: 'restarted', sessionName: agent, success: result.success };
        }
        if (action === 'escalate') {
          return { action: 'escalated', sessionName: agent, reason: reason || 'unknown' };
        }
        return { action, sessionName: agent, note: 'Action acknowledged' };
      },
    },

    // ===== File Editing Tools =====

    edit_file: {
      description: 'Surgical file edit: replace an exact substring in a file with new content. Uses precise string matching (not regex) to find the old text and replace it. The old_string must appear exactly once in the file for the edit to succeed. This is safer than full file rewrites — only the targeted section changes.',
      inputSchema: z.object({
        file_path: z.string().describe('Absolute path to the file to edit'),
        old_string: z.string().describe('Exact string to find and replace (must be unique in the file)'),
        new_string: z.string().describe('Replacement string'),
        replace_all: z.boolean().default(false).describe('Replace all occurrences instead of requiring uniqueness'),
      }),
      execute: async ({ file_path, old_string, new_string, replace_all }) => {
        const fp = expandPath(file_path as string), os = old_string as string, ns = new_string as string;
        try {
          // Read the file
          const content = await fsPromises.readFile(fp, 'utf8');

          // Count occurrences
          const occurrences = content.split(os).length - 1;

          if (occurrences === 0) {
            return {
              success: false,
              error: `old_string not found in ${fp}. Make sure the string matches exactly (including whitespace and indentation).`,
            };
          }

          // When replace_all is true, replace all occurrences
          if (replace_all && occurrences > 1) {
            const newContent = content.replaceAll(os, ns);
            await fsPromises.writeFile(fp, newContent, 'utf8');
            return {
              success: true,
              file: fp,
              replacements: occurrences,
            };
          }

          // Default behavior: require unique match for safety
          if (occurrences > 1) {
            return {
              success: false,
              error: `old_string found ${occurrences} times in ${fp}. Provide a larger unique string with more surrounding context, or set replace_all=true.`,
              occurrences,
            };
          }

          // Perform the replacement (single occurrence)
          const newContent = content.replace(os, ns);

          // Write back
          await fsPromises.writeFile(fp, newContent, 'utf8');

          return {
            success: true,
            file: fp,
            replacements: 1,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('ENOENT')) {
            return { success: false, error: `File not found: ${fp}` };
          }
          if (msg.includes('EACCES')) {
            return { success: false, error: `Permission denied: ${fp}` };
          }
          return { success: false, error: msg };
        }
      },
    },

    read_file: {
      description: 'Read the contents of a file. Returns text content with line numbers, or base64-encoded image data for image files (png/jpg/gif/webp/svg). Image files are returned as multimodal content parts for AI SDK.',
      inputSchema: z.object({
        file_path: z.string().describe('Absolute path to the file to read'),
        offset: z.number().optional().describe('Line number to start reading from (1-based, text files only)'),
        limit: z.number().optional().describe('Maximum number of lines to read (text files only)'),
      }),
      execute: async ({ file_path, offset, limit }) => {
        const fp = expandPath(file_path as string);
        try {
          // Check if this is an image file
          const ext = fp.split('.').pop()?.toLowerCase() || '';
          if (IMAGE_EXTENSIONS.has(ext)) {
            const buffer = await fsPromises.readFile(fp);
            const base64 = buffer.toString('base64');
            const mimeType = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';
            return {
              success: true,
              type: 'image',
              mimeType,
              data: base64,
              file: fp,
              sizeBytes: buffer.length,
            };
          }

          const content = await fsPromises.readFile(fp, 'utf8');
          const lines = content.split('\n');

          if (offset || limit) {
            const start = ((offset as number) || 1) - 1;
            const end = limit ? start + (limit as number) : lines.length;
            const sliced = lines.slice(start, end);
            return {
              success: true,
              content: sliced.map((line, i) => `${start + i + 1}\t${line}`).join('\n'),
              totalLines: lines.length,
            };
          }

          return {
            success: true,
            content: lines.map((line, i) => `${i + 1}\t${line}`).join('\n'),
            totalLines: lines.length,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('ENOENT')) {
            return { success: false, error: `File not found: ${fp}` };
          }
          return { success: false, error: msg };
        }
      },
    },

    write_file: {
      description: 'Write content to a file, creating it if it does not exist. Overwrites existing content. Use edit_file for surgical modifications to existing files.',
      inputSchema: z.object({
        file_path: z.string().describe('Absolute path to the file to write'),
        content: z.string().describe('Full file content to write'),
      }),
      execute: async ({ file_path, content }) => {
        const fp = expandPath(file_path as string), ct = content as string;
        try {
          // Ensure parent directory exists
          const dir = fp.substring(0, fp.lastIndexOf('/'));
          if (dir) {
            await fsPromises.mkdir(dir, { recursive: true });
          }
          await fsPromises.writeFile(fp, ct, 'utf8');
          return { success: true, file: fp, bytes: Buffer.byteLength(ct, 'utf8') };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    },

    // ===== Agent Lifecycle Self-Registration Tools =====

    register_self: {
      description: 'Register this agent as active with the Crewly backend. Call this immediately on startup.',
      inputSchema: z.object({
        role: z.string().describe('Agent role (e.g., "developer", "orchestrator")'),
      }),
      execute: async ({ role }) => {
        const result = await client.post('/teams/members/register', {
          role,
          sessionName,
        });
        return result.success ? result.data : { error: result.error };
      },
    },

    get_project_overview: {
      description: 'Get an overview of all configured projects.',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.get('/projects');
        return result.success ? result.data : { error: result.error };
      },
    },

    report_status: {
      description: 'Report task status to the orchestrator.',
      inputSchema: z.object({
        status: z.enum(['in_progress', 'done', 'blocked', 'error']).describe('Current status'),
        summary: z.string().describe('Brief status summary'),
      }),
      execute: async ({ status, summary }) => {
        const body: Record<string, unknown> = {
          sessionName,
          status,
          summary,
        };
        if (projectPath) body.projectPath = projectPath;
        if (conversationId) body.conversationId = conversationId;
        const result = await client.post('/teams/members/register', body);
        return result.success ? result.data : { error: result.error };
      },
    },

    // ===== Context Compaction Tool =====

    compact_memory: {
      description: 'Proactively compact conversation context to preserve critical state while freeing token budget. Use when context is growing large or before starting a new phase of work. Generates an AI-powered structured summary of older messages preserving: active tasks, decisions, findings, blockers, and current context.',
      inputSchema: z.object({}),
      sensitivity: 'safe',
      execute: async () => {
        if (!callbacks?.onCompactMemory) {
          return { success: false, error: 'Compaction not available — no runner callback configured' };
        }
        const result = await callbacks.onCompactMemory();
        return {
          success: result.compacted,
          ...result,
        };
      },
    },

    // ===== Security Audit Tool =====

    get_audit_log: {
      description: 'Retrieve the security audit trail of recent tool invocations. Shows tool name, sensitivity classification, success/failure, duration, and sanitized arguments. Use for security review, debugging, or compliance.',
      inputSchema: z.object({
        limit: z.number().default(50).describe('Maximum entries to return (most recent first)'),
        sensitivity: z.enum(['safe', 'sensitive', 'destructive']).optional().describe('Filter by sensitivity level'),
        toolName: z.string().optional().describe('Filter by specific tool name'),
      }),
      sensitivity: 'safe',
      execute: async ({ limit, sensitivity: filterSensitivity, toolName: filterTool }) => {
        if (!callbacks?.onGetAuditLog) {
          return {
            success: false,
            error: 'Audit log not available — no runner callback configured',
          };
        }

        const filters: AuditLogFilters = {
          limit: (limit as number) || 50,
          sensitivity: filterSensitivity as ToolSensitivity | undefined,
          toolName: filterTool as string | undefined,
        };
        const entries = callbacks.onGetAuditLog(filters);

        return {
          success: true,
          totalEntries: entries.length,
          filters: {
            limit: filters.limit,
            sensitivity: filters.sensitivity || 'all',
            toolName: filters.toolName || 'all',
          },
          entries,
        };
      },
    },
  };

  // Apply sensitivity classifications and audit wrapping
  const tools: Record<string, ToolDefinition> = {};
  for (const [name, tool] of Object.entries(rawTools)) {
    tools[name] = {
      ...tool,
      sensitivity: tool.sensitivity || TOOL_SENSITIVITY[name] || 'safe',
      execute: wrapWithAudit(name, tool.execute, callbacks),
    };
  }

  return tools;
}

/**
 * Build a structured task message matching the delegate-task skill format.
 *
 * @param to - Target agent session
 * @param task - Task instructions
 * @param priority - Task priority
 * @param context - Optional additional context
 * @param projectPath - Optional project path
 * @returns Formatted task message string
 */
function buildTaskMessage(
  to: string,
  task: string,
  priority: string,
  context?: string,
  projectPath?: string,
): string {
  let message = `New task from orchestrator (priority: ${priority}):\n\n${task}`;
  if (context) message += `\n\nContext: ${context}`;
  if (projectPath) {
    message += `\n\nWhen done, report back using: bash config/skills/agent/core/report-status/execute.sh '{"sessionName":"${to}","status":"done","summary":"<brief summary>","projectPath":"${projectPath}"}'`;
  }
  return message;
}

/**
 * Get the list of tool names available in the registry.
 *
 * @returns Array of tool name strings
 */
export function getToolNames(): string[] {
  return [
    'delegate_task', 'send_message', 'get_agent_status', 'get_team_status',
    'get_agent_logs', 'reply_slack', 'schedule_check', 'cancel_schedule',
    'start_agent', 'stop_agent', 'subscribe_event', 'recall_memory',
    'remember', 'heartbeat', 'get_tasks', 'complete_task', 'broadcast',
    'handle_agent_failure', 'edit_file', 'read_file', 'write_file',
    'register_self', 'get_project_overview', 'report_status',
    'compact_memory', 'get_audit_log',
  ];
}
