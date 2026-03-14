/**
 * Shared Channel Configuration
 *
 * Centralized icon, label, and CSS class mapping for chat channel types.
 * Used by ChannelBadge and ChannelFilterBar to avoid duplicated definitions.
 *
 * @module components/Chat/channel-config
 */

import type { ChatChannelType } from '../../types/chat.types';

/**
 * Display configuration for a chat channel type
 */
export interface ChannelDisplayConfig {
  /** Emoji icon for the channel */
  icon: string;
  /** Human-readable label */
  label: string;
  /** CSS class name for styling */
  className: string;
}

/**
 * Channel display configuration map
 */
export const CHANNEL_CONFIG: Record<ChatChannelType, ChannelDisplayConfig> = {
  slack: { icon: '\uD83D\uDD37', label: 'Slack', className: 'channel-slack' },
  crewly_chat: { icon: '\uD83D\uDCAC', label: 'Crewly', className: 'channel-crewly' },
  telegram: { icon: '\u2709\uFE0F', label: 'Telegram', className: 'channel-telegram' },
  api: { icon: '\uD83D\uDD0C', label: 'API', className: 'channel-api' },
};
