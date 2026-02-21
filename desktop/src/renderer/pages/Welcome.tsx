/**
 * Welcome Page
 *
 * First step of the setup wizard. Displays the Crewly logo,
 * tagline, and a "Get Started" button.
 *
 * @module desktop/renderer/pages/Welcome
 */

import React from 'react';

interface WelcomeProps {
  /** Called when the user clicks "Get Started" */
  onNext: () => void;
}

/**
 * Welcome page with branding and call-to-action.
 *
 * @param props - Component props
 * @returns The rendered welcome page
 */
export function Welcome({ onNext }: WelcomeProps): React.ReactElement {
  return (
    <div style={styles.container}>
      <pre style={styles.ascii}>{`
   ____                    _
  / ___|_ __ _____      _| |_   _
 | |   | '__/ _ \\ \\ /\\ / / | | | |
 | |___| | |  __/\\ V  V /| | |_| |
  \\____|_|  \\___| \\_/\\_/ |_|\\__, |
                              |___/
      `}</pre>
      <h2 style={styles.tagline}>Orchestrate AI Development Teams</h2>
      <p style={styles.description}>
        Set up Crewly in a few simple steps. We'll install the tools you need
        and configure agent skills for your team.
      </p>
      <button style={styles.button} onClick={onNext}>
        Get Started
      </button>
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
  ascii: {
    color: '#06b6d4',
    fontSize: '14px',
    lineHeight: 1.2,
    fontFamily: 'monospace',
  },
  tagline: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginTop: '1rem',
    color: '#f1f5f9',
  },
  description: {
    fontSize: '1rem',
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: '480px',
    marginTop: '0.75rem',
    lineHeight: 1.6,
  },
  button: {
    marginTop: '2rem',
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
    backgroundColor: '#06b6d4',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
