/**
 * Slack Thread Store Service
 *
 * Persists Slack thread conversations as markdown files so the orchestrator
 * can read conversation history. Also tracks which agents were delegated
 * from which Slack threads, enabling thread-aware proactive notifications.
 *
 * Storage layout:
 *   ~/.agentmux/slack-threads/
 *     {channelId}/
 *       {threadTs}.md          — Thread conversation file
 *     agent-index.json         — Maps agent session → thread(s)
 *
 * @module services/slack/slack-thread-store
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { SLACK_THREAD_CONSTANTS } from '../../constants.js';
import { atomicWriteFile, atomicWriteJson, safeReadJson } from '../../utils/file-io.utils.js';

/**
 * Represents an agent-to-thread mapping stored in the agent index
 */
export interface AgentThreadMapping {
  channelId: string;
  threadTs: string;
  agentName: string;
  delegatedAt: string;
}

/**
 * Thread info returned by lookup methods
 */
export interface ThreadInfo {
  channelId: string;
  threadTs: string;
  filePath: string;
}

/**
 * In-memory agent index structure persisted to agent-index.json
 */
interface AgentIndex {
  [agentSession: string]: AgentThreadMapping[];
}

/**
 * SlackThreadStoreService manages persistent storage of Slack thread
 * conversations and agent-thread associations.
 *
 * @example
 * ```typescript
 * const store = new SlackThreadStoreService();
 * await store.appendUserMessage('C123', '1707432600.000001', 'Steve', 'Hello');
 * await store.registerAgent('joe-session', 'Joe', 'C123', '1707432600.000001');
 * const threads = store.findThreadsForAgent('joe-session');
 * ```
 */
export class SlackThreadStoreService {
  private baseDir: string;
  private agentIndex: AgentIndex = {};
  private indexLoaded = false;

  /**
   * Create a new SlackThreadStoreService.
   *
   * @param agentmuxHome - Base agentmux home directory (defaults to ~/.agentmux)
   */
  constructor(agentmuxHome?: string) {
    const home = agentmuxHome || path.join(os.homedir(), '.agentmux');
    this.baseDir = path.join(home, SLACK_THREAD_CONSTANTS.STORAGE_DIR);
  }

  /**
   * Compute the file path for a thread conversation file.
   * Pure function — does not perform I/O.
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Slack thread timestamp
   * @returns Absolute path to the thread markdown file
   */
  getThreadFilePath(channelId: string, threadTs: string): string {
    return path.join(
      this.baseDir,
      channelId,
      `${threadTs}${SLACK_THREAD_CONSTANTS.FILE_EXTENSION}`
    );
  }

  /**
   * Ensure the thread file exists, creating it with frontmatter if needed.
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Slack thread timestamp
   * @param userName - Name of the user who started the thread
   * @returns Absolute path to the thread file
   */
  async ensureThreadFile(
    channelId: string,
    threadTs: string,
    userName: string
  ): Promise<string> {
    const filePath = this.getThreadFilePath(channelId, threadTs);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist — create with frontmatter
      const frontmatter = [
        '---',
        `channel: ${channelId}`,
        `thread: ${threadTs}`,
        `user: ${userName}`,
        `started: ${new Date().toISOString()}`,
        'agents: []',
        '---',
        '',
        '## Messages',
        '',
      ].join('\n');

      await atomicWriteFile(filePath, frontmatter);
    }

    return filePath;
  }

  /**
   * Append a user message to the thread conversation file.
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Slack thread timestamp
   * @param userName - Display name of the sender
   * @param message - Message content
   */
  async appendUserMessage(
    channelId: string,
    threadTs: string,
    userName: string,
    message: string
  ): Promise<void> {
    const filePath = await this.ensureThreadFile(channelId, threadTs, userName);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const entry = `\n**${userName}** (${timestamp}):\n${message}\n`;
    await fs.appendFile(filePath, entry, 'utf-8');
  }

  /**
   * Append an orchestrator reply to the thread conversation file.
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Slack thread timestamp
   * @param message - Orchestrator response content
   */
  async appendOrchestratorReply(
    channelId: string,
    threadTs: string,
    message: string
  ): Promise<void> {
    const filePath = this.getThreadFilePath(channelId, threadTs);

    try {
      await fs.access(filePath);
    } catch {
      // Thread file doesn't exist — skip silently
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const entry = `\n**AgentMux** (${timestamp}):\n${message}\n`;
    await fs.appendFile(filePath, entry, 'utf-8');
  }

  /**
   * Register an agent as being associated with a Slack thread.
   * Updates the in-memory index, persists to disk, and appends
   * the agent to the thread file's frontmatter.
   *
   * @param agentSession - Agent session name (e.g., 'innovation-team-joe-abc123')
   * @param agentName - Human-readable agent name (e.g., 'Joe')
   * @param channelId - Slack channel ID
   * @param threadTs - Slack thread timestamp
   */
  async registerAgent(
    agentSession: string,
    agentName: string,
    channelId: string,
    threadTs: string
  ): Promise<void> {
    await this.loadIndex();

    const mapping: AgentThreadMapping = {
      channelId,
      threadTs,
      agentName,
      delegatedAt: new Date().toISOString(),
    };

    if (!this.agentIndex[agentSession]) {
      this.agentIndex[agentSession] = [];
    }

    // Avoid duplicate registrations for the same thread
    const existing = this.agentIndex[agentSession].find(
      (m) => m.channelId === channelId && m.threadTs === threadTs
    );
    if (!existing) {
      this.agentIndex[agentSession].push(mapping);
    }

    await this.saveIndex();
    await this.updateThreadFrontmatter(channelId, threadTs, agentSession, agentName);
  }

  /**
   * Find all threads associated with an agent session.
   * Synchronous lookup from in-memory index.
   *
   * @param sessionName - Agent session name to look up
   * @returns Array of ThreadInfo objects
   */
  findThreadsForAgent(sessionName: string): ThreadInfo[] {
    const mappings = this.agentIndex[sessionName];
    if (!mappings || mappings.length === 0) {
      return [];
    }

    return mappings.map((m) => ({
      channelId: m.channelId,
      threadTs: m.threadTs,
      filePath: this.getThreadFilePath(m.channelId, m.threadTs),
    }));
  }

  /**
   * Load the agent index from disk into memory.
   * Only loads once unless forced.
   */
  private async loadIndex(): Promise<void> {
    if (this.indexLoaded) return;

    const indexPath = path.join(this.baseDir, SLACK_THREAD_CONSTANTS.AGENT_INDEX_FILE);
    this.agentIndex = await safeReadJson(indexPath, {});
    this.indexLoaded = true;
  }

  /**
   * Persist the in-memory agent index to disk.
   */
  private async saveIndex(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const indexPath = path.join(this.baseDir, SLACK_THREAD_CONSTANTS.AGENT_INDEX_FILE);
    await atomicWriteJson(indexPath, this.agentIndex);
  }

  /**
   * Update the thread file's YAML frontmatter to include a newly registered agent.
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Slack thread timestamp
   * @param agentSession - Agent session name
   * @param agentName - Human-readable agent name
   */
  private async updateThreadFrontmatter(
    channelId: string,
    threadTs: string,
    agentSession: string,
    agentName: string
  ): Promise<void> {
    const filePath = this.getThreadFilePath(channelId, threadTs);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Find the agents: [] line and replace with the new entry
      const agentEntry = `  - session: ${agentSession}\n    name: ${agentName}\n    delegatedAt: ${new Date().toISOString()}`;

      if (content.includes('agents: []')) {
        const updated = content.replace(
          'agents: []',
          `agents:\n${agentEntry}`
        );
        await atomicWriteFile(filePath, updated);
      } else if (content.includes('agents:')) {
        // Agents list already has entries — append before the closing ---
        const endOfFrontmatter = content.indexOf('---', content.indexOf('---') + 3);
        if (endOfFrontmatter > 0) {
          const updated =
            content.slice(0, endOfFrontmatter) +
            agentEntry +
            '\n' +
            content.slice(endOfFrontmatter);
          await atomicWriteFile(filePath, updated);
        }
      }
    } catch {
      // Thread file doesn't exist — skip silently
    }
  }
}

/** Singleton instance */
let instance: SlackThreadStoreService | null = null;

/**
 * Get the SlackThreadStoreService singleton.
 *
 * @returns The service instance or null if not initialized
 */
export function getSlackThreadStore(): SlackThreadStoreService | null {
  return instance;
}

/**
 * Set the SlackThreadStoreService singleton.
 *
 * @param store - The service instance to set
 */
export function setSlackThreadStore(store: SlackThreadStoreService): void {
  instance = store;
}

/**
 * Reset the SlackThreadStoreService singleton (for testing).
 */
export function resetSlackThreadStore(): void {
  instance = null;
}
