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
    <div className="mb-6 border-b border-border-dark">
      <nav aria-label="Tabs" className="-mb-px flex space-x-8">
        <button
          onClick={() => setActiveTab('active')}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'active'
              ? 'text-primary border-primary'
              : 'text-text-secondary-dark hover:text-text-primary-dark hover:border-border-dark border-transparent'
          }`}
        >
          Active ({activeMessages.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'completed'
              ? 'text-primary border-primary'
              : 'text-text-secondary-dark hover:text-text-primary-dark hover:border-border-dark border-transparent'
          }`}
        >
          Completed ({completedMessages.length})
        </button>
      </nav>
    </div>
  );
};
