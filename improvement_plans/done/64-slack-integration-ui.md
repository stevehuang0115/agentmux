# Task 64: Slack Integration UI

## Overview

Add Slack integration UI to allow users to connect their Slack workspace for mobile communication with the orchestrator.

## Problem

- **Current state**: "Mobile Access" button shows a QR code for accessing web UI on local network
- **User expectation**: Slack integration to communicate with orchestrator from phone
- **Gap**: No UI for Slack configuration, connection status, or channel selection

## Implementation

### 1. Add Slack Tab to Settings

**`frontend/src/components/Settings/SlackTab.tsx`**

```typescript
/**
 * SlackTab Component
 *
 * Slack integration configuration in Settings.
 */

import React, { useState, useEffect } from 'react';
import './SlackTab.css';

interface SlackStatus {
  connected: boolean;
  workspaceName?: string;
  botName?: string;
  channels?: string[];
  error?: string;
}

export const SlackTab: React.FC = () => {
  const [status, setStatus] = useState<SlackStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState(false);

  // Config form state
  const [botToken, setBotToken] = useState('');
  const [appToken, setAppToken] = useState('');
  const [defaultChannel, setDefaultChannel] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/slack/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setStatus({ connected: false, error: 'Failed to fetch status' });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConfiguring(true);
    try {
      const res = await fetch('/api/slack/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken, appToken, defaultChannel }),
      });

      if (!res.ok) throw new Error('Connection failed');

      await fetchStatus();
      setBotToken('');
      setAppToken('');
    } catch (err) {
      alert('Failed to connect to Slack');
    } finally {
      setConfiguring(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from Slack?')) return;

    try {
      await fetch('/api/slack/disconnect', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      alert('Failed to disconnect');
    }
  };

  if (loading) {
    return <div className="slack-tab loading">Loading Slack status...</div>;
  }

  return (
    <div className="slack-tab">
      <div className="slack-header">
        <h2>Slack Integration</h2>
        <p>Connect Slack to communicate with the orchestrator from your phone.</p>
      </div>

      {status.connected ? (
        <div className="slack-connected">
          <div className="connection-status success">
            <span className="status-icon">✅</span>
            <span>Connected to Slack</span>
          </div>

          <div className="slack-details">
            <div className="detail-row">
              <label>Workspace:</label>
              <span>{status.workspaceName}</span>
            </div>
            <div className="detail-row">
              <label>Bot Name:</label>
              <span>{status.botName}</span>
            </div>
            <div className="detail-row">
              <label>Channels:</label>
              <span>{status.channels?.join(', ') || 'None'}</span>
            </div>
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
              <li>Create a Slack App at <a href="https://api.slack.com/apps" target="_blank">api.slack.com/apps</a></li>
              <li>Enable Socket Mode and get an App Token (xapp-...)</li>
              <li>Add Bot Token Scopes: chat:write, channels:read, app_mentions:read</li>
              <li>Install the app to your workspace</li>
              <li>Copy the Bot Token (xoxb-...) and App Token below</li>
            </ol>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleConnect(); }}>
            <div className="form-group">
              <label>Bot Token (xoxb-...)</label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="xoxb-your-bot-token"
                required
              />
            </div>

            <div className="form-group">
              <label>App Token (xapp-...)</label>
              <input
                type="password"
                value={appToken}
                onChange={(e) => setAppToken(e.target.value)}
                placeholder="xapp-your-app-token"
                required
              />
            </div>

            <div className="form-group">
              <label>Default Channel (optional)</label>
              <input
                type="text"
                value={defaultChannel}
                onChange={(e) => setDefaultChannel(e.target.value)}
                placeholder="#agentmux"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={configuring || !botToken || !appToken}
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
```

### 2. Update Settings Page

Add Slack tab to Settings navigation:

```typescript
// frontend/src/pages/Settings.tsx
import { SlackTab } from '../components/Settings/SlackTab.js';

// Add to tabs array
const tabs = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'roles', label: 'Roles', icon: '👤' },
  { id: 'skills', label: 'Skills', icon: '🔧' },
  { id: 'slack', label: 'Slack', icon: '💬' },  // NEW
];

// Add to tab content
{activeTab === 'slack' && <SlackTab />}
```

### 3. Add Sidebar Slack Status Indicator

```typescript
// In Sidebar component, add Slack connection indicator
<div className="slack-status">
  {slackConnected ? (
    <span className="status-indicator connected">Slack ✓</span>
  ) : (
    <span className="status-indicator disconnected">Slack ✗</span>
  )}
</div>
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/Settings/SlackTab.tsx` | Create |
| `frontend/src/components/Settings/SlackTab.css` | Create |
| `frontend/src/components/Settings/SlackTab.test.tsx` | Create |
| `frontend/src/pages/Settings.tsx` | Add Slack tab |
| `frontend/src/components/Layout/Sidebar.tsx` | Add status indicator |

## Backend API Requirements

Ensure these endpoints exist (from Task 46):

- `GET /api/slack/status` - Connection status
- `POST /api/slack/connect` - Connect with tokens
- `POST /api/slack/disconnect` - Disconnect
- `GET /api/slack/channels` - List available channels

## Acceptance Criteria

- [ ] Slack tab appears in Settings
- [ ] Setup instructions are clear
- [ ] Token input fields work
- [ ] Connect button initiates connection
- [ ] Connection status shows in Settings
- [ ] Disconnect button works
- [ ] Sidebar shows Slack status indicator
- [ ] Error handling for failed connections

## Dependencies

- Task 44: Slack Service
- Task 46: Slack Controller

## Priority

**High** - Required for user's Goal #1 (mobile communication via Slack)
