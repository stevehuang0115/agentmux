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
import { z } from 'zod';
import type { CrewlyApiClient } from './api-client.js';

/**
 * Create the complete set of AI SDK tools for the Crewly Agent.
 *
 * Each tool's execute function calls the Crewly REST API directly
 * via the provided API client, bypassing the bash script layer.
 *
 * @param client - API client instance for making REST calls
 * @param sessionName - Agent session name for identity context
 * @returns Object of named tools ready to pass to generateText
 */
/**
 * Tool definition shape matching AI SDK Tool interface.
 * Defined locally to avoid importing the heavy 'ai' module.
 */
interface ToolDefinition {
  description: string;
  inputSchema: z.ZodType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any) => Promise<unknown>;
}

export function createTools(client: CrewlyApiClient, sessionName: string): Record<string, ToolDefinition> {
  return {
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
        const taskMessage = buildTaskMessage(to, task, priority, context, projectPath);

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

        return { success: true, delegatedTo: to, taskId };
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
        const body: Record<string, string> = { channelId, text };
        if (threadTs) body.threadTs = threadTs;
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
      }),
      execute: async ({ context, scope }) => {
        const result = await client.post('/memory/recall', {
          agentId: sessionName,
          context,
          scope,
        });
        return result.success ? result.data : { error: result.error };
      },
    },

    remember: {
      description: 'Store knowledge for future reference.',
      inputSchema: z.object({
        content: z.string().describe('Knowledge to store'),
        category: z.enum(['pattern', 'decision', 'gotcha', 'fact', 'preference']),
        scope: z.enum(['agent', 'project']).default('project'),
      }),
      execute: async ({ content, category, scope }) => {
        const result = await client.post('/memory/remember', {
          agentId: sessionName,
          content,
          category,
          scope,
        });
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
        let endpoint = `/task-management/tasks?projectPath=${encodeURIComponent(projectPath)}`;
        if (status) endpoint += `&status=${encodeURIComponent(status)}`;
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
      execute: async ({ file_path, old_string, new_string }) => {
        try {
          // Read the file
          const content = await fsPromises.readFile(file_path, 'utf8');

          // Count occurrences
          const occurrences = content.split(old_string).length - 1;

          if (occurrences === 0) {
            return {
              success: false,
              error: `old_string not found in ${file_path}. Make sure the string matches exactly (including whitespace and indentation).`,
            };
          }

          // Default behavior: require unique match for safety
          if (occurrences > 1) {
            return {
              success: false,
              error: `old_string found ${occurrences} times in ${file_path}. Provide a larger unique string with more surrounding context, or set replace_all=true.`,
              occurrences,
            };
          }

          // Perform the replacement
          const newContent = content.replace(old_string, new_string);

          // Write back
          await fsPromises.writeFile(file_path, newContent, 'utf8');

          return {
            success: true,
            file: file_path,
            replacements: 1,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('ENOENT')) {
            return { success: false, error: `File not found: ${file_path}` };
          }
          if (msg.includes('EACCES')) {
            return { success: false, error: `Permission denied: ${file_path}` };
          }
          return { success: false, error: msg };
        }
      },
    },

    read_file: {
      description: 'Read the contents of a file. Returns the file content as a string.',
      inputSchema: z.object({
        file_path: z.string().describe('Absolute path to the file to read'),
        offset: z.number().optional().describe('Line number to start reading from (1-based)'),
        limit: z.number().optional().describe('Maximum number of lines to read'),
      }),
      execute: async ({ file_path, offset, limit }) => {
        try {
          const content = await fsPromises.readFile(file_path, 'utf8');
          const lines = content.split('\n');

          if (offset || limit) {
            const start = (offset || 1) - 1;
            const end = limit ? start + limit : lines.length;
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
            return { success: false, error: `File not found: ${file_path}` };
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
        try {
          // Ensure parent directory exists
          const dir = file_path.substring(0, file_path.lastIndexOf('/'));
          if (dir) {
            await fsPromises.mkdir(dir, { recursive: true });
          }
          await fsPromises.writeFile(file_path, content, 'utf8');
          return { success: true, file: file_path, bytes: Buffer.byteLength(content, 'utf8') };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    },
  };
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
  ];
}
