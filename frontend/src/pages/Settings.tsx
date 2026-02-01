/**
 * Settings Page
 *
 * Main settings page with tab navigation for General, Roles, and Skills sections.
 *
 * @module pages/Settings
 */

import React, { useState } from 'react';
import { GeneralTab } from '../components/Settings/GeneralTab';
import { RolesTab } from '../components/Settings/RolesTab';
import { SkillsTab } from '../components/Settings/SkillsTab';
import { SlackTab } from '../components/Settings/SlackTab';
import './Settings.css';

/**
 * Available settings tabs
 */
type SettingsTab = 'general' | 'roles' | 'skills' | 'slack';

/**
 * Tab configuration
 */
interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: string;
}

/**
 * Settings page with tabbed navigation for managing AgentMux configuration
 *
 * @returns Settings page component
 */
export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: TabConfig[] = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'roles', label: 'Roles', icon: '👤' },
    { id: 'skills', label: 'Skills', icon: '🛠️' },
    { id: 'slack', label: 'Slack', icon: '💬' },
  ];

  /**
   * Render the content for the active tab
   */
  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralTab />;
      case 'roles':
        return <RolesTab />;
      case 'skills':
        return <SkillsTab />;
      case 'slack':
        return <SlackTab />;
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

      <nav className="settings-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main
        className="settings-content"
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {renderTabContent()}
      </main>
    </div>
  );
};

export default Settings;
