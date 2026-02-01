/**
 * SlackTab Component
 *
 * Slack integration configuration in Settings.
 * Allows users to connect their Slack workspace for mobile communication
 * with the orchestrator.
 *
 * @module components/Settings/SlackTab
 */

import React, { useState, useEffect, useCallback } from 'react';
import './SlackTab.css';

/**
 * Slack connection status from the API
 */
interface SlackStatus {
  connected: boolean;
  workspaceName?: string;
  botName?: string;
  channels?: string[];
  error?: string;
  lastMessageAt?: string;
  messagesSent?: number;
  messagesReceived?: number;
}

/**
 * Form state for Slack configuration
 */
interface SlackConfigForm {
  botToken: string;
  appToken: string;
  signingSecret: string;
  defaultChannel: string;
}

/**
 * SlackTab component for managing Slack integration
 *
 * @returns SlackTab component
 */
export const SlackTab: React.FC = () => {
  const [status, setStatus] = useState<SlackStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Config form state
  const [formData, setFormData] = useState<SlackConfigForm>({
    botToken: '',
    appToken: '',
    signingSecret: '',
    defaultChannel: '',
  });

  /**
   * Fetch current Slack connection status
   */
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/slack/status');
      const data = await res.json();

      if (data.success) {
        setStatus({
          connected: data.data?.isConfigured || false,
          workspaceName: data.data?.workspaceName,
          botName: data.data?.botName,
          channels: data.data?.channels,
          lastMessageAt: data.data?.lastMessageAt,
          messagesSent: data.data?.messagesSent,
          messagesReceived: data.data?.messagesReceived,
        });
      } else {
        setStatus({ connected: false, error: data.error });
      }
    } catch (err) {
      setStatus({ connected: false, error: 'Failed to fetch status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /**
   * Handle form input changes
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Connect to Slack with provided credentials
   */
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfiguring(true);
    setError(null);

    try {
      const res = await fetch('/api/slack/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: formData.botToken,
          appToken: formData.appToken,
          signingSecret: formData.signingSecret,
          defaultChannelId: formData.defaultChannel || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Connection failed');
      }

      // Clear sensitive data from form
      setFormData({
        botToken: '',
        appToken: '',
        signingSecret: '',
        defaultChannel: '',
      });

      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Slack');
    } finally {
      setConfiguring(false);
    }
  };

  /**
   * Disconnect from Slack
   */
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect from Slack?')) {
      return;
    }

    try {
      setError(null);
      const res = await fetch('/api/slack/disconnect', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Disconnect failed');
      }

      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  if (loading) {
    return (
      <div className="slack-tab loading">
        <div className="loading-spinner" />
        <p>Loading Slack status...</p>
      </div>
    );
  }

  return (
    <div className="slack-tab">
      <div className="slack-header">
        <h2>Slack Integration</h2>
        <p>Connect Slack to communicate with the orchestrator from your phone or desktop Slack app.</p>
      </div>

      {error && (
        <div className="slack-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button className="btn-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {status.connected ? (
        <div className="slack-connected">
          <div className="connection-status success">
            <span className="status-icon">✅</span>
            <span>Connected to Slack</span>
          </div>

          <div className="slack-details">
            {status.workspaceName && (
              <div className="detail-row">
                <label>Workspace:</label>
                <span>{status.workspaceName}</span>
              </div>
            )}
            {status.botName && (
              <div className="detail-row">
                <label>Bot Name:</label>
                <span>{status.botName}</span>
              </div>
            )}
            {status.channels && status.channels.length > 0 && (
              <div className="detail-row">
                <label>Channels:</label>
                <span>{status.channels.join(', ')}</span>
              </div>
            )}
            {status.messagesSent !== undefined && (
              <div className="detail-row">
                <label>Messages Sent:</label>
                <span>{status.messagesSent}</span>
              </div>
            )}
            {status.messagesReceived !== undefined && (
              <div className="detail-row">
                <label>Messages Received:</label>
                <span>{status.messagesReceived}</span>
              </div>
            )}
            {status.lastMessageAt && (
              <div className="detail-row">
                <label>Last Activity:</label>
                <span>{new Date(status.lastMessageAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="slack-actions">
            <button className="btn-secondary" onClick={fetchStatus}>
              Refresh Status
            </button>
            <button className="btn-danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="slack-setup">
          <div className="connection-status warning">
            <span className="status-icon">⚠️</span>
            <span>Not connected to Slack</span>
          </div>

          <div className="setup-instructions">
            <h3>Setup Instructions</h3>
            <ol>
              <li>
                Create a Slack App at{' '}
                <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">
                  api.slack.com/apps
                </a>
              </li>
              <li>Enable Socket Mode in your app settings and create an App Token (starts with xapp-)</li>
              <li>
                Add Bot Token Scopes under OAuth & Permissions:
                <ul>
                  <li><code>chat:write</code> - Send messages</li>
                  <li><code>channels:read</code> - View channels</li>
                  <li><code>app_mentions:read</code> - Respond to mentions</li>
                  <li><code>im:read</code>, <code>im:write</code> - Direct messages</li>
                </ul>
              </li>
              <li>Install the app to your workspace</li>
              <li>Copy the Bot Token (xoxb-...), App Token (xapp-...), and Signing Secret</li>
            </ol>
          </div>

          <form className="slack-form" onSubmit={handleConnect}>
            <div className="form-group">
              <label htmlFor="botToken">Bot Token (xoxb-...)</label>
              <input
                id="botToken"
                name="botToken"
                type="password"
                value={formData.botToken}
                onChange={handleInputChange}
                placeholder="xoxb-your-bot-token"
                required
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="appToken">App Token (xapp-...)</label>
              <input
                id="appToken"
                name="appToken"
                type="password"
                value={formData.appToken}
                onChange={handleInputChange}
                placeholder="xapp-your-app-token"
                required
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="signingSecret">Signing Secret</label>
              <input
                id="signingSecret"
                name="signingSecret"
                type="password"
                value={formData.signingSecret}
                onChange={handleInputChange}
                placeholder="Your signing secret"
                required
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="defaultChannel">Default Channel (optional)</label>
              <input
                id="defaultChannel"
                name="defaultChannel"
                type="text"
                value={formData.defaultChannel}
                onChange={handleInputChange}
                placeholder="C1234567890 or #agentmux"
              />
              <span className="form-hint">
                Channel ID or name where notifications will be sent by default
              </span>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={configuring || !formData.botToken || !formData.appToken || !formData.signingSecret}
            >
              {configuring ? 'Connecting...' : 'Connect to Slack'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SlackTab;
