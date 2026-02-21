/**
 * Complete Page
 *
 * Final step of the setup wizard. Shows a success message and
 * an "Open Dashboard" button that opens the Crewly web UI.
 *
 * @module desktop/renderer/pages/Complete
 */

import React from 'react';

/**
 * Renders the setup-complete success page.
 *
 * @returns The rendered complete page
 */
export function Complete(): React.ReactElement {
  /**
   * Opens the Crewly dashboard in the default browser.
   */
  function openDashboard() {
    window.open('http://localhost:8788', '_blank');
  }

  return (
    <div style={styles.container}>
      <div style={styles.checkmark}>&#10003;</div>
      <h2 style={styles.title}>Setup Complete!</h2>
      <p style={styles.description}>
        Crewly is ready to go. Open the dashboard to create your first team,
        or minimise this window to keep Crewly running in the system tray.
      </p>
      <button style={styles.button} onClick={openDashboard}>
        Open Dashboard
      </button>
      <p style={styles.hint}>
        You can also run <code style={styles.code}>crewly start</code> from any project directory.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '2rem',
  },
  checkmark: {
    fontSize: '4rem',
    color: '#22c55e',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  description: {
    fontSize: '1rem',
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: '440px',
    marginTop: '0.75rem',
    lineHeight: 1.6,
  },
  button: {
    marginTop: '2rem',
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
    backgroundColor: '#22c55e',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '0.85rem',
    color: '#64748b',
    marginTop: '1.5rem',
  },
  code: {
    backgroundColor: '#1e293b',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
  },
};
