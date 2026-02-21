/**
 * ProgressBar Component
 *
 * A simple horizontal progress bar that fills to indicate completion percentage.
 *
 * @module desktop/renderer/components/ProgressBar
 */

import React from 'react';

interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  value: number;
}

/**
 * Renders a horizontal progress bar.
 *
 * @param props - Component props
 * @returns The rendered progress bar
 */
export function ProgressBar({ value }: ProgressBarProps): React.ReactElement {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div style={styles.track}>
      <div
        style={{
          ...styles.fill,
          width: `${clampedValue}%`,
        }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    width: '100%',
    maxWidth: '400px',
    height: '6px',
    backgroundColor: '#1e293b',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#06b6d4',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
  },
};
