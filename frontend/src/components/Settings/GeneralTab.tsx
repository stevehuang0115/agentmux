/**
 * GeneralTab Component
 *
 * General settings tab for configuring application-wide options.
 *
 * @module components/Settings/GeneralTab
 */

import React, { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';
import { AgentMuxSettings, AIRuntime, AI_RUNTIME_DISPLAY_NAMES } from '../../types/settings.types';
import './GeneralTab.css';

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
    return <div className="loading">Loading settings...</div>;
  }

  if (error) {
    return <div className="error">Error loading settings: {error}</div>;
  }

  if (!localSettings) {
    return null;
  }

  return (
    <div className="general-tab">
      <section className="settings-section">
        <h2>Runtime Settings</h2>

        <div className="setting-row">
          <label htmlFor="defaultRuntime">Default AI Runtime</label>
          <select
            id="defaultRuntime"
            value={localSettings.general.defaultRuntime}
            onChange={(e) => handleChange('general', 'defaultRuntime', e.target.value as AIRuntime)}
          >
            {(Object.keys(AI_RUNTIME_DISPLAY_NAMES) as AIRuntime[]).map((runtime) => (
              <option key={runtime} value={runtime}>
                {AI_RUNTIME_DISPLAY_NAMES[runtime]}
              </option>
            ))}
          </select>
          <p className="setting-description">
            The default AI runtime to use for new agents
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="autoStart">Auto-Start Orchestrator</label>
          <input
            type="checkbox"
            id="autoStart"
            checked={localSettings.general.autoStartOrchestrator}
            onChange={(e) => handleChange('general', 'autoStartOrchestrator', e.target.checked)}
          />
          <p className="setting-description">
            Automatically start the orchestrator when AgentMux launches
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="checkInInterval">Check-in Interval (minutes)</label>
          <input
            type="number"
            id="checkInInterval"
            min="1"
            max="60"
            value={localSettings.general.checkInIntervalMinutes}
            onChange={(e) => handleChange('general', 'checkInIntervalMinutes', parseInt(e.target.value) || 5)}
          />
          <p className="setting-description">
            How often agents should check in with the orchestrator
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="maxAgents">Max Concurrent Agents</label>
          <input
            type="number"
            id="maxAgents"
            min="1"
            max="50"
            value={localSettings.general.maxConcurrentAgents}
            onChange={(e) => handleChange('general', 'maxConcurrentAgents', parseInt(e.target.value) || 10)}
          />
          <p className="setting-description">
            Maximum number of agents that can run simultaneously
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="verboseLogging">Verbose Logging</label>
          <input
            type="checkbox"
            id="verboseLogging"
            checked={localSettings.general.verboseLogging}
            onChange={(e) => handleChange('general', 'verboseLogging', e.target.checked)}
          />
          <p className="setting-description">
            Enable detailed logging for debugging
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2>Chat Settings</h2>

        <div className="setting-row">
          <label htmlFor="showRawOutput">Show Raw Terminal Output</label>
          <input
            type="checkbox"
            id="showRawOutput"
            checked={localSettings.chat.showRawTerminalOutput}
            onChange={(e) => handleChange('chat', 'showRawTerminalOutput', e.target.checked)}
          />
          <p className="setting-description">
            Display raw terminal output alongside formatted messages
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="typingIndicator">Enable Typing Indicator</label>
          <input
            type="checkbox"
            id="typingIndicator"
            checked={localSettings.chat.enableTypingIndicator}
            onChange={(e) => handleChange('chat', 'enableTypingIndicator', e.target.checked)}
          />
          <p className="setting-description">
            Show typing animation when agents are processing
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="maxHistory">Message History Limit</label>
          <input
            type="number"
            id="maxHistory"
            min="10"
            max="10000"
            value={localSettings.chat.maxMessageHistory}
            onChange={(e) => handleChange('chat', 'maxMessageHistory', parseInt(e.target.value) || 1000)}
          />
          <p className="setting-description">
            Maximum number of messages to keep in chat history
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="autoScroll">Auto-Scroll to Bottom</label>
          <input
            type="checkbox"
            id="autoScroll"
            checked={localSettings.chat.autoScrollToBottom}
            onChange={(e) => handleChange('chat', 'autoScrollToBottom', e.target.checked)}
          />
          <p className="setting-description">
            Automatically scroll to new messages
          </p>
        </div>

        <div className="setting-row">
          <label htmlFor="showTimestamps">Show Timestamps</label>
          <input
            type="checkbox"
            id="showTimestamps"
            checked={localSettings.chat.showTimestamps}
            onChange={(e) => handleChange('chat', 'showTimestamps', e.target.checked)}
          />
          <p className="setting-description">
            Display timestamps on chat messages
          </p>
        </div>
      </section>

      <div className="settings-actions">
        <button
          className="btn-secondary"
          onClick={handleReset}
        >
          Reset to Defaults
        </button>
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' :
           saveStatus === 'saved' ? 'Saved!' :
           saveStatus === 'error' ? 'Error - Retry' :
           'Save Changes'}
        </button>
      </div>
    </div>
  );
};

export default GeneralTab;
