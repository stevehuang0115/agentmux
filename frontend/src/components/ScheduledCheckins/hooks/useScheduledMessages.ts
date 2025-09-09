import { useState, useEffect } from 'react';
import { ScheduledMessage, ScheduledMessageFormData, MessageDeliveryLog, DEFAULT_FORM_DATA } from '../types';

export const useScheduledMessages = () => {
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<MessageDeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [formData, setFormData] = useState<ScheduledMessageFormData>(DEFAULT_FORM_DATA);

  useEffect(() => {
    loadScheduledMessages();
    loadDeliveryLogs();
  }, []);

  const loadScheduledMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/scheduled-messages');
      if (response.ok) {
        const result = await response.json();
        setScheduledMessages(result.data || []);
      }
    } catch (error) {
      console.error('Error loading scheduled messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryLogs = async () => {
    try {
      const response = await fetch('/api/message-delivery-logs');
      if (response.ok) {
        const result = await response.json();
        setDeliveryLogs(result.data || []);
      }
    } catch (error) {
      console.error('Error loading delivery logs:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingMessage 
        ? `/api/scheduled-messages/${editingMessage.id}`
        : '/api/scheduled-messages';
      
      const method = editingMessage ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadScheduledMessages();
        await loadDeliveryLogs();
        handleCloseModal();
      } else {
        const error = await response.text();
        alert('Failed to save scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error saving scheduled message:', error);
      alert('Failed to save scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadScheduledMessages();
      } else {
        const error = await response.text();
        alert('Failed to delete scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      alert('Failed to delete scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/scheduled-messages/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        await loadScheduledMessages();
      } else {
        const error = await response.text();
        alert('Failed to toggle scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error toggling scheduled message:', error);
      alert('Failed to toggle scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRunNow = async (id: string, name: string) => {
    if (!window.confirm(`Run "${name}" now?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduled-messages/${id}/run`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('Scheduled message executed successfully!');
        await loadScheduledMessages();
        await loadDeliveryLogs();
      } else {
        const error = await response.text();
        alert('Failed to run scheduled message: ' + error);
      }
    } catch (error) {
      console.error('Error running scheduled message:', error);
      alert('Failed to run scheduled message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEdit = (message: ScheduledMessage) => {
    setEditingMessage(message);
    setFormData({
      name: message.name,
      targetTeam: message.targetTeam,
      targetProject: message.targetProject || '',
      message: message.message,
      delayAmount: message.delayAmount.toString(),
      delayUnit: message.delayUnit,
      isRecurring: message.isRecurring
    });
    setShowCreateModal(true);
  };

  const handleCreate = () => {
    setEditingMessage(null);
    setFormData(DEFAULT_FORM_DATA);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingMessage(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const clearDeliveryLogs = async () => {
    try {
      const response = await fetch('/api/message-delivery-logs', { method: 'DELETE' });
      if (response.ok) {
        setDeliveryLogs([]);
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return {
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
  };
};