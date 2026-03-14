/**
 * Channel Filter Bar Component
 *
 * Row of toggle chips for filtering conversations by channel type.
 *
 * @module components/Chat/ChannelFilterBar
 */

import React from 'react';
import type { ChatChannelType, ChatConversation } from '../../types/chat.types';
import './ChannelFilterBar.css';

// =============================================================================
// Types
// =============================================================================

interface ChannelFilterBarProps {
  /** Currently active filter (null = show all) */
  activeFilter: ChatChannelType | null;
  /** Callback when filter changes */
  onFilterChange: (filter: ChatChannelType | null) => void;
  /** All conversations (used to compute counts per channel) */
  conversations: ChatConversation[];
}

/**
 * Filter chip definition
 */
interface FilterChip {
  key: ChatChannelType | null;
  label: string;
  icon?: string;
}

/**
 * Available filter chips
 */
const FILTER_CHIPS: FilterChip[] = [
  { key: null, label: 'All' },
  { key: 'slack', label: 'Slack', icon: '\uD83D\uDD37' },
  { key: 'crewly_chat', label: 'Crewly', icon: '\uD83D\uDCAC' },
  { key: 'telegram', label: 'Telegram', icon: '\u2709\uFE0F' },
  { key: 'api', label: 'API', icon: '\uD83D\uDD0C' },
];

// =============================================================================
// Component
// =============================================================================

/**
 * Filter bar with channel type toggle chips.
 *
 * Shows count per channel type. Only renders chips that have at least
 * one conversation (except "All" which is always shown).
 *
 * @param props - Component props
 * @returns JSX element with filter bar
 */
export const ChannelFilterBar: React.FC<ChannelFilterBarProps> = ({
  activeFilter,
  onFilterChange,
  conversations,
}) => {
  /** Count conversations per channel type */
  const counts = new Map<ChatChannelType | null, number>();
  counts.set(null, conversations.length);

  for (const conv of conversations) {
    const ct = conv.channelType ?? 'crewly_chat';
    counts.set(ct, (counts.get(ct) ?? 0) + 1);
  }

  /** Only show chips with > 0 conversations (plus "All") */
  const visibleChips = FILTER_CHIPS.filter(
    (chip) => chip.key === null || (counts.get(chip.key) ?? 0) > 0
  );

  return (
    <div className="channel-filter-bar" data-testid="channel-filter-bar">
      {visibleChips.map((chip) => {
        const count = counts.get(chip.key) ?? 0;
        const isActive = activeFilter === chip.key;

        return (
          <button
            key={chip.key ?? 'all'}
            className={`filter-chip ${isActive ? 'active' : ''}`}
            onClick={() => onFilterChange(chip.key)}
            data-testid={`filter-chip-${chip.key ?? 'all'}`}
            aria-pressed={isActive}
          >
            {chip.icon && (
              <span className="filter-chip-icon" aria-hidden="true">
                {chip.icon}
              </span>
            )}
            <span className="filter-chip-label">{chip.label}</span>
            <span className="filter-chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ChannelFilterBar;
