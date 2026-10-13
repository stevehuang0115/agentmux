/**
 * The orchestrator's primary owner DM as a file target (#1142).
 *
 * The orchestrator answers the owner in a plain Slack DM (`D…`), mirrored
 * into chat-v2 as `slack-<D…>-<ts>` conversations. That DM belongs to neither
 * the team-channel nor the per-agent-DM service, so `attach-file` found no
 * Slack place for it. Only the orchestrator gets this target, and only a DM.
 *
 * @module services/slack/orc-owner-dm-target
 */

import { ORCHESTRATOR_SESSION_NAME } from '../../constants.js';
import { parseSlackConversationId } from '../orc/orc-delivery-enforcer.service.js';
import { isSlackDm } from '../orc/orc-reply-route.service.js';
import { parseSlackThreadKey } from './slack-thread-key.js';

/** Where a file for the orchestrator's owner DM goes. */
export interface OrcOwnerDmTarget {
  slackChannelId: string;
  threadTs?: string;
}

/**
 * Work out the owner DM (and thread) an attach names.
 *
 * @param agentSession - The calling agent
 * @param named - `--channel` (a Slack DM id or a `slack-D…-<ts>` conversation id) and `--thread` (Slack thread key)
 * @returns The target, or null when the caller is not the orchestrator or nothing names a Slack DM
 */
export function orcOwnerDmTarget(
  agentSession: string,
  named: { channelId?: unknown; threadId?: unknown },
): OrcOwnerDmTarget | null {
  if (agentSession !== ORCHESTRATOR_SESSION_NAME) return null;
  const channel = typeof named.channelId === 'string' ? named.channelId.trim() : '';
  const thread = typeof named.threadId === 'string' ? named.threadId.trim() : '';
  const key = parseSlackThreadKey(thread);

  let slackChannelId: string | undefined;
  let threadTs: string | undefined;
  const conv = parseSlackConversationId(channel);
  if (conv) {
    slackChannelId = conv.channelId;
    threadTs = conv.threadTs;
  } else if (/^[A-Z0-9]+$/.test(channel) && isSlackDm(channel)) {
    slackChannelId = channel;
  } else if (!channel && key) {
    slackChannelId = key.slackChannelId;
  }
  if (!slackChannelId || !isSlackDm(slackChannelId)) return null;
  // A thread key of the same DM wins over the thread the conversation id carries.
  if (key && key.slackChannelId === slackChannelId) threadTs = key.threadTs;
  return { slackChannelId, ...(threadTs ? { threadTs } : {}) };
}
