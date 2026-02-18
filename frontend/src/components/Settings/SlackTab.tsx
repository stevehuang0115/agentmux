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
import { AlertTriangle, CheckCircle, RefreshCw, Unlink, ExternalLink, X } from 'lucide-react';
import { Button } from '../UI/Button';
import { FormInput, FormLabel } from '../UI/Form';

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
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-text-secondary-dark">Loading Slack status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Slack Integration</h2>
        <p className="text-sm text-text-secondary-dark mt-1">
          Connect Slack to communicate with the orchestrator from your phone or desktop Slack app.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {status.connected ? (
        /* Connected State */
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-medium">Connected to Slack</span>
          </div>

          {/* Connection Details */}
          <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
            <h3 className="text-sm font-semibold text-text-secondary-dark uppercase tracking-wide mb-4">
              Connection Details
            </h3>
            <div className="space-y-3">
              {status.workspaceName && (
                <div className="flex items-center justify-between py-2 border-b border-border-dark">
                  <span className="text-sm text-text-secondary-dark">Workspace</span>
                  <span className="text-sm font-medium">{status.workspaceName}</span>
                </div>
              )}
              {status.botName && (
                <div className="flex items-center justify-between py-2 border-b border-border-dark">
                  <span className="text-sm text-text-secondary-dark">Bot Name</span>
                  <span className="text-sm font-medium">{status.botName}</span>
                </div>
              )}
              {status.channels && status.channels.length > 0 && (
                <div className="flex items-center justify-between py-2 border-b border-border-dark">
                  <span className="text-sm text-text-secondary-dark">Channels</span>
                  <span className="text-sm font-medium">{status.channels.join(', ')}</span>
                </div>
              )}
              {status.messagesSent !== undefined && (
                <div className="flex items-center justify-between py-2 border-b border-border-dark">
                  <span className="text-sm text-text-secondary-dark">Messages Sent</span>
                  <span className="text-sm font-medium">{status.messagesSent}</span>
                </div>
              )}
              {status.messagesReceived !== undefined && (
                <div className="flex items-center justify-between py-2 border-b border-border-dark">
                  <span className="text-sm text-text-secondary-dark">Messages Received</span>
                  <span className="text-sm font-medium">{status.messagesReceived}</span>
                </div>
              )}
              {status.lastMessageAt && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-text-secondary-dark">Last Activity</span>
                  <span className="text-sm font-medium">
                    {new Date(status.lastMessageAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchStatus} icon={RefreshCw}>
              Refresh Status
            </Button>
            <Button variant="danger" onClick={handleDisconnect} icon={Unlink}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        /* Setup State */
        <div className="space-y-6">
          {/* Warning Status */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-medium">Not connected to Slack</span>
          </div>

          {/* Setup Instructions */}
          <div className="bg-surface-dark border border-border-dark rounded-lg p-6">
            <h3 className="text-sm font-semibold text-text-secondary-dark uppercase tracking-wide mb-4">
              Setup Instructions
            </h3>
            <ol className="list-decimal list-inside space-y-3 text-sm text-text-secondary-dark">
              <li>
                Create a Slack App at{' '}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  api.slack.com/apps
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Enable Socket Mode in your app settings and create an App Token (starts with xapp-)</li>
              <li>
                Add Bot Token Scopes under OAuth & Permissions:
                <ul className="list-disc list-inside ml-4 mt-1.5 space-y-1">
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">chat:write</code> - Send messages</li>
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">channels:read</code> - View channels</li>
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">app_mentions:read</code> - Respond to mentions</li>
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">im:read</code>, <code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">im:write</code> - Direct messages</li>
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">files:read</code> - Receive images from Slack</li>
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">files:write</code> - Upload images to Slack</li>
                  <li><code className="text-xs bg-background-dark px-1.5 py-0.5 rounded">reactions:write</code> - Typing/completion indicators (optional)</li>
                </ul>
                <p className="text-xs text-amber-400/80 mt-1.5 ml-4">
                  Note: Adding <code className="text-xs bg-background-dark px-1 py-0.5 rounded">files:read</code> and <code className="text-xs bg-background-dark px-1 py-0.5 rounded">files:write</code> scopes requires reinstalling the app to your workspace.
                </p>
              </li>
              <li>Install the app to your workspace</li>
              <li>Copy the Bot Token (xoxb-...), App Token (xapp-...), and Signing Secret</li>
            </ol>
          </div>

          {/* Connection Form */}
          <form onSubmit={handleConnect} className="bg-surface-dark border border-border-dark rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary-dark uppercase tracking-wide mb-4">
              Connect to Slack
            </h3>

            <div>
              <FormLabel htmlFor="botToken" required>Bot Token (xoxb-...)</FormLabel>
              <FormInput
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

            <div>
              <FormLabel htmlFor="appToken" required>App Token (xapp-...)</FormLabel>
              <FormInput
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

            <div>
              <FormLabel htmlFor="signingSecret" required>Signing Secret</FormLabel>
              <FormInput
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

            <div>
              <FormLabel htmlFor="defaultChannel">Default Channel (optional)</FormLabel>
              <FormInput
                id="defaultChannel"
                name="defaultChannel"
                type="text"
                value={formData.defaultChannel}
                onChange={handleInputChange}
                placeholder="C1234567890 or #crewly"
              />
              <p className="text-xs text-text-secondary-dark mt-1">
                Channel ID or name where notifications will be sent by default
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={configuring || !formData.botToken || !formData.appToken || !formData.signingSecret}
                loading={configuring}
                fullWidth
              >
                {configuring ? 'Connecting...' : 'Connect to Slack'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SlackTab;
