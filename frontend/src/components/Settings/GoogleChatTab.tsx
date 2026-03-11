/**
 * GoogleChatTab Component
 *
 * Google Chat integration configuration panel.
 * Supports three connection modes:
 * 1. Webhook mode (simpler) — paste an incoming webhook URL (send-only)
 * 2. Service account mode — paste a service account JSON key (send-only)
 * 3. Pub/Sub mode — bidirectional: pull messages from Pub/Sub, reply via Chat API
 *
 * @module components/Settings/GoogleChatTab
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Unlink, X } from 'lucide-react';
import { Button } from '../UI/Button';
import { FormInput, FormLabel } from '../UI/Form';

// =============================================================================
// Types
// =============================================================================

/**
 * Google Chat connection status from the messenger API
 */
interface GoogleChatStatus {
  connected: boolean;
  mode?: string;
  pullActive?: boolean;
  pullPaused?: boolean;
  subscriptionName?: string;
  projectId?: string;
  error?: string;
}

/**
 * Connection mode for Google Chat
 */
type ConnectionMode = 'webhook' | 'service-account' | 'pubsub';

// =============================================================================
// Component
// =============================================================================

/**
 * GoogleChatTab component for managing Google Chat integration
 *
 * @returns GoogleChatTab component
 */
export const GoogleChatTab: React.FC = () => {
  const [status, setStatus] = useState<GoogleChatStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('pubsub');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [subscriptionName, setSubscriptionName] = useState('');

  /**
   * Fetch Google Chat connection status via the messenger API
   */
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/messengers/status');
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const gchat = data.data.find(
          (p: { platform: string }) => p.platform === 'google-chat'
        );
        if (gchat) {
          setStatus({
            connected: gchat.connected,
            mode: gchat.details?.mode,
            pullActive: gchat.details?.pullActive,
            pullPaused: gchat.details?.pullPaused,
            subscriptionName: gchat.details?.subscriptionName,
            projectId: gchat.details?.projectId,
          });
        }
      }
    } catch {
      setStatus({ connected: false, error: 'Failed to fetch status' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /**
   * Connect to Google Chat with provided credentials
   */
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError(null);

    try {
      let body: Record<string, string>;

      if (connectionMode === 'webhook') {
        body = { webhookUrl };
      } else if (connectionMode === 'service-account') {
        body = { serviceAccountKey };
      } else {
        // pubsub mode
        body = { serviceAccountKey, projectId, subscriptionName };
      }

      const res = await fetch('/api/messengers/google-chat/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Connection failed');
      }

      // Clear sensitive data
      setWebhookUrl('');
      setServiceAccountKey('');
      setProjectId('');
      setSubscriptionName('');
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  /**
   * Disconnect from Google Chat
   */
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect from Google Chat?')) {
      return;
    }

    try {
      setError(null);
      const res = await fetch('/api/messengers/google-chat/disconnect', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Disconnect failed');
      }

      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  /**
   * Get human-readable mode label
   */
  const getModeLabel = (mode?: string): string => {
    switch (mode) {
      case 'webhook': return 'Webhook';
      case 'service-account': return 'Service Account';
      case 'pubsub': return 'Pub/Sub (Bidirectional)';
      default: return 'Unknown';
    }
  };

  /**
   * Check if form is valid for the current mode
   */
  const isFormValid = (): boolean => {
    if (connectionMode === 'webhook') return Boolean(webhookUrl);
    if (connectionMode === 'service-account') return Boolean(serviceAccountKey);
    return Boolean(serviceAccountKey && projectId && subscriptionName);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
        <p className="text-sm text-text-secondary-dark">Loading Google Chat status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {status.connected ? (
        /* Connected State */
        <div className="space-y-5">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-medium text-sm">Connected to Google Chat</span>
          </div>

          <div className="bg-background-dark border border-border-dark rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-secondary-dark uppercase tracking-wide mb-3">
              Connection Details
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-text-secondary-dark">Mode</span>
                <span className="text-sm font-medium">{getModeLabel(status.mode)}</span>
              </div>
              {status.mode === 'pubsub' && (
                <>
                  <div className="flex items-center justify-between py-2 border-t border-border-dark">
                    <span className="text-sm text-text-secondary-dark">Project ID</span>
                    <span className="text-sm font-mono">{status.projectId}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-border-dark">
                    <span className="text-sm text-text-secondary-dark">Pull Status</span>
                    <span className={`text-sm font-medium ${status.pullPaused ? 'text-amber-400' : status.pullActive ? 'text-emerald-400' : 'text-text-secondary-dark'}`}>
                      {status.pullPaused ? 'Paused (errors)' : status.pullActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

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
        <div className="space-y-5">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 font-medium text-sm">Not connected to Google Chat</span>
          </div>

          {/* Connection Mode Toggle */}
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                connectionMode === 'pubsub'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark'
              }`}
              onClick={() => setConnectionMode('pubsub')}
              data-testid="mode-pubsub"
            >
              Pub/Sub (Recommended)
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                connectionMode === 'webhook'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark'
              }`}
              onClick={() => setConnectionMode('webhook')}
              data-testid="mode-webhook"
            >
              Webhook
            </button>
            <button
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                connectionMode === 'service-account'
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface-dark border-border-dark text-text-secondary-dark hover:text-text-primary-dark'
              }`}
              onClick={() => setConnectionMode('service-account')}
              data-testid="mode-service-account"
            >
              Service Account
            </button>
          </div>

          {/* Setup Instructions */}
          <div className="bg-background-dark border border-border-dark rounded-lg p-5">
            <h3 className="text-xs font-semibold text-text-secondary-dark uppercase tracking-wide mb-3">
              {connectionMode === 'pubsub' ? 'Pub/Sub Setup (Bidirectional)' :
               connectionMode === 'webhook' ? 'Webhook Setup (Send-only)' :
               'Service Account Setup (Send-only)'}
            </h3>
            {connectionMode === 'pubsub' ? (
              <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary-dark">
                <li>Go to <strong>Google Cloud Console</strong> &gt; <strong>APIs & Services</strong></li>
                <li>Enable the <strong>Google Chat API</strong> and <strong>Cloud Pub/Sub API</strong></li>
                <li>Create a <strong>Service Account</strong> and download the JSON key</li>
                <li>In the Chat API settings, create a <strong>Chat App</strong> and select <strong>Cloud Pub/Sub</strong> as the connection type</li>
                <li>Enter a <strong>Pub/Sub topic name</strong> (e.g., <code className="bg-surface-dark px-1 rounded">projects/my-project/topics/google-chat-events</code>)</li>
                <li>Create a <strong>Pub/Sub subscription</strong> for that topic (pull mode)</li>
                <li>Grant the service account <strong>Pub/Sub Subscriber</strong> role on the subscription</li>
                <li>Fill in the details below</li>
              </ol>
            ) : connectionMode === 'webhook' ? (
              <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary-dark">
                <li>Open your Google Chat space</li>
                <li>Click the space name &gt; <strong>Apps & integrations</strong> &gt; <strong>Manage webhooks</strong></li>
                <li>Create a new webhook and copy the URL</li>
                <li>Paste the webhook URL below</li>
              </ol>
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-sm text-text-secondary-dark">
                <li>Go to the <strong>Google Cloud Console</strong> &gt; <strong>APIs & Services</strong></li>
                <li>Enable the <strong>Google Chat API</strong></li>
                <li>Create a <strong>Service Account</strong> and download the JSON key</li>
                <li>Grant the service account access to your Chat space</li>
                <li>Paste the JSON key contents below</li>
              </ol>
            )}
          </div>

          {/* Connection Form */}
          <form onSubmit={handleConnect} className="space-y-4">
            {connectionMode === 'webhook' ? (
              <div>
                <FormLabel htmlFor="gchat-webhook" required>Webhook URL</FormLabel>
                <FormInput
                  id="gchat-webhook"
                  name="webhookUrl"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://chat.googleapis.com/v1/spaces/..."
                  required
                  autoComplete="off"
                />
              </div>
            ) : (
              <>
                {connectionMode === 'pubsub' && (
                  <>
                    <div>
                      <FormLabel htmlFor="gchat-project-id" required>GCP Project ID</FormLabel>
                      <FormInput
                        id="gchat-project-id"
                        name="projectId"
                        type="text"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        placeholder="my-gcp-project-id"
                        required
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <FormLabel htmlFor="gchat-subscription" required>Pub/Sub Subscription Name</FormLabel>
                      <FormInput
                        id="gchat-subscription"
                        name="subscriptionName"
                        type="text"
                        value={subscriptionName}
                        onChange={(e) => setSubscriptionName(e.target.value)}
                        placeholder="google-chat-events-sub"
                        required
                        autoComplete="off"
                      />
                      <p className="mt-1 text-xs text-text-secondary-dark/70">
                        Just the subscription name, not the full resource path
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <FormLabel htmlFor="gchat-sa-key" required>Service Account Key (JSON)</FormLabel>
                  <textarea
                    id="gchat-sa-key"
                    name="serviceAccountKey"
                    value={serviceAccountKey}
                    onChange={(e) => setServiceAccountKey(e.target.value)}
                    placeholder='{"type": "service_account", "project_id": "...", ...}'
                    required
                    rows={6}
                    className="w-full px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-sm text-text-primary-dark placeholder:text-text-secondary-dark/50 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={connecting || !isFormValid()}
              loading={connecting}
              fullWidth
            >
              {connecting ? 'Connecting...' : 'Connect Google Chat'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};

export default GoogleChatTab;
