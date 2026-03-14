/**
 * Channel Badge Component
 *
 * Displays a small icon+label badge for the channel type of a conversation.
 *
 * @module components/Chat/ChannelBadge
 */

import React from 'react';
import type { ChatChannelType } from '../../types/chat.types';
import { CHANNEL_CONFIG } from './channel-config';
import './ChannelBadge.css';

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
