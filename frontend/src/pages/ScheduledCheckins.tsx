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
     , AlertComponent, ConfirmComponent } = useScheduledMessages();


  // Filter messages based on active/completed status
  const activeMessages = scheduledMessages.filter(msg => msg.isActive);
  const completedMessages = scheduledMessages.filter(msg => !msg.isActive);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-3 mx-auto" />
          <p className="text-text-secondary-dark">Loading scheduled messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Scheduled Messages</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Create and manage scheduled messages for teams and projects</p>
        </div>
        <button
          className="bg-primary text-white hover:bg-primary/90 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-10 px-4 rounded-lg text-sm"
          onClick={handleCreate}
        >
          <Plus className="w-4 h-4" />
          New Scheduled Message
        </button>
      </div>

      <TabNavigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMessages={activeMessages}
        completedMessages={completedMessages}
      />

      <div>
        {activeTab === 'active' ? (
          activeMessages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
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

      {/* Global dialogs for this page */}
      <AlertComponent />
      <ConfirmComponent />
    </div>
  );
};
