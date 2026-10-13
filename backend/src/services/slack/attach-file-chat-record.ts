/**
 * Record a file an agent attached to Slack in the local chat history.
 *
 * `POST /api/slack/attach` uploads straight to Slack, which left no row in
 * chat-v2: a team lead reading the thread from chat history saw nothing from
 * the agent and told the owner nobody had followed up (Pia's finished video,
 * 2026-10-12). This writes the agent's post as an ordinary agent message that
 * carries the file's details in its metadata.
 *
 * The row is flagged `slackAlreadyPosted` so the outbound Slack mirrors skip
 * it: the upload IS the Slack post, and mirroring would send it twice.
 *
 * @module services/slack/attach-file-chat-record
 */

import path from 'path';
import { SLACK_THREAD_KEY_CONSTANTS } from '../../constants.js';
import { formatSlackThreadKey } from './slack-thread-key.js';
import { synthesizeSlackConversationId } from '../chat-v2/legacy-dto.utils.js';
import type { ChatV2Service } from '../chat-v2/chat-v2.service.js';

/** Metadata flag: this row is already in Slack — outbound mirrors must not post it. */
export const SLACK_ALREADY_POSTED_METADATA_KEY = 'slackAlreadyPosted';

/** Inputs for {@link recordAttachedFileInChat}. */
export interface RecordAttachedFileInput {
  /** The chat channel the file belongs to ('' when unknown — see `slackChannelId`) */
  chatChannelId: string;
  /** Agent session that attached the file */
  agentSession: string;
  /** Local path of the file */
  filePath: string;
  /** Filename shown in Slack, when it differs from the path's basename */
  filename?: string;
  title?: string;
  comment?: string;
  /** Slack conversation the file landed in */
  slackChannelId: string;
  /** Slack thread the file landed in, when threaded */
  threadTs?: string;
  /** Slack file id returned by the upload */
  fileId?: string;
  /** File size in bytes, when known */
  sizeBytes?: number;
}

/**
 * Write the attach to chat-v2. Never throws: the file is already in Slack, so a
 * bookkeeping failure must not turn into a failed attach (the agent would
 * upload it again).
 *
 * @param chat - The chat-v2 service
 * @param input - What was attached and where
 * @returns The recorded message id, or null when nothing was recorded
 */
export function recordAttachedFileInChat(chat: Pick<ChatV2Service, 'recordTurn' | 'getChannelForBridge' | 'findSlackThreadRoot' | 'ensureChannelForLegacyConversation'>, input: RecordAttachedFileInput): string | null {
  try {
    let channelId = input.chatChannelId && chat.getChannelForBridge(input.chatChannelId) ? input.chatChannelId : '';
    if (!channelId) {
      // Not a mapped team channel / agent DM (e.g. the orchestrator's owner DM):
      // use the conversation the Slack text replies of that thread live in.
      if (!input.slackChannelId || !input.threadTs) return null;
      channelId = chat.ensureChannelForLegacyConversation({
        conversationId: synthesizeSlackConversationId(input.slackChannelId, input.threadTs),
        agentSession: input.agentSession,
      }).id;
    }

    const name = input.filename || path.basename(input.filePath);
    const content = input.comment?.trim() ? input.comment.trim() : `Shared ${name}`;
    const root = input.threadTs ? chat.findSlackThreadRoot(channelId, input.threadTs) : null;
    const threadKey = input.threadTs ? formatSlackThreadKey(input.slackChannelId, input.threadTs) : undefined;

    const { message } = chat.recordTurn({
      channelId,
      senderType: 'agent',
      senderId: input.agentSession,
      content,
      ...(root ? { threadId: root.id } : {}),
      metadata: {
        source: 'reply-tool',
        replyKind: 'file-upload',
        [SLACK_ALREADY_POSTED_METADATA_KEY]: true,
        slackChannelId: input.slackChannelId,
        ...(input.threadTs ? { slackThreadTs: input.threadTs } : {}),
        ...(threadKey ? { [SLACK_THREAD_KEY_CONSTANTS.METADATA_KEY]: threadKey } : {}),
        files: [
          {
            name,
            path: input.filePath,
            ...(input.title ? { title: input.title } : {}),
            ...(input.fileId ? { slackFileId: input.fileId } : {}),
            ...(typeof input.sizeBytes === 'number' ? { sizeBytes: input.sizeBytes } : {}),
          },
        ],
      },
    });
    return message.id;
  } catch {
    return null;
  }
}
