/**
 * Incoming side of the automatic file hand-off: before a message from an
 * agent on another machine is delivered to a local agent, its file markers
 * are downloaded into the recipient's project inbox and rewritten to paths.
 *
 * @module services/file-handoff/file-handoff.inbound
 */

import type { ChatChannelDTO, ChatMessageDTO } from '../chat-v2/types.js';
import { OWNER_EVIDENCE_METADATA } from '../../constants.js';
import { findMarkerIds, type FileHandoffService } from './file-handoff.service.js';

/** Collaborators (injectable). */
export interface InboundFileDeps {
  service: Pick<FileHandoffService, 'expandInbound'>;
  /** Whether an agent session runs on this machine (its own echo is never downloaded) */
  isLocalAgent: (agentSession: string) => boolean;
  /** The local agent the message is for, to find its project; undefined = unknown */
  recipientFor: (channel: ChatChannelDTO) => string | undefined;
  /** Inbox folder (`<project>/.crewly/inbox`) of that recipient, or null */
  inboxRootFor: (recipient: string | undefined) => Promise<string | null>;
}

/**
 * Return the message with its file markers replaced by local paths, or the
 * same message when nothing applies. Never throws: on any failure the original
 * message is delivered.
 *
 * Only a colleague agent's message from another machine is acted on - a human
 * pasting a marker, or a local agent's own echo, is left alone (an echo would
 * download and acknowledge the file before its real recipient got it).
 *
 * @param channel - Channel the message was recorded in
 * @param message - The message about to be delivered
 * @param deps - Collaborators
 * @returns The message to deliver
 */
export async function expandInboundFiles(channel: ChatChannelDTO, message: ChatMessageDTO, deps: InboundFileDeps): Promise<ChatMessageDTO> {
  try {
    if (message.senderType !== 'user' || typeof message.content !== 'string') return message;
    const remote = message.metadata?.[OWNER_EVIDENCE_METADATA.REMOTE_AGENT_SESSION];
    if (typeof remote !== 'string' || !remote || deps.isLocalAgent(remote)) return message;
    if (findMarkerIds(message.content).length === 0) return message;
    const recipient = deps.recipientFor(channel);
    const inbox = await deps.inboxRootFor(recipient);
    if (!inbox) return message;
    const sender = message.senderId.replace(/\s*\(agent\)\s*$/, '');
    const content = await deps.service.expandInbound(message.content, sender, inbox, recipient);
    return content === message.content ? message : { ...message, content };
  } catch {
    return message;
  }
}
