# Task: Create Frontend Settings Page

## Overview

Create the Settings page in the React frontend with tab navigation for General, Roles, and Skills sections. This page serves as the central hub for configuring AgentMux behavior.

## Priority

**Sprint 1** - Foundation (Settings + Roles)

## Dependencies

- `26-settings-controllers.md` - Backend API endpoints must be available

## Files to Create

### 1. `frontend/src/pages/Settings.tsx`

Main settings page with tab navigation.

```typescript
import React, { useState } from 'react';
import { GeneralTab } from '../components/Settings/GeneralTab.js';
import { RolesTab } from '../components/Settings/RolesTab.js';
import { SkillsTab } from '../components/Settings/SkillsTab.js';
import './Settings.css';

type SettingsTab = 'general' | 'roles' | 'skills';

/**
 * Settings page with tabbed navigation for managing AgentMux configuration
 */
export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'roles', label: 'Roles', icon: '👤' },
    { id: 'skills', label: 'Skills', icon: '🛠️' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab />;
      case 'roles':
        return <RolesTab />;
      case 'skills':
        return <SkillsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1>Settings</h1>
        <p>Configure AgentMux behavior and manage roles and skills</p>
      </header>

      <nav className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="settings-content" role="tabpanel">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default Settings;
```

### 2. `frontend/src/pages/Settings.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Settings } from './Settings.js';

// Mock the tab components
vi.mock('../components/Settings/GeneralTab.js', () => ({
  GeneralTab: () => <div data-testid="general-tab">General Tab</div>,
}));

vi.mock('../components/Settings/RolesTab.js', () => ({
  RolesTab: () => <div data-testid="roles-tab">Roles Tab</div>,
}));

vi.mock('../components/Settings/SkillsTab.js', () => ({
  SkillsTab: () => <div data-testid="skills-tab">Skills Tab</div>,
}));

describe('Settings', () => {
  it('renders settings page with header', () => {
    render(<Settings />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText(/Configure AgentMux/)).toBeInTheDocument();
  });

  it('shows all tab buttons', () => {
    render(<Settings />);

    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('shows General tab by default', () => {
    render(<Settings />);

    expect(screen.getByTestId('general-tab')).toBeInTheDocument();
  });

  it('switches to Roles tab when clicked', () => {
    render(<Settings />);

    fireEvent.click(screen.getByText('Roles'));

    expect(screen.getByTestId('roles-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('general-tab')).not.toBeInTheDocument();
  });

  it('switches to Skills tab when clicked', () => {
    render(<Settings />);

    fireEvent.click(screen.getByText('Skills'));

    expect(screen.getByTestId('skills-tab')).toBeInTheDocument();
  });

  it('marks active tab with active class', () => {
    render(<Settings />);

    const generalButton = screen.getByText('General').closest('button');
    expect(generalButton).toHaveClass('active');

    fireEvent.click(screen.getByText('Roles'));

    const rolesButton = screen.getByText('Roles').closest('button');
    expect(rolesButton).toHaveClass('active');
    expect(generalButton).not.toHaveClass('active');
  });
});
```

### 3. `frontend/src/components/Settings/GeneralTab.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings.js';
import { AgentMuxSettings, AIRuntime } from '../../types/settings.types.js';
import './GeneralTab.css';

/**
 * General settings tab for configuring application-wide options
 */
export const GeneralTab: React.FC = () => {
  const { settings, updateSettings, resetSection, isLoading, error } = useSettings();
  const [localSettings, setLocalSettings] = useState<AgentMuxSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleChange = <K extends keyof AgentMuxSettings>(
    section: K,
    field: keyof AgentMuxSettings[K],
    value: any
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
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleReset = async () => {
    if (confirm('Reset all general and chat settings to defaults?')) {
      await resetSection('general');
      await resetSection('chat');
      setHasChanges(false);
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
            <option value="claude-code">Claude Code</option>
            <option value="gemini-cli">Gemini CLI</option>
            <option value="codex-cli">Codex CLI</option>
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
            onChange={(e) => handleChange('general', 'checkInIntervalMinutes', parseInt(e.target.value))}
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
            onChange={(e) => handleChange('general', 'maxConcurrentAgents', parseInt(e.target.value))}
          />
          <p className="setting-description">
            Maximum number of agents that can run simultaneously
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
            onChange={(e) => handleChange('chat', 'maxMessageHistory', parseInt(e.target.value))}
          />
          <p className="setting-description">
            Maximum number of messages to keep in chat history
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
```

### 4. `frontend/src/components/Settings/GeneralTab.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeneralTab } from './GeneralTab.js';
import * as useSettingsHook from '../../hooks/useSettings.js';

describe('GeneralTab', () => {
  const mockSettings = {
    general: {
      defaultRuntime: 'claude-code',
      autoStartOrchestrator: false,
      checkInIntervalMinutes: 5,
      maxConcurrentAgents: 10,
      verboseLogging: false,
    },
    chat: {
      showRawTerminalOutput: false,
      enableTypingIndicator: true,
      maxMessageHistory: 1000,
      autoScrollToBottom: true,
      showTimestamps: true,
    },
    skills: {
      skillsDirectory: '',
      enableBrowserAutomation: true,
      enableScriptExecution: true,
      skillExecutionTimeoutMs: 60000,
    },
  };

  const mockUpdateSettings = vi.fn();
  const mockResetSection = vi.fn();

  beforeEach(() => {
    vi.spyOn(useSettingsHook, 'useSettings').mockReturnValue({
      settings: mockSettings,
      updateSettings: mockUpdateSettings,
      resetSection: mockResetSection,
      isLoading: false,
      error: null,
    });
  });

  it('renders runtime settings section', () => {
    render(<GeneralTab />);

    expect(screen.getByText('Runtime Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Default AI Runtime')).toBeInTheDocument();
  });

  it('renders chat settings section', () => {
    render(<GeneralTab />);

    expect(screen.getByText('Chat Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Show Raw Terminal Output')).toBeInTheDocument();
  });

  it('updates local state on input change', () => {
    render(<GeneralTab />);

    const checkbox = screen.getByLabelText('Auto-Start Orchestrator');
    fireEvent.click(checkbox);

    expect(checkbox).toBeChecked();
  });

  it('calls updateSettings on save', async () => {
    render(<GeneralTab />);

    // Make a change
    fireEvent.click(screen.getByLabelText('Auto-Start Orchestrator'));

    // Click save
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });

  it('shows loading state', () => {
    vi.spyOn(useSettingsHook, 'useSettings').mockReturnValue({
      settings: null,
      updateSettings: mockUpdateSettings,
      resetSection: mockResetSection,
      isLoading: true,
      error: null,
    });

    render(<GeneralTab />);

    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    vi.spyOn(useSettingsHook, 'useSettings').mockReturnValue({
      settings: null,
      updateSettings: mockUpdateSettings,
      resetSection: mockResetSection,
      isLoading: false,
      error: 'Failed to load',
    });

    render(<GeneralTab />);

    expect(screen.getByText(/Error loading settings/)).toBeInTheDocument();
  });
});
```

### 5. `frontend/src/components/Settings/RolesTab.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useRoles } from '../../hooks/useRoles.js';
import { RoleSummary, Role } from '../../types/role.types.js';
import { RoleEditor } from './RoleEditor.js';
import './RolesTab.css';

/**
 * Roles management tab for viewing and editing agent roles
 */
export const RolesTab: React.FC = () => {
  const { roles, isLoading, error, createRole, updateRole, deleteRole } = useRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const filteredRoles = roles?.filter((role) =>
    role.displayName.toLowerCase().includes(filter.toLowerCase()) ||
    role.description.toLowerCase().includes(filter.toLowerCase())
  ) ?? [];

  const groupedRoles = filteredRoles.reduce((acc, role) => {
    const category = role.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(role);
    return acc;
  }, {} as Record<string, RoleSummary[]>);

  const handleCreateNew = () => {
    setSelectedRoleId(null);
    setIsCreating(true);
    setIsEditorOpen(true);
  };

  const handleEdit = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsCreating(false);
    setIsEditorOpen(true);
  };

  const handleDelete = async (roleId: string, isBuiltin: boolean) => {
    if (isBuiltin) {
      alert('Built-in roles cannot be deleted');
      return;
    }

    if (confirm('Are you sure you want to delete this role?')) {
      await deleteRole(roleId);
    }
  };

  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedRoleId(null);
    setIsCreating(false);
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      development: '💻 Development',
      management: '📋 Management',
      quality: '✅ Quality',
      design: '🎨 Design',
      sales: '💼 Sales',
      support: '🎧 Support',
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return <div className="loading">Loading roles...</div>;
  }

  if (error) {
    return <div className="error">Error loading roles: {error}</div>;
  }

  return (
    <div className="roles-tab">
      <div className="roles-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search roles..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={handleCreateNew}>
          + Create Role
        </button>
      </div>

      <div className="roles-list">
        {Object.entries(groupedRoles).map(([category, categoryRoles]) => (
          <div key={category} className="role-category">
            <h3>{getCategoryLabel(category)}</h3>
            <div className="role-cards">
              {categoryRoles.map((role) => (
                <div
                  key={role.id}
                  className={`role-card ${role.isBuiltin ? 'builtin' : 'custom'}`}
                >
                  <div className="role-card-header">
                    <h4>{role.displayName}</h4>
                    {role.isDefault && <span className="default-badge">Default</span>}
                    {role.isBuiltin && <span className="builtin-badge">Built-in</span>}
                  </div>
                  <p className="role-description">{role.description}</p>
                  <div className="role-meta">
                    <span>{role.skillCount} skills assigned</span>
                  </div>
                  <div className="role-actions">
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => handleEdit(role.id)}
                    >
                      {role.isBuiltin ? 'View' : 'Edit'}
                    </button>
                    {!role.isBuiltin && (
                      <button
                        className="btn-danger btn-small"
                        onClick={() => handleDelete(role.id, role.isBuiltin)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredRoles.length === 0 && (
          <div className="empty-state">
            <p>No roles found matching your search.</p>
          </div>
        )}
      </div>

      {isEditorOpen && (
        <RoleEditor
          roleId={isCreating ? null : selectedRoleId}
          onClose={handleEditorClose}
          onSave={isCreating ? createRole : updateRole}
        />
      )}
    </div>
  );
};
```

### 6. `frontend/src/components/Settings/RolesTab.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RolesTab } from './RolesTab.js';
import * as useRolesHook from '../../hooks/useRoles.js';

describe('RolesTab', () => {
  const mockRoles = [
    {
      id: 'developer',
      name: 'developer',
      displayName: 'Developer',
      description: 'Software developer role',
      category: 'development',
      skillCount: 3,
      isDefault: true,
      isBuiltin: true,
    },
    {
      id: 'custom-role',
      name: 'custom-role',
      displayName: 'Custom Role',
      description: 'A custom role',
      category: 'development',
      skillCount: 1,
      isDefault: false,
      isBuiltin: false,
    },
  ];

  beforeEach(() => {
    vi.spyOn(useRolesHook, 'useRoles').mockReturnValue({
      roles: mockRoles,
      isLoading: false,
      error: null,
      createRole: vi.fn(),
      updateRole: vi.fn(),
      deleteRole: vi.fn(),
      refreshRoles: vi.fn(),
    });
  });

  it('renders role cards', () => {
    render(<RolesTab />);

    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Custom Role')).toBeInTheDocument();
  });

  it('filters roles by search', () => {
    render(<RolesTab />);

    const searchInput = screen.getByPlaceholder('Search roles...');
    fireEvent.change(searchInput, { target: { value: 'Developer' } });

    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.queryByText('Custom Role')).not.toBeInTheDocument();
  });

  it('shows Create Role button', () => {
    render(<RolesTab />);

    expect(screen.getByText('+ Create Role')).toBeInTheDocument();
  });

  it('shows default badge for default role', () => {
    render(<RolesTab />);

    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('shows builtin badge for builtin roles', () => {
    render(<RolesTab />);

    expect(screen.getByText('Built-in')).toBeInTheDocument();
  });

  it('shows View button for builtin roles', () => {
    render(<RolesTab />);

    const viewButtons = screen.getAllByText('View');
    expect(viewButtons.length).toBeGreaterThan(0);
  });

  it('shows Edit button for custom roles', () => {
    render(<RolesTab />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons.length).toBeGreaterThan(0);
  });
});
```

### 7. `frontend/src/components/Settings/RoleEditor.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useRole } from '../../hooks/useRole.js';
import { useSkills } from '../../hooks/useSkills.js';
import { CreateRoleInput, UpdateRoleInput, RoleCategory } from '../../types/role.types.js';
import './RoleEditor.css';

interface RoleEditorProps {
  roleId: string | null;
  onClose: () => void;
  onSave: (input: CreateRoleInput | UpdateRoleInput) => Promise<void>;
}

/**
 * Modal dialog for creating or editing roles
 */
export const RoleEditor: React.FC<RoleEditorProps> = ({
  roleId,
  onClose,
  onSave,
}) => {
  const { role, isLoading } = useRole(roleId);
  const { skills } = useSkills();

  const [formData, setFormData] = useState<{
    name: string;
    displayName: string;
    description: string;
    category: RoleCategory;
    systemPromptContent: string;
    assignedSkills: string[];
    isDefault: boolean;
  }>({
    name: '',
    displayName: '',
    description: '',
    category: 'development',
    systemPromptContent: '',
    assignedSkills: [],
    isDefault: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreating = roleId === null;
  const isBuiltin = role?.isBuiltin ?? false;
  const isReadOnly = isBuiltin && !isCreating;

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        category: role.category,
        systemPromptContent: role.systemPromptContent || '',
        assignedSkills: role.assignedSkills,
        isDefault: role.isDefault,
      });
    }
  }, [role]);

  const handleChange = (
    field: keyof typeof formData,
    value: string | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSkillToggle = (skillId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedSkills: prev.assignedSkills.includes(skillId)
        ? prev.assignedSkills.filter((id) => id !== skillId)
        : [...prev.assignedSkills, skillId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && roleId) {
    return (
      <div className="role-editor-overlay">
        <div className="role-editor-modal">
          <p>Loading role...</p>
        </div>
      </div>
    );
  }

  const categories: { value: RoleCategory; label: string }[] = [
    { value: 'development', label: 'Development' },
    { value: 'management', label: 'Management' },
    { value: 'quality', label: 'Quality' },
    { value: 'design', label: 'Design' },
    { value: 'sales', label: 'Sales' },
    { value: 'support', label: 'Support' },
  ];

  return (
    <div className="role-editor-overlay" onClick={onClose}>
      <div className="role-editor-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>
            {isCreating ? 'Create Role' : isReadOnly ? 'View Role' : 'Edit Role'}
          </h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Basic Information</h3>

            <div className="form-row">
              <label htmlFor="displayName">Display Name *</label>
              <input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                disabled={isReadOnly}
                required
              />
            </div>

            {isCreating && (
              <div className="form-row">
                <label htmlFor="name">Internal Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  pattern="[a-z0-9-]+"
                  required
                />
                <p className="hint">Lowercase letters, numbers, and hyphens only</p>
              </div>
            )}

            <div className="form-row">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isReadOnly}
                rows={2}
              />
            </div>

            <div className="form-row">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as RoleCategory)}
                disabled={isReadOnly}
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row checkbox-row">
              <input
                id="isDefault"
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => handleChange('isDefault', e.target.checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="isDefault">Set as default role</label>
            </div>
          </div>

          <div className="form-section">
            <h3>System Prompt</h3>
            <div className="form-row">
              <textarea
                id="systemPrompt"
                value={formData.systemPromptContent}
                onChange={(e) => handleChange('systemPromptContent', e.target.value)}
                disabled={isReadOnly}
                rows={10}
                placeholder="# Role Name\n\nYou are a..."
                className="prompt-editor"
              />
              <p className="hint">Markdown supported. This prompt defines the agent's behavior.</p>
            </div>
          </div>

          <div className="form-section">
            <h3>Assigned Skills</h3>
            <div className="skills-grid">
              {skills?.map((skill) => (
                <label key={skill.id} className="skill-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.assignedSkills.includes(skill.id)}
                    onChange={() => handleSkillToggle(skill.id)}
                    disabled={isReadOnly}
                  />
                  <span className="skill-name">{skill.name}</span>
                </label>
              ))}
              {(!skills || skills.length === 0) && (
                <p className="empty-skills">No skills available. Create skills in the Skills tab.</p>
              )}
            </div>
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : isCreating ? 'Create Role' : 'Save Changes'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
};
```

### 8. `frontend/src/components/Settings/RoleEditor.test.tsx`

Create tests for the RoleEditor component.

### 9. `frontend/src/components/Settings/SkillsTab.tsx`

Placeholder for Sprint 2 - Shows skills list and management (similar pattern to RolesTab).

## Additional Files Needed

### Hooks

- `frontend/src/hooks/useSettings.ts` - Hook for settings API
- `frontend/src/hooks/useRoles.ts` - Hook for roles API
- `frontend/src/hooks/useRole.ts` - Hook for single role with prompt
- `frontend/src/hooks/useSkills.ts` - Hook for skills API (Sprint 2)

### Services

- `frontend/src/services/settings.service.ts` - API client for settings
- `frontend/src/services/roles.service.ts` - API client for roles

### Styles

- `frontend/src/pages/Settings.css`
- `frontend/src/components/Settings/GeneralTab.css`
- `frontend/src/components/Settings/RolesTab.css`
- `frontend/src/components/Settings/RoleEditor.css`

## Acceptance Criteria

- [ ] Settings page renders with three tabs
- [ ] Tab switching works correctly
- [ ] General tab shows and saves runtime/chat settings
- [ ] Roles tab shows all roles grouped by category
- [ ] Role search/filter works
- [ ] Role creation modal works
- [ ] Role editing modal works
- [ ] Built-in roles are view-only
- [ ] Skill assignment in role editor works
- [ ] All components have comprehensive tests
- [ ] Responsive design for mobile/tablet

## Testing Requirements

1. Unit tests for all components
2. Integration tests for form submissions
3. Mock API calls in tests
4. Test loading and error states
5. Test accessibility (keyboard navigation, ARIA)

## Notes

- Use existing UI component patterns from the codebase
- Follow existing CSS/styling conventions
- Add Settings link to main navigation
- Consider using React Query or SWR for data fetching
- Debounce search input for better performance
