/**
 * StepIndicator Component
 *
 * Displays a single installation step with a status icon
 * (pending, running spinner, done checkmark, or error X).
 *
 * @module desktop/renderer/components/StepIndicator
 */

import React from 'react';

/** Possible statuses for a wizard step */
export type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface StepIndicatorProps {
  /** Display label for the step */
  label: string;
  /** Current status */
  status: StepStatus;
  /** Optional detail text (e.g. version or error message) */
  detail?: string;
}

/** Maps step status to a display icon */
const STATUS_ICONS: Record<StepStatus, string> = {
  pending: '\u25CB', // ○
  running: '\u25D0', // ◐
  done: '\u2713',    // ✓
  error: '\u2717',   // ✗
};

/** Maps step status to a color */
const STATUS_COLORS: Record<StepStatus, string> = {
  pending: '#64748b',
  running: '#06b6d4',
  done: '#22c55e',
  error: '#ef4444',
};

/**
 * Renders a single step with icon, label, and optional detail.
 *
 * @param props - Component props
 * @returns The rendered step indicator
 */
export function StepIndicator({ label, status, detail }: StepIndicatorProps): React.ReactElement {
  return (
    <div style={styles.row}>
      <span style={{ ...styles.icon, color: STATUS_COLORS[status] }}>
        {STATUS_ICONS[status]}
      </span>
      <span style={styles.label}>{label}</span>
      {detail && <span style={styles.detail}>{detail}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0',
  },
  icon: {
    fontSize: '1.25rem',
    width: '1.5rem',
    textAlign: 'center',
  },
  label: {
    fontSize: '1rem',
    color: '#e2e8f0',
    fontWeight: 500,
  },
  detail: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginLeft: 'auto',
  },
};
