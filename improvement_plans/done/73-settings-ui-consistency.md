# Task 73: Refactor Settings Page for UI Consistency

## Priority: High

## Problem

The Settings page has inconsistent styling compared to the rest of the application:
- Tab buttons have light styling (white active background)
- Role/Skill cards use light backgrounds
- Form elements don't match the dark theme
- Buttons don't use the standard Button component

### Current Issues
1. **Settings.css**: Uses undefined CSS variables or wrong fallbacks
2. **RolesTab**: Uses custom light-styled cards
3. **SkillsTab**: Uses custom light-styled cards
4. **GeneralTab**: Uses custom form styling
5. **SlackTab**: Uses light alert styling

## Solution

Refactor Settings page and tabs to use atomic UI components with consistent dark theming.

## Implementation

### 1. Refactor Settings Page

**Update:** `frontend/src/pages/Settings.tsx`

```typescript
import React, { useState } from 'react';
import { Tabs, TabList, TabTrigger, TabContent } from '../components/UI/Tabs';
import { GeneralTab } from '../components/Settings/GeneralTab';
import { RolesTab } from '../components/Settings/RolesTab';
import { SkillsTab } from '../components/Settings/SkillsTab';
import { SlackTab } from '../components/Settings/SlackTab';
import { Settings as SettingsIcon, User, Wrench, MessageSquare } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary-dark">Settings</h1>
        <p className="text-sm text-text-secondary-dark mt-1">
          Configure Crewly behavior and manage roles and skills
        </p>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabList>
          <TabTrigger value="general" icon={<SettingsIcon className="w-4 h-4" />}>
            General
          </TabTrigger>
          <TabTrigger value="roles" icon={<User className="w-4 h-4" />}>
            Roles
          </TabTrigger>
          <TabTrigger value="skills" icon={<Wrench className="w-4 h-4" />}>
            Skills
          </TabTrigger>
          <TabTrigger value="slack" icon={<MessageSquare className="w-4 h-4" />}>
            Slack
          </TabTrigger>
        </TabList>

        <TabContent value="general">
          <GeneralTab />
        </TabContent>
        <TabContent value="roles">
          <RolesTab />
        </TabContent>
        <TabContent value="skills">
          <SkillsTab />
        </TabContent>
        <TabContent value="slack">
          <SlackTab />
        </TabContent>
      </Tabs>
    </div>
  );
};

export default Settings;
```

### 2. Refactor RolesTab

**Update:** `frontend/src/components/Settings/RolesTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useRoles } from '../../hooks/useRoles';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Badge } from '../UI/Badge';
import { Plus, Search, Eye, Edit, Trash2 } from 'lucide-react';
import type { Role } from '../../types/role.types';

export const RolesTab: React.FC = () => {
  const { roles, loading, error, deleteRole, refreshRoles } = useRoles();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group roles by category
  const groupedRoles = filteredRoles.reduce((acc, role) => {
    const category = role.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    development: { label: 'Development', icon: '💻' },
    management: { label: 'Management', icon: '📋' },
    design: { label: 'Design', icon: '🎨' },
    quality: { label: 'Quality', icon: '✅' },
    sales: { label: 'Sales', icon: '💼' },
    support: { label: 'Support', icon: '🎧' },
    other: { label: 'Other', icon: '📁' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="ml-3 text-text-secondary-dark">Loading roles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <Button onClick={refreshRoles}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search roles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
          />
        </div>
        <Button variant="primary" icon={Plus}>
          Create Role
        </Button>
      </div>

      {/* Roles by Category */}
      {Object.entries(groupedRoles).map(([category, categoryRoles]) => (
        <div key={category}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-secondary-dark mb-3">
            <span>{categoryLabels[category]?.icon || '📁'}</span>
            {categoryLabels[category]?.label || category}
          </h3>

          <div className="space-y-3">
            {categoryRoles.map((role) => (
              <Card
                key={role.id}
                variant="default"
                padding="lg"
                className="flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-text-primary-dark">
                      {role.displayName || role.name}
                    </h4>
                    {role.isDefault && (
                      <Badge variant="primary" size="sm">Default</Badge>
                    )}
                    {role.isBuiltin && (
                      <Badge variant="default" size="sm">Built-in</Badge>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary-dark">
                    {role.description}
                  </p>
                  <p className="text-xs text-text-secondary-dark/70 mt-2">
                    {role.assignedSkills?.length || 0} skills assigned
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Eye}
                    onClick={() => setSelectedRole(role)}
                  >
                    View
                  </Button>
                  {!role.isBuiltin && (
                    <>
                      <Button variant="ghost" size="icon" icon={Edit} aria-label="Edit role" />
                      <Button
                        variant="ghost"
                        size="icon"
                        icon={Trash2}
                        className="text-red-400 hover:text-red-300"
                        aria-label="Delete role"
                        onClick={() => deleteRole(role.id)}
                      />
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filteredRoles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-secondary-dark">
            {searchQuery ? 'No roles match your search' : 'No roles configured yet'}
          </p>
        </div>
      )}
    </div>
  );
};
```

### 3. Refactor SkillsTab

**Update:** `frontend/src/components/Settings/SkillsTab.tsx`

```typescript
import React, { useState } from 'react';
import { useSkills } from '../../hooks/useSkills';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Badge } from '../UI/Badge';
import { Plus, Search, Eye, Play, Settings } from 'lucide-react';

export const SkillsTab: React.FC = () => {
  const { skills, loading, error, refreshSkills } = useSkills();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSkills = skills.filter((skill) =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group skills by category
  const groupedSkills = filteredSkills.reduce((acc, skill) => {
    const category = skill.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>);

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    development: { label: 'Development', icon: '💻' },
    design: { label: 'Design', icon: '🎨' },
    communication: { label: 'Communication', icon: '💬' },
    integration: { label: 'Integration', icon: '🔗' },
    automation: { label: 'Automation', icon: '⚙️' },
    other: { label: 'Other', icon: '📁' },
  };

  const getExecutionTypeBadge = (skill: typeof skills[0]) => {
    if (!skill.execution) return null;
    const typeMap: Record<string, { label: string; variant: 'info' | 'success' | 'warning' }> = {
      script: { label: 'Script', variant: 'info' },
      browser: { label: 'Browser', variant: 'warning' },
      'mcp-tool': { label: 'MCP Tool', variant: 'success' },
    };
    const config = typeMap[skill.execution.type];
    return config ? <Badge variant={config.variant} size="sm">{config.label}</Badge> : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="ml-3 text-text-secondary-dark">Loading skills...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Error: {error}</p>
        <Button onClick={refreshSkills}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
          />
        </div>
        <Button variant="primary" icon={Plus}>
          Create Skill
        </Button>
      </div>

      {/* Skills by Category */}
      {Object.entries(groupedSkills).map(([category, categorySkills]) => (
        <div key={category}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-secondary-dark mb-3">
            <span>{categoryLabels[category]?.icon || '📁'}</span>
            {categoryLabels[category]?.label || category}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorySkills.map((skill) => (
              <Card key={skill.id} variant="default" padding="lg" interactive>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-text-primary-dark">{skill.name}</h4>
                  <div className="flex items-center gap-2">
                    {getExecutionTypeBadge(skill)}
                    {skill.isBuiltin && (
                      <Badge variant="default" size="sm">Built-in</Badge>
                    )}
                  </div>
                </div>

                <p className="text-sm text-text-secondary-dark mb-4">
                  {skill.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {skill.tags?.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="default" size="sm">{tag}</Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" icon={Eye} aria-label="View skill" />
                    {skill.execution && (
                      <Button variant="ghost" size="icon" icon={Play} aria-label="Test skill" />
                    )}
                    <Button variant="ghost" size="icon" icon={Settings} aria-label="Configure skill" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filteredSkills.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-secondary-dark">
            {searchQuery ? 'No skills match your search' : 'No skills configured yet'}
          </p>
        </div>
      )}
    </div>
  );
};
```

### 4. Refactor SlackTab

**Update:** `frontend/src/components/Settings/SlackTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Alert } from '../UI/Alert';
import { Badge } from '../UI/Badge';
import { useSettings } from '../../hooks/useSettings';
import { ExternalLink, RefreshCw, Check, X } from 'lucide-react';

export const SlackTab: React.FC = () => {
  const { settings, updateSettings, loading, error } = useSettings();
  const [botToken, setBotToken] = useState('');
  const [appToken, setAppToken] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = async () => {
    // Implementation for connecting to Slack
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card variant="default" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary-dark">
            Slack Integration
          </h3>
          <Badge
            variant={isConnected ? 'success' : 'warning'}
            size="md"
          >
            {isConnected ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>

        <p className="text-text-secondary-dark mb-6">
          Connect Slack to communicate with the orchestrator from your phone or desktop Slack app.
        </p>

        {!isConnected && (
          <Alert variant="warning" className="mb-6">
            Not connected to Slack. Configure your Slack app credentials below to enable mobile access.
          </Alert>
        )}

        {/* Setup Instructions */}
        <Card variant="outlined" padding="md" className="mb-6">
          <h4 className="font-medium text-text-primary-dark mb-3">Setup Instructions</h4>
          <ol className="space-y-2 text-sm text-text-secondary-dark">
            <li className="flex gap-2">
              <span className="text-text-primary-dark">1.</span>
              Create a Slack App at{' '}
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                api.slack.com/apps <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li className="flex gap-2">
              <span className="text-text-primary-dark">2.</span>
              Enable Socket Mode in your app settings and create an App Token (starts with xapp-)
            </li>
            <li className="flex gap-2">
              <span className="text-text-primary-dark">3.</span>
              Add Bot Token Scopes under OAuth & Permissions:
            </li>
          </ol>
          <div className="mt-2 ml-6 flex flex-wrap gap-2">
            <Badge variant="info" size="sm">chat:write</Badge>
            <Badge variant="info" size="sm">channels:read</Badge>
            <Badge variant="info" size="sm">app_mentions:read</Badge>
            <Badge variant="info" size="sm">im:read</Badge>
            <Badge variant="info" size="sm">im:write</Badge>
          </div>
          <ol className="space-y-2 text-sm text-text-secondary-dark mt-3" start={4}>
            <li className="flex gap-2">
              <span className="text-text-primary-dark">4.</span>
              Install the app to your workspace
            </li>
            <li className="flex gap-2">
              <span className="text-text-primary-dark">5.</span>
              Copy the Bot Token (xoxb-...), App Token (xapp-...), and Signing Secret
            </li>
          </ol>
        </Card>

        {/* Credentials Form */}
        <div className="space-y-4">
          <Input
            label="Bot Token (xoxb-...)"
            type="password"
            placeholder="xoxb-your-bot-token"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            fullWidth
          />

          <Input
            label="App Token (xapp-...)"
            type="password"
            placeholder="xapp-your-app-token"
            value={appToken}
            onChange={(e) => setAppToken(e.target.value)}
            fullWidth
          />

          <Input
            label="Signing Secret"
            type="password"
            placeholder="Your signing secret"
            value={signingSecret}
            onChange={(e) => setSigningSecret(e.target.value)}
            fullWidth
          />

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              icon={isConnected ? RefreshCw : Check}
              onClick={handleConnect}
              loading={loading}
            >
              {isConnected ? 'Reconnect' : 'Connect to Slack'}
            </Button>

            {isConnected && (
              <Button variant="outline" icon={X}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
```

### 5. Delete Old CSS

After migration, the Settings.css file can be significantly reduced or removed.

## Dependencies

- Task 71 (Atomic UI Component System) - Requires Tabs, Card, Input, Badge, Alert components

## Files to Modify

1. `frontend/src/pages/Settings.tsx` - Use Tabs component
2. `frontend/src/components/Settings/RolesTab.tsx` - Use Card, Button, Badge, Input
3. `frontend/src/components/Settings/SkillsTab.tsx` - Use Card, Button, Badge, Input
4. `frontend/src/components/Settings/GeneralTab.tsx` - Use Card, Input, Button
5. `frontend/src/components/Settings/SlackTab.tsx` - Use Card, Input, Button, Alert, Badge

## Files to Modify/Remove

1. `frontend/src/pages/Settings.css` - Remove or minimize

## Testing Requirements

1. Settings page matches dark theme
2. Tabs work correctly with proper styling
3. Roles list displays with dark cards
4. Skills grid displays with dark cards
5. Slack tab has proper alert and form styling
6. All buttons use consistent Button component
7. All inputs use consistent Input component

## Acceptance Criteria

- [ ] Settings page uses Tabs component
- [ ] Tab triggers have dark theme styling
- [ ] Role cards use Card component with dark theme
- [ ] Skill cards use Card component with dark theme
- [ ] Badges use Badge component consistently
- [ ] Alerts use Alert component with dark theme
- [ ] Form inputs use Input component
- [ ] Buttons use Button component
- [ ] No light backgrounds visible
- [ ] Old CSS minimized or removed
