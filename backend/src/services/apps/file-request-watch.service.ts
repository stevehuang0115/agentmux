/**
 * FileRequestWatchService — tells an agent when the owner has uploaded the
 * file it asked for with the `request-file` skill.
 *
 * The owner uploads from the Crewly portal (a signed-in link, chunked); Cloud
 * keeps the file as a handoff addressed to this machine's agent. This service
 * reads the instance's inbox (`GET /upload-requests/inbox`) every
 * FILE_REQUEST_POLL_MS, hands each new file to the agent that asked (starting
 * it when it is down; the orchestrator when the agent is gone from this
 * machine), and then marks the file told so it is delivered once. A failing
 * poll backs off (x2 up to FILE_REQUEST_MAX_BACKOFF_MS); nothing is lost,
 * because Cloud keeps un-told files in the inbox until they are marked.
 *
 * The message names the file and the `receive-file` command; the file
 * name is the owner's text, so it is quoted and length-capped.
 *
 * @module services/apps/file-request-watch.service
 */

import { CREWLY_APPS_CONSTANTS } from '../../constants.js';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { AppsCloudError, type AppsCloudClient } from './apps-cloud.client.js';

const C = CREWLY_APPS_CONSTANTS;

/** One uploaded file the machine has not been told about (Cloud's inbox item). */
export interface FileRequestInboxItem {
  requestId: string;
  agentSession: string;
  purpose: string;
  handoffId: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt?: string;
}

/** Constructor dependencies. */
export interface FileRequestWatchDeps {
  client: Pick<AppsCloudClient, 'request'>;
  /** Wake an agent with a message (`activate` starts it when down); false = not delivered */
  sendToAgent: (session: string, text: string, activate: boolean) => Promise<boolean>;
  /** Hand a message to the orchestrator */
  sendToOrchestrator: (text: string) => Promise<boolean>;
  /** Whether an agent session is known on this machine */
  isLocalAgent: (session: string) => Promise<boolean>;
  /** Runs `deliver` as an owner-authored message (queue priority) */
  asOwnerMessage?: <T>(session: string, text: string, ref: string, deliver: () => T) => T;
  /** Skills root, to print the receive-file path */
  receiveCommand?: (handoffId: string) => string;
  pollMs?: number;
  maxBackoffMs?: number;
}

/**
 * Human size: 23273672 -> "22.2 MB".
 *
 * @param bytes - Size
 * @returns Text
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * The message an agent gets when the owner's upload arrived.
 *
 * @param items - Files of one request (same agent)
 * @param receiveCommand - Command that receives one handoff
 * @returns Message text
 */
export function buildFileUploadedMessage(items: FileRequestInboxItem[], receiveCommand: (id: string) => string): string {
  const first = items[0];
  const safeName = (n: string): string => JSON.stringify(n.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 120));
  const lines = items.map((i) => `- ${safeName(i.fileName)} (${formatSize(i.sizeBytes)}): ${receiveCommand(i.handoffId)}`);
  return [
    `[File from the owner] The owner uploaded ${items.length === 1 ? 'the file' : `${items.length} files`} you asked for with request-file` +
      ` (your request: ${JSON.stringify(first.purpose.slice(0, 200))}).`,
    'Receive each one with the receive-file skill, then carry on with what you were doing. Tell the owner in your own words that you have it.',
    ...lines,
  ].join('\n');
}

/**
 * Service — see module docs.
 */
export class FileRequestWatchService {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;
  private failures = 0;
  private readonly logger: ComponentLogger;
  /** Handoff ids delivered but not yet marked told (a mark that failed is retried, not re-sent). */
  private readonly delivered = new Set<string>();

  constructor(private readonly deps: FileRequestWatchDeps) {
    this.logger = LoggerService.getInstance().createComponentLogger('FileRequestWatch');
  }

  /** Start polling (idempotent). */
  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.schedule(5_000);
  }

  /** Stop polling. */
  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Read the inbox once and deliver what is new.
   *
   * @returns How many files were delivered this pass
   */
  async pollOnce(): Promise<number> {
    const data = await this.deps.client.request<{ items?: FileRequestInboxItem[] }>('GET', '/upload-requests/inbox', {
      timeoutMs: C.FILE_REQUEST_TIMEOUT_MS,
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    // One message per (request, agent).
    const groups = new Map<string, FileRequestInboxItem[]>();
    for (const i of items) {
      if (!i || typeof i.handoffId !== 'string' || typeof i.requestId !== 'string' || typeof i.agentSession !== 'string') continue;
      const key = `${i.requestId}\u0000${i.agentSession}`;
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
    let count = 0;
    for (const group of groups.values()) {
      const fresh = group.filter((i) => !this.delivered.has(i.handoffId));
      if (fresh.length > 0 && (await this.deliver(fresh))) {
        for (const i of fresh) this.delivered.add(i.handoffId);
        count += fresh.length;
      } else if (fresh.length > 0) {
        continue; // not delivered: stays in the inbox, retried next pass
      }
      await this.markTold(group);
    }
    return count;
  }

  private async deliver(items: FileRequestInboxItem[]): Promise<boolean> {
    const { agentSession } = items[0];
    const command =
      this.deps.receiveCommand ?? ((id: string) => `bash <skills>/core/receive-file/execute.sh --id ${id}`);
    const text = buildFileUploadedMessage(items, command);
    const local = await this.deps.isLocalAgent(agentSession).catch(() => false);
    if (!local) {
      // The agent is gone from this machine (renamed or removed): the orchestrator routes it.
      return this.deps.sendToOrchestrator(`The agent "${agentSession}" is not on this machine any more.\n${text}`);
    }
    const send = (): Promise<boolean> => this.deps.sendToAgent(agentSession, text, true);
    const ref = `file-request:${items[0].handoffId}`;
    return this.deps.asOwnerMessage ? this.deps.asOwnerMessage(agentSession, text, ref, send) : send();
  }

  private async markTold(group: FileRequestInboxItem[]): Promise<void> {
    const ids = group.map((i) => i.handoffId).filter((id) => this.delivered.has(id));
    if (ids.length === 0) return;
    try {
      await this.deps.client.request('POST', `/upload-requests/${group[0].requestId}/notified`, {
        body: { handoffIds: ids },
        timeoutMs: C.FILE_REQUEST_TIMEOUT_MS,
      });
      for (const id of ids) this.delivered.delete(id);
    } catch (err) {
      this.logger.warn('Could not mark uploaded files as told (retried next pass)', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), ms);
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    const pollMs = this.deps.pollMs ?? C.FILE_REQUEST_POLL_MS;
    const maxBackoff = this.deps.maxBackoffMs ?? C.FILE_REQUEST_MAX_BACKOFF_MS;
    try {
      const n = await this.pollOnce();
      if (n > 0) this.logger.info('Owner upload delivered to its agent', { files: n });
      this.failures = 0;
    } catch (err) {
      // Not signed in to Cloud / offline: quiet, backs off.
      const quiet = err instanceof AppsCloudError && (err.status === 409 || err.status === 401 || err.status === 503);
      this.failures++;
      if (!quiet && this.failures <= 3) this.logger.warn('Upload inbox poll failed', { error: err instanceof Error ? err.message : String(err) });
    }
    this.schedule(Math.min(pollMs * 2 ** Math.min(this.failures, 10), maxBackoff));
  }
}
