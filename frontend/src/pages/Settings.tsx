/**
 * Settings Page
 *
 * Main settings page with tab navigation for General, Roles, Skills, and Slack sections.
 *
 * @module pages/Settings
 */

import React, { useState } from 'react';
import { Settings as SettingsIcon, User, Wrench, MessageSquare, LucideIcon } from 'lucide-react';
import { GeneralTab } from '../components/Settings/GeneralTab';
import { RolesTab } from '../components/Settings/RolesTab';
import { SkillsTab } from '../components/Settings/SkillsTab';
import { SlackTab } from '../components/Settings/SlackTab';

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
  icon: LucideIcon;
}

/**
 * Settings page with tabbed navigation for managing AgentMux configuration
 *
 * @returns Settings page component
 */
export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs: TabConfig[] = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    { id: 'roles', label: 'Roles', icon: User },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'slack', label: 'Slack', icon: MessageSquare },
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-text-secondary-dark mt-1">
          Configure AgentMux behavior and manage roles and skills
        </p>
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 border-b border-border-dark mb-6" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary-dark hover:text-text-primary-dark hover:bg-surface-dark'
            }`}
            onClick={() => setActiveTab(tab.id)}
            aria-selected={activeTab === tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <main
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
