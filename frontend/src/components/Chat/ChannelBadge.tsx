/**
 * Channel Badge Component
 *
 * Displays a small icon+label badge for the channel type of a conversation.
 *
 * @module components/Chat/ChannelBadge
 */

import React from 'react';
import type { ChatChannelType } from '../../types/chat.types';
import './ChannelBadge.css';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Channel display configuration map
 */
const CHANNEL_CONFIG: Record<ChatChannelType, { icon: string; label: string; className: string }> = {
  slack: { icon: '\uD83D\uDD37', label: 'Slack', className: 'channel-slack' },
  google_chat: { icon: '\uD83D\uDFE2', label: 'Google Chat', className: 'channel-google-chat' },
  crewly_chat: { icon: '\uD83D\uDCAC', label: 'Crewly', className: 'channel-crewly' },
  telegram: { icon: '\u2709\uFE0F', label: 'Telegram', className: 'channel-telegram' },
  api: { icon: '\uD83D\uDD0C', label: 'API', className: 'channel-api' },
};

// =============================================================================
// Types
// =============================================================================

interface ChannelBadgeProps {
  /** Channel type to display */
  channelType: ChatChannelType;
  /** Whether to show the label text (default: true) */
  showLabel?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Small badge showing channel type with icon and optional label.
 *
 * @param props - Component props
 * @returns JSX element with channel badge
 */
export const ChannelBadge: React.FC<ChannelBadgeProps> = ({
  channelType,
  showLabel = true,
}) => {
  const config = CHANNEL_CONFIG[channelType] ?? CHANNEL_CONFIG.crewly_chat;

  return (
    <span
      className={`channel-badge ${config.className}`}
      data-testid="channel-badge"
      title={config.label}
    >
      <span className="channel-badge-icon" aria-hidden="true">
        {config.icon}
      </span>
      {showLabel && <span className="channel-badge-label">{config.label}</span>}
    </span>
  );
};

export default ChannelBadge;
