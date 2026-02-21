/**
 * Installing Page
 *
 * Third step of the setup wizard. Runs through the installation of
 * Node.js, Crewly, the selected AI tool(s), and agent skills,
 * showing progress checkmarks along the way.
 *
 * @module desktop/renderer/pages/Installing
 */

import React, { useEffect, useState } from 'react';
import type { Provider } from '../App';
import { StepIndicator, type StepStatus } from '../components/StepIndicator';
import { ProgressBar } from '../components/ProgressBar';

declare global {
  interface Window {
    crewly: {
      checkNode: () => Promise<{ installed: boolean; version?: string }>;
      checkCrewly: () => Promise<{ installed: boolean; version?: string }>;
      installCrewly: () => Promise<{ success: boolean; error?: string }>;
      checkTool: (tool: string) => Promise<{ installed: boolean; version?: string }>;
      installTool: (npmPackage: string) => Promise<{ success: boolean; error?: string }>;
      installSkills: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

interface InstallingProps {
  /** The selected AI provider */
  provider: Provider;
  /** Called when all installations complete */
  onComplete: () => void;
}

/** An install step tracked by the UI */
interface InstallStep {
  label: string;
  status: StepStatus;
  detail?: string;
}

/**
 * Renders the installation progress page.
 *
 * Sequentially checks and installs each dependency, updating the UI
 * as each step completes.
 *
 * @param props - Component props
 * @returns The rendered installing page
 */
export function Installing({ provider, onComplete }: InstallingProps): React.ReactElement {
  const [steps, setSteps] = useState<InstallStep[]>([
    { label: 'Node.js', status: 'pending' },
    { label: 'Crewly CLI', status: 'pending' },
    { label: 'AI Tools', status: 'pending' },
    { label: 'Agent Skills', status: 'pending' },
  ]);

  const [progress, setProgress] = useState(0);

  /**
   * Updates a step by index with new values.
   */
  function updateStep(index: number, update: Partial<InstallStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const api = window.crewly;

      // Step 0: Node.js
      updateStep(0, { status: 'running' });
      const node = await api.checkNode();
      if (node.installed) {
        updateStep(0, { status: 'done', detail: `v${node.version}` });
      } else {
        updateStep(0, { status: 'error', detail: 'Not found — install from nodejs.org' });
      }
      if (cancelled) return;
      setProgress(25);

      // Step 1: Crewly CLI
      updateStep(1, { status: 'running' });
      const crewly = await api.checkCrewly();
      if (crewly.installed) {
        updateStep(1, { status: 'done', detail: `v${crewly.version}` });
      } else {
        const result = await api.installCrewly();
        updateStep(1, result.success
          ? { status: 'done', detail: 'Installed' }
          : { status: 'error', detail: result.error || 'Failed' });
      }
      if (cancelled) return;
      setProgress(50);

      // Step 2: AI Tools
      updateStep(2, { status: 'running' });
      if (provider === 'skip') {
        updateStep(2, { status: 'done', detail: 'Skipped' });
      } else {
        const tools: Array<{ command: string; pkg: string }> = [];
        if (provider === 'claude' || provider === 'both') {
          tools.push({ command: 'claude', pkg: '@anthropic-ai/claude-code' });
        }
        if (provider === 'gemini' || provider === 'both') {
          tools.push({ command: 'gemini', pkg: '@anthropic-ai/gemini-cli' });
        }

        for (const tool of tools) {
          const check = await api.checkTool(tool.command);
          if (!check.installed) {
            await api.installTool(tool.pkg);
          }
        }
        updateStep(2, { status: 'done' });
      }
      if (cancelled) return;
      setProgress(75);

      // Step 3: Agent Skills
      updateStep(3, { status: 'running' });
      const skillResult = await api.installSkills();
      updateStep(3, skillResult.success
        ? { status: 'done', detail: 'All skills installed' }
        : { status: 'error', detail: skillResult.error || 'Failed' });
      setProgress(100);

      // Auto-advance after a brief delay
      if (!cancelled) {
        setTimeout(onComplete, 1500);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [provider, onComplete]);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Setting Up Crewly</h2>
      <div style={styles.steps}>
        {steps.map((step, i) => (
          <StepIndicator key={i} label={step.label} status={step.status} detail={step.detail} />
        ))}
      </div>
      <ProgressBar value={progress} />
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
    marginBottom: '2rem',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: '400px',
    marginBottom: '2rem',
  },
};
