import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  ScheduledMessageCard,
  TabNavigation,
  EmptyState,
  MessageForm,
  DeliveryLogsTable,
  useScheduledMessages,
  ActiveTab
} from '../components/ScheduledCheckins';

export const ScheduledCheckins: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  
  const {
    // State
    scheduledMessages,
    deliveryLogs,
    loading,
    showCreateModal,
    editingMessage,
    formData,
    setFormData,
    // Actions
    handleSubmit,
    handleDelete,
    handleToggleActive,
    handleRunNow,
    handleEdit,
    handleCreate,
    handleCloseModal,
    clearDeliveryLogs,
    // Utils
    formatDate
  } = useScheduledMessages();

  // Filter messages based on active/completed status
  const activeMessages = scheduledMessages.filter(msg => msg.isActive);
  const completedMessages = scheduledMessages.filter(msg => !msg.isActive);

  if (loading) {
    return (
      <div className="page scheduled-checkins-page">
        <div className="loading-spinner"></div>
        <p>Loading scheduled check-ins...</p>
      </div>
    );
  }

  return (
    <div className="page scheduled-checkins-page">
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Scheduled Messages</h1>
          <p className="page-description">
            Create and manage scheduled messages for teams and projects
          </p>
        </div>
        
        <button 
          className="primary-button"
          onClick={handleCreate}
        >
          <Plus className="button-icon" />
          New Scheduled Message
        </button>
      </div>

      <TabNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMessages={activeMessages}
        completedMessages={completedMessages}
      />

      <div className="scheduled-messages-content">
        {activeTab === 'active' ? (
          activeMessages.length > 0 ? (
            <div className="scheduled-messages-grid">
              {activeMessages.map((message) => (
                <ScheduledMessageCard
                  key={message.id}
                  message={message}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                  onRunNow={handleRunNow}
                  formatDate={formatDate}
                  onCardClick={handleEdit}
                />
              ))}
            </div>
          ) : (
            <EmptyState type="active" onCreateMessage={handleCreate} />
          )
        ) : (
          completedMessages.length > 0 ? (
            <div className="scheduled-messages-grid">
              {completedMessages.map((message) => (
                <ScheduledMessageCard
                  key={message.id}
                  message={message}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggleActive}
                  onRunNow={handleRunNow}
                  formatDate={formatDate}
                  onCardClick={handleEdit}
                />
              ))}
            </div>
          ) : (
            <EmptyState type="completed" />
          )
        )}
      </div>

      <DeliveryLogsTable
        deliveryLogs={deliveryLogs}
        formatDate={formatDate}
        onClearLogs={clearDeliveryLogs}
      />

      <MessageForm
        isOpen={showCreateModal}
        editingMessage={editingMessage}
        formData={formData}
        setFormData={setFormData}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
};