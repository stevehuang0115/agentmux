/**
 * Provider Select Page
 *
 * Second step of the setup wizard. Shows cards for each AI provider
 * option and lets the user pick one.
 *
 * @module desktop/renderer/pages/ProviderSelect
 */

import React from 'react';
import type { Provider } from '../App';

interface ProviderSelectProps {
  /** Called when the user selects a provider */
  onSelect: (provider: Provider) => void;
}

/** Card data for each provider option */
const PROVIDERS: Array<{ id: Provider; label: string; description: string }> = [
  { id: 'claude', label: 'Claude Code', description: 'Anthropic\'s AI coding assistant' },
  { id: 'gemini', label: 'Gemini CLI', description: 'Google\'s AI coding assistant' },
  { id: 'both', label: 'Both', description: 'Install Claude Code and Gemini CLI' },
  { id: 'skip', label: 'Skip', description: 'I\'ll set up tools myself later' },
];

/**
 * Provider selection page with option cards.
 *
 * @param props - Component props
 * @returns The rendered provider selection page
 */
export function ProviderSelect({ onSelect }: ProviderSelectProps): React.ReactElement {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Choose Your AI Provider</h2>
      <p style={styles.subtitle}>Which AI coding assistant do you use?</p>
      <div style={styles.grid}>
        {PROVIDERS.map((p) => (
          <button key={p.id} style={styles.card} onClick={() => onSelect(p.id)}>
            <span style={styles.cardLabel}>{p.label}</span>
            <span style={styles.cardDesc}>{p.description}</span>
          </button>
        ))}
      </div>
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
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#94a3b8',
    marginTop: '0.5rem',
    marginBottom: '2rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    maxWidth: '500px',
    width: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.5rem 1rem',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    color: '#e2e8f0',
    fontSize: '1rem',
  },
  cardLabel: {
    fontWeight: 600,
    fontSize: '1.1rem',
    marginBottom: '0.25rem',
  },
  cardDesc: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    textAlign: 'center',
  },
};
