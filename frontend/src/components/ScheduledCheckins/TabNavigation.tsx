import React from 'react';
import { ActiveTab, ScheduledMessage } from './types';

interface TabNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeMessages: ScheduledMessage[];
  completedMessages: ScheduledMessage[];
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
  activeMessages,
  completedMessages
}) => {
  return (
    <div className="scheduled-messages-tabs">
      <button 
        className={`tab ${activeTab === 'active' ? 'tab--active' : ''}`}
        onClick={() => setActiveTab('active')}
      >
        Active Messages ({activeMessages.length})
      </button>
      <button 
        className={`tab ${activeTab === 'completed' ? 'tab--active' : ''}`}
        onClick={() => setActiveTab('completed')}
      >
        Completed Messages ({completedMessages.length})
      </button>
    </div>
  );
};