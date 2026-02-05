/**
 * GeneralTab Component
 *
 * General settings tab for configuring application-wide options.
 *
 * @module components/Settings/GeneralTab
 */

import React, { useEffect, useState } from 'react';
import { Save, RotateCcw, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { AgentMuxSettings, AIRuntime, AI_RUNTIME_DISPLAY_NAMES } from '../../types/settings.types';
import { Button } from '../UI/Button';
import { FormInput, FormLabel, FormSelect } from '../UI/Form';

/**
 * Save status states
 */
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * General settings tab for configuring application-wide options
 *
 * @returns GeneralTab component
 */
export const GeneralTab: React.FC = () => {
  const { settings, updateSettings, resetSection, isLoading, error } = useSettings();
  const [localSettings, setLocalSettings] = useState<AgentMuxSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  /**
   * Handle setting change
   */
  const handleChange = <K extends keyof AgentMuxSettings>(
    section: K,
    field: keyof AgentMuxSettings[K],
    value: AgentMuxSettings[K][keyof AgentMuxSettings[K]]
  ) => {
    if (!localSettings) return;

    setLocalSettings({
      ...localSettings,
      [section]: {
        ...localSettings[section],
        [field]: value,
      },
    });
    setHasChanges(true);
    setSaveStatus('idle');
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    if (!localSettings) return;

    setSaveStatus('saving');
    try {
      await updateSettings({
        general: localSettings.general,
        chat: localSettings.chat,
      });
      setSaveStatus('saved');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  /**
   * Handle reset
   */
  const handleReset = async () => {
    if (window.confirm('Reset all general and chat settings to defaults?')) {
      await resetSection('general');
      await resetSection('chat');
      setHasChanges(false);
      setSaveStatus('idle');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-text-secondary-dark">Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Error loading settings: {error}
      </div>
    );
  }

  if (!localSettings) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Runtime Settings Section */}
      <section className="bg-surface-dark border border-border-dark rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Runtime Settings</h2>

        <div className="space-y-5">
          <div>
            <FormLabel htmlFor="defaultRuntime">Default AI Runtime</FormLabel>
            <FormSelect
              id="defaultRuntime"
              value={localSettings.general.defaultRuntime}
              onChange={(e) => handleChange('general', 'defaultRuntime', e.target.value as AIRuntime)}
            >
              {(Object.keys(AI_RUNTIME_DISPLAY_NAMES) as AIRuntime[]).map((runtime) => (
                <option key={runtime} value={runtime}>
                  {AI_RUNTIME_DISPLAY_NAMES[runtime]}
                </option>
              ))}
            </FormSelect>
            <p className="text-xs text-text-secondary-dark mt-1">
              The default AI runtime to use for new agents
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="autoStart" className="text-sm font-medium text-text-primary-dark cursor-pointer">
                Auto-Start Orchestrator
              </label>
              <p className="text-xs text-text-secondary-dark mt-0.5">
                Automatically start the orchestrator when AgentMux launches
              </p>
            </div>
            <input
              type="checkbox"
              id="autoStart"
              checked={localSettings.general.autoStartOrchestrator}
              onChange={(e) => handleChange('general', 'autoStartOrchestrator', e.target.checked)}
              className="w-5 h-5 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
          </div>

          <div>
            <FormLabel htmlFor="checkInInterval">Check-in Interval (minutes)</FormLabel>
            <FormInput
              id="checkInInterval"
              type="number"
              min={1}
              max={60}
              value={localSettings.general.checkInIntervalMinutes}
              onChange={(e) => handleChange('general', 'checkInIntervalMinutes', parseInt(e.target.value) || 5)}
            />
            <p className="text-xs text-text-secondary-dark mt-1">
              How often agents should check in with the orchestrator
            </p>
          </div>

          <div>
            <FormLabel htmlFor="maxAgents">Max Concurrent Agents</FormLabel>
            <FormInput
              id="maxAgents"
              type="number"
              min={1}
              max={50}
              value={localSettings.general.maxConcurrentAgents}
              onChange={(e) => handleChange('general', 'maxConcurrentAgents', parseInt(e.target.value) || 10)}
            />
            <p className="text-xs text-text-secondary-dark mt-1">
              Maximum number of agents that can run simultaneously
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="verboseLogging" className="text-sm font-medium text-text-primary-dark cursor-pointer">
                Verbose Logging
              </label>
              <p className="text-xs text-text-secondary-dark mt-0.5">
                Enable detailed logging for debugging
              </p>
            </div>
            <input
              type="checkbox"
              id="verboseLogging"
              checked={localSettings.general.verboseLogging}
              onChange={(e) => handleChange('general', 'verboseLogging', e.target.checked)}
              className="w-5 h-5 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Claude Code Configuration Section */}
      <section className="bg-surface-dark border border-border-dark rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Claude Code Configuration</h2>
        <p className="text-sm text-text-secondary-dark mb-4">
          Configure how AgentMux initializes Claude Code agents.
        </p>

        <div className="space-y-5">
          <div>
            <FormLabel htmlFor="claudeCodeCommand">Startup Command</FormLabel>
            <FormInput
              id="claudeCodeCommand"
              type="text"
              value={localSettings.general.claudeCodeCommand}
              onChange={(e) => handleChange('general', 'claudeCodeCommand', e.target.value)}
            />
            <p className="text-xs text-text-secondary-dark mt-1">
              The command used to start Claude Code agents
            </p>
          </div>

          <div>
            <FormLabel htmlFor="claudeCodeInitScript">Initialization Script</FormLabel>
            <FormInput
              id="claudeCodeInitScript"
              type="text"
              value={localSettings.general.claudeCodeInitScript}
              onChange={(e) => handleChange('general', 'claudeCodeInitScript', e.target.value)}
            />
            <p className="text-xs text-text-secondary-dark mt-1">
              Path to the initialization script (relative to AgentMux root)
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-text-primary-dark">Detection Priority</label>
            <ol className="list-decimal list-inside text-sm text-text-secondary-dark mt-2 space-y-1.5">
              <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">~/.claude/local/claude</code> - Local installation (preferred)</li>
              <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">claude</code> - System PATH via <code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">type</code> command</li>
              <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">claude</code> - System PATH via <code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">command -v</code></li>
            </ol>
            <p className="text-xs text-text-secondary-dark mt-2">
              Claude Code must be installed on your system. Visit{' '}
              <a
                href="https://docs.anthropic.com/en/docs/claude-code/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Claude Code documentation
                <ExternalLink className="w-3 h-3" />
              </a>
              {' '}for installation instructions.
            </p>
          </div>
        </div>
      </section>

      {/* Chat Settings Section */}
      <section className="bg-surface-dark border border-border-dark rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Chat Settings</h2>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="showRawOutput" className="text-sm font-medium text-text-primary-dark cursor-pointer">
                Show Raw Terminal Output
              </label>
              <p className="text-xs text-text-secondary-dark mt-0.5">
                Display raw terminal output alongside formatted messages
              </p>
            </div>
            <input
              type="checkbox"
              id="showRawOutput"
              checked={localSettings.chat.showRawTerminalOutput}
              onChange={(e) => handleChange('chat', 'showRawTerminalOutput', e.target.checked)}
              className="w-5 h-5 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="typingIndicator" className="text-sm font-medium text-text-primary-dark cursor-pointer">
                Enable Typing Indicator
              </label>
              <p className="text-xs text-text-secondary-dark mt-0.5">
                Show typing animation when agents are processing
              </p>
            </div>
            <input
              type="checkbox"
              id="typingIndicator"
              checked={localSettings.chat.enableTypingIndicator}
              onChange={(e) => handleChange('chat', 'enableTypingIndicator', e.target.checked)}
              className="w-5 h-5 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
          </div>

          <div>
            <FormLabel htmlFor="maxHistory">Message History Limit</FormLabel>
            <FormInput
              id="maxHistory"
              type="number"
              min={10}
              max={10000}
              value={localSettings.chat.maxMessageHistory}
              onChange={(e) => handleChange('chat', 'maxMessageHistory', parseInt(e.target.value) || 1000)}
            />
            <p className="text-xs text-text-secondary-dark mt-1">
              Maximum number of messages to keep in chat history
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="autoScroll" className="text-sm font-medium text-text-primary-dark cursor-pointer">
                Auto-Scroll to Bottom
              </label>
              <p className="text-xs text-text-secondary-dark mt-0.5">
                Automatically scroll to new messages
              </p>
            </div>
            <input
              type="checkbox"
              id="autoScroll"
              checked={localSettings.chat.autoScrollToBottom}
              onChange={(e) => handleChange('chat', 'autoScrollToBottom', e.target.checked)}
              className="w-5 h-5 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label htmlFor="showTimestamps" className="text-sm font-medium text-text-primary-dark cursor-pointer">
                Show Timestamps
              </label>
              <p className="text-xs text-text-secondary-dark mt-0.5">
                Display timestamps on chat messages
              </p>
            </div>
            <input
              type="checkbox"
              id="showTimestamps"
              checked={localSettings.chat.showTimestamps}
              onChange={(e) => handleChange('chat', 'showTimestamps', e.target.checked)}
              className="w-5 h-5 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <Button variant="secondary" onClick={handleReset} icon={RotateCcw}>
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
          icon={saveStatus === 'saved' ? Check : Save}
        >
          {saveStatus === 'saving'
            ? 'Saving...'
            : saveStatus === 'saved'
            ? 'Saved!'
            : saveStatus === 'error'
            ? 'Error - Retry'
            : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};

export default GeneralTab;
