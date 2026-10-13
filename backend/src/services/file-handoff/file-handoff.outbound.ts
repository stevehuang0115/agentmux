/**
 * Outgoing side of the automatic file hand-off for one agent message:
 * decide which files go, upload them, and rewrite the message text.
 *
 * @module services/file-handoff/file-handoff.outbound
 */

import type { AttachResult, FileHandoffService } from './file-handoff.service.js';
import { FILE_HANDOFF_CONSTANTS } from '../../constants.js';

/** What an agent's request carries about files. */
export interface OutboundFileRequest {
  /** Message text */
  content: unknown;
  /** `--file` paths (strings only are used) */
  files?: unknown;
  /** The agent's `CREWLY_PROJECT_PATH` */
  projectPath?: unknown;
  /** Interim notes never auto-attach */
  interim?: boolean;
}

/** Collaborators (injectable). */
export interface OutboundFileDeps {
  service: Pick<FileHandoffService, 'attachToMessage'>;
  projectDirFor: (agentSession: string, hint?: string) => Promise<string | null>;
  /** Whether the room has a colleague on another machine */
  crossMachine: (channelId: string) => Promise<boolean>;
}

/** The files an agent named explicitly, cleaned. */
export function explicitFilesOf(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  return files.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).map((f) => f.trim());
}

/**
 * Attach files to an agent's outgoing message.
 *
 * Explicit files always go. Paths written in the text go only when the room
 * has a colleague on another machine. Returns null when the message has no
 * files to consider (the common case: no work, no lookups).
 *
 * @param req - The request fields
 * @param agentSession - Sending agent
 * @param channelId - chat-v2 channel the message is posted in
 * @param deps - Collaborators
 * @returns The rewritten text and report, or null to leave the message as it is
 */
export async function attachOutboundFiles(
  req: OutboundFileRequest,
  agentSession: string,
  channelId: string,
  deps: OutboundFileDeps,
): Promise<AttachResult | null> {
  if (typeof req.content !== 'string') return null;
  const explicit = explicitFilesOf(req.files);
  const mentionsPath = req.interim !== true && /(?:^|[\s"'`(<[])(?:\/|\.\/)\S/.test(req.content);
  if (explicit.length === 0 && !mentionsPath) return null;

  const auto = mentionsPath && (await deps.crossMachine(channelId));
  if (explicit.length === 0 && !auto) return null;

  const hint = typeof req.projectPath === 'string' ? req.projectPath : undefined;
  const projectDir = await deps.projectDirFor(agentSession, hint);
  if (!projectDir) {
    return explicit.length > 0
      ? { content: req.content, attached: [], failed: explicit.map((file) => ({ file, reason: 'cannot tell which project directory you work in' })) }
      : null;
  }
  const result = await deps.service.attachToMessage({ content: req.content, explicit, auto, projectDir, agent: agentSession });
  // Nothing went and nothing failed (a prose path that was not a sendable file): no change, no report.
  return result.attached.length === 0 && result.failed.length === 0 ? null : result;
}

/** Cap exposed for the skill text. */
export const MAX_FILES = FILE_HANDOFF_CONSTANTS.MAX_FILES_PER_MESSAGE;
