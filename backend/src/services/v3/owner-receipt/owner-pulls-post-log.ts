/**
 * Post log for the weekly owner-pulls line (#1387): one JSON line per post an
 * agent started in the owner's DM (a new top-level message, not an answer in
 * the thread of something the owner said). Nothing else records these, and
 * they are where an "FYI that did not need an answer" comes from.
 *
 * Only who, when and whether it ended with a question are kept, never the
 * text. Append-only, best effort: a failed write is logged and never blocks a
 * post. Past {@link OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.POST_LOG_MAX_BYTES}
 * the file is rewritten with the last two weeks only.
 *
 * @module services/v3/owner-receipt/owner-pulls-post-log
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { OWNER_RECEIPT_CONSTANTS } from '../../../constants.js';
import { LoggerService } from '../../core/logger.service.js';
import { endsWithQuestion, type AgentPostRecord } from './owner-pulls-weekly.js';

/** An agent's Slack post, as `onAgentSlackPost` reports it. */
export interface AgentSlackPostInput {
  agent: string;
  slackChannelId: string;
  threadTs?: string;
  text: string;
  interim?: boolean;
}

/**
 * Whether a post is one an agent started in the owner's DM: a DM channel
 * (`D…`), top level (no thread), not an interim line.
 *
 * @param post - The reported post
 * @returns True when it belongs in the log
 */
export function isAgentStartedDmPost(post: AgentSlackPostInput): boolean {
  return !!post.agent && post.slackChannelId.startsWith('D') && !post.threadTs && !post.interim && post.text.trim().length > 0;
}

/** File-backed post log (JSON lines). */
export class OwnerPullsPostLog {
  private readonly file: string;
  private chain: Promise<unknown> = Promise.resolve();

  /**
   * @param dir - Directory (the Request files' directory)
   * @param now - Clock
   */
  constructor(dir: string, private readonly now: () => Date = () => new Date()) {
    this.file = path.join(dir, OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.POST_LOG_FILENAME);
  }

  /**
   * Log a post if it is one an agent started in the owner's DM.
   *
   * @param post - The reported post
   * @returns Resolves once written (or skipped)
   */
  note(post: AgentSlackPostInput): Promise<void> {
    if (!isAgentStartedDmPost(post)) return Promise.resolve();
    const record: AgentPostRecord = { at: this.now().toISOString(), agent: post.agent, endsWithQuestion: endsWithQuestion(post.text) };
    const run = this.chain.then(async () => {
      try {
        await fs.appendFile(this.file, `${JSON.stringify(record)}\n`, 'utf8');
        const { size } = await fs.stat(this.file);
        if (size > OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.POST_LOG_MAX_BYTES) await this.trim();
      } catch (err) {
        LoggerService.getInstance()
          .createComponentLogger('OwnerPullsPostLog')
          .warn('Agent post could not be logged (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
      }
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  /**
   * Read every logged post. Malformed lines are skipped.
   *
   * @returns Posts, oldest first
   */
  async read(): Promise<AgentPostRecord[]> {
    await this.chain;
    return this.readFile();
  }

  private async readFile(): Promise<AgentPostRecord[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch {
      return [];
    }
    const out: AgentPostRecord[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line) as Partial<AgentPostRecord>;
        if (typeof obj.at === 'string' && typeof obj.agent === 'string') {
          out.push({ at: obj.at, agent: obj.agent, endsWithQuestion: obj.endsWithQuestion === true });
        }
      } catch {
        /* skip a torn line */
      }
    }
    return out;
  }

  /** Keep only the two weeks the weekly line reads. */
  private async trim(): Promise<void> {
    const keepFrom = this.now().getTime() - 2 * OWNER_RECEIPT_CONSTANTS.PULLS_WEEKLY.WINDOW_MS;
    const kept = (await this.readFile()).filter((p) => Date.parse(p.at) >= keepFrom);
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, kept.map((p) => `${JSON.stringify(p)}\n`).join(''), 'utf8');
    await fs.rename(tmp, this.file);
  }
}
